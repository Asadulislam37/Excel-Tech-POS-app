import { NextRequest, NextResponse } from "next/server";
import { searchReport, searchReportEmailHtml, logSearch } from "@/lib/search-log";
import { businessSummary } from "@/lib/agent/metrics";
import { sendMail, mailConfigured } from "@/lib/email";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Secret-protected (triggered by the Netlify scheduled function, not a user).
// Public in middleware via the /api/cron prefix; the key is the real gate.
async function run(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!process.env.REPORTS_SECRET || key !== process.env.REPORTS_SECRET)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // TEMP self-test — remove after diagnosis. Confirms Setting write + read.
  if (req.nextUrl.searchParams.get("debug") === "1") {
    const out: Record<string, unknown> = {};
    try {
      await logSearch("debug diagnostic search", 0, "web");
      out.wrote = true;
    } catch (e) {
      out.writeError = e instanceof Error ? e.message : String(e);
    }
    try {
      const all = await prisma.setting.findMany({ where: { key: { startsWith: "search:log:" } }, select: { key: true } });
      out.totalRows = all.length;
      out.sampleKeys = all.slice(0, 3).map((r) => r.key);
    } catch (e) {
      out.readError = e instanceof Error ? e.message : String(e);
    }
    out.report = await searchReport(1).catch((e) => ({ error: String(e) }));
    return NextResponse.json(out);
  }

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
