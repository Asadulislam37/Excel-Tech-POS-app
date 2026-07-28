"use client";

import { useCallback, useEffect, useState } from "react";
import { taka } from "@/lib/format";
import { exportCsv, exportExcel } from "@/lib/export";
import { Download, FileSpreadsheet, Printer } from "lucide-react";
import SalesTabs from "@/components/SalesTabs";

type Named = { id: string; name: string };
type Row = {
  id: string; sku: string; category: string; brand: string; product: string;
  quantity: number; cost: number; revenue: number;
};
type Data = { rows: Row[]; totalQty: number; totalCost: number; totalRevenue: number };

export default function SoldProductsPage() {
  const [q, setQ] = useState("");
  const [outletId, setOutletId] = useState("");
  const [type, setType] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [date, setDate] = useState("");
  const [d, setD] = useState<Data | null>(null);
  const [cfg, setCfg] = useState<{ brands: Named[]; categories: Named[]; outlets: Named[] } | null>(null);

  const load = useCallback(async () => {
    const p = new URLSearchParams({ q });
    if (outletId) p.set("outletId", outletId);
    if (type) p.set("type", type);
    if (categoryId) p.set("categoryId", categoryId);
    if (brandId) p.set("brandId", brandId);
    if (date) p.set("date", date);
    const r = await fetch(`/api/sales/products?${p}`);
    setD(r.ok ? await r.json() : null);
  }, [q, outletId, type, categoryId, brandId, date]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  useEffect(() => { fetch("/api/config").then(async (r) => r.ok && setCfg(await r.json())); }, []);

  const HEAD = ["SL.", "Category", "Brand", "Product", "Quantity", "Costing Price", "Price", "Profit"];
  const sheet = () => (d?.rows ?? []).map((r, i) =>
    [i + 1, r.category, r.brand, r.product, r.quantity, r.cost, r.revenue, r.revenue - r.cost]);

  const Cell = ({ children }: { children: React.ReactNode }) => (
    <div className="min-w-[108px] flex-1 basis-[120px] lg:max-w-[170px]">{children}</div>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SalesTabs />
        <div className="card flex divide-x divide-line">
          <div className="px-4 py-2"><div className="text-[11px] font-semibold uppercase text-muted">Sold Qty</div>
            <div className="text-xl font-bold">{d ? d.totalQty.toLocaleString() : "…"}</div></div>
          <div className="px-4 py-2"><div className="text-[11px] font-semibold uppercase text-muted">Revenue</div>
            <div className="text-xl font-bold">{d ? taka(d.totalRevenue) : "…"}</div></div>
          <div className="px-4 py-2"><div className="text-[11px] font-semibold uppercase text-muted">Profit</div>
            <div className={`text-xl font-bold ${d && d.totalRevenue - d.totalCost >= 0 ? "text-tealdark" : "text-red"}`}>
              {d ? taka(d.totalRevenue - d.totalCost) : "…"}</div></div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Cell><input className="input" placeholder="Type here…" value={q} onChange={(e) => setQ(e.target.value)} /></Cell>
        <Cell>
          <select className="input" value={outletId} onChange={(e) => setOutletId(e.target.value)}>
            <option value="">Select Outlet</option>
            {cfg?.outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </Cell>
        <Cell>
          <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All</option>
            <option value="CUSTOMER">Customer Sale</option>
            <option value="RETAIL">Retail Sale</option>
            <option value="WHOLESALE">Wholesale</option>
          </select>
        </Cell>
        <Cell>
          <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Category</option>
            {cfg?.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Cell>
        <Cell>
          <select className="input" value={brandId} onChange={(e) => setBrandId(e.target.value)}>
            <option value="">Brand</option>
            {cfg?.brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </Cell>
        <Cell><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></Cell>
        <div className="flex shrink-0 gap-2">
          <button className="btn btn-ghost px-3" title="Export to Excel" onClick={() => exportExcel("sold-products", HEAD, sheet())}><FileSpreadsheet size={16} /></button>
          <button className="btn btn-ghost px-3" title="Download CSV" onClick={() => exportCsv("sold-products", HEAD, sheet())}><Download size={16} /></button>
          <button className="btn btn-ghost px-3" title="Print" onClick={() => window.print()}><Printer size={16} /></button>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[820px]">
          <thead><tr>
            <th className="th">SL.</th><th className="th">Category</th><th className="th">Brand</th><th className="th">Product</th>
            <th className="th text-right">Quantity</th><th className="th text-right">Costing Price</th>
            <th className="th text-right">Price</th><th className="th text-right">Profit</th>
          </tr></thead>
          <tbody>
            {d?.rows.map((r, i) => {
              const profit = r.revenue - r.cost;
              return (
                <tr key={r.id}>
                  <td className="td">{i + 1}</td>
                  <td className="td">{r.category || "—"}</td>
                  <td className="td">{r.brand || "—"}</td>
                  <td className="td font-semibold">{r.product}
                    <div className="font-mono text-[11px] text-muted">{r.sku}</div></td>
                  <td className="td text-right font-bold">{r.quantity}</td>
                  <td className="td text-right">{taka(r.cost)}</td>
                  <td className="td text-right font-semibold">{taka(r.revenue)}</td>
                  <td className={`td text-right font-bold ${profit >= 0 ? "text-tealdark" : "text-red"}`}>{taka(profit)}</td>
                </tr>
              );
            })}
            {d && d.rows.length === 0 && (
              <tr><td colSpan={8} className="td py-10 text-center text-muted">No products sold for this filter yet.</td></tr>
            )}
          </tbody>
          {d && d.rows.length > 0 && (
            <tfoot><tr className="bg-paper font-bold">
              <td className="td" colSpan={4}>Total</td>
              <td className="td text-right">{d.totalQty}</td>
              <td className="td text-right">{taka(d.totalCost)}</td>
              <td className="td text-right">{taka(d.totalRevenue)}</td>
              <td className="td text-right text-tealdark">{taka(d.totalRevenue - d.totalCost)}</td>
            </tr></tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
