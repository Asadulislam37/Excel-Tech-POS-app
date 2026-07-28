import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { ACC, METHOD_ACCOUNT, nextVoucherNo, postJournal } from "@/lib/accounting";

export const dynamic = "force-dynamic";

// GET /api/purchase-returns?q=&date=&page=1
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const q = p.get("q")?.trim() ?? "";
  const date = p.get("date") ?? "";
  const page = Math.max(1, Number(p.get("page")) || 1);

  const where: Prisma.PurchaseReturnWhereInput = {
    ...(date && { createdAt: { gte: new Date(date), lte: new Date(`${date}T23:59:59`) } }),
    ...(q && {
      OR: [
        { returnNo: { contains: q, mode: "insensitive" as const } },
        { supplier: { name: { contains: q, mode: "insensitive" as const } } },
      ],
    }),
  };

  const [total, rows, agg] = await Promise.all([
    prisma.purchaseReturn.count({ where }),
    prisma.purchaseReturn.findMany({
      where,
      include: {
        supplier: true, purchase: { select: { purchaseNo: true, outletId: true } },
        items: { include: { variant: { include: { product: true, color: true, size: true } } } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * 50,
      take: 50,
    }),
    prisma.purchaseReturn.aggregate({ where, _sum: { total: true } }),
  ]);

  return NextResponse.json({ total, totalAmount: Number(agg._sum.total ?? 0), rows });
}

type RLine = { purchaseItemId: string; quantity: number; amount: number; serialNos?: string[] };

// POST /api/purchase-returns { purchaseId, refundMethod, reason, items: [...] }
export async function POST(req: NextRequest) {
  const { purchaseId, refundMethod = "CASH", reason, items } = await req.json() as {
    purchaseId: string; refundMethod?: string; reason?: string; items: RLine[];
  };
  if (!purchaseId || !items?.length)
    return NextResponse.json({ error: "Choose a purchase and items to return." }, { status: 400 });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.findUniqueOrThrow({
        where: { id: purchaseId },
        include: { items: { include: { variant: { include: { product: true } }, serialUnits: true } } },
      });

      const prior = await tx.purchaseReturnItem.groupBy({
        by: ["purchaseItemId"],
        where: { purchaseReturn: { purchaseId } },
        _sum: { quantity: true },
      });
      const returnedSoFar = new Map(prior.map((r) => [r.purchaseItemId, r._sum.quantity ?? 0]));

      let total = new Prisma.Decimal(0);
      const prepared = [];
      for (const line of items) {
        if (line.quantity <= 0) continue;
        const pItem = purchase.items.find((i) => i.id === line.purchaseItemId);
        if (!pItem) throw new Error("That item is not on this purchase.");
        const already = returnedSoFar.get(pItem.id) ?? 0;
        if (already + line.quantity > pItem.quantity)
          throw new Error(`Only ${pItem.quantity - already} of ${pItem.variant.product.name} can still be returned.`);
        total = total.add(line.amount);
        prepared.push({ line, pItem });
      }
      if (!prepared.length) throw new Error("Nothing to return.");

      const ymd = new Date().toISOString().slice(2, 10).replace(/-/g, "");
      const count = await tx.purchaseReturn.count({ where: { createdAt: { gte: new Date(new Date().toDateString()) } } });
      const returnNo = `PR-${ymd}-${String(count + 1).padStart(4, "0")}`;

      const pr = await tx.purchaseReturn.create({
        data: { returnNo, purchaseId, supplierId: purchase.supplierId, total, reason: reason || undefined },
      });

      for (const { line, pItem } of prepared) {
        await tx.purchaseReturnItem.create({
          data: {
            returnId: pr.id, purchaseItemId: pItem.id, variantId: pItem.variantId,
            quantity: line.quantity, amount: line.amount, serialNos: line.serialNos ?? [],
          },
        });
        // Returned-to-supplier serials leave stock entirely.
        if (line.serialNos?.length) {
          await tx.serialUnit.deleteMany({ where: { serialNo: { in: line.serialNos }, purchaseItemId: pItem.id } });
        }
        const level = await tx.stockLevel.findFirst({ where: { variantId: pItem.variantId, outletId: purchase.outletId } });
        if (!level || level.quantity < line.quantity)
          throw new Error(`Not enough stock of ${pItem.variant.product.name} to return.`);
        const newQty = level.quantity - line.quantity;
        await tx.stockLevel.update({ where: { id: level.id }, data: { quantity: newQty } });
        await tx.stockLedger.create({
          data: {
            variantId: pItem.variantId, outletId: purchase.outletId, reason: "PURCHASE_RETURN",
            quantity: -line.quantity, balance: newQty, refType: "PurchaseReturn", refId: pr.id,
          },
        });
      }

      // Reduce supplier due first; anything beyond that is cash the supplier refunds.
      const due = new Prisma.Decimal(purchase.dueTotal);
      const offsetDue = Prisma.Decimal.min(due, total);
      const cashBack = total.sub(offsetDue);
      await tx.purchase.update({
        where: { id: purchaseId },
        data: { dueTotal: due.sub(offsetDue), paidTotal: new Prisma.Decimal(purchase.paidTotal).sub(cashBack) },
      });

      // Journal: inventory down; supplier payable down (offset) and/or cash in (refund).
      const lines: { code: string; debit?: number; credit?: number }[] = [{ code: ACC.INVENTORY, credit: Number(total) }];
      if (Number(offsetDue) > 0) lines.push({ code: ACC.PAYABLE, debit: Number(offsetDue) });
      if (Number(cashBack) > 0) lines.push({ code: METHOD_ACCOUNT[refundMethod] ?? METHOD_ACCOUNT.CASH, debit: Number(cashBack) });
      const voucherNo = await nextVoucherNo(tx, "PRT");
      await postJournal(tx, { voucherNo, memo: `Purchase return ${returnNo}`, refType: "PurchaseReturn", refId: pr.id, lines });

      return tx.purchaseReturn.findUniqueOrThrow({
        where: { id: pr.id },
        include: { supplier: true, items: { include: { variant: { include: { product: true } } } } },
      });
    }, { timeout: 30000 });

    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Purchase return failed." }, { status: 400 });
  }
}
