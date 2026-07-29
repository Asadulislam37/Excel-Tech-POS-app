import { prisma } from "@/lib/prisma";

// Shop-wide delivery charge, stored in the Setting (key/value) table so the
// owner can change it in Configuration instead of typing it on every order.
export const DELIVERY_KEYS = {
  inside: "delivery_inside_dhaka",
  outside: "delivery_outside_dhaka",
} as const;

// Fallbacks used until the owner saves their own values.
export const DELIVERY_DEFAULTS = { insideDhaka: 80, outsideDhaka: 120 };

export type DeliveryCharges = { insideDhaka: number; outsideDhaka: number };

/** Read the configured Inside/Outside Dhaka delivery charges (with defaults). */
export async function getDeliveryCharges(): Promise<DeliveryCharges> {
  const rows = await prisma.setting.findMany({
    where: { key: { in: [DELIVERY_KEYS.inside, DELIVERY_KEYS.outside] } },
  });
  const map = new Map(rows.map((r) => [r.key, Number(r.value)]));
  const inside = map.get(DELIVERY_KEYS.inside);
  const outside = map.get(DELIVERY_KEYS.outside);
  return {
    insideDhaka: Number.isFinite(inside) ? (inside as number) : DELIVERY_DEFAULTS.insideDhaka,
    outsideDhaka: Number.isFinite(outside) ? (outside as number) : DELIVERY_DEFAULTS.outsideDhaka,
  };
}

// ── Pre-orders ────────────────────────────────────────────────────────────────
// A shop-wide switch: when on, the AI agent may take orders for out-of-stock
// items (customer pays/receives when stock arrives). Off by default.
export const PREORDER_KEY = "preorder_enabled";

export async function getPreorderEnabled(): Promise<boolean> {
  const row = await prisma.setting.findUnique({ where: { key: PREORDER_KEY } });
  return row?.value === "1";
}

export async function savePreorderEnabled(enabled: boolean): Promise<void> {
  const value = enabled ? "1" : "0";
  await prisma.setting.upsert({
    where: { key: PREORDER_KEY },
    create: { key: PREORDER_KEY, value },
    update: { value },
  });
}

/** Persist both delivery charges. */
export async function saveDeliveryCharges(charges: DeliveryCharges) {
  const entries: [string, number][] = [
    [DELIVERY_KEYS.inside, charges.insideDhaka],
    [DELIVERY_KEYS.outside, charges.outsideDhaka],
  ];
  await Promise.all(
    entries.map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        create: { key, value: String(Math.max(0, Math.round(value) || 0)) },
        update: { value: String(Math.max(0, Math.round(value) || 0)) },
      })
    )
  );
}
