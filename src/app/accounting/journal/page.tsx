"use client";
import DateInput from "@/components/DateInput";

import { useCallback, useEffect, useState } from "react";
import { taka, dt } from "@/lib/format";
import { exportPdf, exportExcel } from "@/lib/export";
import { Download, Eye, FileSpreadsheet, Plus, Printer, Trash2, X } from "lucide-react";

type Account = { id: string; code: string; name: string; type: string };
type JLine = { code: string; name: string; debit: number; credit: number };
type Row = { id: string; voucherNo: string; date: string; memo: string; refType: string; amount: number; lines: JLine[] };
type Data = { total: number; rows: Row[] };

export default function ManageJournalPage() {
  const [q, setQ] = useState("");
  const [date, setDate] = useState("");
  const [page, setPage] = useState(1);
  const [d, setD] = useState<Data | null>(null);
  const [view, setView] = useState<Row | null>(null);
  const [show, setShow] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [memo, setMemo] = useState("");
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState([{ code: "", debit: "", credit: "" }, { code: "", debit: "", credit: "" }]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const p = new URLSearchParams({ q, page: String(page) });
    if (date) p.set("date", date);
    const r = await fetch(`/api/journal?${p}`);
    if (r.ok) setD(await r.json());
  }, [q, date, page]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  useEffect(() => { setPage(1); }, [q, date]);
  useEffect(() => { fetch("/api/accounts").then(async (r) => r.ok && setAccounts(await r.json())); }, []);

  const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

  const save = async () => {
    setErr(""); setBusy(true);
    try {
      const res = await fetch("/api/journal", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: entryDate, memo, lines: lines.map((l) => ({ code: l.code, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0 })) }),
      });
      const dd = await res.json();
      if (!res.ok) throw new Error(dd.error);
      setShow(false); setMemo(""); setLines([{ code: "", debit: "", credit: "" }, { code: "", debit: "", credit: "" }]);
      load();
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed."); }
    finally { setBusy(false); }
  };

  const HEAD = ["SL.", "Date", "Voucher No.", "Account", "Type", "Ref No.", "Amount"];
  const sheet = () => (d?.rows ?? []).flatMap((r, i) => r.lines.map((l) => [i + 1, new Date(r.date).toLocaleString("en-GB"), r.voucherNo, l.name, r.refType, r.memo, l.debit || l.credit]));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-bold">Manage Journal</h1>
        <div className="card px-4 py-2"><div className="text-[11px] font-semibold uppercase text-muted">Vouchers</div><div className="text-xl font-bold">{d ? d.total : "…"}</div></div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button className="btn text-white" style={{ background: "var(--amber)" }} onClick={() => setShow(true)}><Plus size={15} /> Create</button>
        <div className="min-w-[160px] flex-1 basis-[200px]"><input className="input" placeholder="Type here…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="min-w-[130px] basis-[150px]"><DateInput value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div className="flex shrink-0 gap-2">
          <button className="btn btn-ghost px-3" title="Export to Excel" onClick={() => exportExcel("journal", HEAD, sheet())}><FileSpreadsheet size={16} /></button>
          <button className="btn btn-ghost px-3" title="Download PDF" onClick={() => exportPdf("journal", HEAD, sheet(), "Manage Journal")}><Download size={16} /></button>
          <button className="btn btn-ghost px-3" title="Print" onClick={() => window.print()}><Printer size={16} /></button>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[860px]">
          <thead><tr>
            <th className="th">SL.</th><th className="th">Date</th><th className="th">Voucher No.</th>
            <th className="th">Accounts</th><th className="th">Type</th><th className="th">Ref No.</th>
            <th className="th text-right">Amount</th><th className="th text-center">Action</th>
          </tr></thead>
          <tbody>
            {d?.rows.map((r, i) => (
              <tr key={r.id}>
                <td className="td">{(page - 1) * 50 + i + 1}</td>
                <td className="td text-[12px] text-muted">{dt(r.date)}</td>
                <td className="td font-mono text-[12px]">{r.voucherNo}</td>
                <td className="td text-[12px]">{r.lines.map((l) => l.name).join(", ")}</td>
                <td className="td"><span className="rounded bg-paper px-2 py-0.5 text-[11px] font-bold">{r.refType || "Manual"}</span></td>
                <td className="td text-[12px] text-muted">{r.memo || "—"}</td>
                <td className="td text-right font-semibold">{taka(r.amount)}</td>
                <td className="td text-center"><button className="rounded-md bg-orange-100 p-2 text-orange-600 hover:bg-orange-200" onClick={() => setView(r)}><Eye size={14} /></button></td>
              </tr>
            ))}
            {d && d.rows.length === 0 && <tr><td colSpan={8} className="td py-10 text-center text-muted">No journal vouchers yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {d && d.total > 50 && (
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-muted">page {page} of {Math.ceil(d.total / 50)}</span>
          <div className="flex gap-2"><button className="btn btn-ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>‹ Prev</button><button className="btn btn-ghost" disabled={page >= Math.ceil(d.total / 50)} onClick={() => setPage((p) => p + 1)}>Next ›</button></div>
        </div>
      )}

      {/* View voucher */}
      {view && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setView(null)}>
          <div className="card w-full max-w-lg space-y-3 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><div><h3 className="text-lg font-bold">{view.voucherNo}</h3><p className="text-[12px] text-muted">{dt(view.date)} · {view.memo || view.refType}</p></div><button onClick={() => setView(null)}><X size={17} /></button></div>
            <table className="w-full">
              <thead><tr><th className="th">Account</th><th className="th text-right">Debit</th><th className="th text-right">Credit</th></tr></thead>
              <tbody>
                {view.lines.map((l, k) => (
                  <tr key={k}><td className="td">{l.code} — {l.name}</td><td className="td text-right">{l.debit ? taka(l.debit) : "—"}</td><td className="td text-right">{l.credit ? taka(l.credit) : "—"}</td></tr>
                ))}
              </tbody>
              <tfoot><tr className="bg-paper font-bold"><td className="td">Total</td><td className="td text-right">{taka(view.lines.reduce((s, l) => s + l.debit, 0))}</td><td className="td text-right">{taka(view.lines.reduce((s, l) => s + l.credit, 0))}</td></tr></tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Create manual journal */}
      {show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShow(false)}>
          <div className="card max-h-[90vh] w-full max-w-2xl space-y-3 overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h3 className="text-lg font-bold">New Journal Voucher</h3><button onClick={() => setShow(false)}><X size={17} /></button></div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-[12px] font-semibold text-muted">Date<DateInput className="input mt-1" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} /></label>
              <label className="block text-[12px] font-semibold text-muted">Memo<input className="input mt-1" placeholder="What is this for?" value={memo} onChange={(e) => setMemo(e.target.value)} /></label>
            </div>
            <div className="grid grid-cols-[1fr_100px_100px_32px] gap-2 text-[11px] font-semibold uppercase text-muted"><span>Account</span><span className="text-right">Debit</span><span className="text-right">Credit</span><span /></div>
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-[1fr_100px_100px_32px] items-center gap-2">
                <select className="input" value={l.code} onChange={(e) => setLines((ls) => ls.map((x, j) => j === i ? { ...x, code: e.target.value } : x))}>
                  <option value="">Select account…</option>
                  {accounts.map((a) => <option key={a.id} value={a.code}>{a.code} — {a.name}</option>)}
                </select>
                <input type="number" className="input text-right" placeholder="0" value={l.debit} onChange={(e) => setLines((ls) => ls.map((x, j) => j === i ? { ...x, debit: e.target.value, credit: "" } : x))} />
                <input type="number" className="input text-right" placeholder="0" value={l.credit} onChange={(e) => setLines((ls) => ls.map((x, j) => j === i ? { ...x, credit: e.target.value, debit: "" } : x))} />
                <button className="text-muted hover:text-red" onClick={() => setLines((ls) => ls.length > 2 ? ls.filter((_, j) => j !== i) : ls)}><Trash2 size={14} /></button>
              </div>
            ))}
            <button className="text-[12px] font-semibold text-tealdark" onClick={() => setLines((ls) => [...ls, { code: "", debit: "", credit: "" }])}>+ Add line</button>
            <div className={`flex justify-between rounded-lg px-3 py-2 text-[13px] font-bold ${balanced ? "bg-tealsoft text-tealdark" : "bg-ambersoft text-amber"}`}>
              <span>Debit {taka(totalDebit)} · Credit {taka(totalCredit)}</span><span>{balanced ? "Balanced ✓" : "Must balance"}</span>
            </div>
            {err && <div className="rounded-md bg-redsoft px-3 py-2 text-[12px] font-semibold text-red">{err}</div>}
            <button className="btn btn-primary w-full py-3" disabled={!balanced || busy} onClick={save}>{busy ? "Posting…" : "Post Journal"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
