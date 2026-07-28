// Steadfast Courier API client (https://portal.packzy.com/api/v1).
// Keys live in Netlify env vars STEADFAST_API_KEY / STEADFAST_SECRET_KEY.

const BASE = "https://portal.packzy.com/api/v1";

function headers() {
  const apiKey = process.env.STEADFAST_API_KEY;
  const secret = process.env.STEADFAST_SECRET_KEY;
  if (!apiKey || !secret) throw new Error("Steadfast API keys are not configured.");
  return { "Api-Key": apiKey, "Secret-Key": secret, "Content-Type": "application/json" };
}

export type CreateOrderInput = {
  invoice: string;
  recipient_name: string;
  recipient_phone: string; // 11 digits
  recipient_address: string;
  cod_amount: number;
  note?: string;
  item_description?: string;
};

export type Consignment = {
  consignment_id: number;
  tracking_code: string;
  status: string;
};

export async function createOrder(input: CreateOrderInput): Promise<Consignment> {
  const res = await fetch(`${BASE}/create_order`, {
    method: "POST", headers: headers(), body: JSON.stringify(input),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status !== 200 || !data.consignment) {
    const msg = data?.message || (data?.errors ? JSON.stringify(data.errors) : `Steadfast error (HTTP ${res.status})`);
    throw new Error(typeof msg === "string" ? msg : "Steadfast rejected the order.");
  }
  return data.consignment as Consignment;
}

export async function statusByConsignment(id: string | number): Promise<string> {
  const res = await fetch(`${BASE}/status_by_cid/${id}`, { headers: headers() });
  const data = await res.json().catch(() => ({}));
  return data?.delivery_status ?? "unknown";
}

export async function getBalance(): Promise<number> {
  const res = await fetch(`${BASE}/get_balance`, { headers: headers() });
  const data = await res.json().catch(() => ({}));
  return Number(data?.current_balance ?? 0);
}

export function isConfigured() {
  return Boolean(process.env.STEADFAST_API_KEY && process.env.STEADFAST_SECRET_KEY);
}
