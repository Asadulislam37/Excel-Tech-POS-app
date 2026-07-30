// CORS headers for endpoints the exceltech.com.bd website calls cross-origin.
// Open by default (public read-only catalog/stock); tighten to the domain later
// via CORS_ALLOW_ORIGIN if desired.
export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": process.env.CORS_ALLOW_ORIGIN || "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "public, max-age=15", // brief cache; stock stays near-live
};
