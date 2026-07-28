import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

/**
 * GET /api/sales/products?q=&outletId=&type=&categoryId=&brandId=&date=
 * Sold quantities rolled up per product variant, with cost and revenue.
 */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const q = p.get("q")?.trim() ?? "";
  const outletId = p.get("outletId") ?? "";
  const type = p.get("type") ?? "";
  const categoryId = p.get("categoryId") ?? "";
  const brandId = p.get("brandId") ?? "";
  const date = p.get("date") ?? "";

  const where: Prisma.SaleItemWhereInput = {
    sale: {
      ...(outletId && { outletId }),
      ...(type && { saleType: type as Prisma.SaleWhereInput["saleType"] }),
      ...(date && { createdAt: { gte: new Date(date), lte: new Date(`${date}T23:59:59`) } }),
    },
    variant: {
      product: {
        ...(categoryId && { categoryId }),
        ...(brandId && { brandId }),
        ...(q && { name: { contains: q, mode: "insensitive" as const } }),
      },
    },
  };

  const items = await prisma.saleItem.findMany({
    where,
    include: {
      variant: {
        include: {
          color: { select: { name: true } },
          size: { select: { name: true } },
          product: {
            select: {
              name: true,
              brand: { select: { name: true } },
              category: { select: { name: true } },
            },
          },
        },
      },
    },
    take: 5000,
  });

  // Roll up per variant.
  const byVariant = new Map<string, {
    id: string; sku: string; category: string; brand: string; product: string;
    quantity: number; cost: number; revenue: number;
  }>();

  for (const it of items) {
    const v = it.variant;
    const key = v.id;
    const variantName = [v.color?.name, v.size?.name].filter(Boolean).join(" ");
    const row = byVariant.get(key) ?? {
      id: v.id, sku: v.sku,
      category: v.product.category?.name ?? "",
      brand: v.product.brand?.name ?? "",
      product: [v.product.name, variantName].filter(Boolean).join(" - "),
      quantity: 0, cost: 0, revenue: 0,
    };
    row.quantity += it.quantity;
    row.cost += Number(it.unitCost) * it.quantity;
    row.revenue += Number(it.lineTotal);
    byVariant.set(key, row);
  }

  // Net out returns: a returned unit was never really sold, so drop its quantity,
  // revenue (refunded amount) and cost from the rolled-up figures.
  const saleItemIds = items.map((it) => it.id);
  if (saleItemIds.length) {
    const returnItems = await prisma.saleReturnItem.findMany({
      where: { saleItemId: { in: saleItemIds } },
      include: { saleItem: { select: { variantId: true, unitCost: true } } },
    });
    for (const r of returnItems) {
      const row = byVariant.get(r.saleItem.variantId);
      if (!row) continue;
      row.quantity -= r.quantity;
      row.revenue -= Number(r.amount);
      row.cost -= Number(r.saleItem.unitCost) * r.quantity;
    }
  }

  const rows = [...byVariant.values()]
    .filter((r) => r.quantity !== 0 || r.revenue !== 0)
    .sort((a, b) => b.quantity - a.quantity);

  return NextResponse.json({
    rows,
    totalQty: rows.reduce((s, r) => s + r.quantity, 0),
    totalCost: rows.reduce((s, r) => s + r.cost, 0),
    totalRevenue: rows.reduce((s, r) => s + r.revenue, 0),
  });
}
