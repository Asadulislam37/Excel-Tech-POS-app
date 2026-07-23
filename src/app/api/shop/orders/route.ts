import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

const DELIVERY = { INSIDE_DHAKA: 70, OUTSIDE_DHAKA: 130 } as const;

// GET — admin: list online orders
export async function GET() {
  const orders = await prisma.onlineOrder.findMany({
    include: { items: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json(orders);
}

type OrderItem = { variantId: string; quantity: number };

// POST — public checkout: create a pending order (prices come from DB, not client)
export async function POST(req: NextRequest) {
  const { customerName, phone, address, area, note, payMethod, payReference, items } =
    (await req.json()) as {
      customerName: string; phone: string; address: string; area: "INSIDE_DHAKA" | "OUTSIDE_DHAKA";
      note?: string; payMethod: "COD" | "BKASH" | "NAGAD"; payReference?: string;
      items: OrderItem[];
    };

  if (!customerName?.trim() || !phone?.trim() || !address?.trim())
    return NextResponse.json({ error: "Name, phone and address are required." }, { status: 400 });
  if (!/^01\d{9}$/.test(phone.trim()))
    return NextResponse.json({ error: "Enter a valid 11-digit phone number (01…)." }, { status: 400 });
  if (!items?.length) return NextResponse.json({ error: "Your cart is empty." }, { status: 400 });
  if (payMethod !== "COD" && !payReference?.trim())
    return NextResponse.json({ error: "Enter the bKash/Nagad transaction ID." }, { status: 400 });

  let subTotal = new Prisma.Decimal(0);
  const lines: { variantId: string; name: string; variant: string; quantity: number; unitPrice: Prisma.Decimal }[] = [];
  for (const it of items) {
    const v = await prisma.productVariant.findUnique({
      where: { id: it.variantId },
      include: {
        product: true, color: true, size: true, stockLevels: true,
        _count: { select: { serialUnits: { where: { status: "IN_STOCK" } } } },
      },
    });
    if (!v || !v.product.isPublished)
      return NextResponse.json({ error: "One of the products is no longer available." }, { status: 400 });
    const stock = v.product.type === "SERIALIZED"
      ? v._count.serialUnits
      : v.stockLevels.reduce((s, x) => s + x.quantity, 0);
    const qty = Math.max(1, Math.min(Number(it.quantity) || 1, 5));
    if (stock < qty)
      return NextResponse.json({ error: `${v.product.name} is out of stock.` }, { status: 400 });
    const price = new Prisma.Decimal(v.onlinePrice ?? v.salePrice);
    subTotal = subTotal.add(price.mul(qty));
    lines.push({
      variantId: v.id,
      name: v.product.name,
      variant: [v.color?.name, v.size?.name].filter(Boolean).join(" · "),
      quantity: qty,
      unitPrice: price,
    });
  }

  const deliveryCharge = DELIVERY[area] ?? DELIVERY.OUTSIDE_DHAKA;
  const grandTotal = subTotal.add(deliveryCharge);
  const count = await prisma.onlineOrder.count();
  const order = await prisma.onlineOrder.create({
    data: {
      orderNo: `ET-${String(count + 1001).padStart(5, "0")}`,
      customerName: customerName.trim(), phone: phone.trim(), address: address.trim(),
      area, note: note?.trim() || undefined,
      payMethod, payReference: payReference?.trim() || undefined,
      subTotal, deliveryCharge, grandTotal,
      items: { create: lines },
    },
    include: { items: true },
  });
  return NextResponse.json(order, { status: 201 });
}
