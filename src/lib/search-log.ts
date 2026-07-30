// Website search analytics. Logs each storefront search (query + how many
// results it returned) so the owner can see demand — especially searches that
// returned NOTHING (what customers want that you don't stock).
//
// Stored in the Setting key/value table (no schema migration) under
// `search:log:<ts>-<rand>`. Timestamps are fixed-width ms, so key ranges sort
// chronologically — used for windowed reads and pruning.
import { prisma } from "@/lib/prisma";

const PREFIX = "search:log:";

type LogEntry = { q: string; n: number; s: string; t: number };

// Use startsWith (LIKE 'prefix%') + in-code time filtering. Key-RANGE queries
// (gte/lt) are unreliable here because the DB text collation orders ':' / ';'
// and digits differently than ASCII.
async function pruneOld(days = 60): Promise<void> {
  const cutoff = Date.now() - days * 86400_000;
  const rows = await prisma.setting.findMany({ where: { key: { startsWith: PREFIX } }, select: { key: true, value: true } });
  const oldKeys = rows
    .filter((r) => {
      try {
        return (JSON.parse(r.value) as LogEntry).t < cutoff;
      } catch {
        return false;
      }
    })
    .map((r) => r.key);
  if (oldKeys.length) await prisma.setting.deleteMany({ where: { key: { in: oldKeys } } });
}

/** Record one search. Never throws — logging must not break search. */
export async function logSearch(rawQuery: string, resultCount: number, source: "web" | "chat" = "web"): Promise<void> {
  const q = (rawQuery || "").trim().replace(/\s+/g, " ").slice(0, 80).toLowerCase();
  if (q.length < 2) return; // ignore 1-char / empty noise
  try {
    const t = Date.now();
    await prisma.setting.create({
      data: {
        key: `${PREFIX}${t}-${Math.random().toString(36).slice(2, 7)}`,
        value: JSON.stringify({ q, n: Math.max(0, resultCount | 0), s: source, t } satisfies LogEntry),
      },
    });
    if (Math.random() < 0.03) await pruneOld(); // occasional cleanup
  } catch {
    /* analytics only — swallow */
  }
}

export type SearchReport = {
  from: string;
  days: number;
  totalSearches: number;
  uniqueQueries: number;
  top: { query: string; count: number; zeroResultTimes: number }[];
  unmetDemand: { query: string; times: number }[]; // searches that returned 0 results
};

/** Build the daily demand email (search report + optional today's-sales line). */
export function searchReportEmailHtml(
  report: SearchReport,
  today?: { orders: number; revenue: number; currency: string }
): string {
  const row = (a: string, b: string | number) =>
    `<tr><td style="padding:6px 10px;border-top:1px solid #e3e8ee">${a}</td><td style="padding:6px 10px;border-top:1px solid #e3e8ee;text-align:right;font-weight:600">${b}</td></tr>`;
  const topRows = report.top.length
    ? report.top.map((t) => row(t.query, t.count)).join("")
    : `<tr><td colspan="2" style="padding:10px;color:#67737f">No searches yet.</td></tr>`;
  const unmetRows = report.unmetDemand.length
    ? report.unmetDemand.map((u) => row(u.query, u.times)).join("")
    : `<tr><td colspan="2" style="padding:10px;color:#67737f">Nothing — every search found a result. 🎉</td></tr>`;
  const dateStr = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const salesLine = today
    ? `<p style="margin:0 0 4px"><b>Today so far:</b> ${today.orders} order(s), ${today.currency === "BDT" ? "৳" : ""}${today.revenue.toLocaleString()} revenue.</p>`
    : "";

  return `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:auto;color:#1b2430">
    <div style="background:#026a40;color:#fff;padding:18px 24px;border-radius:10px 10px 0 0">
      <h2 style="margin:0;font-size:18px">Excel Tech — Daily Demand</h2>
      <div style="font-size:12px;opacity:.85">${dateStr}</div>
    </div>
    <div style="border:1px solid #e3e8ee;border-top:none;padding:20px 24px;border-radius:0 0 10px 10px">
      ${salesLine}
      <p style="margin:0 0 14px;color:#67737f;font-size:13px">${report.totalSearches} searches (last ${report.days === 1 ? "24h" : report.days + " days"}), ${report.uniqueQueries} unique.</p>

      <h3 style="margin:16px 0 6px;font-size:14px;color:#024d2f">🔎 Unmet demand — searched but NOT found</h3>
      <p style="margin:0 0 6px;font-size:12px;color:#67737f">These are your best stocking / sourcing opportunities.</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px"><tbody>${unmetRows}</tbody></table>

      <h3 style="margin:20px 0 6px;font-size:14px;color:#024d2f">Top searches</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px"><tbody>${topRows}</tbody></table>

      <p style="margin:18px 0 0;font-size:11px;color:#98a2ad">Automated daily report from your Excel Tech POS AI.</p>
    </div>
  </div>`;
}

/** Aggregate searches over the last `days` (default 1 = last 24h). */
export async function searchReport(days = 1): Promise<SearchReport> {
  const cutoff = Date.now() - days * 86400_000;
  const rows = await prisma.setting.findMany({ where: { key: { startsWith: PREFIX } } });
  const entries = rows
    .map((r) => {
      try {
        return JSON.parse(r.value) as LogEntry;
      } catch {
        return null;
      }
    })
    .filter((x): x is LogEntry => x !== null && x.t >= cutoff);

  const byQ = new Map<string, { count: number; zero: number }>();
  for (const e of entries) {
    const cur = byQ.get(e.q) ?? { count: 0, zero: 0 };
    cur.count += 1;
    if ((e.n ?? 0) === 0) cur.zero += 1;
    byQ.set(e.q, cur);
  }

  const all = [...byQ.entries()].map(([query, v]) => ({ query, count: v.count, zeroResultTimes: v.zero }));
  return {
    from: new Date(cutoff).toISOString(),
    days,
    totalSearches: entries.length,
    uniqueQueries: byQ.size,
    top: [...all].sort((a, b) => b.count - a.count).slice(0, 25),
    unmetDemand: all
      .filter((x) => x.zeroResultTimes > 0)
      .sort((a, b) => b.zeroResultTimes - a.zeroResultTimes)
      .map((x) => ({ query: x.query, times: x.zeroResultTimes }))
      .slice(0, 25),
  };
}
