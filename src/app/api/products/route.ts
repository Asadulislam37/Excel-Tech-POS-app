import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/products?q=redmi  → products with variants, stock, in-stock serial counts
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const products = await prisma.product.findMany({
    where: q
      ? {
          isActive: true,
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { brand: { name: { contains: q, mode: "insensitive" } } },
            { variants: { some: { OR: [{ sku: { contains: q, mode: "insensitive" } }, { barcode: q }] } } },
          ],
        }
      : { isActive: true },
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
        create: variants.map((v: { sku: string; colorId?: string; sizeId?: string; costPrice: number; salePrice: number; barcode?: string }) => ({
          sku: v.sku,
          barcode: v.barcode || undefined,
          colorId: v.colorId || undefined,
          sizeId: v.sizeId || undefined,
          costPrice: v.costPrice,
          salePrice: v.salePrice,
        })),
      },
    },
    include: { variants: true },
  });
  return NextResponse.json(product, { status: 201 });
}
