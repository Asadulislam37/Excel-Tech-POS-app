"use client";

import { useCallback, useEffect, useState } from "react";
import { taka } from "@/lib/format";
import ReportShell, { DateBox } from "@/components/ReportShell";

type Row = { id: string; code: string; name: string; balance: number };
type Data = {
  income: Row[]; totalIncome: number;
  cogs: Row[]; totalCogs: number; grossProfit: number;
  opex: Row[]; totalOpex: number;
  totalExpense: number; netProfit: number;
};

const firstOfMonth = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); };
const todayStr = () => new Date().toISOString().slice(0, 10);

export default function ProfitLossPage() {
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(todayStr());
  const [d, setD] = useState<Data | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/reports/financials?report=pnl&from=${from}&to=${to}`);
    setD(r.ok ? await r.json() : null);
  }, [from, to]);
  useEffect(() => { load(); }, [load]);

  const Section = ({ title, rows, total, tone }: { title: string; rows: Row[]; total: number; tone?: string }) => (
    <>
      <tr className="bg-paper"><td className="td font-bold uppercase text-[11px] tracking-wide" colSpan={2}>{title}</td></tr>
      {rows.map((r) => (
        <tr key={r.id}>
          <td className="td pl-6">{r.code} — {r.name}</td>
          <td className={`td text-right ${tone ?? ""}`}>{taka(r.balance)}</td>
        </tr>
      ))}
      {rows.length === 0 && <tr><td className="td pl-6 text-muted" colSpan={2}>None</td></tr>}
      <tr><td className="td pl-6 font-bold">Total {title}</td><td className={`td text-right font-bold ${tone ?? ""}`}>{taka(total)}</td></tr>
    </>
  );

  return (
    <ReportShell
      title="Profit or Loss"
      subtitle={`Income and expenses for ${from} to ${to}`}
      filename="profit-and-loss"
      head={["Section", "Account", "Amount"]}
      rows={() => [
        ...(d?.income ?? []).map((r) => ["Income", `${r.code} — ${r.name}`, r.balance] as (string | number)[]),
        ["", "Total Income", d?.totalIncome ?? 0],
        ...(d?.cogs ?? []).map((r) => ["COGS", `${r.code} — ${r.name}`, r.balance] as (string | number)[]),
        ["", "Gross Profit", d?.grossProfit ?? 0],
        ...(d?.opex ?? []).map((r) => ["Expense", `${r.code} — ${r.name}`, r.balance] as (string | number)[]),
        ["", "Net Profit", d?.netProfit ?? 0],
      ]}
      dates={<><DateBox value={from} onChange={setFrom} /><DateBox value={to} onChange={setTo} /></>}
      badge={d && (
        <div className="card px-4 py-2">
          <div className="text-[11px] font-semibold uppercase text-muted">Net {d.netProfit >= 0 ? "Profit" : "Loss"}</div>
          <div className={`text-xl font-bold ${d.netProfit >= 0 ? "text-tealdark" : "text-red"}`}>{taka(Math.abs(d.netProfit))}</div>
        </div>
      )}
    >
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[520px]">
          <thead><tr><th className="th">Account</th><th className="th text-right">Amount</th></tr></thead>
          <tbody>
            {d && <>
              <Section title="Income" rows={d.income} total={d.totalIncome} tone="text-tealdark" />
              <Section title="Cost of Goods Sold" rows={d.cogs} total={d.totalCogs} tone="text-red" />
              <tr className="bg-tealsoft">
                <td className="td font-bold">Gross Profit</td>
                <td className="td text-right font-bold text-tealdark">{taka(d.grossProfit)}</td>
              </tr>
              <Section title="Operating Expenses" rows={d.opex} total={d.totalOpex} tone="text-red" />
              <tr className={d.netProfit >= 0 ? "bg-tealsoft" : "bg-redsoft"}>
                <td className="td text-[15px] font-bold">Net {d.netProfit >= 0 ? "Profit" : "Loss"}</td>
                <td className={`td text-right text-[15px] font-bold ${d.netProfit >= 0 ? "text-tealdark" : "text-red"}`}>{taka(d.netProfit)}</td>
              </tr>
            </>}
          </tbody>
        </table>
      </div>
    </ReportShell>
  );
}
