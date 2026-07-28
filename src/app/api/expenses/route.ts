import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { METHOD_ACCOUNT, nextVoucherNo, postJournal } from "@/lib/accounting";

export const dynamic = "force-dynamic";

// GET /api/expenses?from=&to=&page=1 — expense vouchers, newest first
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const page = Math.max(1, Number(p.get("page")) || 1);
  const from = p.get("from");
  const to = p.get("to");

  const where = {
    refType: "Expense",
    ...(from || to
      ? {
          date: {
            ...(from && { gte: new Date(from) }),
            ...(to && { lte: new Date(`${to}T23:59:59`) }),
          },
        }
      : {}),
  };

  const [total, entries, agg] = await Promise.all([
    prisma.journalEntry.count({ where }),
    prisma.journalEntry.findMany({
      where,
      include: { lines: { include: { account: true } } },
      orderBy: { date: "desc" },
      skip: (page - 1) * 50,
      take: 50,
    }),
    prisma.journalLine.aggregate({
      where: { entry: where, account: { type: "EXPENSE" } },
      _sum: { debit: true },
    }),
  ]);

  return NextResponse.json({
    total,
    totalAmount: Number(agg._sum.debit ?? 0),
    rows: entries.map((e) => {
      const expenseLine = e.lines.find((l) => l.account.type === "EXPENSE");
      const payLine = e.lines.find((l) => Number(l.credit) > 0);
      return {
        id: e.id, voucherNo: e.voucherNo, date: e.date, memo: e.memo ?? "",
        category: expenseLine?.account.name ?? "—",
        paidFrom: payLine?.account.name ?? "—",
        amount: Number(expenseLine?.debit ?? 0),
      };
    }),
  });
}

// POST /api/expenses { accountCode, method, amount, memo, date }
export async function POST(req: NextRequest) {
  const { accountCode, method, amount, memo, date } = await req.json();
  const amt = Number(amount);
  if (!accountCode) return NextResponse.json({ error: "Choose an expense head." }, { status: 400 });
  if (!Number.isFinite(amt) || amt <= 0)
    return NextResponse.json({ error: "Amount must be greater than zero." }, { status: 400 });

  const payCode = METHOD_ACCOUNT[method] ?? METHOD_ACCOUNT.CASH;

  try {
    const entry = await prisma.$transaction(async (tx) => {
      const voucherNo = await nextVoucherNo(tx, "EXP");
      return postJournal(tx, {
        voucherNo,
        memo: memo || undefined,
        refType: "Expense",
        date: date ? new Date(date) : undefined,
        lines: [
          { code: accountCode, debit: amt },  // expense up
          { code: payCode, credit: amt },     // cash/bKash down
        ],
      });
    });
    return NextResponse.json(entry, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not save voucher." }, { status: 400 });
  }
}
