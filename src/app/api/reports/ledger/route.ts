import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/reports/ledger?accountId=&from=&to=  → running-balance ledger for one account
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const accountId = p.get("accountId") ?? "";
  const from = p.get("from");
  const to = p.get("to");
  if (!accountId) return NextResponse.json({ error: "accountId is required." }, { status: 400 });

  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  const isDebitNatural = account.type === "ASSET" || account.type === "EXPENSE";
  const dateFilter = {
    ...(from && { gte: new Date(from) }),
    ...(to && { lte: new Date(`${to}T23:59:59`) }),
  };

  // Everything before the range becomes the opening balance.
  const priorAgg = from
    ? await prisma.journalLine.aggregate({
        where: { accountId, entry: { date: { lt: new Date(from) } } },
        _sum: { debit: true, credit: true },
      })
    : null;
  const priorDebit = Number(priorAgg?._sum.debit ?? 0);
  const priorCredit = Number(priorAgg?._sum.credit ?? 0);
  let running =
    Number(account.opening) + (isDebitNatural ? priorDebit - priorCredit : priorCredit - priorDebit);
  const opening = running;

  const lines = await prisma.journalLine.findMany({
    where: { accountId, ...(from || to ? { entry: { date: dateFilter } } : {}) },
    include: { entry: true },
    orderBy: [{ entry: { date: "asc" } }, { id: "asc" }],
    take: 500,
  });

  const rows = lines.map((l) => {
    const debit = Number(l.debit);
    const credit = Number(l.credit);
    running += isDebitNatural ? debit - credit : credit - debit;
    return {
      id: l.id, date: l.entry.date, voucherNo: l.entry.voucherNo,
      memo: l.entry.memo ?? "", refType: l.entry.refType ?? "",
      debit, credit, balance: running,
    };
  });

  return NextResponse.json({
    account: { id: account.id, code: account.code, name: account.name, type: account.type },
    opening,
    closing: running,
    totalDebit: rows.reduce((s, r) => s + r.debit, 0),
    totalCredit: rows.reduce((s, r) => s + r.credit, 0),
    rows,
  });
}
