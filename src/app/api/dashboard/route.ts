import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const startOfDay = new Date(new Date().toDateString());
  // One round-trip for every dashboard query (none depend on each other).
  const [todaySales, todayAgg, payAgg, dueAgg, stockUnits, variants, recent, expenseAgg, supplierAgg] = await Promise.all([
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
    // low-stock scan: only the fields we actually need, for both phone + accessory items
    prisma.productVariant.findMany({
      where: { isActive: true, product: { isActive: true } },
      select: {
        id: true, sku: true, reorderLevel: true,
        product: { select: { name: true, type: true } },
        stockLevels: { select: { quantity: true } },
        _count: { select: { serialUnits: { where: { status: "IN_STOCK" } } } },
      },
      orderBy: { id: "asc" },
      take: 400,
    }),
    prisma.sale.findMany({
      select: {
        id: true, invoiceNo: true, grandTotal: true, dueTotal: true, createdAt: true,
        customer: { select: { name: true } },
        items: { select: { variant: { select: { product: { select: { name: true } } } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.journalLine.aggregate({
      where: { account: { type: "EXPENSE" }, entry: { date: { gte: startOfDay }, refType: "Expense" } },
      _sum: { debit: true },
    }),
    prisma.supplierPayment.aggregate({ where: { createdAt: { gte: startOfDay } }, _sum: { amount: true } }),
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
  const cashOut = Number(expenseAgg._sum.debit ?? 0) + Number(supplierAgg._sum.amount ?? 0);

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
