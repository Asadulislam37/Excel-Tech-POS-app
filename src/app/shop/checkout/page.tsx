"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { taka } from "@/lib/format";
import { getCart, setCart, CartItem } from "@/lib/cart";
import { Trash2, CheckCircle2 } from "lucide-react";

const DELIVERY = { INSIDE_DHAKA: 70, OUTSIDE_DHAKA: 130 };

export default function CheckoutPage() {
  const [cart, setCartState] = useState<CartItem[]>([]);
  const [form, setForm] = useState({ customerName: "", phone: "", address: "", area: "INSIDE_DHAKA", note: "", payMethod: "COD", payReference: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<{ orderNo: string; grandTotal: string } | null>(null);

  useEffect(() => { setCartState(getCart()); }, []);

  const update = (items: CartItem[]) => { setCart(items); setCartState(items); };
  const subTotal = cart.reduce((s, c) => s + c.unitPrice * c.quantity, 0);
  const delivery = DELIVERY[form.area as keyof typeof DELIVERY];
  const grand = subTotal + delivery;

  const submit = async () => {
    setErr(""); setBusy(true);
    try {
      const res = await fetch("/api/shop/orders", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, items: cart.map((c) => ({ variantId: c.variantId, quantity: c.quantity })) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      update([]);
      setDone({ orderNo: data.orderNo, grandTotal: data.grandTotal });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Order failed. Try again.");
    } finally { setBusy(false); }
  };

  if (done) {
    return (
      <div className="mx-auto max-w-md">
        <div className="card p-8 text-center">
          <CheckCircle2 size={44} className="mx-auto text-teal" />
          <h1 className="mt-3 text-lg font-bold">Order placed!</h1>
          <div className="mt-1 font-mono text-sm text-muted">{done.orderNo}</div>
          <div className="mt-3 text-2xl font-bold">{taka(done.grandTotal)}</div>
          <p className="mt-3 text-[13px] text-muted">We&apos;ll call you shortly to confirm your order. Keep your phone nearby.</p>
          <Link href="/shop" className="btn btn-primary mt-5 inline-flex">Continue shopping</Link>
        </div>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="py-20 text-center">
        <div className="text-sm text-muted">Your cart is empty.</div>
        <Link href="/shop" className="btn btn-primary mt-4 inline-flex">Browse products</Link>
      </div>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
      <div className="card p-5">
        <h1 className="text-lg font-bold">Delivery details</h1>
        <div className="mt-4 space-y-3">
          <input className="input" placeholder="Full name" value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} />
          <input className="input" placeholder="Phone (01XXXXXXXXX)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <textarea className="input min-h-20" placeholder="Full delivery address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            {(["INSIDE_DHAKA", "OUTSIDE_DHAKA"] as const).map((a) => (
              <button key={a} onClick={() => setForm({ ...form, area: a })}
                className={`rounded-lg border px-3 py-2.5 text-[13px] font-semibold ${form.area === a ? "border-teal bg-tealsoft text-tealdark" : "border-line"}`}>
                {a === "INSIDE_DHAKA" ? `Inside Dhaka · ${taka(DELIVERY.INSIDE_DHAKA)}` : `Outside Dhaka · ${taka(DELIVERY.OUTSIDE_DHAKA)}`}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(["COD", "BKASH", "NAGAD"] as const).map((m) => (
              <button key={m} onClick={() => setForm({ ...form, payMethod: m })}
                className={`rounded-lg border px-3 py-2.5 text-[13px] font-semibold ${form.payMethod === m ? "border-teal bg-tealsoft text-tealdark" : "border-line"}`}>
                {m === "COD" ? "Cash on delivery" : m === "BKASH" ? "bKash" : "Nagad"}
              </button>
            ))}
          </div>
          {form.payMethod !== "COD" && (
            <div className="rounded-lg bg-ambersoft p-3 text-[13px]">
              <div className="font-semibold text-amber">Send {taka(grand)} to 01XXXXXXXXX (personal), then enter the transaction ID:</div>
              <input className="input mt-2 font-mono" placeholder="Transaction ID" value={form.payReference} onChange={(e) => setForm({ ...form, payReference: e.target.value })} />
            </div>
          )}
          <textarea className="input" placeholder="Order note (optional)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        </div>
      </div>

      <div className="card h-fit p-5">
        <h2 className="font-bold">Your order</h2>
        <div className="mt-3 space-y-2">
          {cart.map((c) => (
            <div key={c.variantId} className="flex items-center gap-2 text-[13px]">
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{c.name}</div>
                <div className="text-[12px] text-muted">{c.variant}</div>
              </div>
              <input type="number" min={1} max={5} className="input w-16 text-center" value={c.quantity}
                onChange={(e) => update(cart.map((x) => x.variantId === c.variantId ? { ...x, quantity: Math.max(1, Math.min(5, Number(e.target.value) || 1)) } : x))} />
              <div className="w-20 text-right font-semibold">{taka(c.unitPrice * c.quantity)}</div>
              <button className="text-muted hover:text-red" onClick={() => update(cart.filter((x) => x.variantId !== c.variantId))}><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
        <div className="mt-4 space-y-1.5 border-t border-line pt-3 text-[13px]">
          <div className="flex justify-between"><span className="text-muted">Subtotal</span><span>{taka(subTotal)}</span></div>
          <div className="flex justify-between"><span className="text-muted">Delivery</span><span>{taka(delivery)}</span></div>
          <div className="flex justify-between text-[15px] font-bold"><span>Total</span><span>{taka(grand)}</span></div>
        </div>
        {err && <div className="mt-3 rounded-md bg-redsoft px-3 py-2 text-[12px] font-semibold text-red">{err}</div>}
        <button className="btn btn-primary mt-4 w-full py-3" disabled={busy} onClick={submit}>
          {busy ? "Placing order…" : `Place order · ${taka(grand)}`}
        </button>
      </div>
    </div>
  );
}
