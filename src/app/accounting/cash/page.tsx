"use client";

import { useCallback, useEffect, useState } from "react";
import { taka, dt } from "@/lib/format";
import { exportCsv, exportExcel } from "@/lib/export";
import { Download, FileSpreadsheet, Printer } from "lucide-react";

type Account = { id: string; code: string; name: string; type: string };
type Row = { id: string; date: string; voucherNo: string; memo: string; refType: string; debit: number; credit: number; balance: number };
type Ledger = { account: Account; opening: number; closing: number; totalDebit: number; totalCredit: number; rows: Row[] };

const CASH_CODES = ["1000", "1010", "1020", "1030", "1040"];

export default function CashStatementPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState<Ledger | null>(null);

  useEffect(() => {
    fetch("/api/accounts").then(async (r) => {
      if (!r.ok) return;
      const list: Account[] = await r.json();
      const cash = list.filter((a) => CASH_CODES.includes(a.code));
      setAccounts(cash);
      setAccountId((cur) => cur || cash[0]?.id || "");
    });
  }, []);

  const load = useCallback(async () => {
    if (!accountId) return;
    const p = new URLSearchParams({ accountId });
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    const r = await fetch(`/api/reports/ledger?${p}`);
    setData(r.ok ? await r.json() : null);
  }, [accountId, from, to]);
  useEffect(() => { load(); }, [load]);

  const HEAD = ["Date", "Voucher No.", "Ref", "Debit", "Credit", "Balance"];
  const sheet = () => (data?.rows ?? []).map((r) => [new Date(r.date).toLocaleString("en-GB"), r.voucherNo, r.memo || r.refType, r.debit, r.credit, r.balance]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-bold">Cash &amp; Bank Statement</h1>
        {data && (
          <div className="card flex divide-x divide-line">
            <div className="px-4 py-2"><div className="text-[11px] font-semibold uppercase text-muted">Debit</div><div className="text-lg font-bold">{taka(data.totalDebit)}</div></div>
            <div className="px-4 py-2"><div className="text-[11px] font-semibold uppercase text-muted">Credit</div><div className="text-lg font-bold">{taka(data.totalCredit)}</div></div>
            <div className="px-4 py-2"><div className="text-[11px] font-semibold uppercase text-muted">Balance</div><div className={`text-lg font-bold ${data.closing >= 0 ? "text-tealdark" : "text-red"}`}>{taka(data.closing)}</div></div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[180px] flex-1 basis-[220px] lg:max-w-[280px]">
          <select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
          </select>
        </div>
        <div className="min-w-[130px] basis-[150px]"><input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="min-w-[130px] basis-[150px]"><input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div className="flex shrink-0 gap-2">
          <button className="btn btn-ghost px-3" title="Export to Excel" onClick={() => exportExcel("cash-statement", HEAD, sheet())}><FileSpreadsheet size={16} /></button>
          <button className="btn btn-ghost px-3" title="Download CSV" onClick={() => exportCsv("cash-statement", HEAD, sheet())}><Download size={16} /></button>
          <button className="btn btn-ghost px-3" title="Print" onClick={() => window.print()}><Printer size={16} /></button>
        </div>
      </div>

      {data && (
        <div className="text-center">
          <h2 className="font-bold">Cash and Bank Statement</h2>
          <div className="text-[13px] text-muted">{data.account.name}</div>
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[760px]">
          <thead><tr>
            <th className="th">SL.</th><th className="th">Date</th><th className="th">Voucher No.</th><th className="th">Narration</th>
            <th className="th text-right">Debit</th><th className="th text-right">Credit</th><th className="th text-right">Balance</th>
          </tr></thead>
          <tbody>
            <tr className="bg-paper"><td className="td" /><td className="td font-semibold" colSpan={5}>Opening balance</td><td className="td text-right font-bold">{taka(data?.opening ?? 0)}</td></tr>
            {data?.rows.map((r, i) => (
              <tr key={r.id}>
                <td className="td">{i + 1}</td>
                <td className="td text-[12px] text-muted">{dt(r.date)}</td>
                <td className="td font-mono text-[12px]">{r.voucherNo}</td>
                <td className="td text-[12px]">{r.memo || r.refType || "—"}</td>
                <td className="td text-right">{r.debit ? taka(r.debit) : "—"}</td>
                <td className="td text-right">{r.credit ? taka(r.credit) : "—"}</td>
                <td className="td text-right font-semibold">{taka(r.balance)}</td>
              </tr>
            ))}
            {data && data.rows.length === 0 && <tr><td colSpan={7} className="td py-10 text-center text-muted">No movement in this period.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
