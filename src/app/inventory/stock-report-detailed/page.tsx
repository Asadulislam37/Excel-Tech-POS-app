"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { taka } from "@/lib/format";
import { exportCsv, exportExcel } from "@/lib/export";
import { ChevronDown, ChevronRight } from "lucide-react";
import StockTabs from "@/components/StockTabs";
import StockFilterBar, { StockCfg, StockFilters } from "@/components/StockFilterBar";

type Row = {
  id: string; sku: string; category: string; brand: string;
  name: string; variant: string; qty: number;
  costing: number; wholesale: number; retail: number; mrp: number; warranty: string; alert: number;
};
type Report = { rows: Row[]; total: number; totalQty: number; totalValue: number };
type Unit = { id: string; serialNo: string; createdAt: string };

const EMPTY: StockFilters = { outletId: "", q: "", categoryId: "", brandId: "", type: "", filter: "all" };

export default function StockReportDetailedPage() {
  const [f, setF] = useState<StockFilters>(EMPTY);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Report | null>(null);
  const [cfg, setCfg] = useState<StockCfg | null>(null);
  const [open, setOpen] = useState("");
  const [units, setUnits] = useState<Record<string, Unit[]>>({});

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

  const toggle = async (r: Row) => {
    if (open === r.id) return setOpen("");
    setOpen(r.id);
    if (!units[r.id]) {
      const res = await fetch(`/api/serials?variantId=${r.id}&status=IN_STOCK`);
      const list: Unit[] = res.ok ? await res.json() : [];
      setUnits((u) => ({ ...u, [r.id]: list }));
    }
  };

  const totals = (data?.rows ?? []).reduce(
    (a, r) => ({ cost: a.cost + r.qty * r.costing, retail: a.retail + r.qty * r.retail }),
    { cost: 0, retail: 0 });

  const HEAD = ["SL.", "SKU", "Product Name", "Brand", "QTY", "Costing", "Stock Value", "Retail", "Retail Value", "Potential Profit"];
  const sheet = () => (data?.rows ?? []).map((r, i) => [
    (page - 1) * 50 + i + 1, r.sku, [r.name, r.variant].filter(Boolean).join(" — "), r.brand,
    r.qty, r.costing, r.qty * r.costing, r.retail, r.qty * r.retail, r.qty * (r.retail - r.costing),
  ]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StockTabs />
        <div className="card flex divide-x divide-line">
          <div className="px-4 py-2"><div className="text-[11px] font-semibold uppercase text-muted">Total Stock</div>
            <div className="text-xl font-bold">{data ? data.totalQty.toLocaleString() : "…"}</div></div>
          <div className="px-4 py-2"><div className="text-[11px] font-semibold uppercase text-muted">Stock Value</div>
            <div className="text-xl font-bold">{data ? taka(data.totalValue) : "…"}</div></div>
        </div>
      </div>

      <StockFilterBar cfg={cfg} value={f} onChange={change}
        onExcel={() => exportExcel("stock-report-detailed", HEAD, sheet())}
        onCsv={() => exportCsv("stock-report-detailed", HEAD, sheet())} />

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[980px]">
          <thead><tr>
            <th className="th">SL.</th><th className="th">SKU</th><th className="th">Product Name</th><th className="th">Brand</th>
            <th className="th text-right">QTY</th><th className="th text-right">Costing</th><th className="th text-right">Stock Value</th>
            <th className="th text-right">Retail</th><th className="th text-right">Retail Value</th><th className="th text-right">Potential Profit</th>
          </tr></thead>
          <tbody>
            {data?.rows.map((r, i) => {
              const stockValue = r.qty * r.costing;
              const retailValue = r.qty * r.retail;
              const profit = retailValue - stockValue;
              return (
                <Fragment key={r.id}>
                  <tr className="cursor-pointer hover:bg-paper" onClick={() => toggle(r)}>
                    <td className="td">
                      <span className="flex items-center gap-1">
                        {open === r.id ? <ChevronDown size={13} /> : <ChevronRight size={13} className="text-muted" />}
                        {(page - 1) * 50 + i + 1}
                      </span>
                    </td>
                    <td className="td font-mono text-[12px]">{r.sku}</td>
                    <td className="td font-semibold">{r.name}{r.variant && <span className="ml-1 text-[11px] font-normal text-muted">{r.variant}</span>}</td>
                    <td className="td">{r.brand || "—"}</td>
                    <td className="td text-right"><span className={`rounded px-2 py-0.5 text-[11px] font-bold ${r.qty === 0 ? "bg-redsoft text-red" : r.qty <= r.alert ? "bg-ambersoft text-amber" : "bg-tealsoft text-tealdark"}`}>{r.qty}</span></td>
                    <td className="td text-right">{taka(r.costing)}</td>
                    <td className="td text-right font-semibold">{taka(stockValue)}</td>
                    <td className="td text-right">{taka(r.retail)}</td>
                    <td className="td text-right font-semibold">{taka(retailValue)}</td>
                    <td className={`td text-right font-bold ${profit >= 0 ? "text-tealdark" : "text-red"}`}>{taka(profit)}</td>
                  </tr>
                  {open === r.id && (
                    <tr>
                      <td className="td bg-paper" colSpan={10}>
                        <div className="text-[12px] font-semibold uppercase tracking-wide text-muted">
                          {r.category || "Uncategorised"} · alert at {r.alert} · warranty {r.warranty || "none"}
                        </div>
                        {units[r.id] === undefined
                          ? <div className="py-2 text-[12px] text-muted">Loading serials…</div>
                          : units[r.id].length === 0
                            ? <div className="py-2 text-[12px] text-muted">No IMEI units in stock — quantity-tracked item or nothing stocked in yet.</div>
                            : <div className="flex flex-wrap gap-1.5 py-2">
                                {units[r.id].map((u) => <span key={u.id} className="serial-chip">{u.serialNo}</span>)}
                              </div>}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {data && data.rows.length === 0 && <tr><td colSpan={10} className="td py-10 text-center text-muted">No items match this filter.</td></tr>}
          </tbody>
          {data && data.rows.length > 0 && (
            <tfoot><tr className="bg-paper font-bold">
              <td className="td" colSpan={6}>Page totals</td>
              <td className="td text-right">{taka(totals.cost)}</td>
              <td className="td" />
              <td className="td text-right">{taka(totals.retail)}</td>
              <td className="td text-right text-tealdark">{taka(totals.retail - totals.cost)}</td>
            </tr></tfoot>
          )}
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
