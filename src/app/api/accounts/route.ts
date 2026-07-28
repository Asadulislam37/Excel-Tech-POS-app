import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AccountType } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

// GET /api/accounts?type=EXPENSE  → chart of accounts with current balances
export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type") ?? "";
  const accounts = await prisma.account.findMany({
    where: type ? { type: type as AccountType } : {},
    orderBy: { code: "asc" },
  });
  const sums = await prisma.journalLine.groupBy({
    by: ["accountId"],
    _sum: { debit: true, credit: true },
  });
  const byId = new Map(sums.map((s) => [s.accountId, s]));

  return NextResponse.json(
    accounts.map((a) => {
      const s = byId.get(a.id);
      const debit = Number(s?._sum.debit ?? 0);
      const credit = Number(s?._sum.credit ?? 0);
      // Assets/expenses grow on the debit side; the rest grow on the credit side.
      const natural = a.type === "ASSET" || a.type === "EXPENSE" ? debit - credit : credit - debit;
      return {
        id: a.id, code: a.code, name: a.name, type: a.type, isSystem: a.isSystem,
        debit, credit, balance: Number(a.opening) + natural,
      };
    })
  );
}

// POST /api/accounts { code, name, type }
export async function POST(req: NextRequest) {
  const { code, name, type } = await req.json();
  if (!String(code ?? "").trim() || !String(name ?? "").trim())
    return NextResponse.json({ error: "Code and name are required." }, { status: 400 });
  try {
    const account = await prisma.account.create({
      data: { code: String(code).trim(), name: String(name).trim(), type: type as AccountType },
    });
    return NextResponse.json(account, { status: 201 });
  } catch {
    return NextResponse.json({ error: "That account code already exists." }, { status: 400 });
  }
}
