"use client";

import { useCallback, useEffect, useState } from "react";
import { taka } from "@/lib/format";
import { FileSpreadsheet, ImageIcon, Printer } from "lucide-react";
import StockTabs from "@/components/StockTabs";

type Named = { id: string; name: string };
type Row = {
  id: string; sku: string; category: string; brand: string; imageUrl?: string | null;
  name: string; variant: string; qty: number;
  costing: number; wholesale: number; retail: number; mrp: number; warranty: string; alert: number;
};
type Report = { rows: Row[]; total: number; totalQty: number; totalValue: number };

export default function StockReportPage() {
  const [q, setQ] = useState("");
  const [fCat, setFCat] = useState("");
  const [fBrand, setFBrand] = useState("");
  const [fType, setFType] = useState("");
  const [fStock, setFStock] = useState("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Report | null>(null);
  const [cfg, setCfg] = useState<{ brands: Named[]; categories: Named[] } | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ q, filter: fStock, page: String(page) });
    if (fCat) params.set("categoryId", fCat);
    if (fBrand) params.set("brandId", fBrand);
    if (fType) params.set("type", fType);
    const res = await fetch(`/api/stock-report?${params}`);
    if (res.ok) setData(await res.json());
  }, [q, fCat, fBrand, fType, fStock, page]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  useEffect(() => { setPage(1); }, [q, fCat, fBrand, fType, fStock]);
  useEffect(() => { fetch("/api/config").then(async (r) => r.ok && setCfg(await r.json())); }, []);

  const exportCsv = () => {
    if (!data) return;
    const head = ["SKU", "Category", "Brand", "Product", "Variant", "QTY", "Costing", "Wholesale", "Retail", "MRP", "Warranty"];
    const lines = data.rows.map((r) =>
      [r.sku, r.category, r.brand, r.name, r.variant, r.qty, r.costing, r.wholesale, r.retail, r.mrp, r.warranty]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","));
    const blob = new Blob(["﻿" + [head.join(","), ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "stock-report.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

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

      <div className="flex flex-wrap items-center gap-2">
        <input className="input w-52" placeholder="Type here…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input w-40" value={fCat} onChange={(e) => setFCat(e.target.value)}>
          <option value="">Category</option>
          {cfg?.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="input w-40" value={fBrand} onChange={(e) => setFBrand(e.target.value)}>
          <option value="">Brand</option>
          {cfg?.brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select className="input w-40" value={fType} onChange={(e) => setFType(e.target.value)}>
          <option value="">Stock Type</option>
          <option value="SERIALIZED">Phone / IMEI</option>
          <option value="STANDARD">Accessory</option>
        </select>
        <select className="input w-40" value={fStock} onChange={(e) => setFStock(e.target.value)}>
          <option value="all">All items</option>
          <option value="in">In stock</option>
          <option value="out">Out of stock</option>
          <option value="low">Low stock</option>
        </select>
        <div className="ml-auto flex gap-2">
          <button className="btn btn-ghost" title="Export CSV / Excel" onClick={exportCsv}><FileSpreadsheet size={16} /></button>
          <button className="btn btn-ghost" title="Print" onClick={() => window.print()}><Printer size={16} /></button>
        </div>
      </div>

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
