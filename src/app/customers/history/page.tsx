"use client";

import { useCallback, useEffect, useState } from "react";
import { taka } from "@/lib/format";
import { exportPdf, exportExcel } from "@/lib/export";
import { Download, FileSpreadsheet, Printer } from "lucide-react";

type Customer = {
  id: string; name: string; phone: string; organization?: string | null;
  totalPurchase: number; totalDue: number; rewardPoints: number;
};

export default function CustomerHistoryPage() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Customer[]>([]);

  const load = useCallback(async () => {
    const r = await fetch(`/api/customers?q=${encodeURIComponent(q)}`);
    if (r.ok) setRows(await r.json());
  }, [q]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const totalPurchase = rows.reduce((s, c) => s + c.totalPurchase, 0);
  const totalDue = rows.reduce((s, c) => s + c.totalDue, 0);
  const HEAD = ["SL.", "Name", "Phone", "Organization", "Lifetime Purchase", "Due", "Reward Points"];
  const sheet = () => rows.map((c, i) => [i + 1, c.name, c.phone, c.organization ?? "", c.totalPurchase, c.totalDue, c.rewardPoints]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-bold">Customer History</h1>
        <div className="card flex divide-x divide-line">
          <div className="px-4 py-2"><div className="text-[11px] font-semibold uppercase text-muted">Customers</div><div className="text-xl font-bold">{rows.length}</div></div>
          <div className="px-4 py-2"><div className="text-[11px] font-semibold uppercase text-muted">Lifetime</div><div className="text-xl font-bold">{taka(totalPurchase)}</div></div>
          <div className="px-4 py-2"><div className="text-[11px] font-semibold uppercase text-muted">Total Due</div><div className="text-xl font-bold text-amber">{taka(totalDue)}</div></div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[160px] flex-1 basis-[220px]"><input className="input" placeholder="Search name, phone or organization…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="flex shrink-0 gap-2">
          <button className="btn btn-ghost px-3" title="Export to Excel" onClick={() => exportExcel("customer-history", HEAD, sheet())}><FileSpreadsheet size={16} /></button>
          <button className="btn btn-ghost px-3" title="Download PDF" onClick={() => exportPdf("customer-history", HEAD, sheet(), "Customer History")}><Download size={16} /></button>
          <button className="btn btn-ghost px-3" title="Print" onClick={() => window.print()}><Printer size={16} /></button>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px]">
          <thead><tr>
            <th className="th">SL.</th><th className="th">Name</th><th className="th">Phone</th><th className="th">Organization</th>
            <th className="th text-right">Lifetime Purchase</th><th className="th text-right">Due</th><th className="th text-right">Reward Points</th>
          </tr></thead>
          <tbody>
            {rows.map((c, i) => (
              <tr key={c.id}>
                <td className="td">{i + 1}</td>
                <td className="td font-semibold">{c.name}</td>
                <td className="td font-mono text-[12px]">{c.phone}</td>
                <td className="td">{c.organization || "—"}</td>
                <td className="td text-right font-semibold">{taka(c.totalPurchase)}</td>
                <td className="td text-right">{c.totalDue > 0 ? <span className="font-bold text-amber">{taka(c.totalDue)}</span> : "—"}</td>
                <td className="td text-right">{c.rewardPoints}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="td py-10 text-center text-muted">No customers yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
