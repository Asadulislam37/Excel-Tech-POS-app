"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { taka, dt } from "@/lib/format";
import { Banknote, ReceiptText, Smartphone, AlertTriangle } from "lucide-react";

type Dash = {
  todaySales: number; todayTotal: number; todayCollected: number; totalDue: number; phonesInStock: number;
  lowStock: { id: string; quantity: number; variant: { sku: string; product: { name: string } } }[];
  recent: { id: string; invoiceNo: string; grandTotal: string; dueTotal: string; createdAt: string;
    customer?: { name: string } | null;
    items: { variant: { product: { name: string } } }[] }[];
};

export default function Dashboard() {
  const [d, setD] = useState<Dash | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    fetch("/api/dashboard").then(async (r) => {
      if (r.ok) setD(await r.json());
      else setErr("Could not load dashboard. Check your DATABASE_URL and run the seed script.");
    }).catch(() => setErr("Could not reach the database. Check your DATABASE_URL in .env."));
  }, []);

  if (err) return <div className="card mx-auto max-w-lg p-6 text-center text-sm text-muted">{err}</div>;
  if (!d) return <div className="py-20 text-center text-sm text-muted">Loading…</div>;

  const stats = [
    { label: "Today's sales", value: taka(d.todayTotal), sub: `${d.todaySales} invoices`, icon: ReceiptText },
    { label: "Collected today", value: taka(d.todayCollected), sub: "all payment methods", icon: Banknote },
    { label: "Total outstanding due", value: taka(d.totalDue), sub: "across all customers", icon: AlertTriangle },
    { label: "Units in stock", value: String(d.phonesInStock), sub: "serialized (IMEI) items", icon: Smartphone },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card p-4">
            <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-muted">
              <s.icon size={14} /> {s.label}
            </div>
            <div className="mt-2 text-2xl font-bold">{s.value}</div>
            <div className="text-[12px] text-muted">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <h2 className="font-bold">Recent invoices</h2>
            <Link href="/sales/history" className="text-[12px] font-semibold text-tealdark">View all</Link>
          </div>
          <table className="w-full">
            <thead><tr><th className="th">Invoice</th><th className="th">Customer</th><th className="th">Items</th><th className="th text-right">Total</th></tr></thead>
            <tbody>
              {d.recent.map((s) => (
                <tr key={s.id}>
                  <td className="td"><div className="font-mono text-[12px]">{s.invoiceNo}</div><div className="text-[11px] text-muted">{dt(s.createdAt)}</div></td>
                  <td className="td">{s.customer?.name ?? "Walk-in"}</td>
                  <td className="td text-muted">{s.items.map((i) => i.variant.product.name).slice(0, 2).join(", ")}{s.items.length > 2 && "…"}</td>
                  <td className="td text-right font-semibold">{taka(s.grandTotal)}{Number(s.dueTotal) > 0 && <div className="text-[11px] font-semibold text-amber">due {taka(s.dueTotal)}</div>}</td>
                </tr>
              ))}
              {d.recent.length === 0 && <tr><td className="td text-center text-muted" colSpan={4}>No sales yet — create your first invoice.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="card p-4">
          <h2 className="font-bold">Low stock</h2>
          <div className="mt-2 space-y-2">
            {d.lowStock.map((l) => (
              <div key={l.id} className="flex items-center justify-between rounded-md bg-paper px-3 py-2 text-[13px]">
                <div><div className="font-semibold">{l.variant.product.name}</div><div className="text-[11px] text-muted">{l.variant.sku}</div></div>
                <span className={`rounded px-2 py-0.5 text-[11px] font-bold ${l.quantity === 0 ? "bg-redsoft text-red" : "bg-ambersoft text-amber"}`}>{l.quantity} left</span>
              </div>
            ))}
            {d.lowStock.length === 0 && <div className="py-6 text-center text-[13px] text-muted">All stocked up.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
