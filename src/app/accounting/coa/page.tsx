"use client";

import { useCallback, useEffect, useState } from "react";
import { taka } from "@/lib/format";
import { Plus, X } from "lucide-react";

type Account = {
  id: string; code: string; name: string; type: string; isSystem: boolean;
  debit: number; credit: number; balance: number;
};

const TYPES = ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"];
const TINT: Record<string, string> = {
  ASSET: "bg-tealsoft text-tealdark", LIABILITY: "bg-ambersoft text-amber",
  EQUITY: "bg-paper text-body", INCOME: "bg-tealsoft text-tealdark", EXPENSE: "bg-redsoft text-red",
};

export default function ChartOfAccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [type, setType] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [form, setForm] = useState({ code: "", name: "", type: "EXPENSE" });

  const load = useCallback(async () => {
    const r = await fetch(`/api/accounts${type ? `?type=${type}` : ""}`);
    if (r.ok) setAccounts(await r.json());
  }, [type]);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setErr("");
    const res = await fetch("/api/accounts", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
    });
    const d = await res.json();
    if (!res.ok) return setErr(d.error);
    setShow(false);
    setForm({ code: "", name: "", type: "EXPENSE" });
    load();
  };

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-bold">Chart of Account</h1>

      <div className="flex flex-wrap items-center gap-2">
        <button className="btn text-white" style={{ background: "var(--amber)" }} onClick={() => setShow(true)}>
          <Plus size={15} /> New Account
        </button>
        <div className="min-w-[140px] flex-1 basis-[150px] lg:max-w-[190px]">
          <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All types</option>
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead><tr>
            <th className="th">Code</th><th className="th">Account Name</th><th className="th">Type</th>
            <th className="th text-right">Debit</th><th className="th text-right">Credit</th><th className="th text-right">Balance</th>
          </tr></thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id}>
                <td className="td font-mono text-[12px]">{a.code}</td>
                <td className="td font-semibold">{a.name}
                  {a.isSystem && <span className="ml-2 rounded bg-paper px-1.5 py-0.5 text-[10px] font-bold text-muted">AUTO</span>}</td>
                <td className="td"><span className={`rounded px-2 py-0.5 text-[11px] font-bold ${TINT[a.type]}`}>{a.type}</span></td>
                <td className="td text-right">{a.debit ? taka(a.debit) : "—"}</td>
                <td className="td text-right">{a.credit ? taka(a.credit) : "—"}</td>
                <td className="td text-right font-bold">{taka(a.balance)}</td>
              </tr>
            ))}
            {accounts.length === 0 && <tr><td colSpan={6} className="td py-10 text-center text-muted">No accounts.</td></tr>}
          </tbody>
        </table>
      </div>

      {show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShow(false)}>
          <div className="card w-full max-w-md space-y-3 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h3 className="text-lg font-bold">New Account</h3><button onClick={() => setShow(false)}><X size={17} /></button></div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-[12px] font-semibold text-muted">Code
                <input className="input mt-1" placeholder="5800" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
              </label>
              <label className="block text-[12px] font-semibold text-muted">Type
                <select className="input mt-1" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
            </div>
            <label className="block text-[12px] font-semibold text-muted">Account Name
              <input className="input mt-1" placeholder="e.g. Staff Tea & Snacks" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            {err && <div className="rounded-md bg-redsoft px-3 py-2 text-[12px] font-semibold text-red">{err}</div>}
            <button className="btn btn-primary w-full py-3" onClick={save}>Save Account</button>
          </div>
        </div>
      )}
    </div>
  );
}
