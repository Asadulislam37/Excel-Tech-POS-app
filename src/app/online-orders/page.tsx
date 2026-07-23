"use client";

import { useCallback, useEffect, useState } from "react";
import { taka, dt } from "@/lib/format";

type Order = {
  id: string; orderNo: string; customerName: string; phone: string; address: string; area: string;
  payMethod: string; payReference?: string | null; status: string; note?: string | null;
  subTotal: string; deliveryCharge: string; grandTotal: string; createdAt: string;
  items: { name: string; variant?: string | null; quantity: number; unitPrice: string }[];
};

const BADGE: Record<string, string> = {
  PENDING: "bg-ambersoft text-amber", CONFIRMED: "bg-tealsoft text-tealdark",
  DELIVERED: "bg-tealsoft text-tealdark", CANCELLED: "bg-redsoft text-red",
};

export default function OnlineOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/shop/orders");
    if (res.ok) setOrders(await res.json());
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = async (id: string, action: string) => {
    setErr(""); setBusy(id + action);
    const res = await fetch(`/api/shop/orders/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }),
    });
    const data = await res.json();
    setBusy("");
    if (!res.ok) return setErr(data.error);
    load();
  };

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-bold">Online orders</h1>
      <p className="text-[13px] text-muted">Confirming an order converts it into a POS sale — stock and IMEIs are assigned automatically (oldest first). COD payment is collected when you mark it delivered.</p>
      {err && <div className="rounded-md bg-redsoft px-3 py-2 text-[12px] font-semibold text-red">{err}</div>}
      <div className="space-y-3">
        {orders.map((o) => (
          <div key={o.id} className="card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[13px] font-bold">{o.orderNo}</span>
              <span className={`rounded px-2 py-0.5 text-[11px] font-bold ${BADGE[o.status]}`}>{o.status}</span>
              <span className="rounded bg-paper px-2 py-0.5 text-[11px] font-semibold">{o.payMethod}{o.payReference && ` · ${o.payReference}`}</span>
              <span className="ml-auto text-[12px] text-muted">{dt(o.createdAt)}</span>
            </div>
            <div className="mt-2 grid gap-3 sm:grid-cols-[1fr_auto]">
              <div>
                <div className="text-[13px] font-semibold">{o.customerName} · <span className="font-mono">{o.phone}</span></div>
                <div className="text-[12px] text-muted">{o.address} ({o.area === "INSIDE_DHAKA" ? "Inside Dhaka" : "Outside Dhaka"})</div>
                {o.note && <div className="mt-1 text-[12px] italic text-muted">"{o.note}"</div>}
                <div className="mt-2 space-y-0.5 text-[13px]">
                  {o.items.map((i, k) => (
                    <div key={k}>{i.quantity}× {i.name} {i.variant && <span className="text-muted">({i.variant})</span>} — {taka(Number(i.unitPrice) * i.quantity)}</div>
                  ))}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[12px] text-muted">incl. delivery {taka(o.deliveryCharge)}</div>
                <div className="text-xl font-bold">{taka(o.grandTotal)}</div>
                <div className="mt-2 flex justify-end gap-2">
                  {o.status === "PENDING" && (
                    <>
                      <button className="btn btn-ghost text-red" disabled={!!busy} onClick={() => act(o.id, "CANCEL")}>Cancel</button>
                      <button className="btn btn-primary" disabled={!!busy} onClick={() => act(o.id, "CONFIRM")}>
                        {busy === o.id + "CONFIRM" ? "Confirming…" : "Confirm"}
                      </button>
                    </>
                  )}
                  {o.status === "CONFIRMED" && (
                    <button className="btn btn-primary" disabled={!!busy} onClick={() => act(o.id, "DELIVER")}>
                      {busy === o.id + "DELIVER" ? "Saving…" : "Mark delivered"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
        {orders.length === 0 && <div className="card py-14 text-center text-sm text-muted">No online orders yet. Share your shop link once deployed!</div>}
      </div>
    </div>
  );
}
