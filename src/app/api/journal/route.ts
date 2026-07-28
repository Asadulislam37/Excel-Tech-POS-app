import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

// GET /api/journal?q=&date=&page=1 → all journal vouchers with their debit/credit lines
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const q = p.get("q")?.trim() ?? "";
  const date = p.get("date") ?? "";
  const page = Math.max(1, Number(p.get("page")) || 1);

  const where: Prisma.JournalEntryWhereInput = {
    ...(date && { date: { gte: new Date(date), lte: new Date(`${date}T23:59:59`) } }),
    ...(q && {
      OR: [
        { voucherNo: { contains: q, mode: "insensitive" as const } },
        { memo: { contains: q, mode: "insensitive" as const } },
        { refType: { contains: q, mode: "insensitive" as const } },
      ],
    }),
  };

  const [total, rows] = await Promise.all([
    prisma.journalEntry.count({ where }),
    prisma.journalEntry.findMany({
      where,
      include: { lines: { include: { account: true } } },
      orderBy: { date: "desc" },
      skip: (page - 1) * 50,
      take: 50,
    }),
  ]);

  return NextResponse.json({
    total,
    rows: rows.map((e) => ({
      id: e.id, voucherNo: e.voucherNo, date: e.date, memo: e.memo ?? "", refType: e.refType ?? "",
      amount: e.lines.reduce((s, l) => s + Number(l.debit), 0),
      lines: e.lines.map((l) => ({ code: l.account.code, name: l.account.name, debit: Number(l.debit), credit: Number(l.credit) })),
    })),
  });
}

type Line = { code: string; debit?: number; credit?: number };

// POST /api/journal — manual journal voucher { date?, memo, lines: [{ code, debit, credit }] }
export async function POST(req: NextRequest) {
  const { date, memo, lines } = await req.json() as { date?: string; memo?: string; lines: Line[] };
  const valid = (lines ?? []).filter((l) => l.code && (Number(l.debit) > 0 || Number(l.credit) > 0));
  if (valid.length < 2) return NextResponse.json({ error: "A journal needs at least two lines." }, { status: 400 });

  const totalDebit = valid.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCredit = valid.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  if (Math.abs(totalDebit - totalCredit) > 0.009)
    return NextResponse.json({ error: `Debit (${totalDebit}) must equal credit (${totalCredit}).` }, { status: 400 });

  try {
    const entry = await prisma.$transaction(async (tx) => {
      const ymd = new Date().toISOString().slice(2, 10).replace(/-/g, "");
      const count = await tx.journalEntry.count({ where: { voucherNo: { startsWith: `JV-${ymd}` } } });
      const voucherNo = `JV-${ymd}-${String(count + 1).padStart(4, "0")}`;

      const codes = [...new Set(valid.map((l) => l.code))];
      const accounts = await tx.account.findMany({ where: { code: { in: codes } } });
      const byCode = new Map(accounts.map((a) => [a.code, a.id]));
      const missing = codes.filter((c) => !byCode.has(c));
      if (missing.length) throw new Error(`Unknown account code(s): ${missing.join(", ")}`);

      return tx.journalEntry.create({
        data: {
          voucherNo, memo: memo || undefined, refType: "Manual",
          ...(date && { date: new Date(date) }),
          lines: { create: valid.map((l) => ({ accountId: byCode.get(l.code)!, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0 })) },
        },
      });
    });
    return NextResponse.json(entry, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not post the journal." }, { status: 400 });
  }
}
