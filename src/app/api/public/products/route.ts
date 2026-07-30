import { NextRequest, NextResponse } from "next/server";
import { listPublicCatalog } from "@/lib/catalog";
import { corsHeaders } from "@/lib/cors";

export const dynamic = "force-dynamic";

// Public catalog for the exceltech.com.bd website (the POS is the source of truth).
// GET /api/public/products            → all published products with live stock
// GET /api/public/products?slug=xxx   → one product
export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug")?.trim() || undefined;
  const products = await listPublicCatalog(slug);
  return NextResponse.json(
    { products, count: products.length, updatedAt: new Date().toISOString() },
    { headers: corsHeaders }
  );
}
