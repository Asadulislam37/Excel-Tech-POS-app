import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Line = { id: string; code: string; name: string; type: string; debit: number; credit: number; balance: number };

/**
 * GET /api/reports/financials?report=trial-balance|pnl|balance-sheet&from=&to=&asOf=
 * All three reports are views over the same journal totals, so they share one query.
 */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const report = p.get("report") ?? "trial-balance";
  const from = p.get("from");
  const to = p.get("to");
  const asOf = p.get("asOf");

  // Balance sheet is cumulative "as of" a date; the others cover a period.
  const dateFilter =
    report === "balance-sheet"
      ? asOf ? { lte: new Date(`${asOf}T23:59:59`) } : undefined
      : from || to
        ? { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(`${to}T23:59:59`) }) }
        : undefined;

  const [accounts, sums] = await Promise.all([
    prisma.account.findMany({ orderBy: { code: "asc" } }),
    prisma.journalLine.groupBy({
      by: ["accountId"],
      where: dateFilter ? { entry: { date: dateFilter } } : {},
      _sum: { debit: true, credit: true },
    }),
  ]);
  const byId = new Map(sums.map((s) => [s.accountId, s]));

  const lines: Line[] = accounts.map((a) => {
    const s = byId.get(a.id);
    const debit = Number(s?._sum.debit ?? 0);
    const credit = Number(s?._sum.credit ?? 0);
    const isDebitNatural = a.type === "ASSET" || a.type === "EXPENSE";
    // Opening balances only belong on cumulative (balance sheet) views.
    const opening = report === "balance-sheet" ? Number(a.opening) : 0;
    return {
      id: a.id, code: a.code, name: a.name, type: a.type,
      debit, credit,
      balance: opening + (isDebitNatural ? debit - credit : credit - debit),
    };
  });

  const pick = (type: string) => lines.filter((l) => l.type === type && (l.balance !== 0 || l.debit !== 0 || l.credit !== 0));
  const sum = (rows: Line[]) => rows.reduce((t, r) => t + r.balance, 0);

  if (report === "pnl") {
    const income = pick("INCOME");
    const expense = pick("EXPENSE");
    const totalIncome = sum(income);
    const totalExpense = sum(expense);
    // COGS is tracked separately so gross margin is visible.
    const cogs = expense.filter((e) => e.code === "5000");
    const opex = expense.filter((e) => e.code !== "5000");
    const totalCogs = sum(cogs);
    return NextResponse.json({
      report, from, to,
      income, totalIncome,
      cogs, totalCogs,
      grossProfit: totalIncome - totalCogs,
      opex, totalOpex: sum(opex),
      totalExpense,
      netProfit: totalIncome - totalExpense,
    });
  }

  if (report === "balance-sheet") {
    const assets = pick("ASSET");
    const liabilities = pick("LIABILITY");
    const equity = pick("EQUITY");
    // Profit not yet distributed belongs to equity.
    const retained = sum(lines.filter((l) => l.type === "INCOME")) - sum(lines.filter((l) => l.type === "EXPENSE"));
    const totalAssets = sum(assets);
    const totalLiabilities = sum(liabilities);
    const totalEquity = sum(equity) + retained;
    return NextResponse.json({
      report, asOf,
      assets, totalAssets,
      liabilities, totalLiabilities,
      equity, retained, totalEquity,
      totalLiabilitiesAndEquity: totalLiabilities + totalEquity,
      balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
    });
  }

  // Trial balance — every account that moved, debits must equal credits.
  const rows = lines.filter((l) => l.debit !== 0 || l.credit !== 0);
  const totalDebit = rows.reduce((t, r) => t + r.debit, 0);
  const totalCredit = rows.reduce((t, r) => t + r.credit, 0);
  return NextResponse.json({
    report, from, to, rows, totalDebit, totalCredit,
    balanced: Math.abs(totalDebit - totalCredit) < 0.01,
  });
}
