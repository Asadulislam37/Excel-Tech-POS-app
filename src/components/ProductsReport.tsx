"use client";

import { useCallback, useEffect, useState } from "react";
import { taka } from "@/lib/format";
import { exportCsv, exportExcel } from "@/lib/export";
import { Download, FileSpreadsheet, Printer } from "lucide-react";
import DateInput from "@/components/DateInput";

type Row = {
  id: string; sku: string; category: string; brand: string; product: string;
  quantity: number; amount: number; restocked?: number; defective?: number;
};
type Data = { rows: Row[]; totalQty: number; totalAmount: number };

/** Shared "products rolled up" report used by return/exchange/purchase screens. */
export default function ProductsReport({
  title, endpoint, amountLabel = "Amount", showCondition = false, tabs,
}: {
  title: string;
  endpoint: string;
  amountLabel?: string;
  showCondition?: boolean;
  tabs?: React.ReactNode;
}) {
  const [q, setQ] = useState("");
  const [date, setDate] = useState("");
  const [d, setD] = useState<Data | null>(null);

  const load = useCallback(async () => {
    const p = new URLSearchParams({ q });
    if (date) p.set("date", date);
    const sep = endpoint.includes("?") ? "&" : "?";
    const r = await fetch(`${endpoint}${sep}${p}`);
    setD(r.ok ? await r.json() : null);
  }, [q, date, endpoint]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const HEAD = ["SL.", "Category", "Brand", "Product", "Quantity", amountLabel,
    ...(showCondition ? ["Restocked", "Defective"] : [])];
  const sheet = () => (d?.rows ?? []).map((r, i) => [
    i + 1, r.category, r.brand, r.product, r.quantity, r.amount,
    ...(showCondition ? [r.restocked ?? 0, r.defective ?? 0] : []),
  ]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {tabs ?? <h1 className="text-lg font-bold">{title}</h1>}
        <div className="card flex divide-x divide-line">
          <div className="px-4 py-2"><div className="text-[11px] font-semibold uppercase text-muted">Quantity</div>
            <div className="text-xl font-bold">{d ? d.totalQty.toLocaleString() : "…"}</div></div>
          <div className="px-4 py-2"><div className="text-[11px] font-semibold uppercase text-muted">{amountLabel}</div>
            <div className="text-xl font-bold">{d ? taka(d.totalAmount) : "…"}</div></div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[140px] flex-1 basis-[180px] lg:max-w-[240px]">
          <input className="input" placeholder="Type here…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="min-w-[130px] flex-1 basis-[140px] lg:max-w-[170px]">
          <DateInput value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="flex shrink-0 gap-2">
          <button className="btn btn-ghost px-3" title="Export to Excel" onClick={() => exportExcel(title.toLowerCase().replace(/\s+/g, "-"), HEAD, sheet())}><FileSpreadsheet size={16} /></button>
          <button className="btn btn-ghost px-3" title="Download CSV" onClick={() => exportCsv(title.toLowerCase().replace(/\s+/g, "-"), HEAD, sheet())}><Download size={16} /></button>
          <button className="btn btn-ghost px-3" title="Print" onClick={() => window.print()}><Printer size={16} /></button>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[760px]">
          <thead><tr>
            <th className="th">SL.</th><th className="th">Category</th><th className="th">Brand</th><th className="th">Product</th>
            <th className="th text-right">Quantity</th><th className="th text-right">{amountLabel}</th>
            {showCondition && <><th className="th text-right">Restocked</th><th className="th text-right">Defective</th></>}
          </tr></thead>
          <tbody>
            {d?.rows.map((r, i) => (
              <tr key={r.id}>
                <td className="td">{i + 1}</td>
                <td className="td">{r.category || "—"}</td>
                <td className="td">{r.brand || "—"}</td>
                <td className="td font-semibold">{r.product}
                  <div className="font-mono text-[11px] text-muted">{r.sku}</div></td>
                <td className="td text-right font-bold">{r.quantity}</td>
                <td className="td text-right font-semibold">{taka(r.amount)}</td>
                {showCondition && <>
                  <td className="td text-right text-tealdark">{r.restocked ?? 0}</td>
                  <td className="td text-right text-red">{r.defective ?? 0}</td>
                </>}
              </tr>
            ))}
            {d && d.rows.length === 0 && (
              <tr><td colSpan={showCondition ? 8 : 6} className="td py-10 text-center text-muted">Nothing recorded yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
