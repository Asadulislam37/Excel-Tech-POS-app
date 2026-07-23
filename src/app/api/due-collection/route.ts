import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

// GET → invoices with outstanding due
export async function GET() {
  const sales = await prisma.sale.findMany({
    where: { dueTotal: { gt: 0 } },
    include: { customer: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(sales);
}

// POST { saleId, amount, method, reference } → collect due
export async function POST(req: NextRequest) {
  const { saleId, amount, method, reference } = await req.json();
  if (!saleId || !amount || !method)
    return NextResponse.json({ error: "saleId, amount and method are required." }, { status: 400 });
  try {
    const updated = await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUniqueOrThrow({ where: { id: saleId } });
      const amt = new Prisma.Decimal(amount);
      if (amt.lte(0) || amt.gt(sale.dueTotal)) throw new Error("Amount must be within the outstanding due.");
      await tx.payment.create({
        data: { saleId, method, amount: amt, reference: reference || undefined, isDueCollection: true },
      });
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
    });
    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Collection failed." }, { status: 400 });
  }
}
