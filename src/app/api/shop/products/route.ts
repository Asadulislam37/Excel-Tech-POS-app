import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Public storefront catalog — published products only
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const q = sp.get("q")?.trim() ?? "";
  const brand = sp.get("brand")?.trim() ?? "";
  const slug = sp.get("slug")?.trim() ?? "";

  if (slug) {
    const product = await prisma.product.findFirst({
      where: { slug, isPublished: true, isActive: true },
      include: {
        brand: true, category: true, warrantyPolicy: true,
        variants: {
          where: { isActive: true },
          include: {
            color: true, size: true, stockLevels: true,
            _count: { select: { serialUnits: { where: { status: "IN_STOCK" } } } },
          },
        },
      },
    });
    if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 });
    return NextResponse.json(product);
  }

  const [products, brands] = await Promise.all([
    prisma.product.findMany({
      where: {
        isPublished: true, isActive: true,
        ...(brand ? { brand: { name: brand } } : {}),
        ...(q ? { OR: [
          { name: { contains: q, mode: "insensitive" } },
          { brand: { name: { contains: q, mode: "insensitive" } } },
        ] } : {}),
      },
      include: {
        brand: true,
        variants: {
          where: { isActive: true },
          include: {
            color: true, size: true, stockLevels: true,
            _count: { select: { serialUnits: { where: { status: "IN_STOCK" } } } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 60,
    }),
    prisma.brand.findMany({
      where: { products: { some: { isPublished: true, isActive: true } } },
      orderBy: { name: "asc" },
    }),
  ]);
  return NextResponse.json({ products, brands });
}
