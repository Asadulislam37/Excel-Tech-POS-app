import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const startOfDay = new Date(new Date().toDateString());
  const [todaySales, todayAgg, payAgg, dueAgg, stockUnits, variants, recent] = await Promise.all([
    prisma.sale.count({ where: { createdAt: { gte: startOfDay } } }),
    prisma.sale.aggregate({
      where: { createdAt: { gte: startOfDay } },
      _sum: { grandTotal: true, paidTotal: true },
    }),
    prisma.payment.aggregate({
      where: { createdAt: { gte: startOfDay } },
      _sum: { amount: true },
    }),
    prisma.sale.aggregate({ _sum: { dueTotal: true } }),
    prisma.serialUnit.count({ where: { status: "IN_STOCK" } }),
    // low-stock scan: stock vs alert level for both phone (IMEI) and accessory items
    prisma.productVariant.findMany({
      where: { isActive: true, product: { isActive: true } },
      include: {
        product: { select: { name: true, type: true } },
        stockLevels: { select: { quantity: true } },
        _count: { select: { serialUnits: { where: { status: "IN_STOCK" } } } },
      },
      orderBy: { id: "asc" },
      take: 400,
    }),
    prisma.sale.findMany({
      include: { customer: true, items: { include: { variant: { include: { product: true } } } } },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  const lowStock = variants
    .map((v) => ({
      id: v.id,
      sku: v.sku,
      name: v.product.name,
      stock: v.product.type === "SERIALIZED"
        ? v._count.serialUnits
        : v.stockLevels.reduce((s, l) => s + l.quantity, 0),
      alert: v.reorderLevel,
    }))
    .filter((v) => v.stock <= v.alert)
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 10);

  const cashIn = Number(payAgg._sum.amount ?? 0);
  const cashOut = 0; // expense vouchers / supplier payments come in a later phase

  return NextResponse.json({
    todaySales,
    todayTotal: Number(todayAgg._sum.grandTotal ?? 0),
    todayCollected: Number(todayAgg._sum.paidTotal ?? 0),
    totalDue: Number(dueAgg._sum.dueTotal ?? 0),
    phonesInStock: stockUnits,
    cashIn,
    cashOut,
    balance: cashIn - cashOut,
    lowStock,
    recent,
  });
}
