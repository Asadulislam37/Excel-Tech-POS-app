import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { applyCourierStatus } from "@/lib/courier";

export const dynamic = "force-dynamic";

// Steadfast delivery-status webhook. Configure this URL in the Steadfast portal:
//   https://exceltechpos.netlify.app/api/webhook/steadfast
// It updates the matching invoice's courier status. Public (no session) by design;
// it matches on the consignment id / tracking code / invoice we already stored.
export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* some webhooks send form data */ }

  const consignmentId = body.consignment_id ?? body.cid;
  const tracking = body.tracking_code ?? body.trackingCode;
  const invoice = body.invoice;
  const status = (body.delivery_status ?? body.status ?? "") as string;

  if (!status) return NextResponse.json({ ok: true });

  const where = consignmentId
    ? { courierConsignmentId: String(consignmentId) }
    : tracking
      ? { courierTracking: String(tracking) }
      : invoice
        ? { invoiceNo: String(invoice) }
        : null;
  if (!where) return NextResponse.json({ ok: true });

  // Resolve the invoice, then apply the status (auto-settling the due on delivery).
  const sale = await prisma.sale.findFirst({ where, select: { id: true } });
  if (sale) await applyCourierStatus(sale.id, status);
  return NextResponse.json({ ok: true });
}

// Some providers verify the endpoint with a GET first.
export async function GET() {
  return NextResponse.json({ ok: true });
}
