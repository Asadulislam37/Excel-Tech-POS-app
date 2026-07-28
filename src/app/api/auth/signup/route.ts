import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { SESSION_COOKIE, signSession, sessionMaxAge } from "@/lib/session";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const { name, email, password } = await req.json();
  const cleanName = String(name ?? "").trim();
  const cleanEmail = String(email ?? "").trim().toLowerCase();

  if (!cleanName) return NextResponse.json({ error: "Please enter your name." }, { status: 400 });
  if (!EMAIL_RE.test(cleanEmail)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  if (String(password ?? "").length < 6)
    return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });

  const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
  if (existing) return NextResponse.json({ error: "An account with this email already exists." }, { status: 400 });

  // The very first account to register owns the shop → ADMIN.
  const isFirst = (await prisma.user.count()) === 0;

  const user = await prisma.user.create({
    data: {
      name: cleanName,
      email: cleanEmail,
      passwordHash: await hashPassword(password),
      role: isFirst ? "ADMIN" : "SALESMAN",
    },
  });

  const token = await signSession({ uid: user.id, name: user.name, role: user.role, email: user.email });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: sessionMaxAge,
  });

  return NextResponse.json({ id: user.id, name: user.name, role: user.role });
}
