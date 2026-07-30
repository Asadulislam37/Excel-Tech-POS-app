import { NextRequest, NextResponse } from "next/server";
import { logSearch } from "@/lib/search-log";

export const dynamic = "force-dynamic";

// Public cross-origin endpoint: the exceltech.com.bd site sends each customer
// search here so it appears in the demand report. Kept dead-simple and safe —
// it only records a search term; it can't read or change anything on the site.
const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

// POST { q, results? } — used by navigator.sendBeacon / fetch from the site.
export async function POST(req: NextRequest) {
  const raw = await req.text();
  let q = "";
  let results = -1;
  try {
    const b = JSON.parse(raw || "{}") as { q?: unknown; results?: unknown };
    if (typeof b.q === "string") q = b.q;
    if (b.results != null && Number.isFinite(Number(b.results))) results = Number(b.results);
  } catch {
    /* ignore malformed bodies */
  }
  if (q) await logSearch(q, results, "site");
  return new NextResponse(null, { status: 204, headers: CORS });
}

// GET ?q=…&results=… — handy for an <img> pixel or quick testing.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const rp = req.nextUrl.searchParams.get("results");
  const results = rp != null && Number.isFinite(Number(rp)) ? Number(rp) : -1;
  if (q) await logSearch(q, results, "site");
  return new NextResponse(null, { status: 204, headers: CORS });
}
