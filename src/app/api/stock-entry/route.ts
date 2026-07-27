import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma, ProductType } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

// GET /api/stock-entry?q=&categoryId=&brandId=&type=&page=1
// Flat variant list with current stock — the grid used for bulk stock entry.
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const q = p.get("q")?.trim() ?? "";
  const categoryId = p.get("categoryId") ?? "";
  const brandId = p.get("brandId") ?? "";
  const type = p.get("type") ?? "";
  const page = Math.max(1, Number(p.get("page")) || 1);

  const where: Prisma.ProductVariantWhereInput = {
    isActive: true,
    product: {
      isActive: true,
      ...(categoryId && { categoryId }),
      ...(brandId && { brandId }),
      ...(type === "SERIALIZED" || type === "STANDARD" ? { type: type as ProductType } : {}),
      ...(q && {
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { variants: { some: { sku: { contains: q, mode: "insensitive" as const } } } },
        ],
      }),
    },
  };

  const [total, variants] = await Promise.all([
    prisma.productVariant.count({ where }),
    prisma.productVariant.findMany({
      where,
      include: {
        product: { select: { name: true, type: true, brand: { select: { name: true } }, category: { select: { name: true } } } },
        color: { select: { name: true } },
        size: { select: { name: true } },
        stockLevels: { select: { quantity: true } },
        _count: { select: { serialUnits: { where: { status: "IN_STOCK" } } } },
      },
      orderBy: { id: "asc" },
      skip: (page - 1) * 50,
      take: 50,
    }),
  ]);

  return NextResponse.json({
    total,
    rows: variants.map((v) => ({
      id: v.id, sku: v.sku, name: v.product.name, type: v.product.type,
      brand: v.product.brand?.name ?? "", category: v.product.category?.name ?? "",
      variant: [v.color?.name, v.size?.name].filter(Boolean).join(" · "),
      costing: Number(v.costPrice),
      stock: v.product.type === "SERIALIZED"
        ? v._count.serialUnits
        : v.stockLevels.reduce((s, l) => s + l.quantity, 0),
    })),
  });
}

// POST /api/stock-entry { mode: "set" | "add", entries: [{ variantId, quantity }] }
// Bulk opening-stock / adjustment entry for quantity-tracked products.
export async function POST(req: NextRequest) {
  const { mode, entries } = await req.json();
  if (!Array.isArray(entries) || entries.length === 0)
    return NextResponse.json({ error: "No stock entries supplied." }, { status: 400 });

  const outlet =
    (await prisma.outlet.findFirst({ where: { isDefault: true } })) ?? (await prisma.outlet.findFirst());
  if (!outlet) return NextResponse.json({ error: "No outlet configured." }, { status: 400 });

  try {
    const result = await prisma.$transaction(async (tx) => {
      let updated = 0;
      const skipped: string[] = [];

      for (const e of entries) {
        const qty = Math.trunc(Number(e.quantity));
        if (!e.variantId || !Number.isFinite(qty) || qty < 0) continue;

        const variant = await tx.productVariant.findUnique({
          where: { id: e.variantId },
          include: { product: { select: { name: true, type: true } } },
        });
        if (!variant) continue;

        // IMEI-tracked units must come in with their serial numbers.
        if (variant.product.type === "SERIALIZED") { skipped.push(variant.sku); continue; }

        const level = await tx.stockLevel.upsert({
          where: { variantId_outletId: { variantId: variant.id, outletId: outlet.id } },
          create: { variantId: variant.id, outletId: outlet.id, quantity: 0 },
          update: {},
        });
        const newQty = mode === "add" ? level.quantity + qty : qty;
        const delta = newQty - level.quantity;
        if (delta === 0) continue;

        await tx.stockLevel.update({ where: { id: level.id }, data: { quantity: newQty } });
        await tx.stockLedger.create({
          data: {
            variantId: variant.id, outletId: outlet.id,
            reason: mode === "add" ? "ADJUSTMENT" : "OPENING",
            quantity: delta, balance: newQty,
            refType: "StockEntry",
            note: mode === "add" ? `Stock in ${qty}` : `Opening stock set to ${qty}`,
          },
        });
        updated++;
      }
      return { updated, skipped };
    }, { timeout: 30000 });

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Stock entry failed." }, { status: 400 });
  }
}
