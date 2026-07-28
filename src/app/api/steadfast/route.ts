import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createOrder, getBalance, isConfigured, statusByConsignment } from "@/lib/steadfast";

export const dynamic = "force-dynamic";

// GET /api/steadfast?balance=1  → courier account balance
// GET /api/steadfast?saleId=... → refresh + return that sale's delivery status
export async function GET(req: NextRequest) {
  if (!isConfigured()) return NextResponse.json({ error: "Steadfast keys not configured." }, { status: 400 });
  const p = req.nextUrl.searchParams;

  if (p.get("balance")) {
    try { return NextResponse.json({ balance: await getBalance() }); }
    catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Failed." }, { status: 400 }); }
  }

  const saleId = p.get("saleId");
  if (!saleId) return NextResponse.json({ error: "saleId is required." }, { status: 400 });
  const sale = await prisma.sale.findUnique({ where: { id: saleId } });
  if (!sale?.courierConsignmentId) return NextResponse.json({ error: "This invoice has no courier parcel." }, { status: 400 });
  try {
    const status = await statusByConsignment(sale.courierConsignmentId);
    await prisma.sale.update({ where: { id: saleId }, data: { courierStatus: status } });
    return NextResponse.json({ status });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed." }, { status: 400 });
  }
}

// POST /api/steadfast  { saleId, note? } → create a Steadfast parcel for the invoice
export async function POST(req: NextRequest) {
  if (!isConfigured()) return NextResponse.json({ error: "Steadfast keys not configured." }, { status: 400 });
  const { saleId, note } = await req.json();

  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: { customer: true, items: { include: { variant: { include: { product: true } } } } },
  });
  if (!sale) return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  if (sale.courierConsignmentId) return NextResponse.json({ error: "A parcel was already created for this invoice." }, { status: 400 });
  if (!sale.customer) return NextResponse.json({ error: "Add a customer with name, phone and address before sending to courier." }, { status: 400 });

  const phone = (sale.customer.phone ?? "").replace(/\D/g, "");
  if (phone.length !== 11) return NextResponse.json({ error: "Customer phone must be an 11-digit number for Steadfast." }, { status: 400 });
  if (!sale.customer.address) return NextResponse.json({ error: "Customer address is required for delivery." }, { status: 400 });

  const items = sale.items.map((i) => `${i.quantity}x ${i.variant.product.name}`).join(", ").slice(0, 250);

  try {
    const consignment = await createOrder({
      invoice: sale.invoiceNo,
      recipient_name: sale.customer.name.slice(0, 100),
      recipient_phone: phone,
      recipient_address: sale.customer.address.slice(0, 250),
      // Collect the outstanding due on delivery (0 if already fully paid).
      cod_amount: Number(sale.dueTotal),
      note: note || undefined,
      item_description: items,
    });

    await prisma.sale.update({
      where: { id: saleId },
      data: {
        courierConsignmentId: String(consignment.consignment_id),
        courierTracking: consignment.tracking_code,
        courierStatus: consignment.status,
      },
    });

    return NextResponse.json({ consignment }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not create the parcel." }, { status: 400 });
  }
}
