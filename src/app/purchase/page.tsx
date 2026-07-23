"use client";

import { useEffect, useState } from "react";
import { taka } from "@/lib/format";
import { Trash2 } from "lucide-react";

type Config = { suppliers: { id: string; name: string }[] };
type Product = { id: string; name: string; type: string; variants: { id: string; sku: string; costPrice: string; color?: { name: string } | null; size?: { name: string } | null }[] };
type Line = { variantId: string; label: string; type: string; quantity: number; unitCost: number; serials: string };

export default function PurchasePage() {
  const [cfg, setCfg] = useState<Config | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [paidTotal, setPaidTotal] = useState(0);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/config").then(async (r) => r.ok && setCfg(await r.json()));
    fetch("/api/products").then(async (r) => r.ok && setProducts(await r.json()));
  }, []);

  const addLine = (variantId: string) => {
    if (!variantId) return;
    for (const p of products) {
      const v = p.variants.find((x) => x.id === variantId);
      if (v) {
        setLines((ls) => [...ls, {
          variantId, type: p.type,
          label: `${p.name} — ${[v.color?.name, v.size?.name].filter(Boolean).join(" ") || v.sku}`,
          quantity: 1, unitCost: Number(v.costPrice), serials: "",
        }]);
        return;
      }
    }
  };

  const grandTotal = lines.reduce((s, l) => s + l.quantity * l.unitCost, 0);

  const submit = async () => {
    setMsg(null);
    const res = await fetch("/api/purchase", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supplierId, paidTotal,
        items: lines.map((l) => ({
          variantId: l.variantId, quantity: l.quantity, unitCost: l.unitCost,
          serials: l.type === "SERIALIZED" ? l.serials.split(/\r?\n|,/).map((s) => s.trim()).filter(Boolean) : undefined,
        })),
      }),
    });
    const data = await res.json();
    if (!res.ok) return setMsg({ ok: false, text: data.error });
    setMsg({ ok: true, text: `Purchase ${data.purchaseNo} recorded — stock updated.` });
    setLines([]); setPaidTotal(0);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-lg font-bold">Purchase</h1>
      <div className="card space-y-3 p-5">
        <div className="grid gap-2 sm:grid-cols-2">
          <select className="input" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">Select supplier…</option>
            {cfg?.suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select className="input" value="" onChange={(e) => addLine(e.target.value)}>
            <option value="">+ Add product to purchase…</option>
            {products.flatMap((p) => p.variants.map((v) => (
              <option key={v.id} value={v.id}>{p.name} — {[v.color?.name, v.size?.name].filter(Boolean).join(" ") || v.sku}</option>
            )))}
          </select>
        </div>

        {lines.map((l, i) => (
          <div key={i} className="rounded-lg border border-line p-3">
            <div className="flex items-center justify-between">
              <div className="text-[13px] font-semibold">{l.label}</div>
              <button className="text-muted hover:text-red" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}><Trash2 size={15} /></button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input type="number" min={1} className="input w-24" value={l.quantity} onChange={(e) => setLines((ls) => ls.map((x, j) => j === i ? { ...x, quantity: Number(e.target.value) || 1 } : x))} />
              <span className="text-[12px] text-muted">qty ×</span>
              <input type="number" className="input w-32" value={l.unitCost || ""} placeholder="Unit cost" onChange={(e) => setLines((ls) => ls.map((x, j) => j === i ? { ...x, unitCost: Number(e.target.value) } : x))} />
              <span className="ml-auto text-[13px] font-bold">{taka(l.quantity * l.unitCost)}</span>
            </div>
            {l.type === "SERIALIZED" && (
              <textarea className="input mt-2 min-h-20 font-mono" placeholder={`Enter ${l.quantity} IMEI/serial number(s), one per line`} value={l.serials} onChange={(e) => setLines((ls) => ls.map((x, j) => j === i ? { ...x, serials: e.target.value } : x))} />
            )}
          </div>
        ))}

        <div className="flex items-center justify-between border-t border-line pt-3">
          <div className="text-[13px]"><span className="text-muted">Paid now:</span>{" "}
            <input type="number" min={0} className="input inline-block w-32" value={paidTotal || ""} onChange={(e) => setPaidTotal(Number(e.target.value) || 0)} />
          </div>
          <div className="text-right">
            <div className="text-[12px] text-muted">Total</div>
            <div className="text-xl font-bold">{taka(grandTotal)}</div>
            {grandTotal - paidTotal > 0 && <div className="text-[12px] font-semibold text-amber">Supplier due: {taka(grandTotal - paidTotal)}</div>}
          </div>
        </div>
        {msg && <div className={`rounded-md px-3 py-2 text-[12px] font-semibold ${msg.ok ? "bg-tealsoft text-tealdark" : "bg-redsoft text-red"}`}>{msg.text}</div>}
        <button className="btn btn-primary w-full" disabled={!supplierId || lines.length === 0} onClick={submit}>Record purchase</button>
      </div>
    </div>
  );
}
