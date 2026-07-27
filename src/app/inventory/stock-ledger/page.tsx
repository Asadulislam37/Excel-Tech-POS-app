"use client";

import { useCallback, useEffect, useState } from "react";
import { dt } from "@/lib/format";
import StockTabs from "@/components/StockTabs";

type Row = {
  id: string; createdAt: string; sku: string; name: string;
  reason: string; quantity: number; balance: number; refType: string;
};

const REASONS = ["PURCHASE", "SALE", "SALE_RETURN", "EXCHANGE_IN", "EXCHANGE_OUT", "PURCHASE_RETURN", "TRANSFER_IN", "TRANSFER_OUT", "ADJUSTMENT", "OPENING"];
const pretty = (r: string) => r.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

export default function StockLedgerPage() {
  const [q, setQ] = useState("");
  const [reason, setReason] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ q, page: String(page) });
    if (reason) params.set("reason", reason);
    const res = await fetch(`/api/stock-ledger?${params}`);
    if (res.ok) { const d = await res.json(); setRows(d.rows); setTotal(d.total); }
  }, [q, reason, page]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  useEffect(() => { setPage(1); }, [q, reason]);

  return (
    <div className="space-y-3">
      <StockTabs />
      <div className="flex flex-wrap items-center gap-2">
        <input className="input w-60" placeholder="Search SKU or product…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input w-48" value={reason} onChange={(e) => setReason(e.target.value)}>
          <option value="">All movement types</option>
          {REASONS.map((r) => <option key={r} value={r}>{pretty(r)}</option>)}
        </select>
        <span className="ml-auto text-[12px] text-muted">{total} entries</span>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[760px]">
          <thead><tr>
            <th className="th">Date</th><th className="th">SKU</th><th className="th">Product</th>
            <th className="th">Movement</th><th className="th text-right">Qty</th><th className="th text-right">Balance</th>
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="td text-[12px] text-muted">{dt(r.createdAt)}</td>
                <td className="td font-mono text-[12px]">{r.sku}</td>
                <td className="td font-semibold">{r.name}</td>
                <td className="td">
                  <span className={`rounded px-2 py-0.5 text-[11px] font-bold ${r.quantity >= 0 ? "bg-tealsoft text-tealdark" : "bg-redsoft text-red"}`}>
                    {pretty(r.reason)}
                  </span>
                </td>
                <td className={`td text-right font-bold ${r.quantity >= 0 ? "text-tealdark" : "text-red"}`}>
                  {r.quantity >= 0 ? `+${r.quantity}` : r.quantity}
                </td>
                <td className="td text-right font-semibold">{r.balance}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="td py-10 text-center text-muted">No stock movements yet — they appear here after purchases, sales, and adjustments.</td></tr>}
          </tbody>
        </table>
      </div>

      {total > 50 && (
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-muted">page {page} of {Math.ceil(total / 50)}</span>
          <div className="flex gap-2">
            <button className="btn btn-ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>‹ Prev</button>
            <button className="btn btn-ghost" disabled={page >= Math.ceil(total / 50)} onClick={() => setPage((p) => p + 1)}>Next ›</button>
          </div>
        </div>
      )}
    </div>
  );
}
