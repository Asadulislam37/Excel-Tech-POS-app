// The agent loop: run Gemini with a set of tools until it produces a final
// text reply. Gemini has no built-in "tool runner", so we drive the
// function-call → execute → feed-back cycle ourselves.
import { FunctionCallingConfigMode, type Content, type FunctionDeclaration } from "@google/genai";
import { gemini } from "@/lib/agent/gemini";

// A tool = its Gemini declaration + a server-side executor.
export type AgentTool = {
  declaration: FunctionDeclaration;
  run: (args: Record<string, unknown>) => Promise<unknown> | unknown;
};

// A single chat turn as stored/sent by callers (plain text only).
export type ChatTurn = { role: "user" | "model"; text: string };

export type RunResult = { reply: string; toolCalls: string[] };

/** Validate + clamp untrusted chat history from a request body. */
export function sanitizeHistory(raw: unknown, maxTurns = 16, maxChars = 2000): ChatTurn[] {
  if (!Array.isArray(raw)) return [];
  const out: ChatTurn[] = [];
  for (const m of raw) {
    if (m && typeof m === "object") {
      const role = (m as { role?: unknown }).role;
      const text = (m as { text?: unknown }).text;
      if ((role === "user" || role === "model") && typeof text === "string" && text.trim()) {
        out.push({ role, text: text.slice(0, maxChars) });
      }
    }
  }
  return out.slice(-maxTurns);
}

// Gemini requires a functionResponse `response` to be a JSON object. Keep an
// { error: ... } or object result at top level; wrap scalars/arrays under `output`.
function asResponseObject(out: unknown): Record<string, unknown> {
  if (out && typeof out === "object" && !Array.isArray(out)) return out as Record<string, unknown>;
  return { output: out };
}

export async function runAgent(opts: {
  model: string;
  systemInstruction: string;
  tools: AgentTool[];
  history: ChatTurn[];
  maxSteps?: number;
}): Promise<RunResult> {
  const { model, systemInstruction, tools, history, maxSteps = 6 } = opts;
  const ai = gemini();

  const contents: Content[] = history.map((t) => ({
    role: t.role,
    parts: [{ text: t.text }],
  }));

  const functionDeclarations = tools.map((t) => t.declaration);
  const toolCalls: string[] = [];

  for (let step = 0; step < maxSteps; step++) {
    const res = await ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction,
        temperature: 0.4,
        maxOutputTokens: 1024,
        ...(functionDeclarations.length
          ? {
              tools: [{ functionDeclarations }],
              toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO } },
            }
          : {}),
      },
    });

    const calls = res.functionCalls;
    if (!calls || calls.length === 0) {
      return { reply: (res.text ?? "").trim() || "Sorry, I didn't catch that. Could you rephrase?", toolCalls };
    }

    // Record the model's tool-call turn verbatim (needed for the follow-up).
    const modelContent = res.candidates?.[0]?.content;
    if (modelContent) contents.push(modelContent);

    // Execute every requested call and return all results in ONE user turn.
    const responseParts: Content["parts"] = [];
    for (const fc of calls) {
      const name = fc.name ?? "";
      toolCalls.push(name);
      const tool = tools.find((t) => t.declaration.name === name);
      let out: unknown;
      try {
        out = tool
          ? await tool.run((fc.args as Record<string, unknown>) ?? {})
          : { error: `Unknown tool: ${name}` };
      } catch (e) {
        out = { error: e instanceof Error ? e.message : "Tool failed." };
      }
      responseParts!.push({
        functionResponse: { name, response: asResponseObject(out) },
      });
    }
    contents.push({ role: "user", parts: responseParts });
  }

  // Ran out of steps without a plain-text answer.
  return {
    reply: "Sorry, I couldn't complete that just now. Please try again, or ask to speak with a person.",
    toolCalls,
  };
}
