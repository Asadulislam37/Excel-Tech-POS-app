import { NextRequest, NextResponse } from "next/server";
import { checkVerifyToken, verifyInbound, sendWhatsAppText } from "@/lib/agent/channels/meta";
import { handleInboundMessage } from "@/lib/agent/channels/inbound";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

type WaMessage = { from?: string; id?: string; type?: string; text?: { body?: string } };
type WaChange = { value?: { messages?: WaMessage[] } };
type WaBody = { object?: string; entry?: { changes?: WaChange[] }[] };

// GET — Meta's webhook verification handshake (shared verify token).
export function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  if (checkVerifyToken(sp.get("hub.mode"), sp.get("hub.verify_token")))
    return new NextResponse(sp.get("hub.challenge") ?? "", { status: 200 });
  return new NextResponse("Forbidden", { status: 403 });
}

// POST — incoming WhatsApp Cloud API events (signature-verified).
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!verifyInbound(raw, req.headers.get("x-hub-signature-256")))
    return new NextResponse("Invalid signature", { status: 401 });

  let body: WaBody;
  try {
    body = JSON.parse(raw) as WaBody;
  } catch {
    return NextResponse.json({ ok: true });
  }
  if (body.object !== "whatsapp_business_account") return NextResponse.json({ ok: true });

  try {
    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        // change.value also carries `statuses` (delivery receipts) — we ignore those.
        for (const msg of change.value?.messages ?? []) {
          const from = msg.from;
          const text = msg.type === "text" ? msg.text?.body : undefined;
          if (from && text) {
            await handleInboundMessage({
              channel: "whatsapp",
              externalId: from,
              messageId: msg.id,
              text,
              send: (t) => sendWhatsAppText(from, t),
            });
          }
        }
      }
    }
  } catch (e) {
    console.error("[webhook/whatsapp]", e);
  }

  return NextResponse.json({ ok: true });
}
