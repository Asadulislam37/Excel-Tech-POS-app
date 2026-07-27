"use client";

import { Download, FileSpreadsheet, Printer } from "lucide-react";

export type Named = { id: string; name: string };
export type StockCfg = { brands: Named[]; categories: Named[]; outlets: Named[] };
export type StockFilters = {
  outletId: string; q: string; categoryId: string; brandId: string; type: string; filter: string;
};

export default function StockFilterBar({
  cfg, value, onChange, onExcel, onCsv,
}: {
  cfg: StockCfg | null;
  value: StockFilters;
  onChange: (next: Partial<StockFilters>) => void;
  onExcel: () => void;
  onCsv: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select className="input w-44" value={value.outletId} onChange={(e) => onChange({ outletId: e.target.value })}>
        <option value="">Select Outlet</option>
        {cfg?.outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
      <input className="input w-48" placeholder="Type here…" value={value.q} onChange={(e) => onChange({ q: e.target.value })} />
      <select className="input w-40" value={value.categoryId} onChange={(e) => onChange({ categoryId: e.target.value })}>
        <option value="">Category</option>
        {cfg?.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <select className="input w-40" value={value.brandId} onChange={(e) => onChange({ brandId: e.target.value })}>
        <option value="">Brand</option>
        {cfg?.brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
      </select>
      <select className="input w-40" value={value.type} onChange={(e) => onChange({ type: e.target.value })}>
        <option value="">Stock Type</option>
        <option value="SERIALIZED">Phone / IMEI</option>
        <option value="STANDARD">Accessory</option>
      </select>
      <select className="input w-40" value={value.filter} onChange={(e) => onChange({ filter: e.target.value })}>
        <option value="all">Stock Filter</option>
        <option value="in">In stock</option>
        <option value="out">Out of stock</option>
        <option value="low">Low stock</option>
      </select>
      <div className="ml-auto flex gap-2">
        <button className="btn btn-ghost px-3" title="Export to Excel" onClick={onExcel}><FileSpreadsheet size={16} /></button>
        <button className="btn btn-ghost px-3" title="Download CSV" onClick={onCsv}><Download size={16} /></button>
        <button className="btn btn-ghost px-3" title="Print" onClick={() => window.print()}><Printer size={16} /></button>
      </div>
    </div>
  );
}
