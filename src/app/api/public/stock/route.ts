import { NextRequest, NextResponse } from "next/server";
import { publicStockBySku } from "@/lib/catalog";
import { corsHeaders } from "@/lib/cors";

export const dynamic = "force-dynamic";

// Live stock keyed by SKU — lightweight endpoint for frequent checks (e.g. the
// website refreshing stock, or verifying at checkout).
// GET  /api/public/stock                 → { sku: stock, ... } for all published
// GET  /api/public/stock?skus=A,B,C      → only those SKUs
// POST /api/public/stock { skus: [...] } → only those SKUs
export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("skus");
  const skus = raw ? raw.split(",").map((s) => s.trim()).filter(Boolean) : undefined;
  const stock = await publicStockBySku(skus);
  return NextResponse.json({ stock, updatedAt: new Date().toISOString() }, { headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const skus = Array.isArray((body as { skus?: unknown }).skus)
    ? ((body as { skus: unknown[] }).skus.filter((s): s is string => typeof s === "string"))
    : undefined;
  const stock = await publicStockBySku(skus);
  return NextResponse.json({ stock, updatedAt: new Date().toISOString() }, { headers: corsHeaders });
}
