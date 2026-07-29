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
