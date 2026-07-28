"use client";

import { useCallback, useEffect, useState } from "react";
import { taka, dt } from "@/lib/format";
import { CheckCircle2, Search } from "lucide-react";

type SaleItem = {
  id: string; quantity: number; unitPrice: string; lineTotal: string;
  variant: { sku: string; product: { name: string; type: string } };
  serialUnits: { id: string; serialNo: string }[];
};
type Sale = {
  id: string; invoiceNo: string; createdAt: string; grandTotal: string; dueTotal: string;
  customer?: { name: string; phone: string } | null;
  items: SaleItem[];
};
type Line = { saleItemId: string; quantity: number; amount: number; serialNos: string[]; restock: boolean };

const METHODS = ["CASH", "BKASH", "NAGAD", "ROCKET", "CARD", "BANK_TRANSFER"];

export default function SalesReturnPage() {
  const [q, setQ] = useState("");
  const [sales, setSales] = useState<Sale[]>([]);
  const [sale, setSale] = useState<Sale | null>(null);
  const [lines, setLines] = useState<Record<string, Line>>({});
  const [refundMethod, setRefundMethod] = useState("CASH");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ returnNo: string; totalAmount: string } | null>(null);

  const search = useCallback(async () => {
    const r = await fetch(`/api/sales?q=${encodeURIComponent(q)}`);
    if (r.ok) setSales((await r.json()).rows);
  }, [q]);
  useEffect(() => { const t = setTimeout(search, 250); return () => clearTimeout(t); }, [search]);

  const pick = (s: Sale) => {
    setSale(s);
    setErr("");
    setLines(Object.fromEntries(s.items.map((i) => [i.id, {
      saleItemId: i.id, quantity: 0, amount: 0, serialNos: [], restock: true,
    }])));
  };

  const setQty = (item: SaleItem, quantity: number) => {
    const qty = Math.max(0, Math.min(quantity, item.quantity));
    setLines((l) => ({
      ...l,
      [item.id]: {
        ...l[item.id],
        quantity: qty,
        amount: Math.round(Number(item.unitPrice) * qty),
        // keep the serial selection in step with the quantity
        serialNos: l[item.id].serialNos.slice(0, qty),
      },
    }));
  };

  const toggleSerial = (item: SaleItem, serialNo: string) => {
    setLines((l) => {
      const cur = l[item.id];
      const has = cur.serialNos.includes(serialNo);
      const serialNos = has ? cur.serialNos.filter((s) => s !== serialNo) : [...cur.serialNos, serialNo];
      return {
        ...l,
        [item.id]: {
          ...cur, serialNos,
          quantity: serialNos.length,
          amount: Math.round(Number(item.unitPrice) * serialNos.length),
        },
      };
    });
  };

  const active = Object.values(lines).filter((l) => l.quantity > 0);
  const totalRefund = active.reduce((s, l) => s + l.amount, 0);

  const submit = async () => {
    if (!sale) return;
    setErr(""); setBusy(true);
    try {
      const res = await fetch("/api/returns", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saleId: sale.id, refundMethod, reason, items: active }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setDone({ returnNo: d.returnNo, totalAmount: d.totalAmount });
      setSale(null); setLines({}); setReason("");
    } catch (e) { setErr(e instanceof Error ? e.message : "Return failed."); }
    finally { setBusy(false); }
  };

  if (done) {
    return (
      <div className="mx-auto max-w-md">
        <div className="card p-8 text-center">
          <CheckCircle2 size={44} className="mx-auto text-teal" />
          <h2 className="mt-3 text-lg font-bold">Return recorded</h2>
          <div className="mt-1 font-mono text-sm text-muted">{done.returnNo}</div>
          <div className="mt-4 text-3xl font-bold">{taka(done.totalAmount)}</div>
          <p className="mt-2 text-[13px] text-muted">Stock and the customer&apos;s balance have been updated.</p>
          <button className="btn btn-primary mt-6" onClick={() => setDone(null)}>New return</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-bold">Sales Return</h1>

      {!sale ? (
        <>
          <div className="relative max-w-lg">
            <Search size={16} className="absolute left-3 top-2.5 text-muted" />
            <input className="input pl-9" placeholder="Search invoice no, customer name or phone…"
              value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
          </div>
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[680px]">
              <thead><tr>
                <th className="th">Invoice</th><th className="th">Date</th><th className="th">Customer</th>
                <th className="th text-right">Amount</th><th className="th" />
              </tr></thead>
              <tbody>
                {sales.map((s) => (
                  <tr key={s.id}>
                    <td className="td font-mono text-[12px]">{s.invoiceNo}</td>
                    <td className="td text-[12px] text-muted">{dt(s.createdAt)}</td>
                    <td className="td font-semibold">{s.customer?.name ?? "Walk-in"}</td>
                    <td className="td text-right font-semibold">{taka(s.grandTotal)}</td>
                    <td className="td text-right"><button className="btn btn-primary py-1.5 text-[12px]" onClick={() => pick(s)}>Select</button></td>
                  </tr>
                ))}
                {sales.length === 0 && <tr><td colSpan={5} className="td py-10 text-center text-muted">No invoices found.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <div className="font-bold">{sale.invoiceNo}</div>
                <div className="text-[12px] text-muted">{sale.customer?.name ?? "Walk-in"} · {dt(sale.createdAt)}</div>
              </div>
              <button className="btn btn-ghost py-1.5 text-[12px]" onClick={() => setSale(null)}>Change invoice</button>
            </div>
            <table className="w-full">
              <thead><tr>
                <th className="th">Product</th><th className="th text-center">Sold</th>
                <th className="th text-center">Return Qty</th><th className="th text-right">Refund</th><th className="th text-center">Condition</th>
              </tr></thead>
              <tbody>
                {sale.items.map((i) => {
                  const line = lines[i.id];
                  const serialised = i.variant.product.type === "SERIALIZED";
                  return (
                    <tr key={i.id}>
                      <td className="td">
                        <div className="font-semibold">{i.variant.product.name}</div>
                        <div className="font-mono text-[11px] text-muted">{i.variant.sku}</div>
                        {serialised && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {i.serialUnits.map((u) => (
                              <button key={u.id}
                                onClick={() => toggleSerial(i, u.serialNo)}
                                className={`serial-chip ${line?.serialNos.includes(u.serialNo) ? "!bg-teal !text-white" : "!bg-white"}`}>
                                {u.serialNo}
                              </button>
                            ))}
                            {i.serialUnits.length === 0 && <span className="text-[11px] text-muted">No IMEIs recorded</span>}
                          </div>
                        )}
                      </td>
                      <td className="td text-center">{i.quantity}</td>
                      <td className="td text-center">
                        <input type="number" min={0} max={i.quantity} disabled={serialised}
                          className="input w-20 text-center"
                          value={line?.quantity ?? 0}
                          onChange={(e) => setQty(i, Number(e.target.value))} />
                      </td>
                      <td className="td text-right font-semibold">{taka(line?.amount ?? 0)}</td>
                      <td className="td text-center">
                        <select className="input" value={line?.restock ? "restock" : "defective"}
                          onChange={(e) => setLines((l) => ({ ...l, [i.id]: { ...l[i.id], restock: e.target.value === "restock" } }))}>
                          <option value="restock">Resellable</option>
                          <option value="defective">Defective</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="card h-fit space-y-3 p-4 lg:sticky lg:top-[72px]">
            <h2 className="text-[15px] font-bold">Return Summary</h2>
            <div className="flex justify-between text-[13px]"><span className="text-muted">Items</span><span>{active.reduce((s, l) => s + l.quantity, 0)}</span></div>
            <div className="flex justify-between rounded-lg bg-tealsoft px-3 py-2 text-[15px] font-bold text-tealdark">
              <span>Refund</span><span>{taka(totalRefund)}</span>
            </div>
            <label className="block text-[12px] font-semibold text-muted">Refund Method
              <select className="input mt-1" value={refundMethod} onChange={(e) => setRefundMethod(e.target.value)}>
                {METHODS.map((m) => <option key={m} value={m}>{m.replace("_", " ")}</option>)}
              </select>
            </label>
            <label className="block text-[12px] font-semibold text-muted">Reason
              <textarea className="input mt-1 min-h-20" placeholder="Why is this being returned?" value={reason} onChange={(e) => setReason(e.target.value)} />
            </label>
            {Number(sale.dueTotal) > 0 && (
              <div className="rounded-md bg-ambersoft px-3 py-2 text-[12px] font-semibold text-amber">
                This invoice has {taka(sale.dueTotal)} due — the refund reduces that first.
              </div>
            )}
            {err && <div className="rounded-md bg-redsoft px-3 py-2 text-[12px] font-semibold text-red">{err}</div>}
            <button className="btn btn-primary w-full py-3" disabled={!active.length || busy} onClick={submit}>
              {busy ? "Saving…" : `Submit Return · ${taka(totalRefund)}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
