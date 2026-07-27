import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/products?q=redmi&status=active|inactive&categoryId=&brandId=&page=1
// Returns up to 50 products per page; total count in the x-total-count header.
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const q = p.get("q")?.trim() ?? "";
  const isActive = p.get("status") !== "inactive";
  const categoryId = p.get("categoryId") ?? "";
  const brandId = p.get("brandId") ?? "";
  const page = Math.max(1, Number(p.get("page")) || 1);
  const where = {
      isActive,
      ...(categoryId && { categoryId }),
      ...(brandId && { brandId }),
      ...(q && {
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { brand: { name: { contains: q, mode: "insensitive" as const } } },
          { variants: { some: { OR: [{ sku: { contains: q, mode: "insensitive" as const } }, { barcode: q }] } } },
        ],
      }),
  };
  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
    where,
    include: {
      brand: true,
      category: true,
      warrantyPolicy: true,
      variants: {
        where: { isActive: true },
        include: {
          color: true,
          size: true,
          stockLevels: true,
          _count: { select: { serialUnits: { where: { status: "IN_STOCK" } } } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * 50,
    take: 50,
    }),
  ]);
  return NextResponse.json(products, { headers: { "x-total-count": String(total) } });
}

// POST /api/products — create product + variants
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, type, brandId, categoryId, warrantyPolicyId, variants } = body;
  if (!name || !variants?.length) {
    return NextResponse.json({ error: "Name and at least one variant are required." }, { status: 400 });
  }
  const slug =
    name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Date.now().toString(36);

  const product = await prisma.product.create({
    data: {
      name,
      slug,
      type: type === "SERIALIZED" ? "SERIALIZED" : "STANDARD",
      brandId: brandId || undefined,
      categoryId: categoryId || undefined,
      warrantyPolicyId: warrantyPolicyId || undefined,
      variants: {
        create: variants.map((v: { sku: string; colorId?: string; sizeId?: string; costPrice: number; salePrice: number; mrp?: number; barcode?: string }) => ({
          sku: v.sku,
          barcode: v.barcode || undefined,
          colorId: v.colorId || undefined,
          sizeId: v.sizeId || undefined,
          costPrice: v.costPrice,
          salePrice: v.salePrice,
          mrp: v.mrp || undefined,
        })),
      },
    },
    include: { variants: true },
  });
  return NextResponse.json(product, { status: 201 });
}
