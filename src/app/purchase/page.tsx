"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { taka } from "@/lib/format";
import { CheckCircle2, Plus, ScanBarcode, Search, Trash2, X } from "lucide-react";
import { PurchaseTabs } from "@/components/PurchaseTabs";

type Variant = { id: string; sku: string; costPrice: string; color?: { name: string } | null; size?: { name: string } | null };
type Product = { id: string; name: string; type: "SERIALIZED" | "STANDARD"; variants: Variant[] };
type Supplier = { id: string; name: string; phone: string; address?: string | null };
type Line = { variantId: string; label: string; type: Product["type"]; quantity: number; unitCost: number; serials: string[] };

const METHODS = ["CASH", "BKASH", "NAGAD", "ROCKET", "CARD", "BANK_TRANSFER"];

export default function PurchasePage() {
  const [q, setQ] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [discount, setDiscount] = useState(0);
  const [additionalExpense, setAdditionalExpense] = useState(0);
  const [payments, setPayments] = useState([{ method: "CASH", amount: 0 }]);
  const [note, setNote] = useState("");
  const [serialFor, setSerialFor] = useState<number | null>(null);
  const [serialInput, setSerialInput] = useState("");
  const [editId, setEditId] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<{ purchaseNo: string; grandTotal: string; dueTotal: string } | null>(null);

  const loadProducts = useCallback(async (query: string) => {
    const r = await fetch(`/api/products?q=${encodeURIComponent(query)}`);
    if (r.ok) setProducts(await r.json());
  }, []);
  useEffect(() => { const t = setTimeout(() => loadProducts(q), 250); return () => clearTimeout(t); }, [q, loadProducts]);
  useEffect(() => { fetch("/api/config/supplier").then(async (r) => r.ok && setSuppliers(await r.json())); }, []);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("edit");
    if (!id) return;
    (async () => {
      const r = await fetch(`/api/purchase/${id}`);
      if (!r.ok) return setErr("Could not load that purchase.");
      const pur = await r.json();
      setEditId(id);
      setSupplierId(pur.supplierId);
      setDiscount(Number(pur.discount) || 0);
      setAdditionalExpense(Number(pur.additionalExpense) || 0);
      setNote(pur.note ?? "");
      setPayments([{ method: "CASH", amount: Number(pur.paidTotal) || 0 }]);
      setLines(pur.items.map((i: {
        variantId: string; quantity: number; unitCost: string;
        variant: { sku: string; color?: { name: string } | null; size?: { name: string } | null; product: { name: string; type: string } };
        serialUnits: { serialNo: string }[];
      }) => ({
        variantId: i.variantId,
        label: `${i.variant.product.name} — ${[i.variant.color?.name, i.variant.size?.name].filter(Boolean).join(" ") || i.variant.sku}`,
        type: i.variant.product.type as Product["type"],
        quantity: i.quantity, unitCost: Number(i.unitCost),
        serials: i.serialUnits.map((u) => u.serialNo),
      })));
    })();
  }, []);

  const supplier = suppliers.find((s) => s.id === supplierId);
  const subTotal = useMemo(() => lines.reduce((s, l) => s + l.quantity * l.unitCost, 0), [lines]);
  const totalQty = useMemo(() => lines.reduce((s, l) => s + l.quantity, 0), [lines]);
  const grandTotal = Math.max(subTotal - discount + additionalExpense, 0);
  const paidTotal = payments.reduce((s, p) => s + Number(p.amount || 0), 0);

  const addProduct = (p: Product, v: Variant) => {
    if (lines.some((l) => l.variantId === v.id)) return;
    setLines((ls) => [...ls, {
      variantId: v.id,
      label: `${p.name} — ${[v.color?.name, v.size?.name].filter(Boolean).join(" ") || v.sku}`,
      type: p.type, quantity: p.type === "SERIALIZED" ? 0 : 1, unitCost: Number(v.costPrice), serials: [],
    }]);
    setQ("");
  };

  const addSerial = (idx: number, raw: string) => {
    const nos = raw.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
    if (!nos.length) return;
    setLines((ls) => ls.map((l, j) => {
      if (j !== idx) return l;
      const serials = [...new Set([...l.serials, ...nos])];
      return { ...l, serials, quantity: serials.length };
    }));
    setSerialInput("");
  };

  const submit = async () => {
    setErr(""); setBusy(true);
    try {
      const items = lines.filter((l) => l.quantity > 0).map((l) => ({
        variantId: l.variantId, quantity: l.quantity, unitCost: l.unitCost,
        serials: l.type === "SERIALIZED" ? l.serials : undefined,
      }));
      const res = await fetch(editId ? `/api/purchase/${editId}` : "/api/purchase", {
        method: editId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplierId, items, payments: payments.filter((p) => p.amount > 0), discount, additionalExpense, note }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setDone({ purchaseNo: d.purchaseNo, grandTotal: d.grandTotal, dueTotal: d.dueTotal });
      setLines([]); setDiscount(0); setAdditionalExpense(0); setNote("");
      setPayments([{ method: "CASH", amount: 0 }]); setSupplierId(""); setEditId("");
    } catch (e) { setErr(e instanceof Error ? e.message : "Purchase failed."); }
    finally { setBusy(false); }
  };

  const valid = supplierId && lines.length > 0 && lines.every((l) => l.quantity > 0 && (l.type !== "SERIALIZED" || l.serials.length === l.quantity));

  if (done) {
    return (
      <div className="mx-auto max-w-md">
        <div className="card p-8 text-center">
          <CheckCircle2 size={44} className="mx-auto text-teal" />
          <h2 className="mt-3 text-lg font-bold">Purchase recorded</h2>
          <div className="mt-1 font-mono text-sm text-muted">{done.purchaseNo}</div>
          <div className="mt-4 text-3xl font-bold">{taka(done.grandTotal)}</div>
          {Number(done.dueTotal) > 0 && <div className="mt-2 inline-block rounded-md bg-ambersoft px-3 py-1 text-sm font-semibold text-amber">Supplier due: {taka(done.dueTotal)}</div>}
          <div className="mt-6 flex justify-center gap-3">
            <a href="/purchase/history" className="btn btn-ghost">View history</a>
            <button className="btn btn-primary" onClick={() => setDone(null)}>New purchase</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <PurchaseTabs />
      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div>
          <div className="card p-4">
            <h2 className="text-[15px] font-bold">{editId ? "Purchase Edit" : "Purchase"}</h2>
            <div className="relative mt-3">
              <Search size={16} className="absolute left-3 top-2.5 text-muted" />
              <input className="input pl-9" placeholder="Scan/Type Product ID or Name" value={q} onChange={(e) => setQ(e.target.value)} />
              {q && (
                <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-line bg-card shadow-lg">
                  {products.flatMap((p) => p.variants.map((v) => (
                    <button key={v.id} onClick={() => addProduct(p, v)}
                      className="flex w-full items-center justify-between border-b border-line px-3 py-2 text-left text-[13px] last:border-0 hover:bg-paper">
                      <span>{p.type === "SERIALIZED" && <ScanBarcode size={12} className="mr-1 inline text-tealdark" />}{p.name} <span className="text-muted">{[v.color?.name, v.size?.name].filter(Boolean).join(" ") || v.sku}</span></span>
                      <span className="flex items-center gap-2 text-muted"><b>{taka(v.costPrice)}</b><Plus size={13} /></span>
                    </button>
                  )))}
                  {products.length === 0 && <div className="px-3 py-4 text-center text-[12px] text-muted">No products found.</div>}
                </div>
              )}
            </div>
          </div>

          {lines.length > 0 && (
            <div className="card mt-3 overflow-x-auto">
              <table className="w-full min-w-[560px]">
                <thead><tr><th className="th">SL.</th><th className="th">Product Name</th><th className="th text-center">QTY</th><th className="th text-right">Unit Cost</th><th className="th text-right">SubTotal</th><th className="th" /></tr></thead>
                <tbody>
                  {lines.map((l, idx) => (
                    <tr key={l.variantId}>
                      <td className="td">{idx + 1}</td>
                      <td className="td">
                        <div className="font-semibold">{l.label}</div>
                        {l.type === "SERIALIZED" && (
                          <button className="mt-1 inline-flex items-center gap-1 rounded-md bg-tealsoft px-2 py-1 text-[11px] font-bold text-tealdark" onClick={() => { setSerialFor(idx); setSerialInput(""); }}>
                            <ScanBarcode size={12} /> Serial No. ({l.serials.length})
                          </button>
                        )}
                      </td>
                      <td className="td text-center">
                        <input type="number" min={0} disabled={l.type === "SERIALIZED"} className="input w-16 text-center"
                          value={l.quantity} onChange={(e) => setLines((ls) => ls.map((x, j) => j === idx ? { ...x, quantity: Math.max(0, Number(e.target.value)) } : x))} />
                      </td>
                      <td className="td text-right">
                        <input type="number" className="input w-24 text-right" value={l.unitCost}
                          onChange={(e) => setLines((ls) => ls.map((x, j) => j === idx ? { ...x, unitCost: Number(e.target.value) || 0 } : x))} />
                      </td>
                      <td className="td text-right font-semibold">{taka(l.quantity * l.unitCost)}</td>
                      <td className="td text-right"><button className="rounded-md bg-red-100 p-2 text-red-700 hover:bg-red-200" onClick={() => setLines((ls) => ls.filter((_, j) => j !== idx))}><Trash2 size={14} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="card h-fit p-4 lg:sticky lg:top-[72px]">
          <h2 className="text-[15px] font-bold">{editId ? "Purchase Summary Edit" : "Purchase Summary"}
            {editId && <span className="ml-2 rounded bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-700">EDITING</span>}</h2>

          <label className="mt-3 block text-[12px] font-semibold text-muted">Supplier Name *
            <select className="input mt-1" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">Select Supplier</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label className="mt-2 block text-[12px] font-semibold text-muted">Phone Number
            <input className="input mt-1 bg-paper" readOnly value={supplier?.phone ?? ""} placeholder="—" />
          </label>
          <label className="mt-2 block text-[12px] font-semibold text-muted">Address
            <input className="input mt-1 bg-paper" readOnly value={supplier?.address ?? ""} placeholder="—" />
          </label>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="block text-[12px] font-semibold text-muted">Total Qty<input className="input mt-1 bg-paper" readOnly value={totalQty} /></label>
            <label className="block text-[12px] font-semibold text-muted">Amount<input className="input mt-1 bg-paper" readOnly value={taka(subTotal)} /></label>
          </div>
          <label className="mt-2 block text-[12px] font-semibold text-muted">Additional Expense
            <input type="number" min={0} className="input mt-1" value={additionalExpense || ""} placeholder="0" onChange={(e) => setAdditionalExpense(Number(e.target.value) || 0)} />
          </label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="block text-[12px] font-semibold text-muted">Total Discount<input type="number" min={0} className="input mt-1" value={discount || ""} placeholder="0" onChange={(e) => setDiscount(Number(e.target.value) || 0)} /></label>
            <label className="block text-[12px] font-semibold text-muted">Total Payable<input className="input mt-1 bg-paper" readOnly value={taka(grandTotal)} /></label>
          </div>

          <div className="mt-3 space-y-2">
            {payments.map((p, i) => (
              <div key={i} className="grid grid-cols-2 gap-2">
                <select className="input" value={p.method} onChange={(e) => setPayments((ps) => ps.map((x, j) => j === i ? { ...x, method: e.target.value } : x))}>
                  {METHODS.map((m) => <option key={m} value={m}>{m.replace("_", " ")}</option>)}
                </select>
                <div className="flex gap-1">
                  <input type="number" min={0} className="input" placeholder="Paid Amount" value={p.amount || ""} onChange={(e) => setPayments((ps) => ps.map((x, j) => j === i ? { ...x, amount: Number(e.target.value) } : x))} />
                  {payments.length > 1 && <button className="text-muted hover:text-red" onClick={() => setPayments((ps) => ps.filter((_, j) => j !== i))}><X size={15} /></button>}
                </div>
              </div>
            ))}
            <button className="text-[12px] font-semibold" style={{ color: "var(--amber)" }} onClick={() => setPayments((ps) => [...ps, { method: "BKASH", amount: 0 }])}>Add Multiple Payment Method</button>
          </div>

          {grandTotal - paidTotal > 0 && (
            <div className="mt-2 rounded-md bg-ambersoft px-3 py-2 text-[12px] font-semibold text-amber">{taka(grandTotal - paidTotal)} will be supplier due.</div>
          )}
          <textarea className="input mt-3 min-h-16" placeholder="Add remarks here…" value={note} onChange={(e) => setNote(e.target.value)} />
          {err && <div className="mt-2 rounded-md bg-redsoft px-3 py-2 text-[12px] font-semibold text-red">{err}</div>}
          <button className={`btn mt-3 w-full py-3 ${editId ? "text-white" : "btn-primary"}`} style={editId ? { background: "#2563eb" } : undefined} disabled={!valid || busy} onClick={submit}>
            {busy ? "Saving…" : editId ? "Update Now" : "Purchase Now"}
          </button>
        </div>
      </div>

      {/* Serial entry modal */}
      {serialFor !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSerialFor(null)}>
          <div className="card w-full max-w-lg space-y-3 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><div><h3 className="text-lg font-bold">Add Serial Number</h3><p className="text-[12px] text-muted">Scan or type one IMEI per line for this product</p></div><button onClick={() => setSerialFor(null)}><X size={17} /></button></div>
            <label className="block text-[12px] font-semibold text-muted">Product Name<input className="input mt-1 bg-paper" readOnly value={lines[serialFor]?.label ?? ""} /></label>
            <label className="block text-[12px] font-semibold text-muted">Add Serial Number
              <input className="input mt-1" placeholder="Enter Serial Number, then Enter" value={serialInput}
                onChange={(e) => setSerialInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSerial(serialFor, serialInput); } }} />
            </label>
            <div className="text-[12px] font-semibold text-muted">Serial Number List <span className="rounded-full bg-paper px-2 text-[11px]">{lines[serialFor]?.serials.length ?? 0}</span></div>
            <div className="flex min-h-24 flex-wrap gap-1.5 rounded-lg border border-dashed border-line p-3">
              {lines[serialFor]?.serials.map((s) => (
                <span key={s} className="serial-chip">{s}
                  <button className="text-red" onClick={() => setLines((ls) => ls.map((l, j) => j === serialFor ? { ...l, serials: l.serials.filter((x) => x !== s), quantity: l.serials.length - 1 } : l))}><X size={11} /></button>
                </span>
              ))}
              {(lines[serialFor]?.serials.length ?? 0) === 0 && <span className="text-[12px] text-muted">No serials yet.</span>}
            </div>
            <button className="btn btn-primary w-full" onClick={() => setSerialFor(null)}>Save Serial Numbers</button>
          </div>
        </div>
      )}
    </div>
  );
}
