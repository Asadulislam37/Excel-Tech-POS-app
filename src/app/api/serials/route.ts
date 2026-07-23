import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/serials?variantId=&status=IN_STOCK  → pickable units for POS
// GET /api/serials?serial=356789...            → full trace for one IMEI
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const serial = sp.get("serial")?.trim();

  if (serial) {
    const unit = await prisma.serialUnit.findFirst({
      where: { serialNo: { contains: serial } },
      include: {
        variant: { include: { product: { include: { brand: true, warrantyPolicy: true } }, color: true, size: true } },
        saleItem: { include: { sale: { include: { customer: true } } } },
        purchaseItem: { include: { purchase: { include: { supplier: true } } } },
        warrantyClaims: { orderBy: { receivedAt: "desc" } },
      },
    });
    if (!unit) return NextResponse.json({ error: "No unit found with this serial/IMEI." }, { status: 404 });
    return NextResponse.json(unit);
  }

  const variantId = sp.get("variantId");
  const status = sp.get("status") ?? "IN_STOCK";
  if (!variantId) return NextResponse.json({ error: "variantId or serial is required." }, { status: 400 });
  const units = await prisma.serialUnit.findMany({
    where: { variantId, status: status as never },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(units);
}

// POST /api/serials — bulk add serials to a variant (quick stock-in)
export async function POST(req: NextRequest) {
  const { variantId, serials, costPrice } = await req.json();
  if (!variantId || !serials?.length)
    return NextResponse.json({ error: "variantId and serials[] are required." }, { status: 400 });

  const outlet =
    (await prisma.outlet.findFirst({ where: { isDefault: true } })) ?? (await prisma.outlet.findFirst());
  if (!outlet) return NextResponse.json({ error: "No outlet configured. Run the seed script." }, { status: 400 });

  const clean: string[] = [...new Set((serials as string[]).map((s) => s.trim()).filter(Boolean))];
  const dupes = await prisma.serialUnit.findMany({ where: { serialNo: { in: clean } }, select: { serialNo: true } });
  if (dupes.length)
    return NextResponse.json(
      { error: `Already in system: ${dupes.map((d) => d.serialNo).join(", ")}` },
      { status: 409 }
    );

  await prisma.$transaction(async (tx) => {
    await tx.serialUnit.createMany({
      data: clean.map((serialNo) => ({
        serialNo,
        variantId,
        outletId: outlet.id,
        costPrice: costPrice || undefined,
      })),
    });
    const updated = await tx.stockLevel.upsert({
      where: { variantId_outletId: { variantId, outletId: outlet.id } },
      create: { variantId, outletId: outlet.id, quantity: clean.length },
      update: { quantity: { increment: clean.length } },
    });
    await tx.stockLedger.create({
      data: {
        variantId,
        outletId: outlet.id,
        reason: "ADJUSTMENT",
        quantity: clean.length,
        balance: updated.quantity,
        refType: "SerialStockIn",
        note: `Added ${clean.length} serial(s)`,
      },
    });
  });

  return NextResponse.json({ added: clean.length }, { status: 201 });
}
