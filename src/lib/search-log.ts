// Website search analytics. Logs each storefront search (query + how many
// results it returned) so the owner can see demand — especially searches that
// returned NOTHING (what customers want that you don't stock).
//
// Stored in the Setting key/value table (no schema migration) under
// `search:log:<ts>-<rand>`. Timestamps are fixed-width ms, so key ranges sort
// chronologically — used for windowed reads and pruning.
import { prisma } from "@/lib/prisma";

const PREFIX = "search:log:";
const KEY_END = "search:log;"; // ';' = ':'+1, upper bound for the prefix range

type LogEntry = { q: string; n: number; s: string; t: number };

async function pruneOld(days = 60): Promise<void> {
  const cutoff = Date.now() - days * 86400_000;
  await prisma.setting.deleteMany({ where: { key: { gte: PREFIX, lt: `${PREFIX}${cutoff}` } } });
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

/** Aggregate searches over the last `days` (default 1 = last 24h). */
export async function searchReport(days = 1): Promise<SearchReport> {
  const cutoff = Date.now() - days * 86400_000;
  const rows = await prisma.setting.findMany({
    where: { key: { gte: `${PREFIX}${cutoff}`, lt: KEY_END } },
  });
  const entries = rows
    .map((r) => {
      try {
        return JSON.parse(r.value) as LogEntry;
      } catch {
        return null;
      }
    })
    .filter((x): x is LogEntry => x !== null);

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
