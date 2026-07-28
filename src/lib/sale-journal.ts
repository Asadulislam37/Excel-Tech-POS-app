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

// A sales return reverses the sale's accounting for the returned items:
//   • revenue comes back out of Sales (debit)
//   • restocked goods return to Inventory and their COGS is reversed
//   • the refund clears the customer's due first, then any cash paid back
// Defective (non-restocked) items reverse revenue but keep their cost as a loss.
export async function postSaleReturnJournal(
  tx: Prisma.TransactionClient,
  args: {
    returnId: string; returnNo: string;
    refundTotal: number; restockCost: number;
    offsetDue: number; cashBack: number; refundMethod: string;
  }
) {
  const lines: { code: string; debit?: number; credit?: number }[] = [];
  if (args.refundTotal > 0) lines.push({ code: ACC.SALES, debit: args.refundTotal });
  if (args.restockCost > 0) {
    lines.push({ code: ACC.INVENTORY, debit: args.restockCost });
    lines.push({ code: ACC.COGS, credit: args.restockCost });
  }
  if (args.offsetDue > 0) lines.push({ code: ACC.RECEIVABLE, credit: args.offsetDue });
  if (args.cashBack > 0) lines.push({ code: METHOD_ACCOUNT[args.refundMethod] ?? "1000", credit: args.cashBack });
  if (!lines.length) return;
  const voucherNo = await nextVoucherNo(tx, "SRT");
  await postJournal(tx, { voucherNo, memo: `Sales return ${args.returnNo}`, refType: "SaleReturn", refId: args.returnId, lines });
}

// Collecting a customer due: money comes in (asset ↑), the receivable clears (asset ↓).
export async function postDueCollectionJournal(
  tx: Prisma.TransactionClient,
  args: { saleId: string; invoiceNo: string; method: string; amount: number; date?: Date }
) {
  if (args.amount <= 0) return;
  const asset = METHOD_ACCOUNT[args.method] ?? "1000";
  const voucherNo = await nextVoucherNo(tx, "DCR");
  await postJournal(tx, {
    voucherNo,
    memo: `Due collection ${args.invoiceNo}`,
    refType: "DueCollection",
    refId: args.saleId,
    ...(args.date && { date: args.date }),
    lines: [
      { code: asset, debit: args.amount },
      { code: ACC.RECEIVABLE, credit: args.amount },
    ],
  });
}
