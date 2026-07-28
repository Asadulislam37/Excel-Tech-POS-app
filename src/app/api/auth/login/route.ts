import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { SESSION_COOKIE, signSession, sessionMaxAge } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  const cleanEmail = String(email ?? "").trim().toLowerCase();

  const user = await prisma.user.findUnique({ where: { email: cleanEmail } });
  // Same message whether the email is unknown or the password is wrong.
  if (!user || !(await verifyPassword(String(password ?? ""), user.passwordHash)))
    return NextResponse.json({ error: "Wrong email or password." }, { status: 401 });
  if (!user.isActive)
    return NextResponse.json({ error: "This account is disabled. Contact the admin." }, { status: 403 });

  const token = await signSession({ uid: user.id, name: user.name, role: user.role, email: user.email });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: sessionMaxAge,
  });

  return NextResponse.json({ id: user.id, name: user.name, role: user.role });
}
