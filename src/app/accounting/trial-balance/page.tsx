"use client";

import { useCallback, useEffect, useState } from "react";
import { taka } from "@/lib/format";
import ReportShell, { DateBox } from "@/components/ReportShell";

type Row = { id: string; code: string; name: string; type: string; debit: number; credit: number; balance: number };
type Data = { rows: Row[]; totalDebit: number; totalCredit: number; balanced: boolean };

export default function TrialBalancePage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [d, setD] = useState<Data | null>(null);

  const load = useCallback(async () => {
    const p = new URLSearchParams({ report: "trial-balance" });
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    const r = await fetch(`/api/reports/financials?${p}`);
    setD(r.ok ? await r.json() : null);
  }, [from, to]);
  useEffect(() => { load(); }, [load]);

  const HEAD = ["Code", "Account", "Type", "Debit", "Credit"];

  return (
    <ReportShell
      title="Trial Balance"
      subtitle="Every account that moved in the period — debits must equal credits."
      filename="trial-balance"
      head={HEAD}
      rows={() => (d?.rows ?? []).map((r) => [r.code, r.name, r.type, r.debit, r.credit])}
      dates={<><DateBox value={from} onChange={setFrom} /><DateBox value={to} onChange={setTo} /></>}
      badge={d && (
        <div className={`card px-4 py-2 ${d.balanced ? "" : "border-red"}`}>
          <div className="text-[11px] font-semibold uppercase text-muted">Status</div>
          <div className={`text-lg font-bold ${d.balanced ? "text-tealdark" : "text-red"}`}>
            {d.balanced ? "Balanced ✓" : "Out of balance"}
          </div>
        </div>
      )}
    >
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead><tr>
            <th className="th">Code</th><th className="th">Account</th><th className="th">Type</th>
            <th className="th text-right">Debit</th><th className="th text-right">Credit</th>
          </tr></thead>
          <tbody>
            {d?.rows.map((r) => (
              <tr key={r.id}>
                <td className="td font-mono text-[12px]">{r.code}</td>
                <td className="td font-semibold">{r.name}</td>
                <td className="td text-[12px] text-muted">{r.type}</td>
                <td className="td text-right">{r.debit ? taka(r.debit) : "—"}</td>
                <td className="td text-right">{r.credit ? taka(r.credit) : "—"}</td>
              </tr>
            ))}
            {d && d.rows.length === 0 && <tr><td colSpan={5} className="td py-10 text-center text-muted">No journal activity in this period.</td></tr>}
          </tbody>
          {d && d.rows.length > 0 && (
            <tfoot><tr className="bg-paper font-bold">
              <td className="td" colSpan={3}>Total</td>
              <td className="td text-right">{taka(d.totalDebit)}</td>
              <td className="td text-right">{taka(d.totalCredit)}</td>
            </tr></tfoot>
          )}
        </table>
      </div>
    </ReportShell>
  );
}
