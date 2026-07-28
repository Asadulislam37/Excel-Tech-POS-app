import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

// GET /api/stock-transfer?q=&page=1 → transfer history
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const q = p.get("q")?.trim() ?? "";
  const page = Math.max(1, Number(p.get("page")) || 1);

  const where: Prisma.StockTransferWhereInput = q
    ? { OR: [
        { transferNo: { contains: q, mode: "insensitive" as const } },
        { fromOutlet: { name: { contains: q, mode: "insensitive" as const } } },
        { toOutlet: { name: { contains: q, mode: "insensitive" as const } } },
      ] }
    : {};

  const [total, rows] = await Promise.all([
    prisma.stockTransfer.count({ where }),
    prisma.stockTransfer.findMany({
      where,
      include: {
        fromOutlet: { select: { name: true } },
        toOutlet: { select: { name: true } },
        items: { include: { variant: { include: { product: true, color: true, size: true } } } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * 50,
      take: 50,
    }),
  ]);

  return NextResponse.json({ total, rows });
}

type TItem = { variantId: string; quantity: number; serialNos?: string[] };

// POST /api/stock-transfer { fromOutletId, toOutletId, note, items }
// A transfer moves stock (and any named serials) between outlets in one step.
export async function POST(req: NextRequest) {
  const { fromOutletId, toOutletId, note, items } = await req.json() as {
    fromOutletId: string; toOutletId: string; note?: string; items: TItem[];
  };
  if (!fromOutletId || !toOutletId)
    return NextResponse.json({ error: "Choose both outlets." }, { status: 400 });
  if (fromOutletId === toOutletId)
    return NextResponse.json({ error: "From and To outlets must differ." }, { status: 400 });
  if (!items?.length) return NextResponse.json({ error: "Add at least one product." }, { status: 400 });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const ymd = new Date().toISOString().slice(2, 10).replace(/-/g, "");
      const count = await tx.stockTransfer.count({ where: { createdAt: { gte: new Date(new Date().toDateString()) } } });
      const transferNo = `TR-${ymd}-${String(count + 1).padStart(4, "0")}`;

      const transfer = await tx.stockTransfer.create({
        data: { transferNo, fromOutletId, toOutletId, status: "RECEIVED", receivedAt: new Date(), note: note || undefined },
      });

      for (const it of items) {
        if (it.quantity <= 0) continue;
        const variant = await tx.productVariant.findUniqueOrThrow({ where: { id: it.variantId }, include: { product: true } });

        // Source must have the stock.
        const from = await tx.stockLevel.findUnique({
          where: { variantId_outletId: { variantId: it.variantId, outletId: fromOutletId } },
        });
        if (!from || from.quantity < it.quantity)
          throw new Error(`Not enough ${variant.product.name} at the source outlet.`);

        await tx.stockTransferItem.create({
          data: { transferId: transfer.id, variantId: it.variantId, quantity: it.quantity, serialNos: it.serialNos ?? [] },
        });

        // Move named serial units across.
        if (it.serialNos?.length) {
          await tx.serialUnit.updateMany({
            where: { serialNo: { in: it.serialNos }, variantId: it.variantId, status: "IN_STOCK" },
            data: { outletId: toOutletId },
          });
        }

        const newFrom = from.quantity - it.quantity;
        await tx.stockLevel.update({ where: { id: from.id }, data: { quantity: newFrom } });
        await tx.stockLedger.create({
          data: { variantId: it.variantId, outletId: fromOutletId, reason: "TRANSFER_OUT", quantity: -it.quantity, balance: newFrom, refType: "StockTransfer", refId: transfer.id },
        });

        const to = await tx.stockLevel.upsert({
          where: { variantId_outletId: { variantId: it.variantId, outletId: toOutletId } },
          create: { variantId: it.variantId, outletId: toOutletId, quantity: it.quantity },
          update: { quantity: { increment: it.quantity } },
        });
        await tx.stockLedger.create({
          data: { variantId: it.variantId, outletId: toOutletId, reason: "TRANSFER_IN", quantity: it.quantity, balance: to.quantity, refType: "StockTransfer", refId: transfer.id },
        });
      }

      return tx.stockTransfer.findUniqueOrThrow({
        where: { id: transfer.id },
        include: { fromOutlet: true, toOutlet: true, items: { include: { variant: { include: { product: true } } } } },
      });
    }, { timeout: 30000 });

    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Transfer failed." }, { status: 400 });
  }
}
