// Shared online-order creation. Used by the public checkout (`/api/shop/orders`)
// AND the AI agent, so both take orders through exactly one code path with the
// same validation, DB-sourced pricing, and stock checks.
//
// Prices ALWAYS come from the database, never from the caller — the caller only
// says which variant and how many.
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { getDeliveryCharges } from "@/lib/settings";
import { variantStock } from "@/lib/catalog";

export type OrderArea = "INSIDE_DHAKA" | "OUTSIDE_DHAKA";
export type OrderPayMethod = "COD" | "BKASH" | "NAGAD";

export type CreateOnlineOrderInput = {
  customerName: string;
  phone: string;
  address: string;
  area: OrderArea;
  note?: string;
  payMethod: OrderPayMethod;
  payReference?: string;
  items: { variantId: string; quantity: number }[];
};

/** A validation/stock problem the caller should show to the user as-is. */
export class OrderError extends Error {}

/**
 * Validate + create a PENDING online order. Throws `OrderError` with a
 * customer-safe message on any bad input or out-of-stock item.
 */
export async function createOnlineOrder(input: CreateOnlineOrderInput) {
  const { customerName, phone, address, area, note, payMethod, payReference, items } = input;

  if (!customerName?.trim() || !phone?.trim() || !address?.trim())
    throw new OrderError("Name, phone and address are required.");
  if (!/^01\d{9}$/.test(phone.trim()))
    throw new OrderError("Enter a valid 11-digit phone number (starting 01…).");
  if (!items?.length) throw new OrderError("No items to order.");
  if (payMethod !== "COD" && !payReference?.trim())
    throw new OrderError("Enter the bKash/Nagad transaction ID for a prepaid order.");

  let subTotal = new Prisma.Decimal(0);
  const lines: {
    variantId: string;
    name: string;
    variant: string;
    quantity: number;
    unitPrice: Prisma.Decimal;
  }[] = [];

  for (const it of items) {
    const v = await prisma.productVariant.findUnique({
      where: { id: it.variantId },
      include: {
        product: true,
        color: true,
        size: true,
        stockLevels: true,
        _count: { select: { serialUnits: { where: { status: "IN_STOCK" } } } },
      },
    });
    if (!v || !v.product.isPublished)
      throw new OrderError("One of the products is no longer available.");

    const stock = variantStock(v.product.type, v);
    const qty = Math.max(1, Math.min(Number(it.quantity) || 1, 5));
    if (stock < qty) throw new OrderError(`${v.product.name} is out of stock.`);

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

  const charges = await getDeliveryCharges();
  const deliveryCharge = area === "INSIDE_DHAKA" ? charges.insideDhaka : charges.outsideDhaka;
  const grandTotal = subTotal.add(deliveryCharge);
  const count = await prisma.onlineOrder.count();

  return prisma.onlineOrder.create({
    data: {
      orderNo: `ET-${String(count + 1001).padStart(5, "0")}`,
      customerName: customerName.trim(),
      phone: phone.trim(),
      address: address.trim(),
      area,
      note: note?.trim() || undefined,
      payMethod,
      payReference: payReference?.trim() || undefined,
      subTotal,
      deliveryCharge,
      grandTotal,
      items: { create: lines },
    },
    include: { items: true },
  });
}
