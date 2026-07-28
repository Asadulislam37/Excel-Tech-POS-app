// Password hashing with Node's built-in scrypt — no native dependency, so it
// builds and runs cleanly on Netlify. Only imported from Node-runtime API routes.
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  const hashBuf = Buffer.from(hash, "hex");
  return hashBuf.length === derived.length && timingSafeEqual(hashBuf, derived);
}
