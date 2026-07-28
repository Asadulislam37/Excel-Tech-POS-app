import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET → all accounts with their opening balances, plus a balanced check.
export async function GET() {
  const accounts = await prisma.account.findMany({ orderBy: { code: "asc" } });
  const rows = accounts.map((a) => ({ id: a.id, code: a.code, name: a.name, type: a.type, opening: Number(a.opening) }));
  // Opening balances balance when debit-natural openings equal credit-natural openings.
  const debit = rows.filter((r) => r.type === "ASSET" || r.type === "EXPENSE").reduce((s, r) => s + r.opening, 0);
  const credit = rows.filter((r) => r.type !== "ASSET" && r.type !== "EXPENSE").reduce((s, r) => s + r.opening, 0);
  return NextResponse.json({ rows, totalDebit: debit, totalCredit: credit, balanced: Math.abs(debit - credit) < 0.01 });
}

// POST { id, opening } → set one account's opening balance.
export async function POST(req: NextRequest) {
  const { id, opening } = await req.json();
  if (!id) return NextResponse.json({ error: "Account id is required." }, { status: 400 });
  const account = await prisma.account.update({ where: { id }, data: { opening: Number(opening) || 0 } });
  return NextResponse.json(account);
}
