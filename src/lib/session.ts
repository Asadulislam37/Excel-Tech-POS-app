// Stateless signed-session tokens using Web Crypto (HMAC-SHA256).
// Web Crypto works in both the Node runtime (API routes) and the Edge
// runtime (middleware), so this one module covers everything.

export type SessionPayload = { uid: string; name: string; role: string; email: string };

const enc = new TextEncoder();
const dec = new TextDecoder();

const b64url = (bytes: ArrayBuffer | Uint8Array) => {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const fromB64url = (str: string) => {
  const s = str.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(s + "=".repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

async function key() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set.");
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

const SESSION_DAYS = 30;

export async function signSession(payload: SessionPayload): Promise<string> {
  const body = { ...payload, exp: Date.now() + SESSION_DAYS * 86400_000 };
  const data = b64url(enc.encode(JSON.stringify(body)));
  const sig = await crypto.subtle.sign("HMAC", await key(), enc.encode(data));
  return `${data}.${b64url(sig)}`;
}

export async function verifySession(token: string | undefined): Promise<(SessionPayload & { exp: number }) | null> {
  if (!token || !token.includes(".")) return null;
  const [data, sig] = token.split(".");
  try {
    const ok = await crypto.subtle.verify("HMAC", await key(), fromB64url(sig), enc.encode(data));
    if (!ok) return null;
    const body = JSON.parse(dec.decode(fromB64url(data)));
    if (!body.exp || body.exp < Date.now()) return null;
    return body;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = "et_session";
export const sessionMaxAge = SESSION_DAYS * 86400;
