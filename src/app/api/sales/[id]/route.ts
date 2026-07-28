import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

const FULL = {
  customer: true,
  outlet: { select: { name: true, address: true, phone: true } },
  soldBy: { select: { name: true } },
  items: {
    include: {
      variant: { include: { product: { include: { warrantyPolicy: true } }, color: true, size: true } },
      serialUnits: true,
    },
  },
  payments: true,
} as const;

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const sale = await prisma.sale.findUnique({ where: { id }, include: FULL });
  if (!sale) return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  return NextResponse.json(sale);
}

/** Undo everything a sale did to stock, serials, ledger and reward points. */
async function reverseSale(tx: Prisma.TransactionClient, saleId: string) {
  const sale = await tx.sale.findUniqueOrThrow({
    where: { id: saleId },
    include: { items: true },
  });

  for (const item of sale.items) {
    // Serial units go back into stock, unlinked from this sale.
    await tx.serialUnit.updateMany({
      where: { saleItemId: item.id },
      data: { status: "IN_STOCK", saleItemId: null, soldAt: null, warrantyUntil: null },
    });
    const level = await tx.stockLevel.findFirst({
      where: { variantId: item.variantId, outletId: sale.outletId },
    });
    if (level) {
      await tx.stockLevel.update({
        where: { id: level.id },
        data: { quantity: level.quantity + item.quantity },
      });
    }
  }

  await tx.stockLedger.deleteMany({ where: { refType: "Sale", refId: saleId } });

  // Claw back reward points granted for this sale.
  const points = await tx.rewardPointHistory.findMany({ where: { saleId } });
  for (const p of points) {
    if (p.customerId) {
      await tx.customer.update({
        where: { id: p.customerId },
        data: { rewardPoints: { decrement: p.points } },
      });
    }
  }
  await tx.rewardPointHistory.deleteMany({ where: { saleId } });

  return sale;
}

// DELETE /api/sales/:id — reverse the sale, then remove it.
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    await prisma.$transaction(async (tx) => {
      await reverseSale(tx, id);
      await tx.sale.delete({ where: { id } }); // items + payments cascade
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not delete this invoice." },
      { status: 400 }
    );
  }
}

type CartItem = { variantId: string; quantity: number; unitPrice: number; serialUnitIds?: string[] };

// PATCH /api/sales/:id — edit an invoice: reverse the old lines, apply the new ones,
// keeping the same invoice number.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json();
  const {
    customerId, items, payments = [], discount = 0,
    saleType = "CUSTOMER", vat = 0, additionalExpense = 0, workOrder, note, soldById,
  } = body as {
    customerId?: string; items: CartItem[]; payments: { method: string; amount: number; reference?: string }[];
    discount?: number; saleType?: "CUSTOMER" | "RETAIL" | "WHOLESALE"; vat?: number;
    additionalExpense?: number; workOrder?: string; note?: string; soldById?: string;
  };

  if (!items?.length) return NextResponse.json({ error: "Invoice must have at least one item." }, { status: 400 });

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const old = await reverseSale(tx, id);
      // Clear the old lines and payments now that stock is restored.
      await tx.saleItem.deleteMany({ where: { saleId: id } });
      await tx.payment.deleteMany({ where: { saleId: id } });

      const outletId = old.outletId;
      let subTotal = new Prisma.Decimal(0);
      const prepared = [];

      for (const item of items) {
        const variant = await tx.productVariant.findUniqueOrThrow({
          where: { id: item.variantId },
          include: { product: true },
        });
        if (variant.product.type === "SERIALIZED") {
          const ids = item.serialUnitIds ?? [];
          if (ids.length !== item.quantity)
            throw new Error(`Select ${item.quantity} serial number(s) for ${variant.product.name}.`);
          const units = await tx.serialUnit.findMany({
            where: { id: { in: ids }, status: "IN_STOCK", variantId: variant.id },
          });
          if (units.length !== ids.length)
            throw new Error(`Some serials for ${variant.product.name} are no longer in stock.`);
        } else {
          const stock = await tx.stockLevel.findUnique({
            where: { variantId_outletId: { variantId: variant.id, outletId } },
          });
          if (!stock || stock.quantity < item.quantity)
            throw new Error(`Not enough stock for ${variant.product.name} (${variant.sku}).`);
        }
        const lineTotal = new Prisma.Decimal(item.unitPrice).mul(item.quantity);
        subTotal = subTotal.add(lineTotal);
        prepared.push({ item, variant, lineTotal });
      }

      const grandTotal = subTotal.sub(discount).add(additionalExpense).add(vat);
      const paidTotal = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
      const dueTotal = Prisma.Decimal.max(grandTotal.sub(paidTotal), 0);
      if (dueTotal.gt(0) && !customerId)
        throw new Error("Due sales need a customer.");

      await tx.sale.update({
        where: { id },
        data: {
          customerId: customerId || null,
          soldById: soldById || null,
          saleType, workOrder: workOrder || null, note: note || null,
          subTotal, discount, additionalExpense, vat, grandTotal,
          paidTotal: Prisma.Decimal.min(paidTotal, grandTotal),
          dueTotal,
          status: dueTotal.gt(0) ? (paidTotal > 0 ? "PARTIAL_DUE" : "FULL_DUE") : "COMPLETED",
        },
      });

      for (const { item, variant, lineTotal } of prepared) {
        const saleItem = await tx.saleItem.create({
          data: {
            saleId: id, variantId: variant.id, quantity: item.quantity,
            unitPrice: item.unitPrice, unitCost: variant.costPrice, lineTotal,
          },
        });
        if (variant.product.type === "SERIALIZED") {
          const policy = variant.product.warrantyPolicyId
            ? await tx.warrantyPolicy.findUnique({ where: { id: variant.product.warrantyPolicyId } })
            : null;
          await tx.serialUnit.updateMany({
            where: { id: { in: item.serialUnitIds! } },
            data: {
              status: "SOLD", saleItemId: saleItem.id, soldAt: new Date(),
              warrantyUntil: policy ? new Date(Date.now() + policy.durationDays * 86400000) : null,
            },
          });
        }
        const stock = await tx.stockLevel.upsert({
          where: { variantId_outletId: { variantId: variant.id, outletId } },
          create: { variantId: variant.id, outletId, quantity: 0 },
          update: {},
        });
        const newQty = stock.quantity - item.quantity;
        await tx.stockLevel.update({ where: { id: stock.id }, data: { quantity: newQty } });
        await tx.stockLedger.create({
          data: {
            variantId: variant.id, outletId, reason: "SALE",
            quantity: -item.quantity, balance: newQty, refType: "Sale", refId: id,
          },
        });
      }

      for (const p of payments.filter((p) => Number(p.amount) > 0)) {
        await tx.payment.create({
          data: { saleId: id, method: p.method as never, amount: p.amount, reference: p.reference || undefined },
        });
      }

      return tx.sale.findUniqueOrThrow({ where: { id }, include: FULL });
    }, { timeout: 30000 });

    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not update this invoice." },
      { status: 400 }
    );
  }
}
