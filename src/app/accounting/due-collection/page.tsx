"use client";

import { useCallback, useEffect, useState } from "react";
import { taka, dt } from "@/lib/format";

type Sale = { id: string; invoiceNo: string; grandTotal: string; dueTotal: string; createdAt: string; customer?: { name: string; phone: string } | null };
const METHODS = ["CASH", "BKASH", "NAGAD", "ROCKET", "CARD", "BANK_TRANSFER"];

export default function DueCollection() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [collect, setCollect] = useState<Record<string, { amount: number; method: string }>>({});
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/due-collection");
    if (res.ok) setSales(await res.json());
  }, []);
  useEffect(() => { load(); }, [load]);

  const submit = async (saleId: string) => {
    setMsg("");
    const c = collect[saleId];
    if (!c?.amount) return;
    const res = await fetch("/api/due-collection", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ saleId, amount: c.amount, method: c.method || "CASH" }),
    });
    const data = await res.json();
    if (!res.ok) return setMsg(data.error);
    setCollect((x) => ({ ...x, [saleId]: { amount: 0, method: "CASH" } }));
    load();
  };

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-bold">Due collection</h1>
      {msg && <div className="rounded-md bg-redsoft px-3 py-2 text-[12px] font-semibold text-red">{msg}</div>}
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px]">
          <thead><tr><th className="th">Invoice</th><th className="th">Customer</th><th className="th text-right">Due</th><th className="th">Collect</th></tr></thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s.id}>
                <td className="td"><div className="font-mono text-[12px]">{s.invoiceNo}</div><div className="text-[11px] text-muted">{dt(s.createdAt)}</div></td>
                <td className="td">{s.customer ? `${s.customer.name} (${s.customer.phone})` : "Walk-in"}</td>
                <td className="td text-right font-bold text-amber">{taka(s.dueTotal)}</td>
                <td className="td">
                  <div className="flex gap-2">
                    <input type="number" min={0} className="input w-28" placeholder="Amount" value={collect[s.id]?.amount || ""} onChange={(e) => setCollect((x) => ({ ...x, [s.id]: { amount: Number(e.target.value), method: x[s.id]?.method ?? "CASH" } }))} />
                    <select className="input w-28" value={collect[s.id]?.method ?? "CASH"} onChange={(e) => setCollect((x) => ({ ...x, [s.id]: { amount: x[s.id]?.amount ?? 0, method: e.target.value } }))}>
                      {METHODS.map((m) => <option key={m} value={m}>{m.replace("_", " ")}</option>)}
                    </select>
                    <button className="btn btn-primary" onClick={() => submit(s.id)}>Collect</button>
                  </div>
                </td>
              </tr>
            ))}
            {sales.length === 0 && <tr><td colSpan={4} className="td py-10 text-center text-muted">No outstanding dues. 🎉</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
