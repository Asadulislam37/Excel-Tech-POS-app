"use client";

import { useCallback, useEffect, useState } from "react";
import { taka, dt } from "@/lib/format";
import { CheckCircle2, Search } from "lucide-react";
import { PurchaseReturnTabs } from "@/components/PurchaseTabs";

type PItem = {
  id: string; quantity: number; unitCost: string;
  variant: { sku: string; product: { name: string; type: string } };
  serialUnits: { serialNo: string; status: string }[];
};
type Purchase = {
  id: string; purchaseNo: string; createdAt: string; grandTotal: string; dueTotal: string;
  supplier?: { name: string; phone: string } | null;
  items: PItem[];
};
type Line = { purchaseItemId: string; quantity: number; amount: number; serialNos: string[] };

const METHODS = ["CASH", "BKASH", "NAGAD", "ROCKET", "CARD", "BANK_TRANSFER"];

export default function PurchaseReturnPage() {
  const [q, setQ] = useState("");
  const [list, setList] = useState<Purchase[]>([]);
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [lines, setLines] = useState<Record<string, Line>>({});
  const [refundMethod, setRefundMethod] = useState("CASH");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ returnNo: string; total: string } | null>(null);

  const search = useCallback(async () => {
    const r = await fetch(`/api/purchase?q=${encodeURIComponent(q)}`);
    if (r.ok) setList((await r.json()).rows);
  }, [q]);
  useEffect(() => { const t = setTimeout(search, 250); return () => clearTimeout(t); }, [search]);

  const pick = async (p: Purchase) => {
    const r = await fetch(`/api/purchase/${p.id}`);
    const full = r.ok ? await r.json() : p;
    setPurchase(full); setErr("");
    setLines(Object.fromEntries(full.items.map((i: PItem) => [i.id, { purchaseItemId: i.id, quantity: 0, amount: 0, serialNos: [] }])));
  };

  const setQty = (item: PItem, quantity: number) => {
    const qty = Math.max(0, Math.min(quantity, item.quantity));
    setLines((l) => ({ ...l, [item.id]: { ...l[item.id], quantity: qty, amount: Math.round(Number(item.unitCost) * qty), serialNos: l[item.id].serialNos.slice(0, qty) } }));
  };
  const toggleSerial = (item: PItem, serialNo: string) => {
    setLines((l) => {
      const cur = l[item.id];
      const has = cur.serialNos.includes(serialNo);
      const serialNos = has ? cur.serialNos.filter((s) => s !== serialNo) : [...cur.serialNos, serialNo];
      return { ...l, [item.id]: { ...cur, serialNos, quantity: serialNos.length, amount: Math.round(Number(item.unitCost) * serialNos.length) } };
    });
  };

  const active = Object.values(lines).filter((l) => l.quantity > 0);
  const total = active.reduce((s, l) => s + l.amount, 0);

  const submit = async () => {
    if (!purchase) return;
    setErr(""); setBusy(true);
    try {
      const res = await fetch("/api/purchase-returns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ purchaseId: purchase.id, refundMethod, reason, items: active }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setDone({ returnNo: d.returnNo, total: d.total });
      setPurchase(null); setLines({}); setReason("");
    } catch (e) { setErr(e instanceof Error ? e.message : "Return failed."); }
    finally { setBusy(false); }
  };

  if (done) {
    return (
      <div className="mx-auto max-w-md"><div className="card p-8 text-center">
        <CheckCircle2 size={44} className="mx-auto text-teal" />
        <h2 className="mt-3 text-lg font-bold">Purchase return recorded</h2>
        <div className="mt-1 font-mono text-sm text-muted">{done.returnNo}</div>
        <div className="mt-4 text-3xl font-bold">{taka(done.total)}</div>
        <p className="mt-2 text-[13px] text-muted">Stock reduced and supplier balance updated.</p>
        <button className="btn btn-primary mt-6" onClick={() => setDone(null)}>New return</button>
      </div></div>
    );
  }

  return (
    <div className="space-y-3">
      <PurchaseReturnTabs />
      {!purchase ? (
        <>
          <div className="relative max-w-lg">
            <Search size={16} className="absolute left-3 top-2.5 text-muted" />
            <input className="input pl-9" placeholder="Search purchase no or supplier…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
          </div>
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead><tr><th className="th">Purchase</th><th className="th">Date</th><th className="th">Supplier</th><th className="th text-right">Amount</th><th className="th" /></tr></thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.id}>
                    <td className="td font-mono text-[12px]">{p.purchaseNo}</td>
                    <td className="td text-[12px] text-muted">{dt(p.createdAt)}</td>
                    <td className="td font-semibold">{p.supplier?.name ?? "—"}</td>
                    <td className="td text-right font-semibold">{taka(p.grandTotal)}</td>
                    <td className="td text-right"><button className="btn btn-primary py-1.5 text-[12px]" onClick={() => pick(p)}>Select</button></td>
                  </tr>
                ))}
                {list.length === 0 && <tr><td colSpan={5} className="td py-10 text-center text-muted">No purchases found.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3">
              <div><div className="font-bold">{purchase.purchaseNo}</div><div className="text-[12px] text-muted">{purchase.supplier?.name} · {dt(purchase.createdAt)}</div></div>
              <button className="btn btn-ghost py-1.5 text-[12px]" onClick={() => setPurchase(null)}>Change</button>
            </div>
            <table className="w-full">
              <thead><tr><th className="th">Product</th><th className="th text-center">Bought</th><th className="th text-center">Return Qty</th><th className="th text-right">Amount</th></tr></thead>
              <tbody>
                {purchase.items.map((i) => {
                  const line = lines[i.id];
                  const serialised = i.variant.product.type === "SERIALIZED";
                  const inStock = i.serialUnits.filter((u) => u.status === "IN_STOCK");
                  return (
                    <tr key={i.id}>
                      <td className="td">
                        <div className="font-semibold">{i.variant.product.name}</div>
                        <div className="font-mono text-[11px] text-muted">{i.variant.sku}</div>
                        {serialised && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {inStock.map((u) => (
                              <button key={u.serialNo} onClick={() => toggleSerial(i, u.serialNo)} className={`serial-chip ${line?.serialNos.includes(u.serialNo) ? "!bg-teal !text-white" : "!bg-white"}`}>{u.serialNo}</button>
                            ))}
                            {inStock.length === 0 && <span className="text-[11px] text-muted">No units left in stock</span>}
                          </div>
                        )}
                      </td>
                      <td className="td text-center">{i.quantity}</td>
                      <td className="td text-center"><input type="number" min={0} max={i.quantity} disabled={serialised} className="input w-20 text-center" value={line?.quantity ?? 0} onChange={(e) => setQty(i, Number(e.target.value))} /></td>
                      <td className="td text-right font-semibold">{taka(line?.amount ?? 0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="card h-fit space-y-3 p-4 lg:sticky lg:top-[72px]">
            <h2 className="text-[15px] font-bold">Purchase Return Summary</h2>
            <div className="flex justify-between text-[13px]"><span className="text-muted">Items</span><span>{active.reduce((s, l) => s + l.quantity, 0)}</span></div>
            <div className="flex justify-between rounded-lg bg-tealsoft px-3 py-2 text-[15px] font-bold text-tealdark"><span>Total Returnable</span><span>{taka(total)}</span></div>
            <label className="block text-[12px] font-semibold text-muted">Payment Method
              <select className="input mt-1" value={refundMethod} onChange={(e) => setRefundMethod(e.target.value)}>{METHODS.map((m) => <option key={m} value={m}>{m.replace("_", " ")}</option>)}</select>
            </label>
            <label className="block text-[12px] font-semibold text-muted">Reason<textarea className="input mt-1 min-h-20" value={reason} onChange={(e) => setReason(e.target.value)} /></label>
            {err && <div className="rounded-md bg-redsoft px-3 py-2 text-[12px] font-semibold text-red">{err}</div>}
            <button className="btn btn-primary w-full py-3" disabled={!active.length || busy} onClick={submit}>{busy ? "Saving…" : `Submit Now · ${taka(total)}`}</button>
          </div>
        </div>
      )}
    </div>
  );
}
