import { NextRequest, NextResponse } from "next/server";
import { checkVerifyToken, verifyMetaSignature, sendMessengerText } from "@/lib/agent/channels/meta";
import { handleInboundMessage } from "@/lib/agent/channels/inbound";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

type MessengerEvent = {
  sender?: { id?: string };
  message?: { text?: string; mid?: string; is_echo?: boolean };
};
type MessengerBody = { object?: string; entry?: { messaging?: MessengerEvent[] }[] };

// GET — Meta's webhook verification handshake.
export function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  if (checkVerifyToken(sp.get("hub.mode"), sp.get("hub.verify_token")))
    return new NextResponse(sp.get("hub.challenge") ?? "", { status: 200 });
  return new NextResponse("Forbidden", { status: 403 });
}

// POST — incoming Messenger events (signature-verified).
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!verifyMetaSignature(raw, req.headers.get("x-hub-signature-256")))
    return new NextResponse("Invalid signature", { status: 401 });

  let body: MessengerBody;
  try {
    body = JSON.parse(raw) as MessengerBody;
  } catch {
    return NextResponse.json({ ok: true });
  }
  if (body.object !== "page") return NextResponse.json({ ok: true });

  try {
    for (const entry of body.entry ?? []) {
      for (const ev of entry.messaging ?? []) {
        if (ev.message?.is_echo) continue; // ignore the page's own outgoing messages
        const psid = ev.sender?.id;
        const text = ev.message?.text;
        if (psid && text) {
          await handleInboundMessage({
            channel: "messenger",
            externalId: psid,
            messageId: ev.message?.mid,
            text,
            send: (t) => sendMessengerText(psid, t),
          });
        }
      }
    }
  } catch (e) {
    console.error("[webhook/messenger]", e);
  }

  // Always 200 so Meta doesn't retry (which would double-send replies).
  return NextResponse.json({ ok: true });
}
