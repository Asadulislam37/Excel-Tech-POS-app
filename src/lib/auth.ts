import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

// The signed-in user for the current request, or null. Server-only.
export async function currentUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySession(token);
}
