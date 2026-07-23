"use client";

import { useCallback, useEffect, useState } from "react";
import { taka } from "@/lib/format";
import { Plus, ScanBarcode, X } from "lucide-react";

type Config = { brands: { id: string; name: string }[]; categories: { id: string; name: string }[];
  colors: { id: string; name: string }[]; sizes: { id: string; name: string }[]; warranties: { id: string; name: string }[] };
type Product = {
  id: string; name: string; type: string;
  brand?: { name: string } | null; category?: { name: string } | null;
  variants: { id: string; sku: string; salePrice: string; costPrice: string;
    color?: { name: string } | null; size?: { name: string } | null;
    stockLevels: { quantity: number }[]; _count: { serialUnits: number } }[];
};
type NewVariant = { sku: string; colorId: string; sizeId: string; costPrice: number; salePrice: number };

export default function ProductsPage() {
  const [q, setQ] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [cfg, setCfg] = useState<Config | null>(null);
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [form, setForm] = useState({ name: "", type: "SERIALIZED", brandId: "", categoryId: "", warrantyPolicyId: "" });
  const [variants, setVariants] = useState<NewVariant[]>([{ sku: "", colorId: "", sizeId: "", costPrice: 0, salePrice: 0 }]);

  const load = useCallback(async () => {
    const res = await fetch(`/api/products?q=${encodeURIComponent(q)}`);
    if (res.ok) setProducts(await res.json());
  }, [q]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  useEffect(() => { fetch("/api/config").then(async (r) => r.ok && setCfg(await r.json())); }, []);

  const save = async () => {
    setErr("");
    const res = await fetch("/api/products", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, variants: variants.filter((v) => v.sku) }),
    });
    const data = await res.json();
    if (!res.ok) return setErr(data.error);
    setShow(false);
    setForm({ name: "", type: "SERIALIZED", brandId: "", categoryId: "", warrantyPolicyId: "" });
    setVariants([{ sku: "", colorId: "", sizeId: "", costPrice: 0, salePrice: 0 }]);
    load();
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-bold">Product list</h1>
        <div className="flex gap-2">
          <input className="input w-64" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn btn-primary" onClick={() => setShow(true)}><Plus size={15} /> New product</button>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead><tr><th className="th">Product</th><th className="th">Variant</th><th className="th">SKU</th><th className="th text-right">Cost</th><th className="th text-right">Sale price</th><th className="th text-right">Stock</th></tr></thead>
          <tbody>
            {products.flatMap((p) =>
              p.variants.map((v, i) => {
                const stock = p.type === "SERIALIZED" ? v._count.serialUnits : (v.stockLevels[0]?.quantity ?? 0);
                return (
                  <tr key={v.id}>
                    <td className="td">{i === 0 && (<div className="flex items-center gap-1.5 font-semibold">{p.type === "SERIALIZED" && <ScanBarcode size={13} className="text-tealdark" />}{p.name}<span className="text-[11px] font-normal text-muted">{p.brand?.name}</span></div>)}</td>
                    <td className="td">{[v.color?.name, v.size?.name].filter(Boolean).join(" · ") || "—"}</td>
                    <td className="td font-mono text-[12px]">{v.sku}</td>
                    <td className="td text-right">{taka(v.costPrice)}</td>
                    <td className="td text-right font-semibold">{taka(v.salePrice)}</td>
                    <td className="td text-right"><span className={`rounded px-2 py-0.5 text-[11px] font-bold ${stock === 0 ? "bg-redsoft text-red" : "bg-tealsoft text-tealdark"}`}>{stock}</span></td>
                  </tr>
                );
              })
            )}
            {products.length === 0 && <tr><td colSpan={6} className="td py-10 text-center text-muted">No products yet — create your first one.</td></tr>}
          </tbody>
        </table>
      </div>

      {show && cfg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShow(false)}>
          <div className="card max-h-[90vh] w-full max-w-2xl space-y-3 overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h3 className="font-bold">New product</h3><button onClick={() => setShow(false)}><X size={17} /></button></div>
            <input className="input" placeholder="Product name — e.g. Redmi Note 13" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="SERIALIZED">Phone / IMEI tracked</option>
                <option value="STANDARD">Accessory / quantity tracked</option>
              </select>
              <select className="input" value={form.brandId} onChange={(e) => setForm({ ...form, brandId: e.target.value })}>
                <option value="">Brand…</option>{cfg.brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <select className="input" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                <option value="">Category…</option>{cfg.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select className="input" value={form.warrantyPolicyId} onChange={(e) => setForm({ ...form, warrantyPolicyId: e.target.value })}>
                <option value="">Warranty…</option>{cfg.warranties.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div className="text-[12px] font-semibold uppercase tracking-wide text-muted">Variants</div>
            {variants.map((v, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_1fr_90px_90px_auto] items-center gap-2">
                <input className="input" placeholder="SKU" value={v.sku} onChange={(e) => setVariants((vs) => vs.map((x, j) => j === i ? { ...x, sku: e.target.value } : x))} />
                <select className="input" value={v.colorId} onChange={(e) => setVariants((vs) => vs.map((x, j) => j === i ? { ...x, colorId: e.target.value } : x))}>
                  <option value="">Color…</option>{cfg.colors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select className="input" value={v.sizeId} onChange={(e) => setVariants((vs) => vs.map((x, j) => j === i ? { ...x, sizeId: e.target.value } : x))}>
                  <option value="">Storage…</option>{cfg.sizes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <input type="number" className="input" placeholder="Cost" value={v.costPrice || ""} onChange={(e) => setVariants((vs) => vs.map((x, j) => j === i ? { ...x, costPrice: Number(e.target.value) } : x))} />
                <input type="number" className="input" placeholder="Price" value={v.salePrice || ""} onChange={(e) => setVariants((vs) => vs.map((x, j) => j === i ? { ...x, salePrice: Number(e.target.value) } : x))} />
                <button className="text-muted hover:text-red" onClick={() => setVariants((vs) => vs.filter((_, j) => j !== i))}><X size={15} /></button>
              </div>
            ))}
            <button className="text-[12px] font-semibold text-tealdark" onClick={() => setVariants((vs) => [...vs, { sku: "", colorId: "", sizeId: "", costPrice: 0, salePrice: 0 }])}>+ Add variant</button>
            {err && <div className="rounded-md bg-redsoft px-3 py-2 text-[12px] font-semibold text-red">{err}</div>}
            <button className="btn btn-primary w-full" onClick={save}>Save product</button>
          </div>
        </div>
      )}
    </div>
  );
}
