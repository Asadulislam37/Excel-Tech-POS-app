import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const purchases = await prisma.purchase.findMany({
    include: { supplier: true, items: { include: { variant: { include: { product: true } } } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json(purchases);
}

type PItem = { variantId: string; quantity: number; unitCost: number; serials?: string[] };

// POST — record purchase: adds stock, creates serial units, tracks supplier due
export async function POST(req: NextRequest) {
  const { supplierId, items, paidTotal = 0, discount = 0 } = (await req.json()) as {
    supplierId: string; items: PItem[]; paidTotal?: number; discount?: number;
  };
  if (!supplierId || !items?.length)
    return NextResponse.json({ error: "Supplier and at least one item are required." }, { status: 400 });

  try {
    const purchase = await prisma.$transaction(async (tx) => {
      const outlet =
        (await tx.outlet.findFirst({ where: { isDefault: true } })) ?? (await tx.outlet.findFirst());
      if (!outlet) throw new Error("No outlet configured. Run the seed script first.");

      let subTotal = new Prisma.Decimal(0);
      for (const it of items) subTotal = subTotal.add(new Prisma.Decimal(it.unitCost).mul(it.quantity));
      const grandTotal = subTotal.sub(discount);
      const dueTotal = grandTotal.sub(paidTotal);

      const count = await tx.purchase.count();
      const purchase = await tx.purchase.create({
        data: {
          purchaseNo: `PUR-${String(count + 1).padStart(5, "0")}`,
          supplierId,
          outletId: outlet.id,
          subTotal, discount, grandTotal, paidTotal, dueTotal,
        },
      });

      for (const it of items) {
        const variant = await tx.productVariant.findUniqueOrThrow({
          where: { id: it.variantId }, include: { product: true },
        });
        const pItem = await tx.purchaseItem.create({
          data: {
            purchaseId: purchase.id,
            variantId: it.variantId,
            quantity: it.quantity,
            unitCost: it.unitCost,
            lineTotal: new Prisma.Decimal(it.unitCost).mul(it.quantity),
          },
        });
        if (variant.product.type === "SERIALIZED") {
          const serials = (it.serials ?? []).map((s) => s.trim()).filter(Boolean);
          if (serials.length !== it.quantity)
            throw new Error(`Enter ${it.quantity} serial/IMEI number(s) for ${variant.product.name}.`);
          const dupes = await tx.serialUnit.findMany({ where: { serialNo: { in: serials } } });
          if (dupes.length) throw new Error(`Already in system: ${dupes.map((d) => d.serialNo).join(", ")}`);
          await tx.serialUnit.createMany({
            data: serials.map((serialNo) => ({
              serialNo, variantId: it.variantId, outletId: outlet.id,
              costPrice: it.unitCost, purchaseItemId: pItem.id,
            })),
          });
        }
        const stock = await tx.stockLevel.upsert({
          where: { variantId_outletId: { variantId: it.variantId, outletId: outlet.id } },
          create: { variantId: it.variantId, outletId: outlet.id, quantity: it.quantity },
          update: { quantity: { increment: it.quantity } },
        });
        await tx.stockLedger.create({
          data: {
            variantId: it.variantId, outletId: outlet.id, reason: "PURCHASE",
            quantity: it.quantity, balance: stock.quantity,
            refType: "Purchase", refId: purchase.id,
          },
        });
        // Keep variant cost current
        await tx.productVariant.update({ where: { id: it.variantId }, data: { costPrice: it.unitCost } });
      }
      return purchase;
    });
    return NextResponse.json(purchase, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Purchase failed." }, { status: 400 });
  }
}
