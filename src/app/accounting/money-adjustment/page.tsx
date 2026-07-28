"use client";

import { useCallback, useEffect, useState } from "react";
import { taka, dt } from "@/lib/format";

type Account = { id: string; code: string; name: string; type: string };
type Row = { id: string; voucherNo: string; date: string; memo: string; amount: number; fromAccount: string; toAccount: string };

const CASH_CODES = ["1000", "1010", "1020", "1030", "1040"];

export default function MoneyAdjustmentPage() {
  const [tab, setTab] = useState<"ADD" | "WITHDRAW">("ADD");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [accountCode, setAccountCode] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/money?kind=adjustment");
    if (r.ok) setRows((await r.json()).rows);
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { fetch("/api/accounts").then(async (r) => { if (r.ok) setAccounts(((await r.json()) as Account[]).filter((a) => CASH_CODES.includes(a.code))); }); }, []);

  const submit = async () => {
    setErr(""); setBusy(true);
    try {
      const res = await fetch("/api/money", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "adjustment", direction: tab, accountCode, amount: Number(amount), memo }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setAmount(""); setMemo(""); load();
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed."); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-3">
      <div className="inline-flex rounded-full border border-line bg-card p-1">
        {(["ADD", "WITHDRAW"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-full px-5 py-2 text-[13px] font-bold ${tab === t ? "bg-ink text-white" : "text-body hover:bg-paper"}`}>
            {t === "ADD" ? "Add Money" : "Withdraw Money"}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <div className="card h-fit space-y-3 p-4">
          <h2 className="font-bold">{tab === "ADD" ? "Add Money (capital in)" : "Withdraw Money (drawings)"}</h2>
          <label className="block text-[12px] font-semibold text-muted">Account
            <select className="input mt-1" value={accountCode} onChange={(e) => setAccountCode(e.target.value)}><option value="">Select…</option>{accounts.map((a) => <option key={a.id} value={a.code}>{a.name}</option>)}</select>
          </label>
          <label className="block text-[12px] font-semibold text-muted">Amount
            <input type="number" className="input mt-1" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          <label className="block text-[12px] font-semibold text-muted">Note
            <input className="input mt-1" placeholder="Reason (optional)" value={memo} onChange={(e) => setMemo(e.target.value)} />
          </label>
          {err && <div className="rounded-md bg-redsoft px-3 py-2 text-[12px] font-semibold text-red">{err}</div>}
          <button className="btn btn-primary w-full py-3" disabled={busy || !accountCode || !Number(amount)} onClick={submit}>{busy ? "Saving…" : tab === "ADD" ? "Add Money" : "Withdraw Money"}</button>
        </div>

        <div className="card overflow-x-auto">
          <h2 className="px-4 py-3 font-bold">History</h2>
          <table className="w-full min-w-[520px]">
            <thead><tr><th className="th">Date</th><th className="th">Voucher</th><th className="th">Account</th><th className="th text-right">Amount</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="td text-[12px] text-muted">{dt(r.date)}</td>
                  <td className="td font-mono text-[12px]">{r.voucherNo}</td>
                  <td className="td font-semibold">{r.toAccount || r.fromAccount}</td>
                  <td className="td text-right font-semibold">{taka(r.amount)}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={4} className="td py-8 text-center text-muted">No adjustments yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
