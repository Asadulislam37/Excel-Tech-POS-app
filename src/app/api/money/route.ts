import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { nextVoucherNo, postJournal } from "@/lib/accounting";

export const dynamic = "force-dynamic";

const EQUITY = "3000"; // Owner's Equity — the contra for money added/withdrawn.

// GET /api/money?kind=transfer|adjustment → recent entries of that kind
export async function GET(req: NextRequest) {
  const kind = req.nextUrl.searchParams.get("kind") ?? "transfer";
  const refType = kind === "adjustment" ? "MoneyAdjustment" : "MoneyTransfer";
  const rows = await prisma.journalEntry.findMany({
    where: { refType },
    include: { lines: { include: { account: true } } },
    orderBy: { date: "desc" },
    take: 100,
  });
  return NextResponse.json({
    rows: rows.map((e) => {
      const debit = e.lines.find((l) => Number(l.debit) > 0);
      const credit = e.lines.find((l) => Number(l.credit) > 0);
      return {
        id: e.id, voucherNo: e.voucherNo, date: e.date, memo: e.memo ?? "",
        amount: e.lines.reduce((s, l) => s + Number(l.debit), 0),
        toAccount: debit?.account.name ?? "", fromAccount: credit?.account.name ?? "",
      };
    }),
  });
}

// POST /api/money
//   transfer:   { kind:"transfer", fromCode, toCode, amount, memo }
//   adjustment: { kind:"adjustment", direction:"ADD"|"WITHDRAW", accountCode, amount, memo }
export async function POST(req: NextRequest) {
  const body = await req.json();
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0)
    return NextResponse.json({ error: "Amount must be greater than zero." }, { status: 400 });

  try {
    if (body.kind === "adjustment") {
      const { direction, accountCode, memo } = body;
      if (!accountCode) return NextResponse.json({ error: "Choose an account." }, { status: 400 });
      const entry = await prisma.$transaction(async (tx) => {
        const voucherNo = await nextVoucherNo(tx, "ADJ");
        // Add money  → cash up (debit account), equity up (credit 3000)
        // Withdraw    → cash down (credit account), equity down (debit 3000)
        const lines = direction === "WITHDRAW"
          ? [{ code: EQUITY, debit: amount }, { code: accountCode, credit: amount }]
          : [{ code: accountCode, debit: amount }, { code: EQUITY, credit: amount }];
        return postJournal(tx, { voucherNo, memo: memo || `Money ${direction === "WITHDRAW" ? "withdrawn" : "added"}`, refType: "MoneyAdjustment", lines });
      });
      return NextResponse.json(entry, { status: 201 });
    }

    // transfer between two accounts
    const { fromCode, toCode, memo } = body;
    if (!fromCode || !toCode) return NextResponse.json({ error: "Choose both accounts." }, { status: 400 });
    if (fromCode === toCode) return NextResponse.json({ error: "From and To accounts must differ." }, { status: 400 });
    const entry = await prisma.$transaction(async (tx) => {
      const voucherNo = await nextVoucherNo(tx, "TRF");
      return postJournal(tx, {
        voucherNo, memo: memo || "Money transfer", refType: "MoneyTransfer",
        lines: [{ code: toCode, debit: amount }, { code: fromCode, credit: amount }],
      });
    });
    return NextResponse.json(entry, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed." }, { status: 400 });
  }
}
