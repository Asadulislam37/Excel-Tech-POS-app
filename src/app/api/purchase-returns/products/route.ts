import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/purchase-returns/products?q=&categoryId=&brandId=&date=
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const q = p.get("q")?.trim() ?? "";
  const categoryId = p.get("categoryId") ?? "";
  const brandId = p.get("brandId") ?? "";
  const date = p.get("date") ?? "";

  const items = await prisma.purchaseReturnItem.findMany({
    where: {
      ...(date && { purchaseReturn: { createdAt: { gte: new Date(date), lte: new Date(`${date}T23:59:59`) } } }),
      variant: {
        product: {
          ...(categoryId && { categoryId }),
          ...(brandId && { brandId }),
          ...(q && { name: { contains: q, mode: "insensitive" as const } }),
        },
      },
    },
    include: {
      variant: {
        include: {
          color: { select: { name: true } },
          size: { select: { name: true } },
          product: { select: { name: true, brand: { select: { name: true } }, category: { select: { name: true } } } },
        },
      },
    },
    take: 5000,
  });

  const byVariant = new Map<string, {
    id: string; sku: string; category: string; brand: string; product: string;
    quantity: number; amount: number;
  }>();

  for (const it of items) {
    const v = it.variant;
    const variantName = [v.color?.name, v.size?.name].filter(Boolean).join(" ");
    const row = byVariant.get(v.id) ?? {
      id: v.id, sku: v.sku,
      category: v.product.category?.name ?? "",
      brand: v.product.brand?.name ?? "",
      product: [v.product.name, variantName].filter(Boolean).join(" - "),
      quantity: 0, amount: 0,
    };
    row.quantity += it.quantity;
    row.amount += Number(it.amount);
    byVariant.set(v.id, row);
  }

  const rows = [...byVariant.values()].sort((a, b) => b.quantity - a.quantity);
  return NextResponse.json({
    rows,
    totalQty: rows.reduce((s, r) => s + r.quantity, 0),
    totalAmount: rows.reduce((s, r) => s + r.amount, 0),
  });
}
