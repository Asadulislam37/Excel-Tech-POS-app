import { NextRequest, NextResponse } from "next/server";
import { listPublishedProducts, getPublishedProduct } from "@/lib/catalog";

export const dynamic = "force-dynamic";

// Public storefront catalog — published products only.
// Query + stock logic lives in src/lib/catalog.ts so the storefront and the
// AI agent read the catalog through one shared implementation.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const q = sp.get("q")?.trim() ?? "";
  const brand = sp.get("brand")?.trim() ?? "";
  const slug = sp.get("slug")?.trim() ?? "";

  if (slug) {
    const product = await getPublishedProduct(slug);
    if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 });
    return NextResponse.json(product);
  }

  const { products, brands } = await listPublishedProducts({ q, brand });
  return NextResponse.json({ products, brands });
}
