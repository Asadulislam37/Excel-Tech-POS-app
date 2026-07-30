import { NextRequest, NextResponse } from "next/server";
import { searchReport, searchReportEmailHtml } from "@/lib/search-log";
import { businessSummary } from "@/lib/agent/metrics";
import { sendMail, mailConfigured } from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Secret-protected (triggered by the Netlify scheduled function, not a user).
// Public in middleware via the /api/cron prefix; the key is the real gate.
async function run(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!process.env.REPORTS_SECRET || key !== process.env.REPORTS_SECRET)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [report, summary] = await Promise.all([searchReport(1), businessSummary()]);
  const to = process.env.REPORT_EMAIL || process.env.SMTP_USER;
  if (!mailConfigured() || !to)
    return NextResponse.json({ ok: false, error: "Email not configured (SMTP_* / REPORT_EMAIL)." });

  const html = searchReportEmailHtml(report, {
    orders: summary.today.orders,
    revenue: summary.today.revenue,
    currency: summary.currency,
  });
  const r = await sendMail({ to, subject: "Excel Tech — daily demand report", html });
  return NextResponse.json({
    ok: r.sent,
    to,
    totalSearches: report.totalSearches,
    unmetDemand: report.unmetDemand.length,
  });
}

export async function GET(req: NextRequest) {
  return run(req);
}
export async function POST(req: NextRequest) {
  return run(req);
}
