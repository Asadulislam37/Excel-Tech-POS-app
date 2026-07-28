import { Prisma } from "@/generated/prisma/client";
import { ACC, METHOD_ACCOUNT, nextVoucherNo, postJournal } from "@/lib/accounting";

// Build a balanced sale journal: revenue (cash/receivable → Sales) + COGS (→ Inventory).
export async function postSaleJournal(
  tx: Prisma.TransactionClient,
  args: {
    saleId: string; invoiceNo: string;
    grandTotal: number; dueTotal: number; cogs: number;
    payments: { method: string; amount: number }[];
  }
) {
  const lines: { code: string; debit?: number; credit?: number }[] = [];
  if (args.cogs > 0) {
    lines.push({ code: ACC.COGS, debit: args.cogs });
    lines.push({ code: ACC.INVENTORY, credit: args.cogs });
  }
  // Cash retained = grandTotal − due (overpayment is change, not extra cash).
  let cashLeft = args.grandTotal - args.dueTotal;
  for (const p of args.payments.filter((p) => Number(p.amount) > 0)) {
    const amt = Math.min(Number(p.amount), cashLeft);
    if (amt > 0) { lines.push({ code: METHOD_ACCOUNT[p.method] ?? "1000", debit: amt }); cashLeft -= amt; }
  }
  if (args.dueTotal > 0) lines.push({ code: ACC.RECEIVABLE, debit: args.dueTotal });
  if (args.grandTotal > 0) lines.push({ code: ACC.SALES, credit: args.grandTotal });
  if (!lines.length) return;
  const voucherNo = await nextVoucherNo(tx, "SAL");
  await postJournal(tx, { voucherNo, memo: `Sale ${args.invoiceNo}`, refType: "Sale", refId: args.saleId, lines });
}
