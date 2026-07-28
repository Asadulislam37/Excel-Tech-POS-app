import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

// PATCH /api/shop/orders/:id  { action: "CONFIRM" | "DELIVER" | "CANCEL" }
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { action } = await req.json();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.onlineOrder.findUniqueOrThrow({ where: { id }, include: { items: true } });

      if (action === "CANCEL") {
        if (order.status !== "PENDING") throw new Error("Only pending orders can be cancelled.");
        return tx.onlineOrder.update({ where: { id }, data: { status: "CANCELLED" } });
      }

      if (action === "CONFIRM") {
        if (order.status !== "PENDING") throw new Error("Order is not pending.");
        const outlet =
          (await tx.outlet.findFirst({ where: { isDefault: true } })) ?? (await tx.outlet.findFirst());
        if (!outlet) throw new Error("No outlet configured.");

        // Find or create the customer from the order phone
        let customer = await tx.customer.findUnique({ where: { phone: order.phone } });
        if (!customer) {
          customer = await tx.customer.create({
            data: { name: order.customerName, phone: order.phone, address: order.address },
          });
        }

        // Invoice number
        const today = new Date();
        const ymd = today.toISOString().slice(2, 10).replace(/-/g, "");
        const countToday = await tx.sale.count({ where: { createdAt: { gte: new Date(today.toDateString()) } } });
        const invoiceNo = `INV-${ymd}-${String(countToday + 1).padStart(4, "0")}`;

        const prepaid = order.payMethod !== "COD";
        const sale = await tx.sale.create({
          data: {
            invoiceNo,
            customerId: customer.id,
            outletId: outlet.id,
            subTotal: order.subTotal,
            discount: new Prisma.Decimal(order.deliveryCharge).neg(), // negative discount = delivery charge
            grandTotal: order.grandTotal,
            paidTotal: prepaid ? order.grandTotal : 0,
            dueTotal: prepaid ? 0 : order.grandTotal,
            status: prepaid ? "COMPLETED" : "FULL_DUE",
            note: `Online order ${order.orderNo} · ${order.area === "INSIDE_DHAKA" ? "Inside Dhaka" : "Outside Dhaka"} delivery`,
          },
        });

        for (const it of order.items) {
          const variant = await tx.productVariant.findUniqueOrThrow({
            where: { id: it.variantId },
            include: { product: true },
          });
          const saleItem = await tx.saleItem.create({
            data: {
              saleId: sale.id,
              variantId: variant.id,
              quantity: it.quantity,
              unitPrice: it.unitPrice,
              unitCost: variant.costPrice,
              lineTotal: new Prisma.Decimal(it.unitPrice).mul(it.quantity),
            },
          });

          if (variant.product.type === "SERIALIZED") {
            // FIFO: oldest in-stock units first
            const units = await tx.serialUnit.findMany({
              where: { variantId: variant.id, status: "IN_STOCK" },
              orderBy: { createdAt: "asc" },
              take: it.quantity,
            });
            if (units.length < it.quantity)
              throw new Error(`Not enough stock for ${variant.product.name}.`);
            const policy = variant.product.warrantyPolicyId
              ? await tx.warrantyPolicy.findUnique({ where: { id: variant.product.warrantyPolicyId } })
              : null;
            await tx.serialUnit.updateMany({
              where: { id: { in: units.map((u) => u.id) } },
              data: {
                status: "SOLD",
                saleItemId: saleItem.id,
                soldAt: new Date(),
                warrantyUntil: policy ? new Date(Date.now() + policy.durationDays * 86400000) : null,
              },
            });
          }

          const stock = await tx.stockLevel.upsert({
            where: { variantId_outletId: { variantId: variant.id, outletId: outlet.id } },
            create: { variantId: variant.id, outletId: outlet.id, quantity: 0 },
            update: {},
          });
          if (stock.quantity < it.quantity && variant.product.type === "STANDARD")
            throw new Error(`Not enough stock for ${variant.product.name}.`);
          const newQty = stock.quantity - it.quantity;
          await tx.stockLevel.update({ where: { id: stock.id }, data: { quantity: newQty } });
          await tx.stockLedger.create({
            data: {
              variantId: variant.id, outletId: outlet.id, reason: "SALE",
              quantity: -it.quantity, balance: newQty, refType: "OnlineOrder", refId: order.id,
            },
          });
        }

        if (prepaid) {
          await tx.payment.create({
            data: {
              saleId: sale.id,
              method: order.payMethod === "BKASH" ? "BKASH" : "NAGAD",
              amount: order.grandTotal,
              reference: order.payReference ?? undefined,
            },
          });
        }

        return tx.onlineOrder.update({
          where: { id },
          data: { status: "CONFIRMED", saleId: sale.id },
        });
      }

      if (action === "DELIVER") {
        if (order.status !== "CONFIRMED") throw new Error("Confirm the order first.");
        if (order.saleId) {
          const sale = await tx.sale.findUniqueOrThrow({ where: { id: order.saleId } });
          if (Number(sale.dueTotal) > 0) {
            await tx.payment.create({
              data: { saleId: sale.id, method: "CASH", amount: sale.dueTotal, isDueCollection: true },
            });
            await tx.sale.update({
              where: { id: sale.id },
              data: { paidTotal: sale.grandTotal, dueTotal: 0, status: "COMPLETED" },
            });
          }
        }
        return tx.onlineOrder.update({ where: { id }, data: { status: "DELIVERED" } });
      }

      throw new Error("Unknown action.");
    }, { timeout: 30000, maxWait: 15000 });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Update failed." }, { status: 400 });
  }
}
