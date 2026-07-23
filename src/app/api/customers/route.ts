import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const customers = await prisma.customer.findMany({
    where: q
      ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }] }
      : {},
    include: { sales: { select: { dueTotal: true, grandTotal: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const shaped = customers.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    address: c.address,
    rewardPoints: c.rewardPoints,
    createdAt: c.createdAt,
    totalPurchase: c.sales.reduce((s, x) => s + Number(x.grandTotal), 0),
    totalDue: Number(c.openingDue) + c.sales.reduce((s, x) => s + Number(x.dueTotal), 0),
  }));
  return NextResponse.json(shaped);
}

export async function POST(req: NextRequest) {
  const { name, phone, address } = await req.json();
  if (!name || !phone) return NextResponse.json({ error: "Name and phone are required." }, { status: 400 });
  const exists = await prisma.customer.findUnique({ where: { phone } });
  if (exists) return NextResponse.json({ error: "A customer with this phone already exists." }, { status: 409 });
  const customer = await prisma.customer.create({ data: { name, phone, address: address || undefined } });
  return NextResponse.json(customer, { status: 201 });
}
