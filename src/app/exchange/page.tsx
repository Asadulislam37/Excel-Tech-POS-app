"use client";

import { useCallback, useEffect, useState } from "react";
import { taka, dt } from "@/lib/format";
import { ArrowDownLeft, ArrowUpRight, CheckCircle2, Plus, Search, Trash2 } from "lucide-react";

type SaleItem = {
  id: string; quantity: number; unitPrice: string;
  variantId: string;
  variant: { sku: string; product: { name: string; type: string } };
  serialUnits: { id: string; serialNo: string }[];
};
type Sale = {
  id: string; invoiceNo: string; createdAt: string; grandTotal: string;
  customer?: { name: string; phone: string } | null;
  items: SaleItem[];
};
type Variant = {
  id: string; sku: string; salePrice: string;
  color?: { name: string } | null; size?: { name: string } | null;
  stockLevels: { quantity: number }[]; _count: { serialUnits: number };
};
type Product = { id: string; name: string; type: "SERIALIZED" | "STANDARD"; variants: Variant[] };
type OutLine = { variantId: string; label: string; type: string; quantity: number; unitPrice: number; serialNos: string[]; available: { id: string; serialNo: string }[] };

export default function SalesExchangePage() {
  const [q, setQ] = useState("");
  const [sales, setSales] = useState<Sale[]>([]);
  const [sale, setSale] = useState<Sale | null>(null);
  const [inLines, setInLines] = useState<Record<string, { quantity: number; serialNos: string[] }>>({});
  const [pq, setPq] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [outLines, setOutLines] = useState<OutLine[]>([]);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ exchangeNo: string; diffAmount: string } | null>(null);

  const search = useCallback(async () => {
    const r = await fetch(`/api/sales?q=${encodeURIComponent(q)}`);
    if (r.ok) setSales((await r.json()).rows);
  }, [q]);
  useEffect(() => { const t = setTimeout(search, 250); return () => clearTimeout(t); }, [search]);

  useEffect(() => {
    if (!sale) return;
    const t = setTimeout(async () => {
      const r = await fetch(`/api/products?q=${encodeURIComponent(pq)}`);
      if (r.ok) setProducts(await r.json());
    }, 250);
    return () => clearTimeout(t);
  }, [pq, sale]);

  const pick = (s: Sale) => {
    setSale(s); setErr("");
    setInLines(Object.fromEntries(s.items.map((i) => [i.id, { quantity: 0, serialNos: [] }])));
    setOutLines([]);
  };

  const addOut = async (p: Product, v: Variant) => {
    if (outLines.some((l) => l.variantId === v.id)) return;
    let available: { id: string; serialNo: string }[] = [];
    if (p.type === "SERIALIZED") {
      const r = await fetch(`/api/serials?variantId=${v.id}&status=IN_STOCK`);
      available = r.ok ? await r.json() : [];
    }
    setOutLines((l) => [...l, {
      variantId: v.id,
      label: `${p.name} — ${[v.color?.name, v.size?.name].filter(Boolean).join(" ") || v.sku}`,
      type: p.type, quantity: p.type === "SERIALIZED" ? 0 : 1,
      unitPrice: Number(v.salePrice), serialNos: [], available,
    }]);
  };

  const valueIn = sale
    ? sale.items.reduce((s, i) => s + (inLines[i.id]?.quantity ?? 0) * Number(i.unitPrice), 0)
    : 0;
  const valueOut = outLines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const diff = valueOut - valueIn;

  const submit = async () => {
    if (!sale) return;
    setErr(""); setBusy(true);
    try {
      const itemsIn = sale.items
        .filter((i) => (inLines[i.id]?.quantity ?? 0) > 0)
        .map((i) => ({
          variantId: i.variantId, quantity: inLines[i.id].quantity,
          unitPrice: Number(i.unitPrice), serialNos: inLines[i.id].serialNos,
        }));
      const itemsOut = outLines.filter((l) => l.quantity > 0).map((l) => ({
        variantId: l.variantId, quantity: l.quantity, unitPrice: l.unitPrice, serialNos: l.serialNos,
      }));
      const res = await fetch("/api/exchanges", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saleId: sale.id, reason, itemsIn, itemsOut }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setDone({ exchangeNo: d.exchangeNo, diffAmount: d.diffAmount });
      setSale(null); setOutLines([]); setInLines({}); setReason("");
    } catch (e) { setErr(e instanceof Error ? e.message : "Exchange failed."); }
    finally { setBusy(false); }
  };

  if (done) {
    const amt = Number(done.diffAmount);
    return (
      <div className="mx-auto max-w-md">
        <div className="card p-8 text-center">
          <CheckCircle2 size={44} className="mx-auto text-teal" />
          <h2 className="mt-3 text-lg font-bold">Exchange recorded</h2>
          <div className="mt-1 font-mono text-sm text-muted">{done.exchangeNo}</div>
          <div className={`mt-4 text-3xl font-bold ${amt >= 0 ? "text-tealdark" : "text-red"}`}>{taka(Math.abs(amt))}</div>
          <p className="mt-2 text-[13px] text-muted">{amt >= 0 ? "Collect from customer" : "Refund to customer"}</p>
          <button className="btn btn-primary mt-6" onClick={() => setDone(null)}>New exchange</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-bold">Sales Exchange</h1>

      {!sale ? (
        <>
          <div className="relative max-w-lg">
            <Search size={16} className="absolute left-3 top-2.5 text-muted" />
            <input className="input pl-9" placeholder="Search invoice no, customer name or phone…"
              value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
          </div>
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[680px]">
              <thead><tr><th className="th">Invoice</th><th className="th">Date</th><th className="th">Customer</th><th className="th text-right">Amount</th><th className="th" /></tr></thead>
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
          <div className="space-y-4">
            {/* Coming back in */}
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3">
                <h2 className="flex items-center gap-2 font-bold"><ArrowDownLeft size={16} className="text-tealdark" /> Customer returns</h2>
                <button className="btn btn-ghost py-1.5 text-[12px]" onClick={() => setSale(null)}>Change invoice</button>
              </div>
              <table className="w-full">
                <thead><tr><th className="th">Product</th><th className="th text-center">Sold</th><th className="th text-center">Qty</th><th className="th text-right">Value</th></tr></thead>
                <tbody>
                  {sale.items.map((i) => {
                    const serialised = i.variant.product.type === "SERIALIZED";
                    const line = inLines[i.id];
                    return (
                      <tr key={i.id}>
                        <td className="td">
                          <div className="font-semibold">{i.variant.product.name}</div>
                          {serialised && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {i.serialUnits.map((u) => (
                                <button key={u.id}
                                  onClick={() => setInLines((l) => {
                                    const cur = l[i.id];
                                    const has = cur.serialNos.includes(u.serialNo);
                                    const serialNos = has ? cur.serialNos.filter((s) => s !== u.serialNo) : [...cur.serialNos, u.serialNo];
                                    return { ...l, [i.id]: { serialNos, quantity: serialNos.length } };
                                  })}
                                  className={`serial-chip ${line?.serialNos.includes(u.serialNo) ? "!bg-teal !text-white" : "!bg-white"}`}>
                                  {u.serialNo}
                                </button>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="td text-center">{i.quantity}</td>
                        <td className="td text-center">
                          <input type="number" min={0} max={i.quantity} disabled={serialised} className="input w-20 text-center"
                            value={line?.quantity ?? 0}
                            onChange={(e) => setInLines((l) => ({ ...l, [i.id]: { ...l[i.id], quantity: Math.max(0, Math.min(Number(e.target.value), i.quantity)) } }))} />
                        </td>
                        <td className="td text-right">{taka((line?.quantity ?? 0) * Number(i.unitPrice))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Going out */}
            <div className="card overflow-hidden">
              <h2 className="flex items-center gap-2 px-4 py-3 font-bold"><ArrowUpRight size={16} className="text-amber" /> Customer takes</h2>
              <div className="px-4 pb-3">
                <input className="input" placeholder="Search a replacement product…" value={pq} onChange={(e) => setPq(e.target.value)} />
                {pq && (
                  <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-line">
                    {products.flatMap((p) => p.variants.map((v) => {
                      const stock = p.type === "SERIALIZED" ? v._count.serialUnits : (v.stockLevels[0]?.quantity ?? 0);
                      return (
                        <button key={v.id} disabled={stock === 0} onClick={() => { addOut(p, v); setPq(""); }}
                          className="flex w-full items-center justify-between border-b border-line px-3 py-2 text-left text-[13px] last:border-0 hover:bg-paper disabled:opacity-40">
                          <span>{p.name} <span className="text-muted">{[v.color?.name, v.size?.name].filter(Boolean).join(" ") || v.sku}</span></span>
                          <span className="flex items-center gap-2"><b>{taka(v.salePrice)}</b><span className="text-[11px] text-muted">{stock} left</span><Plus size={13} /></span>
                        </button>
                      );
                    }))}
                  </div>
                )}
              </div>
              <table className="w-full">
                <thead><tr><th className="th">Product</th><th className="th text-center">Qty</th><th className="th text-right">Price</th><th className="th text-right">Total</th><th className="th" /></tr></thead>
                <tbody>
                  {outLines.map((l, idx) => (
                    <tr key={l.variantId}>
                      <td className="td">
                        <div className="font-semibold">{l.label}</div>
                        {l.type === "SERIALIZED" && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {l.available.map((u) => (
                              <button key={u.id}
                                onClick={() => setOutLines((ls) => ls.map((x, j) => {
                                  if (j !== idx) return x;
                                  const has = x.serialNos.includes(u.serialNo);
                                  const serialNos = has ? x.serialNos.filter((s) => s !== u.serialNo) : [...x.serialNos, u.serialNo];
                                  return { ...x, serialNos, quantity: serialNos.length };
                                }))}
                                className={`serial-chip ${l.serialNos.includes(u.serialNo) ? "!bg-teal !text-white" : "!bg-white"}`}>
                                {u.serialNo}
                              </button>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="td text-center">
                        <input type="number" min={0} disabled={l.type === "SERIALIZED"} className="input w-20 text-center"
                          value={l.quantity}
                          onChange={(e) => setOutLines((ls) => ls.map((x, j) => j === idx ? { ...x, quantity: Math.max(0, Number(e.target.value)) } : x))} />
                      </td>
                      <td className="td text-right">
                        <input type="number" className="input w-24 text-right" value={l.unitPrice}
                          onChange={(e) => setOutLines((ls) => ls.map((x, j) => j === idx ? { ...x, unitPrice: Number(e.target.value) || 0 } : x))} />
                      </td>
                      <td className="td text-right font-semibold">{taka(l.quantity * l.unitPrice)}</td>
                      <td className="td text-right"><button className="text-muted hover:text-red" onClick={() => setOutLines((ls) => ls.filter((_, j) => j !== idx))}><Trash2 size={15} /></button></td>
                    </tr>
                  ))}
                  {outLines.length === 0 && <tr><td colSpan={5} className="td py-6 text-center text-muted">Search above to add the replacement product.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card h-fit space-y-3 p-4 lg:sticky lg:top-[72px]">
            <h2 className="text-[15px] font-bold">Exchange Summary</h2>
            <div className="flex justify-between text-[13px]"><span className="text-muted">Returned value</span><span>{taka(valueIn)}</span></div>
            <div className="flex justify-between text-[13px]"><span className="text-muted">New items value</span><span>{taka(valueOut)}</span></div>
            <div className={`flex justify-between rounded-lg px-3 py-2 text-[15px] font-bold ${diff >= 0 ? "bg-tealsoft text-tealdark" : "bg-ambersoft text-amber"}`}>
              <span>{diff >= 0 ? "Customer pays" : "Refund"}</span><span>{taka(Math.abs(diff))}</span>
            </div>
            <label className="block text-[12px] font-semibold text-muted">Reason
              <textarea className="input mt-1 min-h-20" placeholder="Why is this being exchanged?" value={reason} onChange={(e) => setReason(e.target.value)} />
            </label>
            {err && <div className="rounded-md bg-redsoft px-3 py-2 text-[12px] font-semibold text-red">{err}</div>}
            <button className="btn btn-primary w-full py-3" disabled={busy || (valueIn === 0 && valueOut === 0)} onClick={submit}>
              {busy ? "Saving…" : "Submit Exchange"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
