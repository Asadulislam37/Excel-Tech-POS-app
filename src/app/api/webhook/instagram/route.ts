import { NextRequest, NextResponse } from "next/server";
import { checkVerifyToken, verifyInbound, sendInstagramText, fetchImageAsBase64 } from "@/lib/agent/channels/meta";
import { handleInboundMessage, handleInboundImage } from "@/lib/agent/channels/inbound";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Instagram DM events share Messenger's shape: entry[].messaging[] with a
// sender IGSID and a message (text and/or image attachments).
type IgAttachment = { type?: string; payload?: { url?: string } };
type IgEvent = {
  sender?: { id?: string };
  message?: { text?: string; mid?: string; is_echo?: boolean; attachments?: IgAttachment[] };
};
type IgBody = { object?: string; entry?: { messaging?: IgEvent[] }[] };

// GET — Meta webhook verification (shared verify token).
export function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  if (checkVerifyToken(sp.get("hub.mode"), sp.get("hub.verify_token")))
    return new NextResponse(sp.get("hub.challenge") ?? "", { status: 200 });
  return new NextResponse("Forbidden", { status: 403 });
}

// POST — incoming Instagram DM events (signature-verified).
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!verifyInbound(raw, req.headers.get("x-hub-signature-256")))
    return new NextResponse("Invalid signature", { status: 401 });

  let body: IgBody;
  try {
    body = JSON.parse(raw) as IgBody;
  } catch {
    return NextResponse.json({ ok: true });
  }
  if (body.object !== "instagram") return NextResponse.json({ ok: true });

  try {
    for (const entry of body.entry ?? []) {
      for (const ev of entry.messaging ?? []) {
        if (ev.message?.is_echo) continue;
        const igsid = ev.sender?.id;
        if (!igsid) continue;
        const mid = ev.message?.mid;
        const text = ev.message?.text;

        const imageUrl = ev.message?.attachments?.find((a) => a.type === "image")?.payload?.url;
        if (imageUrl) {
          const img = await fetchImageAsBase64(imageUrl);
          if (img) {
            await handleInboundImage({
              channel: "instagram",
              externalId: igsid,
              messageId: mid,
              base64: img.base64,
              mimeType: img.mimeType,
              caption: text,
              photoUrl: imageUrl,
              send: (t) => sendInstagramText(igsid, t),
            });
          }
          continue;
        }

        if (text) {
          await handleInboundMessage({
            channel: "instagram",
            externalId: igsid,
            messageId: mid,
            text,
            send: (t) => sendInstagramText(igsid, t),
          });
        }
      }
    }
  } catch (e) {
    console.error("[webhook/instagram]", e);
  }

  return NextResponse.json({ ok: true });
}
