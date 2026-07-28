import { Prisma } from "@/generated/prisma/client";

// Payment method → the asset account money actually lands in.
export const METHOD_ACCOUNT: Record<string, string> = {
  CASH: "1000", BKASH: "1010", NAGAD: "1020", ROCKET: "1030", CARD: "1040", BANK: "1040",
};

export const ACC = {
  RECEIVABLE: "1100",
  INVENTORY: "1200",
  PAYABLE: "2000",
  SALES: "4000",
  COGS: "5000",
} as const;

type Tx = Prisma.TransactionClient;

/** Next voucher number for a prefix, e.g. EXP-260728-0001 */
export async function nextVoucherNo(tx: Tx, prefix: string) {
  const now = new Date();
  const ymd = now.toISOString().slice(2, 10).replace(/-/g, "");
  const from = new Date(now.toDateString());
  const count = await tx.journalEntry.count({
    where: { voucherNo: { startsWith: `${prefix}-${ymd}` }, createdAt: { gte: from } },
  });
  return `${prefix}-${ymd}-${String(count + 1).padStart(4, "0")}`;
}

/**
 * Post a balanced double-entry journal.
 * `lines` are given by account code so callers don't need to look ids up.
 */
export async function postJournal(
  tx: Tx,
  opts: {
    voucherNo: string;
    memo?: string;
    refType?: string;
    refId?: string;
    date?: Date;
    lines: { code: string; debit?: number; credit?: number }[];
  }
) {
  const totalDebit = opts.lines.reduce((s, l) => s + (l.debit ?? 0), 0);
  const totalCredit = opts.lines.reduce((s, l) => s + (l.credit ?? 0), 0);
  if (Math.abs(totalDebit - totalCredit) > 0.009)
    throw new Error(`Journal not balanced: debit ${totalDebit} vs credit ${totalCredit}.`);

  const codes = [...new Set(opts.lines.map((l) => l.code))];
  const accounts = await tx.account.findMany({ where: { code: { in: codes } } });
  const byCode = new Map(accounts.map((a) => [a.code, a.id]));
  const missing = codes.filter((c) => !byCode.has(c));
  if (missing.length)
    throw new Error(`Missing account(s) ${missing.join(", ")} — run the chart-of-accounts seed.`);

  return tx.journalEntry.create({
    data: {
      voucherNo: opts.voucherNo,
      memo: opts.memo,
      refType: opts.refType,
      refId: opts.refId,
      ...(opts.date && { date: opts.date }),
      lines: {
        create: opts.lines.map((l) => ({
          accountId: byCode.get(l.code)!,
          debit: l.debit ?? 0,
          credit: l.credit ?? 0,
        })),
      },
    },
    include: { lines: true },
  });
}
