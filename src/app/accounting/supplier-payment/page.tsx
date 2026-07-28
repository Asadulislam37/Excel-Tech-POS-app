"use client";

import { useCallback, useEffect, useState } from "react";
import { taka, dt } from "@/lib/format";
import { HandCoins, X } from "lucide-react";

type Supplier = { id: string; name: string; phone: string; due: number };
type Payment = { id: string; supplier: string; method: string; amount: number; reference: string; createdAt: string };

const METHODS = ["CASH", "BKASH", "NAGAD", "ROCKET", "CARD", "BANK"];

export default function SupplierPaymentPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [pay, setPay] = useState<Supplier | null>(null);
  const [form, setForm] = useState({ method: "CASH", amount: "", reference: "", note: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/supplier-payments");
    if (r.ok) { const d = await r.json(); setSuppliers(d.suppliers); setPayments(d.payments); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (!pay) return;
    setErr(""); setBusy(true);
    try {
      const res = await fetch("/api/supplier-payments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplierId: pay.id, ...form }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setPay(null);
      setForm({ method: "CASH", amount: "", reference: "", note: "" });
      load();
    } catch (e) { setErr(e instanceof Error ? e.message : "Payment failed."); }
    finally { setBusy(false); }
  };

  const totalDue = suppliers.reduce((s, x) => s + x.due, 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-bold">Supplier Payment</h1>
        <div className="card px-4 py-2">
          <div className="text-[11px] font-semibold uppercase text-muted">Total Supplier Due</div>
          <div className="text-xl font-bold text-amber">{taka(totalDue)}</div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card overflow-hidden">
          <h2 className="px-4 py-3 font-bold">Suppliers</h2>
          <table className="w-full">
            <thead><tr><th className="th">Supplier</th><th className="th">Phone</th><th className="th text-right">Due</th><th className="th" /></tr></thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.id}>
                  <td className="td font-semibold">{s.name}</td>
                  <td className="td text-muted">{s.phone || "—"}</td>
                  <td className={`td text-right font-bold ${s.due > 0 ? "text-amber" : "text-muted"}`}>{taka(s.due)}</td>
                  <td className="td text-right">
                    <button className="btn btn-primary py-1.5 text-[12px]" disabled={s.due <= 0}
                      onClick={() => { setErr(""); setForm({ method: "CASH", amount: String(s.due), reference: "", note: "" }); setPay(s); }}>
                      <HandCoins size={13} /> Pay
                    </button>
                  </td>
                </tr>
              ))}
              {suppliers.length === 0 && <tr><td colSpan={4} className="td py-8 text-center text-muted">No suppliers yet — add one through a purchase.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="card overflow-hidden">
          <h2 className="px-4 py-3 font-bold">Recent Payments</h2>
          <table className="w-full">
            <thead><tr><th className="th">Date</th><th className="th">Supplier</th><th className="th">Method</th><th className="th text-right">Amount</th></tr></thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="td text-[12px] text-muted">{dt(p.createdAt)}</td>
                  <td className="td font-semibold">{p.supplier}</td>
                  <td className="td"><span className="rounded bg-tealsoft px-2 py-0.5 text-[11px] font-bold text-tealdark">{p.method}</span></td>
                  <td className="td text-right font-bold">{taka(p.amount)}</td>
                </tr>
              ))}
              {payments.length === 0 && <tr><td colSpan={4} className="td py-8 text-center text-muted">No payments recorded yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {pay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setPay(null)}>
          <div className="card w-full max-w-md space-y-3 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h3 className="text-lg font-bold">Pay {pay.name}</h3><button onClick={() => setPay(null)}><X size={17} /></button></div>
            <div className="rounded-lg bg-ambersoft px-3 py-2 text-[13px] font-semibold text-amber">Outstanding due: {taka(pay.due)}</div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-[12px] font-semibold text-muted">Amount
                <input type="number" className="input mt-1" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </label>
              <label className="block text-[12px] font-semibold text-muted">Method
                <select className="input mt-1" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
                  {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </label>
            </div>
            <label className="block text-[12px] font-semibold text-muted">Reference
              <input className="input mt-1" placeholder="Transaction ID (optional)" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
            </label>
            {err && <div className="rounded-md bg-redsoft px-3 py-2 text-[12px] font-semibold text-red">{err}</div>}
            <button className="btn btn-primary w-full py-3" disabled={busy} onClick={submit}>{busy ? "Saving…" : "Pay Now"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
