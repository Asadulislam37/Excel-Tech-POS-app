import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/auth";
import { hashPassword } from "@/lib/password";

export const dynamic = "force-dynamic";

const ROLES = ["ADMIN", "MANAGER", "SALESMAN", "ACCOUNTANT"] as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function requireAdmin() {
  const me = await currentUser();
  if (!me || me.role !== "ADMIN") return null;
  return me;
}

// GET — list staff accounts (admin only)
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, phone: true, role: true, isActive: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(users);
}

// POST — create a staff account (admin only)
export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { name, email, password, role = "SALESMAN" } = await req.json();
  const cleanName = String(name ?? "").trim();
  const cleanEmail = String(email ?? "").trim().toLowerCase();

  if (!cleanName) return NextResponse.json({ error: "Name is required." }, { status: 400 });
  if (!EMAIL_RE.test(cleanEmail)) return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  if (String(password ?? "").length < 6) return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
  if (!ROLES.includes(role)) return NextResponse.json({ error: "Invalid role." }, { status: 400 });

  if (await prisma.user.findUnique({ where: { email: cleanEmail } }))
    return NextResponse.json({ error: "An account with this email already exists." }, { status: 400 });

  const user = await prisma.user.create({
    data: { name: cleanName, email: cleanEmail, passwordHash: await hashPassword(password), role },
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
  });
  return NextResponse.json(user, { status: 201 });
}

// PATCH — update role / active state / reset password (admin only)
export async function PATCH(req: NextRequest) {
  const me = await requireAdmin();
  if (!me) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { id, role, isActive, password } = await req.json();
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });

  // Don't let an admin lock themselves out or demote the last admin.
  if (id === me.uid && (isActive === false || (role && role !== "ADMIN")))
    return NextResponse.json({ error: "You can't disable or demote your own admin account." }, { status: 400 });
  if (target.role === "ADMIN" && role && role !== "ADMIN") {
    const admins = await prisma.user.count({ where: { role: "ADMIN", isActive: true } });
    if (admins <= 1) return NextResponse.json({ error: "There must be at least one active admin." }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (role && ROLES.includes(role)) data.role = role;
  if (typeof isActive === "boolean") data.isActive = isActive;
  if (password) {
    if (String(password).length < 6) return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
    data.passwordHash = await hashPassword(String(password));
  }
  const user = await prisma.user.update({
    where: { id }, data,
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
  });
  return NextResponse.json(user);
}

// DELETE — remove a staff account (admin only). Falls back to deactivate if the
// user is referenced by sales/purchases (foreign keys).
export async function DELETE(req: NextRequest) {
  const me = await requireAdmin();
  if (!me) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });
  if (id === me.uid) return NextResponse.json({ error: "You can't delete your own account." }, { status: 400 });

  try {
    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "This user has sales/records and can't be deleted. Deactivate them instead." },
      { status: 400 }
    );
  }
}
