import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { METHOD_ACCOUNT } from "@/lib/accounting";

export const dynamic = "force-dynamic";

const CASH_CODES = [...new Set(Object.values(METHOD_ACCOUNT))];

// GET /api/reports/daily?from=&to=  → cash/bank movement + trading summary for the period
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const from = p.get("from") || today;
  const to = p.get("to") || today;
  const gte = new Date(from);
  const lte = new Date(`${to}T23:59:59`);

  const [cashAccounts, sales, payments, expenseLines, supplierPays] = await Promise.all([
    prisma.account.findMany({ where: { code: { in: CASH_CODES } }, orderBy: { code: "asc" } }),
    prisma.sale.aggregate({
      where: { createdAt: { gte, lte } },
      _sum: { grandTotal: true, dueTotal: true }, _count: true,
    }),
    prisma.payment.groupBy({
      by: ["method"],
      where: { createdAt: { gte, lte } },
      _sum: { amount: true },
    }),
    prisma.journalLine.findMany({
      where: { account: { type: "EXPENSE" }, entry: { date: { gte, lte } } },
      include: { account: true, entry: true },
    }),
    prisma.supplierPayment.aggregate({ where: { createdAt: { gte, lte } }, _sum: { amount: true } }),
  ]);

  // Cash/bank in & out per account from the journal.
  const movement = await Promise.all(
    cashAccounts.map(async (a) => {
      const agg = await prisma.journalLine.aggregate({
        where: { accountId: a.id, entry: { date: { gte, lte } } },
        _sum: { debit: true, credit: true },
      });
      return {
        code: a.code, name: a.name,
        in: Number(agg._sum.debit ?? 0),
        out: Number(agg._sum.credit ?? 0),
      };
    })
  );

  // Expenses grouped by head.
  const byHead = new Map<string, number>();
  for (const l of expenseLines) {
    const amt = Number(l.debit) - Number(l.credit);
    byHead.set(l.account.name, (byHead.get(l.account.name) ?? 0) + amt);
  }

  const collected = payments.reduce((s, r) => s + Number(r._sum.amount ?? 0), 0);
  const expenseTotal = [...byHead.values()].reduce((s, v) => s + v, 0);

  return NextResponse.json({
    from, to,
    sales: {
      invoices: sales._count,
      total: Number(sales._sum.grandTotal ?? 0),
      due: Number(sales._sum.dueTotal ?? 0),
    },
    collected,
    collectedByMethod: payments.map((r) => ({ method: r.method, amount: Number(r._sum.amount ?? 0) })),
    expenseTotal,
    expensesByHead: [...byHead.entries()].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount),
    supplierPaid: Number(supplierPays._sum.amount ?? 0),
    movement,
    cashIn: movement.reduce((s, m) => s + m.in, 0),
    cashOut: movement.reduce((s, m) => s + m.out, 0),
  });
}
