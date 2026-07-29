import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { runOwnerAgent } from "@/lib/agent/owner";
import { isGeminiConfigured } from "@/lib/agent/gemini";
import { sanitizeHistory } from "@/lib/agent/run";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Owner business assistant. Admin/manager only (middleware also requires a
// session; role is enforced here). Body: { messages: [{ role, text }] }.
export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (user.role !== "ADMIN" && user.role !== "MANAGER")
    return NextResponse.json({ error: "Only admins and managers can use the assistant." }, { status: 403 });

  if (!isGeminiConfigured())
    return NextResponse.json(
      { error: "Gemini isn't configured. Add GEMINI_API_KEY to the environment." },
      { status: 503 }
    );

  const body = await req.json().catch(() => ({}));
  const history = sanitizeHistory((body as { messages?: unknown })?.messages);
  if (!history.length || history[history.length - 1].role !== "user")
    return NextResponse.json({ error: "Send a message." }, { status: 400 });

  try {
    const { reply } = await runOwnerAgent(history);
    return NextResponse.json({ reply });
  } catch (e) {
    console.error("[assistant]", e);
    return NextResponse.json(
      { error: "The assistant had a problem. Please try again." },
      { status: 500 }
    );
  }
}
