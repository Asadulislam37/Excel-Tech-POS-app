import { NextRequest, NextResponse } from "next/server";
import { runCustomerAgent } from "@/lib/agent/customer";
import { isGeminiConfigured } from "@/lib/agent/gemini";
import { sanitizeHistory } from "@/lib/agent/run";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Public storefront chat. Body: { messages: [{ role: "user"|"model", text }] }.
// Stateless — the client sends the running history each turn. This same agent
// core will back the Facebook Messenger / WhatsApp channels.
export async function POST(req: NextRequest) {
  if (!isGeminiConfigured())
    return NextResponse.json(
      { error: "The assistant isn't set up yet. Please contact the shop directly." },
      { status: 503 }
    );

  const body = await req.json().catch(() => ({}));
  const history = sanitizeHistory((body as { messages?: unknown })?.messages);
  if (!history.length || history[history.length - 1].role !== "user")
    return NextResponse.json({ error: "Send a message." }, { status: 400 });

  try {
    const { reply } = await runCustomerAgent(history);
    return NextResponse.json({ reply });
  } catch (e) {
    console.error("[shop/agent]", e);
    return NextResponse.json(
      { error: "The assistant had a problem. Please try again in a moment." },
      { status: 500 }
    );
  }
}
