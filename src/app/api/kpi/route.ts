import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/kpi?type=party|supplier → performance rollup per customer or supplier
export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type") ?? "party";

  if (type === "supplier") {
    const suppliers = await prisma.supplier.findMany({
      include: {
        purchases: { select: { grandTotal: true, paidTotal: true, dueTotal: true, createdAt: true } },
        payments: { select: { amount: true } },
      },
      orderBy: { name: "asc" },
    });
    const rows = suppliers.map((s) => {
      const purchased = s.purchases.reduce((t, p) => t + Number(p.grandTotal), 0);
      const due = Number(s.openingDue) + s.purchases.reduce((t, p) => t + Number(p.dueTotal), 0);
      const paid = s.payments.reduce((t, p) => t + Number(p.amount), 0);
      const last = s.purchases.map((p) => p.createdAt).sort().at(-1) ?? null;
      return { id: s.id, name: s.name, phone: s.phone ?? "", orders: s.purchases.length, purchased, paid, due, last };
    }).sort((a, b) => b.purchased - a.purchased);
    return NextResponse.json({
      rows,
      totals: { purchased: rows.reduce((s, r) => s + r.purchased, 0), due: rows.reduce((s, r) => s + r.due, 0) },
    });
  }

  const customers = await prisma.customer.findMany({
    include: { sales: { select: { grandTotal: true, dueTotal: true, createdAt: true } } },
    orderBy: { name: "asc" },
  });
  const rows = customers.map((c) => {
    const purchased = c.sales.reduce((t, s) => t + Number(s.grandTotal), 0);
    const due = Number(c.openingDue) + c.sales.reduce((t, s) => t + Number(s.dueTotal), 0);
    const last = c.sales.map((s) => s.createdAt).sort().at(-1) ?? null;
    return { id: c.id, name: c.name, phone: c.phone, orders: c.sales.length, purchased, due, rewardPoints: c.rewardPoints, last };
  }).sort((a, b) => b.purchased - a.purchased);
  return NextResponse.json({
    rows,
    totals: { purchased: rows.reduce((s, r) => s + r.purchased, 0), due: rows.reduce((s, r) => s + r.due, 0) },
  });
}
