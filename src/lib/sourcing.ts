// Taobao / Pinduoduo / 1688 sourcing price calculator.
// Landed customer price = (RMB × exchangeRate) + flat shipping + flat profit,
// then rounded UP to a clean number (so the customer sees ৳590, not ৳587).
// All four values are owner-editable settings (stored in the Setting table).
import { prisma } from "@/lib/prisma";

export const SOURCING_KEYS = {
  rate: "sourcing_exchange_rate", // BDT per 1 CNY (¥)
  shipping: "sourcing_shipping_flat", // flat BDT per item
  profit: "sourcing_profit_flat", // flat BDT per item
  round: "sourcing_round_step", // round the final price UP to a multiple of this
} as const;

// Sensible starting points — the owner sets their real numbers in /config/ai.
export const SOURCING_DEFAULTS = { rate: 18, shipping: 50, profit: 250, round: 10 };

export type SourcingSettings = { rate: number; shipping: number; profit: number; round: number };

export async function getSourcingSettings(): Promise<SourcingSettings> {
  const rows = await prisma.setting.findMany({ where: { key: { in: Object.values(SOURCING_KEYS) } } });
  const m = new Map(rows.map((r) => [r.key, Number(r.value)]));
  const pick = (k: string, d: number) => {
    const v = m.get(k);
    return Number.isFinite(v) ? (v as number) : d;
  };
  return {
    rate: pick(SOURCING_KEYS.rate, SOURCING_DEFAULTS.rate),
    shipping: pick(SOURCING_KEYS.shipping, SOURCING_DEFAULTS.shipping),
    profit: pick(SOURCING_KEYS.profit, SOURCING_DEFAULTS.profit),
    round: Math.max(1, pick(SOURCING_KEYS.round, SOURCING_DEFAULTS.round)),
  };
}

export async function saveSourcingSettings(s: SourcingSettings): Promise<void> {
  const entries: [string, number][] = [
    [SOURCING_KEYS.rate, s.rate],
    [SOURCING_KEYS.shipping, s.shipping],
    [SOURCING_KEYS.profit, s.profit],
    [SOURCING_KEYS.round, s.round],
  ];
  await Promise.all(
    entries.map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        create: { key, value: String(value) },
        update: { value: String(value) },
      })
    )
  );
}

// ── Sourcing requests (customer photos to source) ────────────────────────────
// Stored in the Setting table (no schema migration) under a namespaced key.
const SR_PREFIX = "agent:sourcing:req:";

export type SourcingRequest = {
  id: string;
  channel: string; // messenger | whatsapp | web
  externalId: string; // PSID / phone
  customerName?: string;
  photoUrl?: string;
  description: string;
  phoneModel: string;
  keywordsChinese: string;
  keywordsEnglish: string;
  status: "pending" | "quoted" | "done";
  createdAt: number;
};

/** Chinese-keyword search links the owner can tap to find the item fast. */
export function searchLinks(keywords: string) {
  const q = encodeURIComponent(keywords || "");
  return {
    taobao: `https://s.taobao.com/search?q=${q}`,
    alibaba1688: `https://s.1688.com/selloffer/offer_search.htm?keywords=${q}`,
    pinduoduo: `https://mobile.yangkeduo.com/search_result.html?search_key=${q}`,
  };
}

export async function saveSourcingRequest(
  r: Omit<SourcingRequest, "id" | "createdAt" | "status"> & { status?: SourcingRequest["status"] }
): Promise<SourcingRequest> {
  const createdAt = Date.now();
  const id = `${createdAt}-${Math.random().toString(36).slice(2, 7)}`;
  const full: SourcingRequest = { id, createdAt, status: r.status ?? "pending", ...r };
  await prisma.setting.create({ data: { key: SR_PREFIX + id, value: JSON.stringify(full) } });
  return full;
}

export async function listSourcingRequests(limit = 20): Promise<SourcingRequest[]> {
  const rows = await prisma.setting.findMany({ where: { key: { startsWith: SR_PREFIX } } });
  const items = rows
    .map((r) => {
      try {
        return JSON.parse(r.value) as SourcingRequest;
      } catch {
        return null;
      }
    })
    .filter((x): x is SourcingRequest => x !== null);
  return items.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
}

export type SourcingQuote = {
  rmb: number;
  rate: number;
  converted: number;
  shipping: number;
  profit: number;
  rawTotal: number;
  finalPrice: number;
  breakdown: string;
};

/** Compute the landed BDT price for an item priced in Chinese Yuan (¥/RMB). */
export function calculateSourcingPrice(
  rmb: number,
  s: SourcingSettings,
  overrides: Partial<Pick<SourcingSettings, "shipping" | "profit">> = {}
): SourcingQuote {
  const shipping = overrides.shipping ?? s.shipping;
  const profit = overrides.profit ?? s.profit;
  const converted = rmb * s.rate;
  const rawTotal = converted + shipping + profit;
  const step = s.round > 0 ? s.round : 1;
  const finalPrice = Math.ceil(rawTotal / step) * step; // round UP to a clean number
  return {
    rmb,
    rate: s.rate,
    converted: Math.round(converted),
    shipping,
    profit,
    rawTotal: Math.round(rawTotal),
    finalPrice,
    breakdown: `¥${rmb} × ${s.rate} = ৳${Math.round(converted)} + ৳${shipping} shipping + ৳${profit} profit = ৳${Math.round(rawTotal)} → ৳${finalPrice}`,
  };
}
