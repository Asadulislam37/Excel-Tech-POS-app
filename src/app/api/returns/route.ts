import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma, PaymentMethod } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

// GET /api/returns?q=&date=&page=1 → sales returns
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const q = p.get("q")?.trim() ?? "";
  const date = p.get("date") ?? "";
  const page = Math.max(1, Number(p.get("page")) || 1);

  const where: Prisma.SaleReturnWhereInput = {
    ...(date && { createdAt: { gte: new Date(date), lte: new Date(`${date}T23:59:59`) } }),
    ...(q && {
      OR: [
        { returnNo: { contains: q, mode: "insensitive" as const } },
        { sale: { invoiceNo: { contains: q, mode: "insensitive" as const } } },
        { sale: { customer: { name: { contains: q, mode: "insensitive" as const } } } },
      ],
    }),
  };

  const [total, rows, agg] = await Promise.all([
    prisma.saleReturn.count({ where }),
    prisma.saleReturn.findMany({
      where,
      include: {
        sale: { include: { customer: true } },
        items: { include: { variant: { include: { product: true, color: true, size: true } } } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * 50,
      take: 50,
    }),
    prisma.saleReturn.aggregate({ where, _sum: { totalAmount: true } }),
  ]);

  return NextResponse.json({ total, totalAmount: Number(agg._sum.totalAmount ?? 0), rows });
}

type ReturnLine = { saleItemId: string; quantity: number; amount: number; serialNos?: string[]; restock?: boolean };

// POST /api/returns { saleId, refundMethod, reason, items: [...] }
export async function POST(req: NextRequest) {
  const { saleId, refundMethod = "CASH", reason, items } = await req.json() as {
    saleId: string; refundMethod?: string; reason?: string; items: ReturnLine[];
  };
  if (!saleId || !items?.length)
    return NextResponse.json({ error: "Choose an invoice and at least one item to return." }, { status: 400 });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUniqueOrThrow({
        where: { id: saleId },
        include: { items: { include: { variant: { include: { product: true } }, serialUnits: true } } },
      });

      // Guard against returning more than was sold (across all past returns).
      const prior = await tx.saleReturnItem.groupBy({
        by: ["saleItemId"],
        where: { saleReturn: { saleId } },
        _sum: { quantity: true },
      });
      const returnedSoFar = new Map(prior.map((r) => [r.saleItemId, r._sum.quantity ?? 0]));

      let total = new Prisma.Decimal(0);
      const prepared = [];
      for (const line of items) {
        if (line.quantity <= 0) continue;
        const saleItem = sale.items.find((i) => i.id === line.saleItemId);
        if (!saleItem) throw new Error("That item is not on this invoice.");
        const already = returnedSoFar.get(saleItem.id) ?? 0;
        if (already + line.quantity > saleItem.quantity)
          throw new Error(`Only ${saleItem.quantity - already} of ${saleItem.variant.product.name} can still be returned.`);
        total = total.add(line.amount);
        prepared.push({ line, saleItem });
      }
      if (!prepared.length) throw new Error("Nothing to return.");

      const ymd = new Date().toISOString().slice(2, 10).replace(/-/g, "");
      const count = await tx.saleReturn.count({ where: { createdAt: { gte: new Date(new Date().toDateString()) } } });
      const returnNo = `SR-${ymd}-${String(count + 1).padStart(4, "0")}`;

      const saleReturn = await tx.saleReturn.create({
        data: {
          returnNo, saleId, totalAmount: total,
          refundMethod: refundMethod as PaymentMethod,
          reason: reason || undefined,
        },
      });

      for (const { line, saleItem } of prepared) {
        const restock = line.restock !== false;
        await tx.saleReturnItem.create({
          data: {
            returnId: saleReturn.id, saleItemId: saleItem.id, variantId: saleItem.variantId,
            quantity: line.quantity, amount: line.amount,
            serialNos: line.serialNos ?? [], restock,
          },
        });

        if (restock) {
          // Serial units named on the return go back to stock.
          if (line.serialNos?.length) {
            await tx.serialUnit.updateMany({
              where: { serialNo: { in: line.serialNos }, saleItemId: saleItem.id },
              data: { status: "IN_STOCK", saleItemId: null, soldAt: null, warrantyUntil: null },
            });
          }
          const level = await tx.stockLevel.upsert({
            where: { variantId_outletId: { variantId: saleItem.variantId, outletId: sale.outletId } },
            create: { variantId: saleItem.variantId, outletId: sale.outletId, quantity: 0 },
            update: {},
          });
          const newQty = level.quantity + line.quantity;
          await tx.stockLevel.update({ where: { id: level.id }, data: { quantity: newQty } });
          await tx.stockLedger.create({
            data: {
              variantId: saleItem.variantId, outletId: sale.outletId, reason: "SALE_RETURN",
              quantity: line.quantity, balance: newQty, refType: "SaleReturn", refId: saleReturn.id,
            },
          });
        } else if (line.serialNos?.length) {
          // Defective units come back but stay out of sellable stock.
          await tx.serialUnit.updateMany({
            where: { serialNo: { in: line.serialNos }, saleItemId: saleItem.id },
            data: { status: "DEFECTIVE" },
          });
        }
      }

      // Refund reduces what the customer still owes first, then cash back.
      const due = new Prisma.Decimal(sale.dueTotal);
      const offsetDue = Prisma.Decimal.min(due, total);
      const cashBack = total.sub(offsetDue);
      await tx.sale.update({
        where: { id: saleId },
        data: {
          dueTotal: due.sub(offsetDue),
          paidTotal: new Prisma.Decimal(sale.paidTotal).sub(cashBack),
          status: "RETURNED",
        },
      });

      return tx.saleReturn.findUniqueOrThrow({
        where: { id: saleReturn.id },
        include: { sale: { include: { customer: true } }, items: { include: { variant: { include: { product: true } } } } },
      });
    }, { timeout: 30000 });

    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Return failed." }, { status: 400 });
  }
}
