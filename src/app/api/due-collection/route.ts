import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { postDueCollectionJournal } from "@/lib/sale-journal";
import { isCourierPending } from "@/lib/courier";

export const dynamic = "force-dynamic";

// GET → invoices with outstanding due that the owner can collect by hand.
// Dues riding on a courier parcel are collected automatically (COD) and are
// hidden here until the parcel is returned — only then is it a real due again.
export async function GET() {
  const sales = await prisma.sale.findMany({
    where: { dueTotal: { gt: 0 } },
    include: { customer: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(sales.filter((s) => !isCourierPending(s)));
}

// POST { saleId, amount, method, reference } → collect due
export async function POST(req: NextRequest) {
  const { saleId, amount, method, reference } = await req.json();
  if (!saleId || !amount || !method)
    return NextResponse.json({ error: "saleId, amount and method are required." }, { status: 400 });
  try {
    const updated = await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUniqueOrThrow({ where: { id: saleId } });
      if (isCourierPending(sale))
        throw new Error("This due is collected automatically by the courier (COD). It becomes collectable only if the parcel is returned.");
      const amt = new Prisma.Decimal(amount);
      if (amt.lte(0) || amt.gt(sale.dueTotal)) throw new Error("Amount must be within the outstanding due.");
      await tx.payment.create({
        data: { saleId, method, amount: amt, reference: reference || undefined, isDueCollection: true },
      });
      // Accounting: money in (asset) ↔ receivable cleared.
      await postDueCollectionJournal(tx, { saleId, invoiceNo: sale.invoiceNo, method, amount: Number(amt) });
      const newDue = sale.dueTotal.sub(amt);
      return tx.sale.update({
        where: { id: saleId },
        data: {
          paidTotal: sale.paidTotal.add(amt),
          dueTotal: newDue,
          status: newDue.gt(0) ? "PARTIAL_DUE" : "COMPLETED",
        },
        include: { customer: true },
      });
    }, { timeout: 30000, maxWait: 15000 });
    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Collection failed." }, { status: 400 });
  }
}
