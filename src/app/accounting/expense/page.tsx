"use client";
import DateInput from "@/components/DateInput";

import { useCallback, useEffect, useState } from "react";
import { taka, dt } from "@/lib/format";
import { exportCsv, exportExcel } from "@/lib/export";
import { Download, FileSpreadsheet, Plus, Printer, X } from "lucide-react";

type Account = { id: string; code: string; name: string; type: string };
type Row = { id: string; voucherNo: string; date: string; memo: string; category: string; paidFrom: string; amount: number };

const METHODS = ["CASH", "BKASH", "NAGAD", "ROCKET", "CARD", "BANK"];
const todayStr = () => new Date().toISOString().slice(0, 10);

export default function ExpenseVoucherPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [heads, setHeads] = useState<Account[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ accountCode: "", method: "CASH", amount: "", memo: "", date: todayStr() });

  const load = useCallback(async () => {
    const p = new URLSearchParams();
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    const r = await fetch(`/api/expenses?${p}`);
    if (r.ok) { const d = await r.json(); setRows(d.rows); setTotal(d.total); setTotalAmount(d.totalAmount); }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetch("/api/accounts?type=EXPENSE").then(async (r) => {
      if (!r.ok) return;
      // Cost of Goods Sold is posted automatically by sales — not a manual voucher head.
      setHeads(((await r.json()) as Account[]).filter((a) => a.code !== "5000"));
    });
  }, []);

  const save = async () => {
    setErr(""); setBusy(true);
    try {
      const res = await fetch("/api/expenses", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setShow(false);
      setForm({ accountCode: "", method: "CASH", amount: "", memo: "", date: todayStr() });
      load();
    } catch (e) { setErr(e instanceof Error ? e.message : "Could not save."); }
    finally { setBusy(false); }
  };

  const HEAD = ["Voucher", "Date", "Expense Head", "Paid From", "Note", "Amount"];
  const sheet = () => rows.map((r) => [r.voucherNo, new Date(r.date).toLocaleDateString("en-GB"), r.category, r.paidFrom, r.memo, r.amount]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-bold">Expense Voucher</h1>
        <div className="card px-4 py-2">
          <div className="text-[11px] font-semibold uppercase text-muted">Total Expense</div>
          <div className="text-xl font-bold text-red">{taka(totalAmount)}</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button className="btn text-white" style={{ background: "var(--amber)" }} onClick={() => setShow(true)}>
          <Plus size={15} /> New Voucher
        </button>
        <div className="min-w-[130px] flex-1 basis-[140px] lg:max-w-[170px]">
          <DateInput value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="min-w-[130px] flex-1 basis-[140px] lg:max-w-[170px]">
          <DateInput value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="flex shrink-0 gap-2">
          <button className="btn btn-ghost px-3" title="Export to Excel" onClick={() => exportExcel("expenses", HEAD, sheet())}><FileSpreadsheet size={16} /></button>
          <button className="btn btn-ghost px-3" title="Download CSV" onClick={() => exportCsv("expenses", HEAD, sheet())}><Download size={16} /></button>
          <button className="btn btn-ghost px-3" title="Print" onClick={() => window.print()}><Printer size={16} /></button>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[760px]">
          <thead><tr>
            <th className="th">SL.</th><th className="th">Voucher</th><th className="th">Date</th>
            <th className="th">Expense Head</th><th className="th">Paid From</th><th className="th">Note</th>
            <th className="th text-right">Amount</th>
          </tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id}>
                <td className="td">{i + 1}</td>
                <td className="td font-mono text-[12px]">{r.voucherNo}</td>
                <td className="td text-[12px] text-muted">{dt(r.date)}</td>
                <td className="td font-semibold">{r.category}</td>
                <td className="td">{r.paidFrom}</td>
                <td className="td text-muted">{r.memo || "—"}</td>
                <td className="td text-right font-bold text-red">{taka(r.amount)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="td py-10 text-center text-muted">No expense vouchers yet — record your first one.</td></tr>}
          </tbody>
        </table>
      </div>
      {total > 50 && <div className="text-[12px] text-muted">Showing latest 50 of {total} vouchers.</div>}

      {show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShow(false)}>
          <div className="card w-full max-w-lg space-y-3 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h3 className="text-lg font-bold">New Expense Voucher</h3><button onClick={() => setShow(false)}><X size={17} /></button></div>
            <label className="block text-[12px] font-semibold text-muted">Expense Head
              <select className="input mt-1" value={form.accountCode} onChange={(e) => setForm({ ...form, accountCode: e.target.value })}>
                <option value="">Select expense head…</option>
                {heads.map((h) => <option key={h.id} value={h.code}>{h.code} — {h.name}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-[12px] font-semibold text-muted">Amount
                <input type="number" className="input mt-1" placeholder="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </label>
              <label className="block text-[12px] font-semibold text-muted">Paid From
                <select className="input mt-1" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
                  {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </label>
            </div>
            <label className="block text-[12px] font-semibold text-muted">Date
              <DateInput className="input mt-1" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </label>
            <label className="block text-[12px] font-semibold text-muted">Note
              <input className="input mt-1" placeholder="What was this for?" value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} />
            </label>
            {err && <div className="rounded-md bg-redsoft px-3 py-2 text-[12px] font-semibold text-red">{err}</div>}
            <button className="btn btn-primary w-full py-3" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save Voucher"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
