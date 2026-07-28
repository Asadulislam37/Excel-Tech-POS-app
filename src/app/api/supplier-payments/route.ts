import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ACC, METHOD_ACCOUNT, nextVoucherNo, postJournal } from "@/lib/accounting";
import { PaymentMethod } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

// GET /api/supplier-payments → suppliers with outstanding dues + recent payments
export async function GET() {
  const [suppliers, payments] = await Promise.all([
    prisma.supplier.findMany({
      include: { purchases: { select: { dueTotal: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.supplierPayment.findMany({
      include: { supplier: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  return NextResponse.json({
    suppliers: suppliers.map((s) => ({
      id: s.id, name: s.name, phone: s.phone ?? "",
      due: s.purchases.reduce((t, p) => t + Number(p.dueTotal), 0),
    })),
    payments: payments.map((p) => ({
      id: p.id, supplier: p.supplier.name, method: p.method,
      amount: Number(p.amount), reference: p.reference ?? "", createdAt: p.createdAt,
    })),
  });
}

// POST /api/supplier-payments { supplierId, method, amount, reference, note }
export async function POST(req: NextRequest) {
  const { supplierId, method, amount, reference, note } = await req.json();
  const amt = Number(amount);
  if (!supplierId) return NextResponse.json({ error: "Choose a supplier." }, { status: 400 });
  if (!Number.isFinite(amt) || amt <= 0)
    return NextResponse.json({ error: "Amount must be greater than zero." }, { status: 400 });

  const payCode = METHOD_ACCOUNT[method] ?? METHOD_ACCOUNT.CASH;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.findUniqueOrThrow({ where: { id: supplierId } });

      const payment = await tx.supplierPayment.create({
        data: {
          supplierId,
          method: (method ?? "CASH") as PaymentMethod,
          amount: amt,
          reference: reference || undefined,
          note: note || undefined,
        },
      });

      // Clear the oldest outstanding purchases first.
      let left = amt;
      const dues = await tx.purchase.findMany({
        where: { supplierId, dueTotal: { gt: 0 } },
        orderBy: { createdAt: "asc" },
      });
      for (const pu of dues) {
        if (left <= 0) break;
        const pay = Math.min(left, Number(pu.dueTotal));
        await tx.purchase.update({
          where: { id: pu.id },
          data: { paidTotal: { increment: pay }, dueTotal: { decrement: pay } },
        });
        left -= pay;
      }

      const voucherNo = await nextVoucherNo(tx, "SPY");
      await postJournal(tx, {
        voucherNo,
        memo: `Payment to ${supplier.name}`,
        refType: "SupplierPayment",
        refId: payment.id,
        lines: [
          { code: ACC.PAYABLE, debit: amt }, // supplier due down
          { code: payCode, credit: amt },    // cash out
        ],
      });

      return { payment, unapplied: left };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Payment failed." }, { status: 400 });
  }
}
