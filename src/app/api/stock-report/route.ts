import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/stock-report?q=&categoryId=&brandId=&type=&filter=in|out|low|all&page=1
// Rows are variants with computed stock; totals cover the whole filtered set.
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const q = p.get("q")?.trim() ?? "";
  const categoryId = p.get("categoryId") ?? "";
  const brandId = p.get("brandId") ?? "";
  const type = p.get("type") ?? "";
  const filter = p.get("filter") || "in";
  const outletId = p.get("outletId") ?? "";
  const page = Math.max(1, Number(p.get("page")) || 1);

  const variants = await prisma.productVariant.findMany({
    where: {
      isActive: true,
      product: {
        isActive: true,
        ...(categoryId && { categoryId }),
        ...(brandId && { brandId }),
        ...(type === "SERIALIZED" || type === "STANDARD" ? { type } : {}),
        ...(q && {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { variants: { some: { sku: { contains: q, mode: "insensitive" as const } } } },
          ],
        }),
      },
    },
    include: {
      product: {
        select: {
          name: true, type: true, imageUrl: true,
          brand: { select: { name: true } },
          category: { select: { name: true } },
          warrantyPolicy: { select: { name: true } },
        },
      },
      color: { select: { name: true } },
      size: { select: { name: true } },
      stockLevels: { where: outletId ? { outletId } : {}, select: { quantity: true } },
      _count: {
        select: {
          serialUnits: { where: { status: "IN_STOCK", ...(outletId && { outletId }) } },
        },
      },
    },
    orderBy: { id: "asc" },
  });

  const all = variants.map((v) => {
    const serialized = v.product.type === "SERIALIZED";
    const stock = serialized
      ? v._count.serialUnits
      : v.stockLevels.reduce((s, l) => s + l.quantity, 0);
    return {
      id: v.id, sku: v.sku, serialized,
      category: v.product.category?.name ?? "", brand: v.product.brand?.name ?? "",
      imageUrl: v.product.imageUrl,
      name: v.product.name,
      variant: [v.color?.name, v.size?.name].filter(Boolean).join(" · "),
      qty: stock,
      costing: Number(v.costPrice), wholesale: Number(v.wholesalePrice ?? 0),
      retail: Number(v.salePrice), mrp: Number(v.mrp ?? 0),
      warranty: v.product.warrantyPolicy?.name ?? "",
      alert: v.reorderLevel,
    };
  }).filter((r) =>
    filter === "in" ? r.qty > 0 :
    filter === "out" ? r.qty === 0 :
    filter === "low" ? r.qty <= r.alert :
    true
  );

  const totalQty = all.reduce((s, r) => s + r.qty, 0);
  const totalValue = all.reduce((s, r) => s + r.qty * r.costing, 0);
  const pageRows = all.slice((page - 1) * 50, page * 50);

  // Attach IN_STOCK serial numbers (IMEIs) for the serialized items on this page.
  const serializedIds = pageRows.filter((r) => r.serialized).map((r) => r.id);
  const serialsByVariant = new Map<string, string[]>();
  if (serializedIds.length) {
    const units = await prisma.serialUnit.findMany({
      where: { variantId: { in: serializedIds }, status: "IN_STOCK", ...(outletId && { outletId }) },
      select: { variantId: true, serialNo: true },
      orderBy: { serialNo: "asc" },
    });
    for (const u of units) {
      const arr = serialsByVariant.get(u.variantId) ?? [];
      arr.push(u.serialNo);
      serialsByVariant.set(u.variantId, arr);
    }
  }
  const rows = pageRows.map((r) => ({ ...r, serials: serialsByVariant.get(r.id) ?? [] }));

  return NextResponse.json({ rows, total: all.length, totalQty, totalValue });
}
