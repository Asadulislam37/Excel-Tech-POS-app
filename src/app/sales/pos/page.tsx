"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { taka } from "@/lib/format";
import { Search, Plus, Trash2, ScanBarcode, X, Printer, CheckCircle2, UserPlus, PauseCircle } from "lucide-react";
import SalesTabs from "@/components/SalesTabs";

type Variant = {
  id: string; sku: string; salePrice: string; costPrice: string;
  color?: { name: string } | null; size?: { name: string } | null;
  stockLevels: { quantity: number }[];
  _count: { serialUnits: number };
};
type Product = {
  id: string; name: string; type: "SERIALIZED" | "STANDARD";
  brand?: { name: string } | null;
  variants: Variant[];
};
type CartLine = {
  variantId: string; productName: string; variantLabel: string; type: Product["type"];
  quantity: number; unitPrice: number; serialUnits: { id: string; serialNo: string }[];
  maxStock: number;
};
type Customer = { id: string; name: string; phone: string };
type SerialUnit = { id: string; serialNo: string };

const METHODS = ["CASH", "BKASH", "NAGAD", "ROCKET", "CARD", "BANK_TRANSFER"] as const;

export default function PosPage() {
  const [q, setQ] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [saleType, setSaleType] = useState<"CUSTOMER" | "RETAIL" | "WHOLESALE">("CUSTOMER");
  const [discount, setDiscount] = useState(0);
  const [discountPct, setDiscountPct] = useState("");
  const [additionalExpense, setAdditionalExpense] = useState(0);
  const [vat, setVat] = useState(0);
  const [workOrder, setWorkOrder] = useState("");
  const [remarks, setRemarks] = useState("");
  const [held, setHeld] = useState<{ id: string; cart: CartLine[]; label: string }[]>([]);
  const [showHold, setShowHold] = useState(false);
  const [payments, setPayments] = useState([{ method: "CASH", amount: 0, reference: "" }]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [custQ, setCustQ] = useState("");
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCust, setNewCust] = useState({ name: "", phone: "", address: "" });
  const [serialPicker, setSerialPicker] = useState<{ line: CartLine; units: SerialUnit[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ invoiceNo: string; grandTotal: string; dueTotal: string } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const loadProducts = useCallback(async (query: string) => {
    const res = await fetch(`/api/products?q=${encodeURIComponent(query)}`);
    if (res.ok) setProducts(await res.json());
  }, []);

  useEffect(() => {
    const t = setTimeout(() => loadProducts(q), 250);
    return () => clearTimeout(t);
  }, [q, loadProducts]);

  useEffect(() => {
    const t = setTimeout(async () => {
      const res = await fetch(`/api/customers?q=${encodeURIComponent(custQ)}`);
      if (res.ok) setCustomers(await res.json());
    }, 250);
    return () => clearTimeout(t);
  }, [custQ]);

  const subTotal = useMemo(() => cart.reduce((s, l) => s + l.quantity * l.unitPrice, 0), [cart]);
  const totalQty = useMemo(() => cart.reduce((s, l) => s + l.quantity, 0), [cart]);
  const grandTotal = Math.max(subTotal - discount + additionalExpense + vat, 0);
  const paidTotal = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const dueTotal = Math.max(grandTotal - paidTotal, 0);
  const changeAmount = Math.max(paidTotal - grandTotal, 0);

  // Typing a discount % keeps the taka amount in sync with the running sub-total.
  const applyDiscountPct = (pct: string) => {
    setDiscountPct(pct);
    const n = Number(pct);
    if (Number.isFinite(n) && n > 0) setDiscount(Math.round(subTotal * (n / 100)));
    else if (pct === "") setDiscount(0);
  };

  const addToCart = (p: Product, v: Variant) => {
    setCart((c) => {
      const existing = c.find((l) => l.variantId === v.id);
      const stock = p.type === "SERIALIZED" ? v._count.serialUnits : (v.stockLevels[0]?.quantity ?? 0);
      if (existing) {
        if (p.type === "SERIALIZED") return c; // qty follows picked serials
        if (existing.quantity >= stock) return c;
        return c.map((l) => (l.variantId === v.id ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [
        ...c,
        {
          variantId: v.id,
          productName: p.name,
          variantLabel: [v.color?.name, v.size?.name].filter(Boolean).join(" · ") || v.sku,
          type: p.type,
          quantity: p.type === "SERIALIZED" ? 0 : 1,
          unitPrice: Number(v.salePrice),
          serialUnits: [],
          maxStock: stock,
        },
      ];
    });
    if (p.type === "SERIALIZED") openSerialPicker(v.id);
  };

  const openSerialPicker = async (variantId: string) => {
    const res = await fetch(`/api/serials?variantId=${variantId}&status=IN_STOCK`);
    const units = res.ok ? await res.json() : [];
    setCart((c) => {
      const line = c.find((l) => l.variantId === variantId);
      if (line) setSerialPicker({ line, units });
      return c;
    });
  };

  const toggleSerial = (unit: SerialUnit) => {
    if (!serialPicker) return;
    setCart((c) =>
      c.map((l) => {
        if (l.variantId !== serialPicker.line.variantId) return l;
        const picked = l.serialUnits.some((s) => s.id === unit.id)
          ? l.serialUnits.filter((s) => s.id !== unit.id)
          : [...l.serialUnits, unit];
        return { ...l, serialUnits: picked, quantity: picked.length };
      })
    );
  };

  const createCustomer = async () => {
    setError("");
    const res = await fetch("/api/customers", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newCust),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    setCustomerId(data.id);
    setCustomers((cs) => [data, ...cs]);
    setShowNewCustomer(false);
    setNewCust({ name: "", phone: "", address: "" });
  };

  const completeSale = async () => {
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customerId || undefined,
          saleType,
          discount,
          additionalExpense,
          vat,
          workOrder: workOrder || undefined,
          note: remarks || undefined,
          items: cart.map((l) => ({
            variantId: l.variantId,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            serialUnitIds: l.type === "SERIALIZED" ? l.serialUnits.map((s) => s.id) : undefined,
          })),
          payments: payments.filter((p) => Number(p.amount) > 0),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDone({ invoiceNo: data.invoiceNo, grandTotal: data.grandTotal, dueTotal: data.dueTotal });
      setCart([]); setDiscount(0); setDiscountPct(""); setAdditionalExpense(0); setVat(0);
      setWorkOrder(""); setRemarks("");
      setPayments([{ method: "CASH", amount: 0, reference: "" }]);
      setCustomerId(""); loadProducts(q);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sale failed.");
    } finally {
      setBusy(false);
    }
  };

  const cartValid =
    cart.length > 0 &&
    cart.every((l) => l.quantity > 0 && (l.type !== "SERIALIZED" || l.serialUnits.length === l.quantity));

  if (done) {
    return (
      <div className="mx-auto max-w-md">
        <div className="card p-8 text-center">
          <CheckCircle2 size={44} className="mx-auto text-teal" />
          <h2 className="mt-3 text-lg font-bold">Invoice created</h2>
          <div className="mt-1 font-mono text-sm text-muted">{done.invoiceNo}</div>
          <div className="mt-4 text-3xl font-bold">{taka(done.grandTotal)}</div>
          {Number(done.dueTotal) > 0 && (
            <div className="mt-2 inline-block rounded-md bg-ambersoft px-3 py-1 text-sm font-semibold text-amber">
              Due: {taka(done.dueTotal)}
            </div>
          )}
          <div className="mt-6 flex justify-center gap-3">
            <button className="btn btn-ghost" onClick={() => window.print()}>
              <Printer size={15} /> Print receipt
            </button>
            <button className="btn btn-primary" onClick={() => { setDone(null); searchRef.current?.focus(); }}>
              New sale
            </button>
          </div>
        </div>
      </div>
    );
  }

  const holdCurrent = () => {
    if (!cart.length) return;
    setHeld((h) => [...h, { id: crypto.randomUUID(), cart, label: `${cart.length} item(s) · ${taka(subTotal)}` }]);
    setCart([]); setDiscount(0); setDiscountPct("");
  };
  const resumeHeld = (id: string) => {
    const entry = held.find((h) => h.id === id);
    if (!entry) return;
    setCart(entry.cart);
    setHeld((h) => h.filter((x) => x.id !== id));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SalesTabs />
        <div className="flex items-center gap-2">
          <button className="btn btn-ghost" onClick={holdCurrent} disabled={!cart.length}>
            <PauseCircle size={15} /> Hold
          </button>
          <div className="relative">
            <button className="btn btn-ghost" onClick={() => setShowHold((s) => !s)}>
              Hold List <span className="rounded-full bg-amber px-1.5 text-[11px] font-bold text-white">{held.length}</span>
            </button>
            {showHold && (
              <div className="card absolute right-0 top-11 z-40 w-64 p-1 shadow-lg">
                {held.map((h) => (
                  <button key={h.id} className="block w-full rounded-md px-3 py-2 text-left text-[13px] hover:bg-paper"
                    onClick={() => { resumeHeld(h.id); setShowHold(false); }}>
                    Resume — {h.label}
                  </button>
                ))}
                {held.length === 0 && <div className="px-3 py-4 text-center text-[12px] text-muted">Nothing on hold.</div>}
              </div>
            )}
          </div>
        </div>
      </div>

    <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
      {/* Product side */}
      <div>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-2.5 text-muted" />
          <input
            ref={searchRef}
            className="input pl-9"
            placeholder="Scan/Type Product ID or Name…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
          />
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {products.flatMap((p) =>
            p.variants.map((v) => {
              const stock = p.type === "SERIALIZED" ? v._count.serialUnits : (v.stockLevels[0]?.quantity ?? 0);
              return (
                <button
                  key={v.id}
                  disabled={stock === 0}
                  onClick={() => addToCart(p, v)}
                  className="card p-3 text-left transition-shadow hover:shadow-md disabled:opacity-45"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-[13px] font-semibold leading-snug">{p.name}</div>
                    {p.type === "SERIALIZED" && <ScanBarcode size={14} className="shrink-0 text-tealdark" />}
                  </div>
                  <div className="mt-0.5 text-[12px] text-muted">
                    {[v.color?.name, v.size?.name].filter(Boolean).join(" · ") || v.sku}
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="font-bold">{taka(v.salePrice)}</div>
                    <div className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${stock === 0 ? "bg-redsoft text-red" : stock <= 2 ? "bg-ambersoft text-amber" : "bg-tealsoft text-tealdark"}`}>
                      {stock} in stock
                    </div>
                  </div>
                </button>
              );
            })
          )}
          {products.length === 0 && (
            <div className="col-span-full py-12 text-center text-sm text-muted">
              No products found. Add products from Inventory → Product List, then stock in from Purchase.
            </div>
          )}
        </div>
      </div>

      {/* Cart side */}
      <div className="card flex h-fit flex-col p-4 lg:sticky lg:top-[72px]">
        <h2 className="text-[15px] font-bold">Invoice Summary</h2>

        {/* Sale type */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          {([["CUSTOMER", "Customer Sale"], ["RETAIL", "Retail Sale"], ["WHOLESALE", "Wholesale"]] as const).map(([v, label]) => (
            <button key={v} onClick={() => setSaleType(v)}
              className={`rounded-lg border px-2 py-2 text-[12px] font-semibold transition-colors ${saleType === v ? "border-teal bg-tealsoft text-tealdark" : "border-line text-muted hover:bg-paper"}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Customer */}
        <div className="mt-3">
          <div className="flex gap-2">
            <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Walk-in customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name} — {c.phone}</option>
              ))}
            </select>
            <button className="btn btn-ghost shrink-0 px-3" title="New customer" onClick={() => setShowNewCustomer(true)}>
              <UserPlus size={15} />
            </button>
          </div>
          <input className="input mt-2" placeholder="Filter customers by name or phone…" value={custQ} onChange={(e) => setCustQ(e.target.value)} />
          <input className="input mt-2" placeholder="Work Order (optional)" value={workOrder} onChange={(e) => setWorkOrder(e.target.value)} />
        </div>

        {/* Lines */}
        <div className="mt-3 space-y-2">
          {cart.map((l) => (
            <div key={l.variantId} className="rounded-lg border border-line p-2.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[13px] font-semibold">{l.productName}</div>
                  <div className="text-[12px] text-muted">{l.variantLabel}</div>
                </div>
                <button className="text-muted hover:text-red" onClick={() => setCart((c) => c.filter((x) => x.variantId !== l.variantId))}>
                  <Trash2 size={15} />
                </button>
              </div>
              {l.type === "SERIALIZED" ? (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {l.serialUnits.map((s) => (
                    <span key={s.id} className="serial-chip">{s.serialNo}</span>
                  ))}
                  <button className="serial-chip !bg-white hover:!bg-tealsoft" onClick={() => openSerialPicker(l.variantId)}>
                    <Plus size={11} /> IMEI
                  </button>
                </div>
              ) : (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="number" min={1} max={l.maxStock}
                    className="input w-20 text-center"
                    value={l.quantity}
                    onChange={(e) =>
                      setCart((c) => c.map((x) => x.variantId === l.variantId
                        ? { ...x, quantity: Math.min(Math.max(1, Number(e.target.value)), l.maxStock) } : x))}
                  />
                  <span className="text-[12px] text-muted">× {taka(l.unitPrice)}</span>
                </div>
              )}
              <div className="mt-1.5 text-right text-[13px] font-bold">{taka(l.quantity * l.unitPrice)}</div>
            </div>
          ))}
          {cart.length === 0 && <div className="py-8 text-center text-[13px] text-muted">Tap products to add them here.</div>}
        </div>

        {/* Totals */}
        <div className="mt-3 space-y-2 border-t border-line pt-3 text-[13px]">
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-[11px] font-semibold uppercase text-muted">Total Qty
              <input className="input mt-1 bg-paper" readOnly value={totalQty} />
            </label>
            <label className="block text-[11px] font-semibold uppercase text-muted">Amount
              <input className="input mt-1 bg-paper" readOnly value={taka(subTotal)} />
            </label>
            <label className="block text-[11px] font-semibold uppercase text-muted">Additional Expense
              <input type="number" min={0} className="input mt-1" value={additionalExpense || ""} placeholder="0"
                onChange={(e) => setAdditionalExpense(Number(e.target.value) || 0)} />
            </label>
            <label className="block text-[11px] font-semibold uppercase text-muted">VAT
              <input type="number" min={0} className="input mt-1" value={vat || ""} placeholder="0"
                onChange={(e) => setVat(Number(e.target.value) || 0)} />
            </label>
            <label className="block text-[11px] font-semibold uppercase text-muted">Total Discount
              <input type="number" min={0} className="input mt-1" value={discount || ""} placeholder="0"
                onChange={(e) => { setDiscount(Number(e.target.value) || 0); setDiscountPct(""); }} />
            </label>
            <label className="block text-[11px] font-semibold uppercase text-muted">Discount %
              <input type="number" min={0} max={100} className="input mt-1" value={discountPct} placeholder="0"
                onChange={(e) => applyDiscountPct(e.target.value)} />
            </label>
          </div>
          <div className="flex justify-between rounded-lg bg-tealsoft px-3 py-2 text-[15px] font-bold text-tealdark">
            <span>Total Payable</span><span>{taka(grandTotal)}</span>
          </div>
        </div>

        {/* Payments */}
        <div className="mt-3 space-y-2">
          {payments.map((p, i) => (
            <div key={i} className="flex gap-2">
              <select className="input w-32" value={p.method} onChange={(e) => setPayments((ps) => ps.map((x, j) => (j === i ? { ...x, method: e.target.value } : x)))}>
                {METHODS.map((m) => <option key={m} value={m}>{m.replace("_", " ")}</option>)}
              </select>
              <input type="number" min={0} className="input" placeholder="Amount" value={p.amount || ""} onChange={(e) => setPayments((ps) => ps.map((x, j) => (j === i ? { ...x, amount: Number(e.target.value) } : x)))} />
              {payments.length > 1 && (
                <button className="text-muted hover:text-red" onClick={() => setPayments((ps) => ps.filter((_, j) => j !== i))}><X size={15} /></button>
              )}
            </div>
          ))}
          <div className="flex items-center justify-between">
            <button className="text-[12px] font-semibold text-tealdark" onClick={() => setPayments((ps) => [...ps, { method: "BKASH", amount: 0, reference: "" }])}>
              + Split payment
            </button>
            <button className="text-[12px] font-semibold text-tealdark" onClick={() => setPayments([{ method: "CASH", amount: grandTotal, reference: "" }])}>
              Exact cash
            </button>
          </div>
          {changeAmount > 0 && (
            <div className="flex justify-between rounded-md bg-tealsoft px-3 py-2 text-[12px] font-semibold text-tealdark">
              <span>Change Amount</span><span>{taka(changeAmount)}</span>
            </div>
          )}
          {dueTotal > 0 && cart.length > 0 && (
            <div className="rounded-md bg-ambersoft px-3 py-2 text-[12px] font-semibold text-amber">
              {taka(dueTotal)} will be recorded as due{!customerId && " — select a customer for due sales"}
            </div>
          )}
        </div>

        <textarea className="input mt-3 min-h-16" placeholder="Add remarks here…" value={remarks} onChange={(e) => setRemarks(e.target.value)} />

        {error && <div className="mt-3 rounded-md bg-redsoft px-3 py-2 text-[12px] font-semibold text-red">{error}</div>}

        <button className="btn btn-primary mt-4 w-full py-3 text-[14px]" disabled={!cartValid || busy || (dueTotal > 0 && !customerId)} onClick={completeSale}>
          {busy ? "Saving…" : `Place Order · ${taka(grandTotal)}`}
        </button>
      </div>
    </div>

      {/* Serial picker modal */}
      {serialPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSerialPicker(null)}>
          <div className="card w-full max-w-md p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold">Select IMEI / serial</h3>
              <button onClick={() => setSerialPicker(null)}><X size={17} /></button>
            </div>
            <div className="mt-1 text-[12px] text-muted">{serialPicker.line.productName} — {serialPicker.line.variantLabel}</div>
            <div className="mt-3 max-h-72 space-y-1.5 overflow-y-auto">
              {serialPicker.units.map((u) => {
                const line = cart.find((l) => l.variantId === serialPicker.line.variantId);
                const picked = line?.serialUnits.some((s) => s.id === u.id);
                return (
                  <button key={u.id} onClick={() => toggleSerial(u)}
                    className={`flex w-full items-center justify-between rounded-md border px-3 py-2 font-mono text-[13px] ${picked ? "border-teal bg-tealsoft text-tealdark" : "border-line hover:bg-paper"}`}>
                    {u.serialNo}
                    {picked && <CheckCircle2 size={15} />}
                  </button>
                );
              })}
              {serialPicker.units.length === 0 && (
                <div className="py-6 text-center text-[13px] text-muted">No units in stock. Add serials via Purchase or Serial Number Manage.</div>
              )}
            </div>
            <button className="btn btn-primary mt-3 w-full" onClick={() => setSerialPicker(null)}>Done</button>
          </div>
        </div>
      )}

      {/* New customer modal */}
      {showNewCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowNewCustomer(false)}>
          <div className="card w-full max-w-sm space-y-3 p-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold">New customer</h3>
            <input className="input" placeholder="Name" value={newCust.name} onChange={(e) => setNewCust({ ...newCust, name: e.target.value })} />
            <input className="input" placeholder="Phone (01…)" value={newCust.phone} onChange={(e) => setNewCust({ ...newCust, phone: e.target.value })} />
            <input className="input" placeholder="Address (optional)" value={newCust.address} onChange={(e) => setNewCust({ ...newCust, address: e.target.value })} />
            {error && <div className="text-[12px] font-semibold text-red">{error}</div>}
            <div className="flex gap-2">
              <button className="btn btn-ghost flex-1" onClick={() => setShowNewCustomer(false)}>Cancel</button>
              <button className="btn btn-primary flex-1" onClick={createCustomer}>Save customer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
