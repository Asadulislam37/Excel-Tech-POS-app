import { createHmac, timingSafeEqual } from "crypto";

// Password-reset tokens are stateless and single-use without a DB table:
// they are signed with a key derived from AUTH_SECRET + the user's CURRENT
// password hash. The moment the password changes, the old token stops
// verifying — so a reset link works exactly once.

const b64url = (b: Buffer) => b.toString("base64url");

function sign(data: string, passwordHash: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set.");
  return createHmac("sha256", secret + passwordHash).update(data).digest();
}

const RESET_MINUTES = 60;

export function makeResetToken(uid: string, passwordHash: string): string {
  const body = { uid, exp: Date.now() + RESET_MINUTES * 60_000 };
  const data = b64url(Buffer.from(JSON.stringify(body)));
  return `${data}.${b64url(sign(data, passwordHash))}`;
}

/** Returns the uid if the token is valid for this user, else null. */
export function verifyResetToken(token: string, passwordHash: string): string | null {
  if (!token || !token.includes(".")) return null;
  const [data, sig] = token.split(".");
  try {
    const expected = sign(data, passwordHash);
    const given = Buffer.from(sig, "base64url");
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
    const body = JSON.parse(Buffer.from(data, "base64url").toString());
    if (!body.exp || body.exp < Date.now()) return null;
    return body.uid as string;
  } catch {
    return null;
  }
}

// The uid is needed to look the user up before we can verify the signature.
export function peekUid(token: string): string | null {
  try {
    return JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString()).uid ?? null;
  } catch {
    return null;
  }
}
