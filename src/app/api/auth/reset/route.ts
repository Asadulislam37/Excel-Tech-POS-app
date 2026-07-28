import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { peekUid, verifyResetToken } from "@/lib/reset-token";
import { SESSION_COOKIE, signSession, sessionMaxAge } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { token, password } = await req.json();
  if (String(password ?? "").length < 6)
    return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });

  const uid = peekUid(String(token ?? ""));
  const user = uid ? await prisma.user.findUnique({ where: { id: uid } }) : null;
  // Verifying against the current hash makes the link single-use.
  if (!user || !verifyResetToken(String(token), user.passwordHash))
    return NextResponse.json({ error: "This reset link is invalid or has expired. Request a new one." }, { status: 400 });

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(password) },
  });

  // Sign them straight in with the new password.
  const session = await signSession({ uid: updated.id, name: updated.name, role: updated.role, email: updated.email });
  (await cookies()).set(SESSION_COOKIE, session, {
    httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: sessionMaxAge,
  });

  return NextResponse.json({ ok: true, name: updated.name });
}
