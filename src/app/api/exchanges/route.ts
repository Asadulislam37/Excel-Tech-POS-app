import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { postExchangeJournal } from "@/lib/sale-journal";

export const dynamic = "force-dynamic";

// GET /api/exchanges?q=&date=&page=1
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const q = p.get("q")?.trim() ?? "";
  const date = p.get("date") ?? "";
  const page = Math.max(1, Number(p.get("page")) || 1);

  const where: Prisma.ExchangeWhereInput = {
    ...(date && { createdAt: { gte: new Date(date), lte: new Date(`${date}T23:59:59`) } }),
    ...(q && {
      OR: [
        { exchangeNo: { contains: q, mode: "insensitive" as const } },
        { sale: { invoiceNo: { contains: q, mode: "insensitive" as const } } },
        { sale: { customer: { name: { contains: q, mode: "insensitive" as const } } } },
      ],
    }),
  };

  const [total, rows] = await Promise.all([
    prisma.exchange.count({ where }),
    prisma.exchange.findMany({
      where,
      include: {
        sale: { include: { customer: true } },
        items: { include: { variant: { include: { product: true, color: true, size: true } } } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * 50,
      take: 50,
    }),
  ]);

  return NextResponse.json({ total, rows });
}

type Line = { variantId: string; quantity: number; unitPrice: number; serialNos?: string[] };

/**
 * POST /api/exchanges
 * { saleId, reason, itemsIn: [...], itemsOut: [...] }
 * itemsIn  = goods the customer hands back  → stock up
 * itemsOut = goods the customer takes away  → stock down
 */
export async function POST(req: NextRequest) {
  const { saleId, reason, itemsIn = [], itemsOut = [] } = await req.json() as {
    saleId: string; reason?: string; itemsIn: Line[]; itemsOut: Line[];
  };
  if (!saleId || (!itemsIn.length && !itemsOut.length))
    return NextResponse.json({ error: "Choose an invoice and the items being exchanged." }, { status: 400 });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUniqueOrThrow({ where: { id: saleId } });
      const outletId = sale.outletId;

      const valueIn = itemsIn.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
      const valueOut = itemsOut.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
      const diffAmount = valueOut - valueIn; // + customer pays, − shop refunds
      let costIn = 0;  // cost of goods coming back into stock
      let costOut = 0; // cost of goods leaving stock

      const ymd = new Date().toISOString().slice(2, 10).replace(/-/g, "");
      const count = await tx.exchange.count({ where: { createdAt: { gte: new Date(new Date().toDateString()) } } });
      const exchangeNo = `EX-${ymd}-${String(count + 1).padStart(4, "0")}`;

      const exchange = await tx.exchange.create({
        data: { exchangeNo, saleId, diffAmount, reason: reason || undefined },
      });

      const move = async (line: Line, direction: "IN" | "OUT") => {
        if (line.quantity <= 0) return;
        const variant = await tx.productVariant.findUniqueOrThrow({
          where: { id: line.variantId }, include: { product: true },
        });
        const lineCost = Number(variant.costPrice) * line.quantity;
        if (direction === "IN") costIn += lineCost; else costOut += lineCost;

        if (direction === "OUT" && variant.product.type === "SERIALIZED") {
          const nos = line.serialNos ?? [];
          if (nos.length !== line.quantity)
            throw new Error(`Pick ${line.quantity} IMEI(s) for ${variant.product.name}.`);
          const units = await tx.serialUnit.findMany({
            where: { serialNo: { in: nos }, variantId: variant.id, status: "IN_STOCK" },
          });
          if (units.length !== nos.length)
            throw new Error(`Some IMEIs for ${variant.product.name} are not in stock.`);
          await tx.serialUnit.updateMany({
            where: { id: { in: units.map((u) => u.id) } },
            data: { status: "EXCHANGED", soldAt: new Date() },
          });
        }
        if (direction === "IN" && line.serialNos?.length) {
          await tx.serialUnit.updateMany({
            where: { serialNo: { in: line.serialNos } },
            data: { status: "IN_STOCK", saleItemId: null, soldAt: null, warrantyUntil: null },
          });
        }

        await tx.exchangeItem.create({
          data: {
            exchangeId: exchange.id, direction, variantId: variant.id,
            quantity: line.quantity, unitPrice: line.unitPrice, serialNos: line.serialNos ?? [],
          },
        });

        const level = await tx.stockLevel.upsert({
          where: { variantId_outletId: { variantId: variant.id, outletId } },
          create: { variantId: variant.id, outletId, quantity: 0 },
          update: {},
        });
        const delta = direction === "IN" ? line.quantity : -line.quantity;
        const newQty = level.quantity + delta;
        if (newQty < 0) throw new Error(`Not enough stock for ${variant.product.name}.`);
        await tx.stockLevel.update({ where: { id: level.id }, data: { quantity: newQty } });
        await tx.stockLedger.create({
          data: {
            variantId: variant.id, outletId,
            reason: direction === "IN" ? "EXCHANGE_IN" : "EXCHANGE_OUT",
            quantity: delta, balance: newQty, refType: "Exchange", refId: exchange.id,
          },
        });
      };

      for (const l of itemsIn) await move(l, "IN");
      for (const l of itemsOut) await move(l, "OUT");

      await tx.sale.update({ where: { id: saleId }, data: { status: "EXCHANGED" } });

      // Accounting: reverse the returned goods, book the new goods, settle the difference.
      await postExchangeJournal(tx, {
        exchangeId: exchange.id, exchangeNo,
        valueIn, valueOut, costIn, costOut, diffAmount,
      });

      return tx.exchange.findUniqueOrThrow({
        where: { id: exchange.id },
        include: { sale: { include: { customer: true } }, items: { include: { variant: { include: { product: true } } } } },
      });
    }, { timeout: 30000 });

    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Exchange failed." }, { status: 400 });
  }
}
