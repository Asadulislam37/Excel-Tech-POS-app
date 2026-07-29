"use client";

import { useCallback, useEffect, useState } from "react";
import { taka } from "@/lib/format";
import ReportShell, { DateBox } from "@/components/ReportShell";
import { TrendingUp, TrendingDown, Receipt, Wallet } from "lucide-react";

type Row = { id: string; code: string; name: string; balance: number };
type Data = {
  income: Row[]; totalIncome: number;
  cogs: Row[]; totalCogs: number; grossProfit: number;
  opex: Row[]; totalOpex: number;
  totalExpense: number; netProfit: number;
};

const firstOfMonth = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); };
const todayStr = () => new Date().toISOString().slice(0, 10);
const pct = (part: number, whole: number) => (whole ? (part / whole) * 100 : 0);
const pctStr = (part: number, whole: number) => `${pct(part, whole).toFixed(1)}%`;

export default function ProfitLossPage() {
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(todayStr());
  const [d, setD] = useState<Data | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/reports/financials?report=pnl&from=${from}&to=${to}`);
    setD(r.ok ? await r.json() : null);
  }, [from, to]);
  useEffect(() => { load(); }, [load]);

  return (
    <ReportShell
      title="Profit & Loss"
      subtitle={`${from} → ${to}`}
      filename="profit-and-loss"
      head={["Section", "Account", "Amount"]}
      rows={() => [
        ...(d?.income ?? []).map((r) => ["Income", `${r.code} — ${r.name}`, r.balance] as (string | number)[]),
        ["", "Total Revenue", d?.totalIncome ?? 0],
        ...(d?.cogs ?? []).map((r) => ["COGS", `${r.code} — ${r.name}`, r.balance] as (string | number)[]),
        ["", "Gross Profit", d?.grossProfit ?? 0],
        ...(d?.opex ?? []).map((r) => ["Expense", `${r.code} — ${r.name}`, r.balance] as (string | number)[]),
        ["", "Total Operating Expenses", d?.totalOpex ?? 0],
        ["", "Net Profit", d?.netProfit ?? 0],
      ]}
      dates={<><DateBox value={from} onChange={setFrom} /><DateBox value={to} onChange={setTo} /></>}
    >
      {!d ? (
        <div className="card py-16 text-center text-sm text-muted">Loading…</div>
      ) : (
        <div className="space-y-4">
          {/* KPI summary */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label="Revenue" value={taka(d.totalIncome)} icon={<Receipt size={18} />} bg="#dbeafe" fg="#1d4ed8" />
            <Kpi label="Gross Profit" value={taka(d.grossProfit)} sub={`${pctStr(d.grossProfit, d.totalIncome)} margin`} icon={<TrendingUp size={18} />} bg="#dcfce7" fg="#15803d" />
            <Kpi label="Operating Expenses" value={taka(d.totalOpex)} icon={<Wallet size={18} />} bg="#ffedd5" fg="#c2410c" />
            <Kpi
              label={d.netProfit >= 0 ? "Net Profit" : "Net Loss"}
              value={taka(Math.abs(d.netProfit))}
              sub={`${pctStr(d.netProfit, d.totalIncome)} of revenue`}
              icon={d.netProfit >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
              bg={d.netProfit >= 0 ? "#d1fae5" : "#fee2e2"} fg={d.netProfit >= 0 ? "#047857" : "#b91c1c"}
              strong
            />
          </div>

          {/* Statement */}
          <div className="card overflow-hidden p-0">
            <div className="border-b border-line px-5 py-3">
              <h2 className="text-[15px] font-bold">Income Statement</h2>
              <p className="text-[12px] text-muted">For the period {from} to {to}</p>
            </div>
            <div className="divide-y divide-line">
              <Group title="Revenue" rows={d.income} total={d.totalIncome} totalLabel="Total Revenue" positive />
              <Group title="Cost of Goods Sold" rows={d.cogs} total={d.totalCogs} totalLabel="Total COGS" />

              <Band label="Gross Profit" value={d.grossProfit} note={`${pctStr(d.grossProfit, d.totalIncome)} margin`} tone="teal" />

              <Group title="Operating Expenses" rows={d.opex} total={d.totalOpex} totalLabel="Total Operating Expenses" />

              <Band
                label={d.netProfit >= 0 ? "Net Profit" : "Net Loss"}
                value={Math.abs(d.netProfit)}
                note={`${pctStr(d.netProfit, d.totalIncome)} of revenue`}
                tone={d.netProfit >= 0 ? "green" : "red"}
                big
              />
            </div>
          </div>
        </div>
      )}
    </ReportShell>
  );
}

function Kpi({ label, value, sub, icon, bg, fg, strong }: {
  label: string; value: string; sub?: string; icon: React.ReactNode; bg: string; fg: string; strong?: boolean;
}) {
  return (
    <div className={`card flex items-center justify-between p-4 ${strong ? "ring-2" : ""}`} style={strong ? { boxShadow: `inset 0 0 0 2px ${fg}22` } : undefined}>
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</div>
        <div className="mt-1 text-2xl font-bold" style={{ color: fg }}>{value}</div>
        {sub && <div className="text-[11px] text-muted">{sub}</div>}
      </div>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: bg, color: fg }}>{icon}</span>
    </div>
  );
}

function Group({ title, rows, total, totalLabel, positive }: {
  title: string; rows: Row[]; total: number; totalLabel: string; positive?: boolean;
}) {
  return (
    <div className="px-5 py-3">
      <div className="text-[11px] font-bold uppercase tracking-wide text-muted">{title}</div>
      <div className="mt-1.5 space-y-1">
        {rows.length === 0 && <div className="text-[13px] text-muted">None recorded</div>}
        {rows.map((r) => (
          <div key={r.id} className="flex items-baseline justify-between text-[13px]">
            <span className="text-body"><span className="mr-2 font-mono text-[11px] text-muted">{r.code}</span>{r.name}</span>
            <span className={`tabular-nums ${positive ? "text-tealdark" : ""}`}>{taka(r.balance)}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-line pt-2 text-[13px] font-bold">
        <span>{totalLabel}</span>
        <span className="tabular-nums">{taka(total)}</span>
      </div>
    </div>
  );
}

function Band({ label, value, note, tone, big }: {
  label: string; value: number; note?: string; tone: "teal" | "green" | "red"; big?: boolean;
}) {
  const bg = tone === "red" ? "var(--redsoft)" : "var(--tealsoft)";
  const fg = tone === "red" ? "var(--red)" : "var(--tealdark)";
  return (
    <div className="flex items-center justify-between px-5" style={{ background: bg, paddingTop: big ? 16 : 12, paddingBottom: big ? 16 : 12 }}>
      <div>
        <div className={`font-bold ${big ? "text-[16px]" : "text-[14px]"}`} style={{ color: fg }}>{label}</div>
        {note && <div className="text-[11px]" style={{ color: fg }}>{note}</div>}
      </div>
      <div className={`font-bold tabular-nums ${big ? "text-2xl" : "text-lg"}`} style={{ color: fg }}>{taka(value)}</div>
    </div>
  );
}
