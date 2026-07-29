"use client";

import { useCallback, useEffect, useState } from "react";
import { taka } from "@/lib/format";
import { exportPdf, exportExcel } from "@/lib/export";
import { ImageIcon } from "lucide-react";
import StockTabs from "@/components/StockTabs";
import StockFilterBar, { StockCfg, StockFilters } from "@/components/StockFilterBar";

type Row = {
  id: string; sku: string; category: string; brand: string; imageUrl?: string | null;
  name: string; variant: string; qty: number;
  costing: number; wholesale: number; retail: number; mrp: number; warranty: string; alert: number;
};
type Report = { rows: Row[]; total: number; totalQty: number; totalValue: number };

const EMPTY: StockFilters = { outletId: "", q: "", categoryId: "", brandId: "", type: "", filter: "all" };

export default function StockReportPage() {
  const [f, setF] = useState<StockFilters>(EMPTY);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Report | null>(null);
  const [cfg, setCfg] = useState<StockCfg | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ q: f.q, filter: f.filter, page: String(page) });
    if (f.categoryId) params.set("categoryId", f.categoryId);
    if (f.brandId) params.set("brandId", f.brandId);
    if (f.type) params.set("type", f.type);
    if (f.outletId) params.set("outletId", f.outletId);
    const res = await fetch(`/api/stock-report?${params}`);
    if (res.ok) setData(await res.json());
  }, [f, page]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  useEffect(() => { fetch("/api/config").then(async (r) => r.ok && setCfg(await r.json())); }, []);

  const change = (next: Partial<StockFilters>) => { setF((p) => ({ ...p, ...next })); setPage(1); };

  const HEAD = ["SL.", "SKU", "Category", "Brand", "Product Name", "QTY", "Costing", "Wholesale", "Retail Price", "MRP", "Warranty"];
  const sheet = () => (data?.rows ?? []).map((r, i) => [
    (page - 1) * 50 + i + 1, r.sku, r.category, r.brand,
    [r.name, r.variant].filter(Boolean).join(" — "),
    r.qty, r.costing, r.wholesale, r.retail, r.mrp, r.warranty,
  ]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StockTabs />
        <div className="card flex divide-x divide-line">
          <div className="px-4 py-2"><div className="text-[11px] font-semibold uppercase text-muted">Total Stock</div>
            <div className="text-xl font-bold">{data ? data.totalQty.toLocaleString() : "…"}</div></div>
          <div className="px-4 py-2"><div className="text-[11px] font-semibold uppercase text-muted">Total Value</div>
            <div className="text-xl font-bold">{data ? taka(data.totalValue) : "…"}</div></div>
        </div>
      </div>

      <StockFilterBar cfg={cfg} value={f} onChange={change}
        onExcel={() => exportExcel("stock-report", HEAD, sheet())}
        onCsv={() => exportPdf("stock-report", HEAD, sheet(), "Stock Report")} />

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[960px]">
          <thead><tr>
            <th className="th">SL.</th><th className="th">SKU</th><th className="th">Category</th><th className="th">Brand</th>
            <th className="th">Photo</th><th className="th">Product Name</th>
            <th className="th text-right">QTY</th><th className="th text-right">Costing</th><th className="th text-right">Wholesale</th>
            <th className="th text-right">Retail Price</th><th className="th text-right">MRP</th><th className="th">Warranty</th>
          </tr></thead>
          <tbody>
            {data?.rows.map((r, i) => (
              <tr key={r.id}>
                <td className="td">{(page - 1) * 50 + i + 1}</td>
                <td className="td font-mono text-[12px]">{r.sku}</td>
                <td className="td">{r.category || "—"}</td>
                <td className="td">{r.brand || "—"}</td>
                <td className="td">
                  {r.imageUrl
                    ? /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={r.imageUrl} alt="" className="h-9 w-9 rounded-md border border-line object-cover" />
                    : <span className="flex h-9 w-9 items-center justify-center rounded-md border border-line bg-paper text-muted"><ImageIcon size={15} /></span>}
                </td>
                <td className="td font-semibold">{r.name}{r.variant && <span className="ml-1 text-[11px] font-normal text-muted">{r.variant}</span>}</td>
                <td className="td text-right"><span className={`rounded px-2 py-0.5 text-[11px] font-bold ${r.qty === 0 ? "bg-redsoft text-red" : r.qty <= r.alert ? "bg-ambersoft text-amber" : "bg-tealsoft text-tealdark"}`}>{r.qty}</span></td>
                <td className="td text-right">{r.costing ? taka(r.costing) : "0"}</td>
                <td className="td text-right">{r.wholesale ? taka(r.wholesale) : "0"}</td>
                <td className="td text-right font-semibold">{r.retail ? taka(r.retail) : "0"}</td>
                <td className="td text-right">{r.mrp ? taka(r.mrp) : "0"}</td>
                <td className="td">{r.warranty || "—"}</td>
              </tr>
            ))}
            {data && data.rows.length === 0 && <tr><td colSpan={12} className="td py-10 text-center text-muted">No items match this filter.</td></tr>}
          </tbody>
        </table>
      </div>

      {data && data.total > 50 && (
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-muted">{data.total} items · page {page} of {Math.ceil(data.total / 50)}</span>
          <div className="flex gap-2">
            <button className="btn btn-ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>‹ Prev</button>
            <button className="btn btn-ghost" disabled={page >= Math.ceil(data.total / 50)} onClick={() => setPage((p) => p + 1)}>Next ›</button>
          </div>
        </div>
      )}
    </div>
  );
}
