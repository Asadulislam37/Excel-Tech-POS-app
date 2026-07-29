"use client";

import { useCallback, useEffect, useState } from "react";
import { taka, dt } from "@/lib/format";
import { exportPdf, exportExcel } from "@/lib/export";
import { Download, FileSpreadsheet, Printer } from "lucide-react";

type Row = {
  id: string; name: string; phone: string; orders: number;
  purchased: number; paid?: number; due: number; rewardPoints?: number; last?: string | null;
};
type Data = { rows: Row[]; totals: { purchased: number; due: number } };

/** Shared KPI table for customers (party) and suppliers. */
export default function KpiReport({ title, type, amountLabel }: { title: string; type: "party" | "supplier"; amountLabel: string }) {
  const [q, setQ] = useState("");
  const [d, setD] = useState<Data | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/kpi?type=${type}`);
    if (r.ok) setD(await r.json());
  }, [type]);
  useEffect(() => { load(); }, [load]);

  const rows = (d?.rows ?? []).filter((r) => !q || r.name.toLowerCase().includes(q.toLowerCase()) || r.phone.includes(q));
  const HEAD = ["SL.", "Name", "Phone", "Orders", amountLabel, "Due", "Last Activity"];
  const sheet = () => rows.map((r, i) => [i + 1, r.name, r.phone, r.orders, r.purchased, r.due, r.last ? new Date(r.last).toLocaleDateString("en-GB") : ""]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-bold">{title}</h1>
        <div className="card flex divide-x divide-line">
          <div className="px-4 py-2"><div className="text-[11px] font-semibold uppercase text-muted">{amountLabel}</div><div className="text-xl font-bold">{d ? taka(d.totals.purchased) : "…"}</div></div>
          <div className="px-4 py-2"><div className="text-[11px] font-semibold uppercase text-muted">Total Due</div><div className="text-xl font-bold text-amber">{d ? taka(d.totals.due) : "…"}</div></div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[160px] flex-1 basis-[220px]"><input className="input" placeholder="Search name or phone…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="flex shrink-0 gap-2">
          <button className="btn btn-ghost px-3" title="Export to Excel" onClick={() => exportExcel(type + "-kpi", HEAD, sheet())}><FileSpreadsheet size={16} /></button>
          <button className="btn btn-ghost px-3" title="Download PDF" onClick={() => exportPdf(type + "-kpi", HEAD, sheet(), type + " KPI")}><Download size={16} /></button>
          <button className="btn btn-ghost px-3" title="Print" onClick={() => window.print()}><Printer size={16} /></button>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px]">
          <thead><tr>
            <th className="th">SL.</th><th className="th">Name</th><th className="th">Phone</th>
            <th className="th text-right">Orders</th><th className="th text-right">{amountLabel}</th>
            {type === "supplier" && <th className="th text-right">Paid</th>}
            <th className="th text-right">Due</th><th className="th">Last Activity</th>
          </tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id}>
                <td className="td">{i + 1}</td>
                <td className="td font-semibold">{r.name}</td>
                <td className="td font-mono text-[12px]">{r.phone || "—"}</td>
                <td className="td text-right font-bold">{r.orders}</td>
                <td className="td text-right font-semibold">{taka(r.purchased)}</td>
                {type === "supplier" && <td className="td text-right">{taka(r.paid ?? 0)}</td>}
                <td className="td text-right">{r.due > 0 ? <span className="font-bold text-amber">{taka(r.due)}</span> : "—"}</td>
                <td className="td text-[12px] text-muted">{r.last ? dt(r.last) : "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={type === "supplier" ? 8 : 7} className="td py-10 text-center text-muted">Nothing to show yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
