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

type NewVariant = { sku?: string; colorId?: string; sizeId?: string; costPrice: number; wholesalePrice?: number; salePrice: number; mrp?: number; barcode?: string };

/** Next free auto SKU in the ET#### series (continues past the highest existing one). */
async function nextAutoSku(taken: Set<string>) {
  const rows = await prisma.productVariant.findMany({
    where: { sku: { startsWith: "ET" } }, select: { sku: true },
  });
  let max = 999; // so the first auto SKU is ET1000
  for (const r of rows) {
    const m = /^ET(\d+)$/.exec(r.sku);
    if (m) max = Math.max(max, Number(m[1]));
  }
  let n = max + 1;
  while (taken.has(`ET${n}`)) n++;
  const sku = `ET${n}`;
  taken.add(sku);
  return sku;
}

// POST /api/products — create product + variants (SKU auto-generates if left blank)
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, type, brandId, categoryId, warrantyPolicyId, imageUrl, variants } = body as {
    name: string; type: string; brandId?: string; categoryId?: string; warrantyPolicyId?: string; imageUrl?: string; variants: NewVariant[];
  };
  if (!name || !variants?.length) {
    return NextResponse.json({ error: "Name and at least one variant are required." }, { status: 400 });
  }
  const slug =
    name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Date.now().toString(36);

  // Resolve each variant's SKU: keep what was typed, auto-generate the rest.
  const taken = new Set<string>(variants.map((v) => (v.sku ?? "").trim()).filter(Boolean));
  const prepared = [];
  for (const v of variants) {
    const sku = (v.sku ?? "").trim() || (await nextAutoSku(taken));
    prepared.push({ ...v, sku });
  }
  // Reject a manually-typed SKU that already exists in the catalog.
  const manual = prepared.map((v) => v.sku);
  const clash = await prisma.productVariant.findFirst({ where: { sku: { in: manual } }, select: { sku: true } });
  if (clash) return NextResponse.json({ error: `SKU "${clash.sku}" already exists. Use a different code or leave it blank to auto-generate.` }, { status: 400 });

  try {
    const product = await prisma.product.create({
      data: {
        name,
        slug,
        type: type === "SERIALIZED" ? "SERIALIZED" : "STANDARD",
        brandId: brandId || undefined,
        categoryId: categoryId || undefined,
        warrantyPolicyId: warrantyPolicyId || undefined,
        imageUrl: imageUrl || undefined,
        variants: {
          create: prepared.map((v) => ({
            sku: v.sku,
            barcode: v.barcode || undefined,
            colorId: v.colorId || undefined,
            sizeId: v.sizeId || undefined,
            costPrice: v.costPrice || 0,
            wholesalePrice: v.wholesalePrice || undefined,
            salePrice: v.salePrice || v.mrp || 0,
            mrp: v.mrp || undefined,
          })),
        },
      },
      include: { variants: true },
    });
    return NextResponse.json(product, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Could not create the product. A SKU may be duplicated." }, { status: 400 });
  }
}
