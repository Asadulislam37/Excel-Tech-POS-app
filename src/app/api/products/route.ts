import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/products?q=redmi&status=active|inactive&categoryId=&brandId=
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const q = p.get("q")?.trim() ?? "";
  const isActive = p.get("status") !== "inactive";
  const categoryId = p.get("categoryId") ?? "";
  const brandId = p.get("brandId") ?? "";
  const products = await prisma.product.findMany({
    where: {
      isActive,
      ...(categoryId && { categoryId }),
      ...(brandId && { brandId }),
      ...(q && {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { brand: { name: { contains: q, mode: "insensitive" } } },
          { variants: { some: { OR: [{ sku: { contains: q, mode: "insensitive" } }, { barcode: q }] } } },
        ],
      }),
    },
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
    take: 50,
  });
  return NextResponse.json(products);
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
