import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isParcelReturned } from "@/lib/courier";

export const dynamic = "force-dynamic";

type Note = { id: string; type: "order" | "return" | "stock"; title: string; detail: string; href: string; time?: string };

// GET /api/notifications → actionable "updates" for the dashboard bell.
export async function GET() {
  const [pendingOrders, courierSales, variants] = await Promise.all([
    prisma.onlineOrder.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "desc" }, take: 25 }),
    prisma.sale.findMany({
      where: { courierConsignmentId: { not: null }, dueTotal: { gt: 0 } },
      include: { customer: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
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
  ]);

  const items: Note[] = [];

  for (const o of pendingOrders) {
    items.push({
      id: `order-${o.id}`,
      type: "order",
      title: `New online order ${o.orderNo}`,
      detail: `${o.customerName} · ৳${Number(o.grandTotal).toLocaleString()} · ${o.area === "INSIDE_DHAKA" ? "Inside Dhaka" : "Outside Dhaka"}`,
      href: "/online-orders",
      time: o.createdAt.toISOString(),
    });
  }

  for (const s of courierSales.filter((s) => isParcelReturned(s.courierStatus))) {
    items.push({
      id: `return-${s.id}`,
      type: "return",
      title: `Parcel returned — ${s.invoiceNo}`,
      detail: `${s.customer?.name ?? "Customer"} · ৳${Number(s.dueTotal).toLocaleString()} due reopened`,
      href: "/sales/history",
      time: s.createdAt.toISOString(),
    });
  }

  const lowStock = variants
    .map((v) => ({
      name: v.product.name,
      stock: v.product.type === "SERIALIZED" ? v._count.serialUnits : v.stockLevels.reduce((s, l) => s + l.quantity, 0),
      alert: v.reorderLevel,
    }))
    .filter((v) => v.stock <= v.alert)
    .sort((a, b) => a.stock - b.stock);

  if (lowStock.length) {
    items.push({
      id: "lowstock",
      type: "stock",
      title: `${lowStock.length} product${lowStock.length > 1 ? "s" : ""} low on stock`,
      detail: lowStock.slice(0, 3).map((v) => v.name).join(", ") + (lowStock.length > 3 ? "…" : ""),
      href: "/inventory/products",
    });
  }

  return NextResponse.json({ count: items.length, items });
}
