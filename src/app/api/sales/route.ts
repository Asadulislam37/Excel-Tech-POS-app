import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { currentUser } from "@/lib/auth";
import { postSaleJournal } from "@/lib/sale-journal";

export const dynamic = "force-dynamic";

// GET /api/sales?q=&outletId=&type=&date=&page=1 → invoice list
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const q = p.get("q")?.trim() ?? "";
  const outletId = p.get("outletId") ?? "";
  const type = p.get("type") ?? "";
  const date = p.get("date") ?? "";
  const page = Math.max(1, Number(p.get("page")) || 1);

  const where: Prisma.SaleWhereInput = {
    ...(outletId && { outletId }),
    ...(type && { saleType: type as Prisma.SaleWhereInput["saleType"] }),
    ...(date && {
      createdAt: { gte: new Date(date), lte: new Date(`${date}T23:59:59`) },
    }),
    ...(q && {
      OR: [
        { invoiceNo: { contains: q, mode: "insensitive" as const } },
        { customer: { name: { contains: q, mode: "insensitive" as const } } },
        { customer: { phone: { contains: q } } },
      ],
    }),
  };

  const [total, sales, agg, returnedAgg] = await Promise.all([
    prisma.sale.count({ where }),
    prisma.sale.findMany({
      where,
      include: {
        customer: true,
        outlet: { select: { name: true } },
        soldBy: { select: { name: true } },
        items: { include: { variant: { include: { product: { include: { warrantyPolicy: true } }, color: true, size: true } }, serialUnits: true } },
        payments: true,
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * 50,
      take: 50,
    }),
    prisma.sale.aggregate({ where, _sum: { grandTotal: true, dueTotal: true } }),
    // Total refunded across all sales matching this filter.
    prisma.saleReturn.aggregate({ where: { sale: where }, _sum: { totalAmount: true } }),
  ]);

  // Per-invoice refunded amount, so returned rows can be flagged in the list.
  const perSale = await prisma.saleReturn.groupBy({
    by: ["saleId"],
    where: { saleId: { in: sales.map((s) => s.id) } },
    _sum: { totalAmount: true },
  });
  const returnedBySale = new Map(perSale.map((r) => [r.saleId, Number(r._sum.totalAmount ?? 0)]));
  const rows = sales.map((s) => ({ ...s, returnedAmount: returnedBySale.get(s.id) ?? 0 }));

  const totalAmount = Number(agg._sum.grandTotal ?? 0);
  const totalReturned = Number(returnedAgg._sum.totalAmount ?? 0);
  return NextResponse.json({
    total,
    totalAmount,
    totalReturned,
    netAmount: totalAmount - totalReturned,
    totalDue: Number(agg._sum.dueTotal ?? 0),
    rows,
  });
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
  const {
    customerId, items, payments, discount = 0,
    saleType = "CUSTOMER", vat = 0, additionalExpense = 0, workOrder, note, soldById, assistedBy,
  } = body as {
    customerId?: string;
    items: CartItem[];
    payments: PaymentInput[];
    discount?: number;
    saleType?: "CUSTOMER" | "RETAIL" | "WHOLESALE";
    vat?: number;
    additionalExpense?: number;
    workOrder?: string;
    note?: string;
    soldById?: string;
    assistedBy?: string;
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

      // Payable = items − discount + delivery/extra charge + VAT
      const grandTotal = subTotal.sub(discount).add(additionalExpense).add(vat);
      const paidTotal = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
      // Overpayment is change given back, not a negative due.
      const dueTotal = Prisma.Decimal.max(grandTotal.sub(paidTotal), 0);
      if (dueTotal.gt(0) && !customerId)
        throw new Error("Due sales need a customer. Add the customer first.");

      // Invoice number carries the sale type: CS-260728-0001
      const prefix = saleType === "WHOLESALE" ? "WS" : saleType === "RETAIL" ? "RS" : "CS";
      const today = new Date();
      const ymd = today.toISOString().slice(2, 10).replace(/-/g, "");
      const countToday = await tx.sale.count({
        where: { createdAt: { gte: new Date(today.toDateString()) } },
      });
      const invoiceNo = `${prefix}-${ymd}-${String(countToday + 1).padStart(4, "0")}`;

      const sale = await tx.sale.create({
        data: {
          invoiceNo,
          customerId: customerId || undefined,
          outletId: outlet.id,
          soldById: soldById || (await currentUser())?.uid || undefined,
          assistedBy: assistedBy || undefined,
          saleType,
          workOrder: workOrder || undefined,
          note: note || undefined,
          subTotal,
          discount,
          additionalExpense,
          vat,
          grandTotal,
          paidTotal: Prisma.Decimal.min(paidTotal, grandTotal),
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

      // Accounting: revenue + cost of goods sold, so the P&L reflects the sale.
      const cogs = prepared.reduce((s, { item, variant }) => s + Number(variant.costPrice) * item.quantity, 0);
      await postSaleJournal(tx, {
        saleId: sale.id, invoiceNo,
        grandTotal: Number(grandTotal), dueTotal: Number(dueTotal), cogs,
        payments: payments.map((p) => ({ method: p.method, amount: Number(p.amount) })),
      });

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
    }, { timeout: 30000, maxWait: 15000 });

    return NextResponse.json(sale, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not create the invoice.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
