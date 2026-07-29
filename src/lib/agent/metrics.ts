// Business metrics for the owner assistant. Plain-number results only (no
// Prisma Decimals) so they serialize cleanly into tool responses.
import { prisma } from "@/lib/prisma";
import { variantStock } from "@/lib/catalog";

// Excel Tech is in Dhaka (UTC+6, no DST). Compute day boundaries in that zone
// so "today" matches the shop's wall clock, not the server's UTC.
const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;

/** UTC Date range for a Dhaka calendar day, `daysBack` days before today. */
function dhakaDayStart(daysBack = 0): Date {
  const dhakaNow = new Date(Date.now() + DHAKA_OFFSET_MS);
  return new Date(
    Date.UTC(dhakaNow.getUTCFullYear(), dhakaNow.getUTCMonth(), dhakaNow.getUTCDate() - daysBack) -
      DHAKA_OFFSET_MS
  );
}

function dhakaMonthStart(): Date {
  const dhakaNow = new Date(Date.now() + DHAKA_OFFSET_MS);
  return new Date(Date.UTC(dhakaNow.getUTCFullYear(), dhakaNow.getUTCMonth(), 1) - DHAKA_OFFSET_MS);
}

async function salesInRange(gte: Date, lt?: Date) {
  const where = { createdAt: lt ? { gte, lt } : { gte } };
  const [agg, items] = await Promise.all([
    prisma.sale.aggregate({
      where,
      _count: true,
      _sum: { grandTotal: true, paidTotal: true, dueTotal: true },
    }),
    prisma.saleItem.findMany({
      where: { sale: where },
      select: { quantity: true, unitCost: true, lineTotal: true },
    }),
  ]);
  const revenue = Number(agg._sum.grandTotal ?? 0);
  const cogs = items.reduce((s, it) => s + Number(it.unitCost) * it.quantity, 0);
  const grossFromLines = items.reduce((s, it) => s + Number(it.lineTotal), 0);
  return {
    orders: agg._count,
    revenue,
    paid: Number(agg._sum.paidTotal ?? 0),
    due: Number(agg._sum.dueTotal ?? 0),
    // Gross profit = line revenue − cost of goods sold (excludes order-level discount/expense).
    grossProfit: Math.round(grossFromLines - cogs),
  };
}

/** Today + this-month sales snapshot. */
export async function businessSummary() {
  const [today, month] = await Promise.all([
    salesInRange(dhakaDayStart(0), dhakaDayStart(-1)),
    salesInRange(dhakaMonthStart()),
  ]);
  return { currency: "BDT", today, thisMonth: month };
}

/** Variants at/below their reorder level (needs restocking). */
export async function lowStock(limit = 40) {
  const variants = await prisma.productVariant.findMany({
    where: { isActive: true, product: { isActive: true } },
    include: {
      product: { select: { name: true, type: true } },
      color: { select: { name: true } },
      size: { select: { name: true } },
      stockLevels: true,
      _count: { select: { serialUnits: { where: { status: "IN_STOCK" } } } },
    },
  });
  return variants
    .map((v) => ({
      product: v.product.name,
      variant: [v.color?.name, v.size?.name].filter(Boolean).join(" · "),
      sku: v.sku,
      stock: variantStock(v.product.type, v),
      reorderLevel: v.reorderLevel,
    }))
    .filter((x) => x.stock <= x.reorderLevel)
    .sort((a, b) => a.stock - b.stock)
    .slice(0, limit);
}

/** In-stock variants with NO sale in the last `days` days (dead stock). */
export async function deadStock(days = 30, limit = 40) {
  const since = dhakaDayStart(days);
  const soldRows = await prisma.saleItem.findMany({
    where: { sale: { createdAt: { gte: since } } },
    select: { variantId: true },
    distinct: ["variantId"],
  });
  const sold = new Set(soldRows.map((r) => r.variantId));

  const variants = await prisma.productVariant.findMany({
    where: { isActive: true, product: { isActive: true } },
    include: {
      product: { select: { name: true, type: true } },
      color: { select: { name: true } },
      size: { select: { name: true } },
      stockLevels: true,
      _count: { select: { serialUnits: { where: { status: "IN_STOCK" } } } },
    },
  });

  return variants
    .filter((v) => variantStock(v.product.type, v) > 0 && !sold.has(v.id))
    .slice(0, limit)
    .map((v) => ({
      product: v.product.name,
      variant: [v.color?.name, v.size?.name].filter(Boolean).join(" · "),
      sku: v.sku,
      stock: variantStock(v.product.type, v),
    }));
}

/** Best-selling variants over the last `days` days (by units sold). */
export async function topProducts(days = 30, limit = 10) {
  const since = dhakaDayStart(days);
  const grouped = await prisma.saleItem.groupBy({
    by: ["variantId"],
    where: { sale: { createdAt: { gte: since } } },
    _sum: { quantity: true, lineTotal: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: limit,
  });
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: grouped.map((g) => g.variantId) } },
    include: {
      product: { select: { name: true } },
      color: { select: { name: true } },
      size: { select: { name: true } },
    },
  });
  const byId = new Map(variants.map((v) => [v.id, v]));
  return grouped.map((g) => {
    const v = byId.get(g.variantId);
    return {
      product: v?.product.name ?? "(unknown)",
      variant: [v?.color?.name, v?.size?.name].filter(Boolean).join(" · "),
      sku: v?.sku ?? "",
      unitsSold: g._sum.quantity ?? 0,
      revenue: Number(g._sum.lineTotal ?? 0),
    };
  });
}
