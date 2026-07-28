import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

const FULL = {
  supplier: true,
  outlet: { select: { name: true, address: true, phone: true } },
  items: { include: { variant: { include: { product: true, color: true, size: true } }, serialUnits: true } },
} as const;

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const purchase = await prisma.purchase.findUnique({ where: { id }, include: FULL });
  if (!purchase) return NextResponse.json({ error: "Purchase not found." }, { status: 404 });
  return NextResponse.json(purchase);
}

/** Undo a purchase: pull stock back, drop its serial units and ledger, void the journal. */
async function reversePurchase(tx: Prisma.TransactionClient, purchaseId: string) {
  const purchase = await tx.purchase.findUniqueOrThrow({
    where: { id: purchaseId },
    include: { items: { include: { serialUnits: true } } },
  });

  for (const item of purchase.items) {
    // Refuse if any purchased unit has already been sold.
    const sold = item.serialUnits.filter((u) => u.status !== "IN_STOCK");
    if (sold.length)
      throw new Error(`Cannot reverse — IMEI ${sold[0].serialNo} was already sold or moved.`);
    await tx.serialUnit.deleteMany({ where: { purchaseItemId: item.id } });

    const level = await tx.stockLevel.findFirst({
      where: { variantId: item.variantId, outletId: purchase.outletId },
    });
    if (level) {
      if (level.quantity < item.quantity)
        throw new Error("Cannot reverse — some of this stock has already been sold.");
      await tx.stockLevel.update({ where: { id: level.id }, data: { quantity: level.quantity - item.quantity } });
    }
  }

  await tx.stockLedger.deleteMany({ where: { refType: "Purchase", refId: purchaseId } });
  const journal = await tx.journalEntry.findFirst({ where: { refType: "Purchase", refId: purchaseId } });
  if (journal) await tx.journalEntry.delete({ where: { id: journal.id } });

  return purchase;
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    await prisma.$transaction(async (tx) => {
      await reversePurchase(tx, id);
      await tx.purchase.delete({ where: { id } });
    }, { timeout: 30000 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Delete failed." }, { status: 400 });
  }
}

type PItem = { variantId: string; quantity: number; unitCost: number; serials?: string[] };
type Payment = { method: string; amount: number };

// PATCH — edit a purchase by reversing and re-applying, keeping the same number.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { supplierId, items, payments = [], discount = 0, additionalExpense = 0, note } = await req.json() as {
    supplierId: string; items: PItem[]; payments?: Payment[]; discount?: number; additionalExpense?: number; note?: string;
  };
  if (!supplierId || !items?.length)
    return NextResponse.json({ error: "Supplier and at least one item are required." }, { status: 400 });

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const old = await reversePurchase(tx, id);
      await tx.purchaseItem.deleteMany({ where: { purchaseId: id } });

      const outletId = old.outletId;
      let subTotal = new Prisma.Decimal(0);
      for (const it of items) subTotal = subTotal.add(new Prisma.Decimal(it.unitCost).mul(it.quantity));
      const grandTotal = subTotal.sub(discount).add(additionalExpense);
      const paidTotal = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
      const dueTotal = Prisma.Decimal.max(grandTotal.sub(paidTotal), 0);

      await tx.purchase.update({
        where: { id },
        data: {
          supplierId, subTotal, discount, additionalExpense, grandTotal,
          paidTotal: Prisma.Decimal.min(paidTotal, grandTotal), dueTotal, note: note || null,
        },
      });

      for (const it of items) {
        const variant = await tx.productVariant.findUniqueOrThrow({ where: { id: it.variantId }, include: { product: true } });
        const pItem = await tx.purchaseItem.create({
          data: {
            purchaseId: id, variantId: it.variantId, quantity: it.quantity,
            unitCost: it.unitCost, lineTotal: new Prisma.Decimal(it.unitCost).mul(it.quantity),
          },
        });
        if (variant.product.type === "SERIALIZED") {
          const serials = (it.serials ?? []).map((s) => s.trim()).filter(Boolean);
          if (serials.length !== it.quantity)
            throw new Error(`Enter ${it.quantity} serial(s) for ${variant.product.name}.`);
          const dupes = await tx.serialUnit.findMany({ where: { serialNo: { in: serials } } });
          if (dupes.length) throw new Error(`Already in system: ${dupes.map((d) => d.serialNo).join(", ")}`);
          await tx.serialUnit.createMany({
            data: serials.map((serialNo) => ({ serialNo, variantId: it.variantId, outletId, costPrice: it.unitCost, purchaseItemId: pItem.id })),
          });
        }
        const stock = await tx.stockLevel.upsert({
          where: { variantId_outletId: { variantId: it.variantId, outletId } },
          create: { variantId: it.variantId, outletId, quantity: it.quantity },
          update: { quantity: { increment: it.quantity } },
        });
        await tx.stockLedger.create({
          data: { variantId: it.variantId, outletId, reason: "PURCHASE", quantity: it.quantity, balance: stock.quantity, refType: "Purchase", refId: id },
        });
        await tx.productVariant.update({ where: { id: it.variantId }, data: { costPrice: it.unitCost } });
      }

      return tx.purchase.findUniqueOrThrow({ where: { id }, include: FULL });
    }, { timeout: 30000 });

    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Update failed." }, { status: 400 });
  }
}
