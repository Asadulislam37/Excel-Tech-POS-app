// Meta (Facebook Messenger + WhatsApp Cloud API) helpers: webhook verification,
// payload signature checking, and sending replies via the Graph API.
import crypto from "node:crypto";

const GRAPH = `https://graph.facebook.com/${process.env.META_GRAPH_VERSION || "v21.0"}`;

// GET webhook verification handshake (Meta calls this when you save the webhook).
export function checkVerifyToken(mode: string | null, token: string | null): boolean {
  return mode === "subscribe" && !!token && token === process.env.META_VERIFY_TOKEN;
}

// Verify the X-Hub-Signature-256 header so we only act on payloads from Meta.
export function verifyMetaSignature(rawBody: string, header: string | null): boolean {
  const secret = process.env.META_APP_SECRET;
  if (!secret || !header || !header.startsWith("sha256=")) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Gate for inbound webhooks. Enforces the signature when META_APP_SECRET is set;
// if it isn't configured yet, allows the request but warns (so Messenger can be
// tested before the App Secret is added). Set META_APP_SECRET for production.
export function verifyInbound(rawBody: string, header: string | null): boolean {
  if (!process.env.META_APP_SECRET) {
    console.warn("[meta] META_APP_SECRET not set — skipping webhook signature check (INSECURE; set it soon)");
    return true;
  }
  return verifyMetaSignature(rawBody, header);
}

// Messenger allows ~2000 chars/message; WhatsApp ~4096. Keep replies safely under.
const clip = (text: string, max: number) => (text.length > max ? text.slice(0, max - 1) + "…" : text);

export async function sendMessengerText(psid: string, text: string): Promise<void> {
  const token = process.env.MESSENGER_PAGE_TOKEN;
  if (!token) return void console.error("[messenger] MESSENGER_PAGE_TOKEN not set");
  const res = await fetch(`${GRAPH}/me/messages?access_token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: psid },
      messaging_type: "RESPONSE",
      message: { text: clip(text, 1900) },
    }),
  });
  if (!res.ok) console.error("[messenger] send failed", res.status, await res.text().catch(() => ""));
}

// Fetch an image and return it base64-encoded for Gemini vision. Caps size.
export async function fetchImageAsBase64(
  url: string,
  authHeader?: string
): Promise<{ base64: string; mimeType: string } | null> {
  try {
    const res = await fetch(url, authHeader ? { headers: { Authorization: authHeader } } : undefined);
    if (!res.ok) {
      console.error("[meta] image fetch failed", res.status);
      return null;
    }
    const mimeType = (res.headers.get("content-type") || "image/jpeg").split(";")[0];
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 6_000_000) {
      console.error("[meta] image too large", buf.length);
      return null;
    }
    return { base64: buf.toString("base64"), mimeType };
  } catch (e) {
    console.error("[meta] image fetch error", e);
    return null;
  }
}

// WhatsApp media arrives as an id; resolve it to a (token-authenticated) URL.
export async function fetchWhatsAppMedia(mediaId: string): Promise<{ base64: string; mimeType: string } | null> {
  const token = process.env.WHATSAPP_TOKEN;
  if (!token) return null;
  try {
    const meta = await fetch(`${GRAPH}/${mediaId}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!meta.ok) return null;
    const j = (await meta.json()) as { url?: string };
    if (!j.url) return null;
    return fetchImageAsBase64(j.url, `Bearer ${token}`);
  } catch (e) {
    console.error("[whatsapp] media fetch error", e);
    return null;
  }
}

export async function sendWhatsAppText(to: string, text: string): Promise<void> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) return void console.error("[whatsapp] WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID not set");
  const res = await fetch(`${GRAPH}/${phoneId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      text: { body: clip(text, 4000) },
    }),
  });
  if (!res.ok) console.error("[whatsapp] send failed", res.status, await res.text().catch(() => ""));
}
