import { NextRequest, NextResponse } from "next/server";
import { runCustomerAgent } from "@/lib/agent/customer";
import { isGeminiConfigured } from "@/lib/agent/gemini";
import { sanitizeHistory } from "@/lib/agent/run";
import { corsHeaders } from "@/lib/cors";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// CORS preflight — the exceltech.com.bd chat widget calls this cross-origin.
export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

// Public storefront chat. Body: { messages: [{ role: "user"|"model", text }] }.
// Stateless — the client sends the running history each turn. This same agent
// core backs the storefront widget, the exceltech.com.bd embed, and the
// Facebook Messenger / WhatsApp / Instagram channels.
export async function POST(req: NextRequest) {
  if (!isGeminiConfigured())
    return NextResponse.json(
      { error: "The assistant isn't set up yet. Please contact the shop directly." },
      { status: 503, headers: corsHeaders }
    );

  const body = await req.json().catch(() => ({}));
  const history = sanitizeHistory((body as { messages?: unknown })?.messages);
  if (!history.length || history[history.length - 1].role !== "user")
    return NextResponse.json({ error: "Send a message." }, { status: 400, headers: corsHeaders });

  try {
    const { reply } = await runCustomerAgent(history);
    return NextResponse.json({ reply }, { headers: corsHeaders });
  } catch (e) {
    console.error("[shop/agent]", e);
    return NextResponse.json(
      { error: "The assistant had a problem. Please try again in a moment." },
      { status: 500, headers: corsHeaders }
    );
  }
}
