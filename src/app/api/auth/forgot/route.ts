import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { makeResetToken } from "@/lib/reset-token";
import { mailConfigured, resetEmailHtml, sendMail } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  const cleanEmail = String(email ?? "").trim().toLowerCase();

  const user = await prisma.user.findUnique({ where: { email: cleanEmail } });

  // Only real accounts get a link, but the response never reveals which
  // emails exist — always the same success message.
  if (user && user.isActive) {
    const token = makeResetToken(user.id, user.passwordHash);
    const base = req.nextUrl.origin;
    const link = `${base}/reset-password?token=${encodeURIComponent(token)}`;

    if (mailConfigured()) {
      try {
        await sendMail({ to: user.email, subject: "Reset your Excel Tech POS password", html: resetEmailHtml(user.name, link) });
      } catch (e) {
        return NextResponse.json({ error: "Could not send the email. Check the SMTP settings." , detail: e instanceof Error ? e.message : "" }, { status: 500 });
      }
    } else {
      // No mail provider yet — hand the link back so the admin isn't locked out.
      return NextResponse.json({ ok: true, devLink: link, note: "Email is not configured yet — use this link." });
    }
  }

  return NextResponse.json({ ok: true });
}
