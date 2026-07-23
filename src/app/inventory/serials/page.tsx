"use client";

import { useEffect, useState } from "react";
import { ScanBarcode } from "lucide-react";

type Product = { id: string; name: string; type: string; variants: { id: string; sku: string; color?: { name: string } | null; size?: { name: string } | null }[] };

export default function SerialManage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [variantId, setVariantId] = useState("");
  const [serialText, setSerialText] = useState("");
  const [costPrice, setCostPrice] = useState<number | "">("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/products").then(async (r) => {
      if (r.ok) setProducts(((await r.json()) as Product[]).filter((p) => p.type === "SERIALIZED"));
    });
  }, []);

  const submit = async () => {
    setMsg(null);
    const serials = serialText.split(/\r?\n|,/).map((s) => s.trim()).filter(Boolean);
    const res = await fetch("/api/serials", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variantId, serials, costPrice: costPrice || undefined }),
    });
    const data = await res.json();
    if (!res.ok) return setMsg({ ok: false, text: data.error });
    setMsg({ ok: true, text: `${data.added} unit(s) added to stock.` });
    setSerialText("");
  };

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="card p-5">
        <h1 className="flex items-center gap-2 text-lg font-bold"><ScanBarcode size={20} className="text-tealdark" /> Serial number manage</h1>
        <p className="mt-1 text-[13px] text-muted">Stock in IMEI/serial numbers for a phone variant. Scan one per line — each becomes a trackable unit. For full purchases with supplier dues, use the Purchase screen instead.</p>
        <div className="mt-4 space-y-3">
          <select className="input" value={variantId} onChange={(e) => setVariantId(e.target.value)}>
            <option value="">Select product variant…</option>
            {products.flatMap((p) => p.variants.map((v) => (
              <option key={v.id} value={v.id}>{p.name} — {[v.color?.name, v.size?.name].filter(Boolean).join(" ") || v.sku}</option>
            )))}
          </select>
          <textarea className="input min-h-40 font-mono" placeholder={"356938104263201\n356938104263202\n356938104263203"} value={serialText} onChange={(e) => setSerialText(e.target.value)} />
          <input type="number" className="input" placeholder="Unit cost price (optional)" value={costPrice} onChange={(e) => setCostPrice(e.target.value ? Number(e.target.value) : "")} />
          {msg && <div className={`rounded-md px-3 py-2 text-[12px] font-semibold ${msg.ok ? "bg-tealsoft text-tealdark" : "bg-redsoft text-red"}`}>{msg.text}</div>}
          <button className="btn btn-primary w-full" disabled={!variantId || !serialText.trim()} onClick={submit}>Add to stock</button>
        </div>
      </div>
    </div>
  );
}
