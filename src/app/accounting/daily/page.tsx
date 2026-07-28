"use client";

import { useCallback, useEffect, useState } from "react";
import { taka } from "@/lib/format";
import { Printer } from "lucide-react";

type Daily = {
  from: string; to: string;
  sales: { invoices: number; total: number; due: number };
  collected: number;
  collectedByMethod: { method: string; amount: number }[];
  expenseTotal: number;
  expensesByHead: { name: string; amount: number }[];
  supplierPaid: number;
  movement: { code: string; name: string; in: number; out: number }[];
  cashIn: number; cashOut: number;
};

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function DailyStatementPage() {
  const [from, setFrom] = useState(todayStr());
  const [to, setTo] = useState(todayStr());
  const [d, setD] = useState<Daily | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/reports/daily?from=${from}&to=${to}`);
    setD(r.ok ? await r.json() : null);
  }, [from, to]);
  useEffect(() => { load(); }, [load]);

  const net = (d?.collected ?? 0) - (d?.expenseTotal ?? 0) - (d?.supplierPaid ?? 0);

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-bold">Daily / Cash Statement</h1>

      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[130px] flex-1 basis-[140px] lg:max-w-[170px]">
          <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="min-w-[130px] flex-1 basis-[140px] lg:max-w-[170px]">
          <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <button className="btn btn-ghost px-3 shrink-0" title="Print" onClick={() => window.print()}><Printer size={16} /></button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="card p-4" style={{ background: "#dbeafe" }}>
          <div className="text-[12px] font-semibold">Sales</div>
          <div className="text-2xl font-bold">{taka(d?.sales.total ?? 0)}</div>
          <div className="text-[11px] text-muted">{d?.sales.invoices ?? 0} invoices</div>
        </div>
        <div className="card p-4" style={{ background: "#dcfce7" }}>
          <div className="text-[12px] font-semibold">Cash In (collected)</div>
          <div className="text-2xl font-bold">{taka(d?.collected ?? 0)}</div>
          <div className="text-[11px] text-muted">all methods</div>
        </div>
        <div className="card p-4" style={{ background: "#fee2e2" }}>
          <div className="text-[12px] font-semibold">Cash Out</div>
          <div className="text-2xl font-bold">{taka((d?.expenseTotal ?? 0) + (d?.supplierPaid ?? 0))}</div>
          <div className="text-[11px] text-muted">expense + supplier</div>
        </div>
        <div className="card p-4" style={{ background: net >= 0 ? "#f3e8ff" : "#fee2e2" }}>
          <div className="text-[12px] font-semibold">Net Cash</div>
          <div className="text-2xl font-bold">{taka(net)}</div>
          <div className="text-[11px] text-muted">in − out</div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card overflow-hidden">
          <h2 className="px-4 py-3 font-bold">Collection by Method</h2>
          <table className="w-full">
            <thead><tr><th className="th">Method</th><th className="th text-right">Amount</th></tr></thead>
            <tbody>
              {d?.collectedByMethod.map((m) => (
                <tr key={m.method}><td className="td font-semibold">{m.method}</td><td className="td text-right font-bold">{taka(m.amount)}</td></tr>
              ))}
              {d && d.collectedByMethod.length === 0 && <tr><td colSpan={2} className="td py-6 text-center text-muted">No collections.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="card overflow-hidden">
          <h2 className="px-4 py-3 font-bold">Expenses by Head</h2>
          <table className="w-full">
            <thead><tr><th className="th">Head</th><th className="th text-right">Amount</th></tr></thead>
            <tbody>
              {d?.expensesByHead.map((x) => (
                <tr key={x.name}><td className="td font-semibold">{x.name}</td><td className="td text-right font-bold text-red">{taka(x.amount)}</td></tr>
              ))}
              {d && d.expensesByHead.length === 0 && <tr><td colSpan={2} className="td py-6 text-center text-muted">No expenses.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="card overflow-hidden">
          <h2 className="px-4 py-3 font-bold">Cash &amp; Bank Movement</h2>
          <table className="w-full">
            <thead><tr><th className="th">Account</th><th className="th text-right">In</th><th className="th text-right">Out</th></tr></thead>
            <tbody>
              {d?.movement.map((m) => (
                <tr key={m.code}>
                  <td className="td font-semibold">{m.name}</td>
                  <td className="td text-right text-tealdark">{m.in ? taka(m.in) : "—"}</td>
                  <td className="td text-right text-red">{m.out ? taka(m.out) : "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr className="bg-paper font-bold">
              <td className="td">Total</td>
              <td className="td text-right">{taka(d?.cashIn ?? 0)}</td>
              <td className="td text-right">{taka(d?.cashOut ?? 0)}</td>
            </tr></tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
