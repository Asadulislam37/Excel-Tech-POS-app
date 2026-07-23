import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const startOfDay = new Date(new Date().toDateString());
  const [todaySales, todayAgg, dueAgg, stockUnits, lowStock, recent] = await Promise.all([
    prisma.sale.count({ where: { createdAt: { gte: startOfDay } } }),
    prisma.sale.aggregate({
      where: { createdAt: { gte: startOfDay } },
      _sum: { grandTotal: true, paidTotal: true },
    }),
    prisma.sale.aggregate({ _sum: { dueTotal: true } }),
    prisma.serialUnit.count({ where: { status: "IN_STOCK" } }),
    prisma.stockLevel.findMany({
      where: { quantity: { lte: 2 } },
      include: { variant: { include: { product: true } } },
      take: 8,
    }),
    prisma.sale.findMany({
      include: { customer: true, items: { include: { variant: { include: { product: true } } } } },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);
  return NextResponse.json({
    todaySales,
    todayTotal: Number(todayAgg._sum.grandTotal ?? 0),
    todayCollected: Number(todayAgg._sum.paidTotal ?? 0),
    totalDue: Number(dueAgg._sum.dueTotal ?? 0),
    phonesInStock: stockUnits,
    lowStock,
    recent,
  });
}
