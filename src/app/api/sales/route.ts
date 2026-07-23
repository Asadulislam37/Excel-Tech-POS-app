import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

// GET /api/sales → recent invoices
export async function GET() {
  const sales = await prisma.sale.findMany({
    include: {
      customer: true,
      items: { include: { variant: { include: { product: true } }, serialUnits: true } },
      payments: true,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json(sales);
}

type CartItem = {
  variantId: string;
  quantity: number;
  unitPrice: number;
  serialUnitIds?: string[]; // required for SERIALIZED products
};
type PaymentInput = { method: string; amount: number; reference?: string };

// POST /api/sales — create invoice
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { customerId, items, payments, discount = 0 } = body as {
    customerId?: string;
    items: CartItem[];
    payments: PaymentInput[];
    discount?: number;
  };

  if (!items?.length) return NextResponse.json({ error: "Cart is empty." }, { status: 400 });

  try {
    const sale = await prisma.$transaction(async (tx) => {
      const outlet =
        (await tx.outlet.findFirst({ where: { isDefault: true } })) ??
        (await tx.outlet.findFirst());
      if (!outlet) throw new Error("No outlet configured. Run the seed script first.");

      // Load variants + validate stock/serials
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
            throw new Error(`Some selected serials for ${variant.product.name} are no longer in stock.`);
        } else {
          const stock = await tx.stockLevel.findUnique({
            where: { variantId_outletId: { variantId: variant.id, outletId: outlet.id } },
          });
          if (!stock || stock.quantity < item.quantity)
            throw new Error(`Not enough stock for ${variant.product.name} (${variant.sku}).`);
        }
        const lineTotal = new Prisma.Decimal(item.unitPrice).mul(item.quantity);
        subTotal = subTotal.add(lineTotal);
        prepared.push({ item, variant, lineTotal });
      }

      const grandTotal = subTotal.sub(discount);
      const paidTotal = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
      const dueTotal = grandTotal.sub(paidTotal);
      if (dueTotal.lt(0)) throw new Error("Paid amount exceeds the invoice total.");
      if (dueTotal.gt(0) && !customerId)
        throw new Error("Due sales need a customer. Add the customer first.");

      // Invoice number: INV-240723-0001
      const today = new Date();
      const ymd = today.toISOString().slice(2, 10).replace(/-/g, "");
      const countToday = await tx.sale.count({
        where: { createdAt: { gte: new Date(today.toDateString()) } },
      });
      const invoiceNo = `INV-${ymd}-${String(countToday + 1).padStart(4, "0")}`;

      const sale = await tx.sale.create({
        data: {
          invoiceNo,
          customerId: customerId || undefined,
          outletId: outlet.id,
          subTotal,
          discount,
          grandTotal,
          paidTotal,
          dueTotal,
          status: dueTotal.gt(0) ? (paidTotal > 0 ? "PARTIAL_DUE" : "FULL_DUE") : "COMPLETED",
        },
      });

      for (const { item, variant, lineTotal } of prepared) {
        const saleItem = await tx.saleItem.create({
          data: {
            saleId: sale.id,
            variantId: variant.id,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            unitCost: variant.costPrice,
            lineTotal,
          },
        });

        if (variant.product.type === "SERIALIZED") {
          // Warranty end date from policy
          const policy = variant.product.warrantyPolicyId
            ? await tx.warrantyPolicy.findUnique({ where: { id: variant.product.warrantyPolicyId } })
            : null;
          const warrantyUntil = policy
            ? new Date(Date.now() + policy.durationDays * 86400000)
            : null;
          await tx.serialUnit.updateMany({
            where: { id: { in: item.serialUnitIds! } },
            data: { status: "SOLD", saleItemId: saleItem.id, soldAt: new Date(), warrantyUntil },
          });
        }

        // Stock level + ledger (serialized items also mirror into quantity stock)
        const stock = await tx.stockLevel.upsert({
          where: { variantId_outletId: { variantId: variant.id, outletId: outlet.id } },
          create: { variantId: variant.id, outletId: outlet.id, quantity: 0 },
          update: {},
        });
        const newQty = stock.quantity - item.quantity;
        await tx.stockLevel.update({ where: { id: stock.id }, data: { quantity: newQty } });
        await tx.stockLedger.create({
          data: {
            variantId: variant.id,
            outletId: outlet.id,
            reason: "SALE",
            quantity: -item.quantity,
            balance: newQty,
            refType: "Sale",
            refId: sale.id,
          },
        });
      }

      for (const p of payments.filter((p) => Number(p.amount) > 0)) {
        await tx.payment.create({
          data: {
            saleId: sale.id,
            method: p.method as never,
            amount: p.amount,
            reference: p.reference || undefined,
          },
        });
      }

      // Reward points
      if (customerId) {
        const setup = await tx.rewardSetup.findFirst({ where: { isActive: true } });
        if (setup) {
          const points = Math.floor(Number(grandTotal) * Number(setup.pointsPerTaka));
          if (points > 0) {
            await tx.customer.update({
              where: { id: customerId },
              data: { rewardPoints: { increment: points } },
            });
            await tx.rewardPointHistory.create({
              data: { customerId, saleId: sale.id, points, reason: `Purchase ${invoiceNo}` },
            });
          }
        }
      }

      return tx.sale.findUniqueOrThrow({
        where: { id: sale.id },
        include: {
          customer: true,
          items: { include: { variant: { include: { product: true } }, serialUnits: true } },
          payments: true,
        },
      });
    });

    return NextResponse.json(sale, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not create the invoice.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
