"use client";
import DateInput from "@/components/DateInput";

import { useCallback, useEffect, useState } from "react";
import { taka, dt } from "@/lib/format";
import { exportCsv, exportExcel } from "@/lib/export";
import { Download, FileSpreadsheet, Printer } from "lucide-react";
import { PurchaseReturnTabs } from "@/components/PurchaseTabs";

type Row = {
  id: string; returnNo: string; createdAt: string; total: string; reason?: string | null;
  supplier: { name: string; phone?: string | null };
  purchase: { purchaseNo: string };
  items: { quantity: number; amount: string; serialNos: string[]; variant: { sku: string; product: { name: string } } }[];
};
type Data = { total: number; totalAmount: number; rows: Row[] };

export default function PurchaseReturnHistoryPage() {
  const [q, setQ] = useState("");
  const [date, setDate] = useState("");
  const [page, setPage] = useState(1);
  const [d, setD] = useState<Data | null>(null);

  const load = useCallback(async () => {
    const p = new URLSearchParams({ q, page: String(page) });
    if (date) p.set("date", date);
    const r = await fetch(`/api/purchase-returns?${p}`);
    if (r.ok) setD(await r.json());
  }, [q, date, page]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  useEffect(() => { setPage(1); }, [q, date]);

  const HEAD = ["SL.", "Return No.", "Date", "Purchase", "Supplier", "Products", "Amount"];
  const sheet = () => (d?.rows ?? []).map((r, i) => [i + 1, r.returnNo, new Date(r.createdAt).toLocaleString("en-GB"), r.purchase.purchaseNo, r.supplier.name, r.items.reduce((t, x) => t + x.quantity, 0), Number(r.total)]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PurchaseReturnTabs />
        <div className="card flex divide-x divide-line">
          <div className="px-4 py-2"><div className="text-[11px] font-semibold uppercase text-muted">Returns</div><div className="text-xl font-bold">{d ? d.total : "…"}</div></div>
          <div className="px-4 py-2"><div className="text-[11px] font-semibold uppercase text-muted">Amount</div><div className="text-xl font-bold text-red">{d ? taka(d.totalAmount) : "…"}</div></div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[160px] flex-1 basis-[200px]"><input className="input" placeholder="Type here…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="min-w-[130px] basis-[150px]"><DateInput value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div className="flex shrink-0 gap-2">
          <button className="btn btn-ghost px-3" title="Export to Excel" onClick={() => exportExcel("purchase-returns", HEAD, sheet())}><FileSpreadsheet size={16} /></button>
          <button className="btn btn-ghost px-3" title="Download CSV" onClick={() => exportCsv("purchase-returns", HEAD, sheet())}><Download size={16} /></button>
          <button className="btn btn-ghost px-3" title="Print" onClick={() => window.print()}><Printer size={16} /></button>
        </div>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[820px]">
          <thead><tr><th className="th">SL.</th><th className="th">Return No.</th><th className="th">Date</th><th className="th">Purchase</th><th className="th">Supplier</th><th className="th">Products</th><th className="th text-right">Amount</th></tr></thead>
          <tbody>
            {d?.rows.map((r, i) => (
              <tr key={r.id}>
                <td className="td">{(page - 1) * 50 + i + 1}</td>
                <td className="td font-mono text-[12px]">{r.returnNo}</td>
                <td className="td text-[12px] text-muted">{dt(r.createdAt)}</td>
                <td className="td font-mono text-[12px]">{r.purchase.purchaseNo}</td>
                <td className="td font-semibold">{r.supplier.name}</td>
                <td className="td text-[12px]">{r.items.map((x, k) => <div key={k}>{x.quantity}× {x.variant.product.name}{x.serialNos.length > 0 && <div className="font-mono text-[10px] text-muted">{x.serialNos.join(", ")}</div>}</div>)}</td>
                <td className="td text-right font-bold text-red">{taka(r.total)}</td>
              </tr>
            ))}
            {d && d.rows.length === 0 && <tr><td colSpan={7} className="td py-10 text-center text-muted">No purchase returns yet.</td></tr>}
          </tbody>
        </table>
      </div>
      {d && d.total > 50 && (
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-muted">page {page} of {Math.ceil(d.total / 50)}</span>
          <div className="flex gap-2"><button className="btn btn-ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>‹ Prev</button><button className="btn btn-ghost" disabled={page >= Math.ceil(d.total / 50)} onClick={() => setPage((p) => p + 1)}>Next ›</button></div>
        </div>
      )}
    </div>
  );
}
