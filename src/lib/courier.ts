import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { postDueCollectionJournal } from "@/lib/sale-journal";

// Steadfast reports the final paid state as exactly "delivered".
// "partial_delivered" and the "*_approval_pending" states are intentionally left
// for the owner to settle by hand, since the collected amount may differ.
const isDelivered = (status: string) => status.trim().toLowerCase() === "delivered";

// Steadfast marks a parcel that came back to the merchant as "cancelled" (some
// payloads say "returned"). Those are the only states where the customer never
// paid, so the invoice's due becomes a real, collectable due again.
export const isParcelReturned = (status?: string | null) =>
  !!status && /cancel|return/i.test(status);

// A due that is currently riding along with a courier parcel (out for delivery,
// not yet delivered or returned) — collected automatically, not by hand.
export const isCourierPending = (sale: { courierConsignmentId?: string | null; courierStatus?: string | null }) =>
  !!sale.courierConsignmentId && !isParcelReturned(sale.courierStatus);

/**
 * Apply a Steadfast status to a sale. On "delivered" the courier has collected the
 * COD, so any remaining due is auto-recorded as a cash payment and the invoice is
 * marked paid (with the matching Cash ↔ Receivable journal). Otherwise it just
 * records the latest courier status label. Idempotent — a fully-paid invoice is
 * only re-stamped with the status.
 */
export async function applyCourierStatus(saleId: string, status: string) {
  if (!isDelivered(status)) {
    await prisma.sale.update({ where: { id: saleId }, data: { courierStatus: status } });
    return;
  }

  await prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findUniqueOrThrow({ where: { id: saleId } });
    if (sale.dueTotal.lte(0)) {
      await tx.sale.update({ where: { id: saleId }, data: { courierStatus: status } });
      return;
    }
    const due = sale.dueTotal;
    await tx.payment.create({
      data: {
        saleId,
        method: "CASH", // cash-on-delivery collected by the courier
        amount: due,
        reference: sale.courierTracking ? `Steadfast COD ${sale.courierTracking}` : "Steadfast COD",
        isDueCollection: true,
      },
    });
    await postDueCollectionJournal(tx, { saleId, invoiceNo: sale.invoiceNo, method: "CASH", amount: Number(due) });
    await tx.sale.update({
      where: { id: saleId },
      data: {
        paidTotal: sale.paidTotal.add(due),
        dueTotal: new Prisma.Decimal(0),
        status: "COMPLETED",
        courierStatus: status,
      },
    });
  }, { timeout: 30000, maxWait: 15000 });
}
