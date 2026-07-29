"use client";

import { useCallback, useEffect, useState } from "react";
import { taka, dt } from "@/lib/format";
import { exportPdf, exportExcel } from "@/lib/export";
import { ArrowRight, Download, FileSpreadsheet, Printer } from "lucide-react";

type Row = {
  id: string; transferNo: string; createdAt: string; status: string; note?: string | null;
  fromOutlet: { name: string }; toOutlet: { name: string };
  items: { quantity: number; serialNos: string[]; variant: { sku: string; product: { name: string } } }[];
};
type Data = { total: number; rows: Row[] };

export default function TransferHistoryPage() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [d, setD] = useState<Data | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/stock-transfer?q=${encodeURIComponent(q)}&page=${page}`);
    if (r.ok) setD(await r.json());
  }, [q, page]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  useEffect(() => { setPage(1); }, [q]);

  const HEAD = ["SL.", "Transfer No.", "Date", "From", "To", "Items", "Qty"];
  const sheet = () => (d?.rows ?? []).map((r, i) => [i + 1, r.transferNo, new Date(r.createdAt).toLocaleString("en-GB"), r.fromOutlet.name, r.toOutlet.name, r.items.map((x) => `${x.quantity}x ${x.variant.product.name}`).join("; "), r.items.reduce((t, x) => t + x.quantity, 0)]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-bold">Stock Transfer History</h1>
        <div className="card px-4 py-2"><div className="text-[11px] font-semibold uppercase text-muted">Transfers</div><div className="text-xl font-bold">{d ? d.total : "…"}</div></div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[160px] flex-1 basis-[220px] lg:max-w-[300px]"><input className="input" placeholder="Search transfer no or outlet…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="flex shrink-0 gap-2">
          <button className="btn btn-ghost px-3" title="Export to Excel" onClick={() => exportExcel("stock-transfers", HEAD, sheet())}><FileSpreadsheet size={16} /></button>
          <button className="btn btn-ghost px-3" title="Download PDF" onClick={() => exportPdf("stock-transfers", HEAD, sheet(), "Stock Transfers")}><Download size={16} /></button>
          <button className="btn btn-ghost px-3" title="Print" onClick={() => window.print()}><Printer size={16} /></button>
        </div>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[820px]">
          <thead><tr><th className="th">SL.</th><th className="th">Transfer No.</th><th className="th">Date</th><th className="th">Route</th><th className="th">Products</th><th className="th text-right">Qty</th><th className="th">Status</th></tr></thead>
          <tbody>
            {d?.rows.map((r, i) => (
              <tr key={r.id}>
                <td className="td">{(page - 1) * 50 + i + 1}</td>
                <td className="td font-mono text-[12px]">{r.transferNo}</td>
                <td className="td text-[12px] text-muted">{dt(r.createdAt)}</td>
                <td className="td"><span className="flex items-center gap-1.5 text-[12px] font-semibold">{r.fromOutlet.name} <ArrowRight size={13} className="text-muted" /> {r.toOutlet.name}</span></td>
                <td className="td text-[12px]">{r.items.map((x, k) => <div key={k}>{x.quantity}× {x.variant.product.name}{x.serialNos.length > 0 && <div className="font-mono text-[10px] text-muted">{x.serialNos.join(", ")}</div>}</div>)}</td>
                <td className="td text-right font-bold">{r.items.reduce((t, x) => t + x.quantity, 0)}</td>
                <td className="td"><span className="rounded bg-tealsoft px-2 py-0.5 text-[11px] font-bold text-tealdark">{r.status}</span></td>
              </tr>
            ))}
            {d && d.rows.length === 0 && <tr><td colSpan={7} className="td py-10 text-center text-muted">No transfers yet.</td></tr>}
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
