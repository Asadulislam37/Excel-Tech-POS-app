import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { ACC, METHOD_ACCOUNT, nextVoucherNo, postJournal } from "@/lib/accounting";

export const dynamic = "force-dynamic";

// GET /api/purchase?q=&date=&page=1 → purchase list
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const q = p.get("q")?.trim() ?? "";
  const date = p.get("date") ?? "";
  const page = Math.max(1, Number(p.get("page")) || 1);

  const where: Prisma.PurchaseWhereInput = {
    ...(date && { createdAt: { gte: new Date(date), lte: new Date(`${date}T23:59:59`) } }),
    ...(q && {
      OR: [
        { purchaseNo: { contains: q, mode: "insensitive" as const } },
        { supplier: { name: { contains: q, mode: "insensitive" as const } } },
        { supplier: { phone: { contains: q } } },
      ],
    }),
  };

  const [total, rows, agg] = await Promise.all([
    prisma.purchase.count({ where }),
    prisma.purchase.findMany({
      where,
      include: {
        supplier: true,
        outlet: { select: { name: true } },
        items: { include: { variant: { include: { product: true, color: true, size: true } }, serialUnits: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * 50,
      take: 50,
    }),
    prisma.purchase.aggregate({ where, _sum: { grandTotal: true, dueTotal: true } }),
  ]);

  return NextResponse.json({
    total,
    totalAmount: Number(agg._sum.grandTotal ?? 0),
    totalDue: Number(agg._sum.dueTotal ?? 0),
    rows,
  });
}

type PItem = { variantId: string; quantity: number; unitCost: number; serials?: string[] };
type Payment = { method: string; amount: number; reference?: string };

// POST — record purchase: adds stock, serials, supplier due, and books the journal.
export async function POST(req: NextRequest) {
  const {
    supplierId, items, payments = [], discount = 0, additionalExpense = 0, note,
  } = (await req.json()) as {
    supplierId: string; items: PItem[]; payments?: Payment[];
    discount?: number; additionalExpense?: number; note?: string;
  };
  if (!supplierId || !items?.length)
    return NextResponse.json({ error: "Supplier and at least one item are required." }, { status: 400 });

  try {
    const purchase = await prisma.$transaction(async (tx) => {
      const outlet =
        (await tx.outlet.findFirst({ where: { isDefault: true } })) ?? (await tx.outlet.findFirst());
      if (!outlet) throw new Error("No outlet configured.");

      let subTotal = new Prisma.Decimal(0);
      for (const it of items) subTotal = subTotal.add(new Prisma.Decimal(it.unitCost).mul(it.quantity));
      const grandTotal = subTotal.sub(discount).add(additionalExpense);
      const paidTotal = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
      const dueTotal = Prisma.Decimal.max(grandTotal.sub(paidTotal), 0);

      const ymd = new Date().toISOString().slice(2, 10).replace(/-/g, "");
      const count = await tx.purchase.count({ where: { createdAt: { gte: new Date(new Date().toDateString()) } } });
      const purchaseNo = `PO-${ymd}-${String(count + 1).padStart(4, "0")}`;

      const purchase = await tx.purchase.create({
        data: {
          purchaseNo, supplierId, outletId: outlet.id,
          subTotal, discount, additionalExpense, grandTotal,
          paidTotal: Prisma.Decimal.min(paidTotal, grandTotal), dueTotal,
          note: note || undefined,
        },
      });

      for (const it of items) {
        const variant = await tx.productVariant.findUniqueOrThrow({
          where: { id: it.variantId }, include: { product: true },
        });
        const pItem = await tx.purchaseItem.create({
          data: {
            purchaseId: purchase.id, variantId: it.variantId, quantity: it.quantity,
            unitCost: it.unitCost, lineTotal: new Prisma.Decimal(it.unitCost).mul(it.quantity),
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
            quantity: it.quantity, balance: stock.quantity, refType: "Purchase", refId: purchase.id,
          },
        });
        await tx.productVariant.update({ where: { id: it.variantId }, data: { costPrice: it.unitCost } });
      }

      // Journal: inventory up (debit); cash out per payment; supplier payable for the rest.
      const lines: { code: string; debit?: number; credit?: number }[] = [{ code: ACC.INVENTORY, debit: Number(grandTotal) }];
      for (const pay of payments.filter((p) => Number(p.amount) > 0)) {
        lines.push({ code: METHOD_ACCOUNT[pay.method] ?? METHOD_ACCOUNT.CASH, credit: Number(pay.amount) });
      }
      if (Number(dueTotal) > 0) lines.push({ code: ACC.PAYABLE, credit: Number(dueTotal) });
      const voucherNo = await nextVoucherNo(tx, "PUR");
      await postJournal(tx, { voucherNo, memo: `Purchase ${purchaseNo}`, refType: "Purchase", refId: purchase.id, lines });

      return purchase;
    }, { timeout: 30000 });

    return NextResponse.json(purchase, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Purchase failed." }, { status: 400 });
  }
}
