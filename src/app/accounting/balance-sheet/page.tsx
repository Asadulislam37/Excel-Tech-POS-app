"use client";

import { useCallback, useEffect, useState } from "react";
import { taka } from "@/lib/format";
import ReportShell, { DateBox } from "@/components/ReportShell";

type Row = { id: string; code: string; name: string; balance: number };
type Data = {
  assets: Row[]; totalAssets: number;
  liabilities: Row[]; totalLiabilities: number;
  equity: Row[]; retained: number; totalEquity: number;
  totalLiabilitiesAndEquity: number; balanced: boolean;
};

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function BalanceSheetPage() {
  const [asOf, setAsOf] = useState(todayStr());
  const [d, setD] = useState<Data | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/reports/financials?report=balance-sheet&asOf=${asOf}`);
    setD(r.ok ? await r.json() : null);
  }, [asOf]);
  useEffect(() => { load(); }, [load]);

  const Block = ({ title, rows, total, extra }: { title: string; rows: Row[]; total: number; extra?: React.ReactNode }) => (
    <div className="card overflow-hidden">
      <h2 className="border-l-4 px-4 py-3 font-bold" style={{ borderColor: "var(--teal)" }}>{title}</h2>
      <table className="w-full">
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="td">{r.code} — {r.name}</td>
              <td className="td text-right font-semibold">{taka(r.balance)}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td className="td text-muted" colSpan={2}>None</td></tr>}
          {extra}
          <tr className="bg-paper font-bold">
            <td className="td">Total {title}</td>
            <td className="td text-right">{taka(total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );

  return (
    <ReportShell
      title="Balance Sheet"
      subtitle={`Financial position as of ${asOf}`}
      filename="balance-sheet"
      head={["Section", "Account", "Amount"]}
      rows={() => [
        ...(d?.assets ?? []).map((r) => ["Asset", `${r.code} — ${r.name}`, r.balance] as (string | number)[]),
        ["", "Total Assets", d?.totalAssets ?? 0],
        ...(d?.liabilities ?? []).map((r) => ["Liability", `${r.code} — ${r.name}`, r.balance] as (string | number)[]),
        ...(d?.equity ?? []).map((r) => ["Equity", `${r.code} — ${r.name}`, r.balance] as (string | number)[]),
        ["Equity", "Retained Earnings", d?.retained ?? 0],
        ["", "Total Liabilities & Equity", d?.totalLiabilitiesAndEquity ?? 0],
      ]}
      dates={<DateBox value={asOf} onChange={setAsOf} />}
      badge={d && (
        <div className="card px-4 py-2">
          <div className="text-[11px] font-semibold uppercase text-muted">Status</div>
          <div className={`text-lg font-bold ${d.balanced ? "text-tealdark" : "text-red"}`}>
            {d.balanced ? "Balanced ✓" : "Out of balance"}
          </div>
        </div>
      )}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Block title="Assets" rows={d?.assets ?? []} total={d?.totalAssets ?? 0} />
        <div className="space-y-4">
          <Block title="Liabilities" rows={d?.liabilities ?? []} total={d?.totalLiabilities ?? 0} />
          <Block title="Equity" rows={d?.equity ?? []} total={d?.totalEquity ?? 0}
            extra={<tr><td className="td">Retained Earnings (profit to date)</td>
              <td className={`td text-right font-semibold ${(d?.retained ?? 0) >= 0 ? "text-tealdark" : "text-red"}`}>{taka(d?.retained ?? 0)}</td></tr>} />
          <div className="card bg-paper px-4 py-3">
            <div className="flex items-center justify-between font-bold">
              <span>Total Liabilities &amp; Equity</span>
              <span>{taka(d?.totalLiabilitiesAndEquity ?? 0)}</span>
            </div>
          </div>
        </div>
      </div>
    </ReportShell>
  );
}
