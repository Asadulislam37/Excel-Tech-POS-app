"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { taka } from "@/lib/format";
import { FileSpreadsheet, ImageIcon, MoreHorizontal, Pencil, Plus, Printer, ScanBarcode, X } from "lucide-react";

type Config = { brands: { id: string; name: string }[]; categories: { id: string; name: string }[];
  colors: { id: string; name: string }[]; sizes: { id: string; name: string }[]; warranties: { id: string; name: string }[] };
type Variant = {
  id: string; sku: string; salePrice: string; costPrice: string; mrp?: string | null;
  colorId?: string | null; sizeId?: string | null;
  color?: { name: string } | null; size?: { name: string } | null;
  stockLevels: { quantity: number }[]; _count: { serialUnits: number };
};
type Product = {
  id: string; name: string; type: string; imageUrl?: string | null; isPublished: boolean;
  brandId?: string | null; categoryId?: string | null; warrantyPolicyId?: string | null;
  brand?: { name: string } | null; category?: { name: string } | null; warrantyPolicy?: { name: string } | null;
  variants: Variant[];
};
type NewVariant = { sku: string; colorId: string; sizeId: string; costPrice: number; salePrice: number; mrp: number };

// ── Code 39 barcode (SVG) ────────────────────────────────────────────────────
const C39: Record<string, string> = {
  "0": "nnnwwnwnn", "1": "wnnwnnnnw", "2": "nnwwnnnnw", "3": "wnwwnnnnn", "4": "nnnwwnnnw",
  "5": "wnnwwnnnn", "6": "nnwwwnnnn", "7": "nnnwnnwnw", "8": "wnnwnnwnn", "9": "nnwwnnwnn",
  A: "wnnnnwnnw", B: "nnwnnwnnw", C: "wnwnnwnnn", D: "nnnnwwnnw", E: "wnnnwwnnn",
  F: "nnwnwwnnn", G: "nnnnnwwnw", H: "wnnnnwwnn", I: "nnwnnwwnn", J: "nnnnwwwnn",
  K: "wnnnnnnww", L: "nnwnnnnww", M: "wnwnnnnwn", N: "nnnnwnnww", O: "wnnnwnnwn",
  P: "nnwnwnnwn", Q: "nnnnnnwww", R: "wnnnnnwwn", S: "nnwnnnwwn", T: "nnnnwnwwn",
  U: "wwnnnnnnw", V: "nwwnnnnnw", W: "wwwnnnnnn", X: "nwnnwnnnw", Y: "wwnnwnnnn",
  Z: "nwwnwnnnn", "-": "nwnnnnwnw", ".": "wwnnnnwnn", " ": "nwwnnnwnn", "*": "nwnnwnwnn",
};
function code39Svg(text: string, height = 64) {
  const chars = ("*" + text.toUpperCase().replace(/[^0-9A-Z\-. ]/g, "-") + "*").split("");
  const N = 2, W = 5, GAP = N;
  let x = 0;
  const rects: string[] = [];
  for (const ch of chars) {
    const pat = C39[ch] ?? C39["-"];
    for (let i = 0; i < 9; i++) {
      const w = pat[i] === "w" ? W : N;
      if (i % 2 === 0) rects.push(`<rect x="${x}" y="0" width="${w}" height="${height}" fill="#111"/>`);
      x += w;
    }
    x += GAP;
  }
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${x}" height="${height}" viewBox="0 0 ${x} ${height}">${rects.join("")}</svg>`, width: x };
}

export default function ProductsPage() {
  const [tab, setTab] = useState<"active" | "inactive">("active");
  const [q, setQ] = useState("");
  const [fCat, setFCat] = useState("");
  const [fBrand, setFBrand] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [cfg, setCfg] = useState<Config | null>(null);
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [menuFor, setMenuFor] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [editP, setEditP] = useState<Product | null>(null);
  const [editErr, setEditErr] = useState("");
  const [barcodeV, setBarcodeV] = useState<{ p: Product; v: Variant } | null>(null);
  const [form, setForm] = useState({ name: "", type: "SERIALIZED", brandId: "", categoryId: "", warrantyPolicyId: "" });
  const [variants, setVariants] = useState<NewVariant[]>([{ sku: "", colorId: "", sizeId: "", costPrice: 0, salePrice: 0, mrp: 0 }]);
  const menuRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ q, status: tab, page: String(page) });
    if (fCat) params.set("categoryId", fCat);
    if (fBrand) params.set("brandId", fBrand);
    const res = await fetch(`/api/products?${params}`);
    if (res.ok) {
      setTotal(Number(res.headers.get("x-total-count")) || 0);
      setProducts(await res.json());
    }
  }, [q, tab, fCat, fBrand, page]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  useEffect(() => { setPage(1); }, [q, tab, fCat, fBrand]);
  useEffect(() => { fetch("/api/config").then(async (r) => r.ok && setCfg(await r.json())); }, []);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenuFor(""); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

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
    setVariants([{ sku: "", colorId: "", sizeId: "", costPrice: 0, salePrice: 0, mrp: 0 }]);
    load();
  };

  const patch = async (id: string, body: object) => {
    const res = await fetch(`/api/products/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Update failed.");
  };

  const doAction = async (id: string, action: string) => {
    setMenuFor("");
    try { await patch(id, { action }); load(); } catch (e) { alert(e instanceof Error ? e.message : "Failed"); }
  };

  const saveEdit = async () => {
    if (!editP) return;
    setEditErr("");
    try {
      await patch(editP.id, {
        name: editP.name, brandId: editP.brandId ?? "", categoryId: editP.categoryId ?? "",
        warrantyPolicyId: editP.warrantyPolicyId ?? "",
        variants: editP.variants.map((v) => ({
          id: v.id, sku: v.sku, costPrice: Number(v.costPrice) || 0, salePrice: Number(v.salePrice) || 0,
          mrp: Number(v.mrp) || 0, colorId: v.colorId ?? "", sizeId: v.sizeId ?? "",
        })),
      });
      setEditP(null);
      load();
    } catch (e) { setEditErr(e instanceof Error ? e.message : "Update failed."); }
  };

  const setEditVariant = (i: number, patch: Partial<Variant>) =>
    setEditP((p) => p && { ...p, variants: p.variants.map((v, j) => (j === i ? { ...v, ...patch } : v)) });

  const rows = products.flatMap((p) => p.variants.map((v, i) => ({ p, v, first: i === 0 })));

  const exportCsv = () => {
    const head = ["SKU", "Category", "Brand", "Product", "Variant", "Wholesale", "Retail", "MRP", "Warranty", "Stock"];
    const lines = rows.map(({ p, v }) => {
      const stock = p.type === "SERIALIZED" ? v._count.serialUnits : (v.stockLevels[0]?.quantity ?? 0);
      return [v.sku, p.category?.name ?? "", p.brand?.name ?? "", p.name,
        [v.color?.name, v.size?.name].filter(Boolean).join(" · "),
        v.costPrice, v.salePrice, v.mrp ?? "", p.warrantyPolicy?.name ?? "", stock]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",");
    });
    const blob = new Blob(["﻿" + [head.join(","), ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `products-${tab}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const printBarcode = () => {
    if (!barcodeV) return;
    const { p, v } = barcodeV;
    const { svg } = code39Svg(v.sku);
    const w = window.open("", "_blank", "width=420,height=320");
    if (!w) return;
    w.document.write(`<html><head><title>${v.sku}</title></head>
      <body style="font-family:sans-serif;text-align:center;padding:16px">
      <div style="font-size:13px;font-weight:600">${p.name}</div>
      ${svg}
      <div style="font-family:monospace;font-size:14px;letter-spacing:.2em">${v.sku}</div>
      <div style="font-size:13px;font-weight:700">${taka(v.salePrice)}</div>
      <script>window.onload=()=>{window.print();window.close()}</script></body></html>`);
    w.document.close();
  };

  return (
    <div className="space-y-3">
      {/* tabs + toolbar */}
      <div className="inline-flex rounded-full border border-line bg-card p-1">
        {(["active", "inactive"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-full px-5 py-2 text-[13px] font-bold transition-colors ${tab === t ? "bg-ink text-white" : "text-body hover:bg-paper"}`}>
            {t === "active" ? "Active Product" : "Inactive Product"}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button className="btn text-white" style={{ background: "var(--amber)" }} onClick={() => setShow(true)}>
          <Plus size={15} /> Create
        </button>
        <input className="input w-56" placeholder="Type here…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input w-44" value={fCat} onChange={(e) => setFCat(e.target.value)}>
          <option value="">Select Category</option>
          {cfg?.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="input w-44" value={fBrand} onChange={(e) => setFBrand(e.target.value)}>
          <option value="">Select Brand</option>
          {cfg?.brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <div className="ml-auto flex gap-2">
          <button className="btn btn-ghost" title="Export CSV / Excel" onClick={exportCsv}><FileSpreadsheet size={16} /></button>
          <button className="btn btn-ghost" title="Print list" onClick={() => window.print()}><Printer size={16} /></button>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead><tr>
            <th className="th">SL.</th><th className="th">SKU</th><th className="th">Category</th><th className="th">Brand</th>
            <th className="th">Photo</th><th className="th">Product Name</th>
            <th className="th text-right">Wholesale</th><th className="th text-right">Retail Price</th><th className="th text-right">MRP</th>
            <th className="th">Warranty</th><th className="th text-right">Stock</th><th className="th text-center">Action</th>
          </tr></thead>
          <tbody>
            {rows.map(({ p, v }, idx) => {
              const stock = p.type === "SERIALIZED" ? v._count.serialUnits : (v.stockLevels[0]?.quantity ?? 0);
              const variant = [v.color?.name, v.size?.name].filter(Boolean).join(" · ");
              return (
                <tr key={v.id}>
                  <td className="td">{idx + 1}</td>
                  <td className="td font-mono text-[12px]">{v.sku}</td>
                  <td className="td">{p.category?.name ?? "—"}</td>
                  <td className="td">{p.brand?.name ?? "—"}</td>
                  <td className="td">
                    {p.imageUrl
                      ? /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={p.imageUrl} alt="" className="h-9 w-9 rounded-md border border-line object-cover" />
                      : <span className="flex h-9 w-9 items-center justify-center rounded-md border border-line bg-paper text-muted"><ImageIcon size={15} /></span>}
                  </td>
                  <td className="td">
                    <div className="flex items-center gap-1.5 font-semibold">
                      {p.type === "SERIALIZED" && <ScanBarcode size={13} className="text-tealdark" />}
                      {p.name}{variant && <span className="text-[11px] font-normal text-muted">{variant}</span>}
                    </div>
                  </td>
                  <td className="td text-right">{taka(v.costPrice)}</td>
                  <td className="td text-right font-semibold">{taka(v.salePrice)}</td>
                  <td className="td text-right">{v.mrp ? taka(v.mrp) : "—"}</td>
                  <td className="td">{p.warrantyPolicy?.name ?? "—"}</td>
                  <td className="td text-right"><span className={`rounded px-2 py-0.5 text-[11px] font-bold ${stock === 0 ? "bg-redsoft text-red" : "bg-tealsoft text-tealdark"}`}>{stock}</span></td>
                  <td className="td">
                    <div className="relative flex items-center justify-center gap-1.5">
                      <button title="Edit" className="rounded-md bg-blue-100 p-2 text-blue-700 hover:bg-blue-200"
                        onClick={() => { setEditErr(""); setEditP(JSON.parse(JSON.stringify(p))); }}><Pencil size={14} /></button>
                      <button title="Barcode" className="rounded-md bg-green-100 p-2 text-green-700 hover:bg-green-200"
                        onClick={() => setBarcodeV({ p, v })}><ScanBarcode size={14} /></button>
                      <button title="More" className="rounded-md bg-orange-100 p-2 text-orange-600 hover:bg-orange-200"
                        onClick={() => setMenuFor(menuFor === v.id ? "" : v.id)}><MoreHorizontal size={14} /></button>
                      {menuFor === v.id && (
                        <div ref={menuRef} className="card absolute right-0 top-9 z-40 w-44 p-1 text-left shadow-lg">
                          {tab === "active"
                            ? <button className="block w-full rounded-md px-3 py-2 text-left text-[13px] font-semibold text-red hover:bg-redsoft" onClick={() => doAction(p.id, "DEACTIVATE")}>Deactivate product</button>
                            : <button className="block w-full rounded-md px-3 py-2 text-left text-[13px] font-semibold text-tealdark hover:bg-tealsoft" onClick={() => doAction(p.id, "ACTIVATE")}>Activate product</button>}
                          <button className="block w-full rounded-md px-3 py-2 text-left text-[13px] hover:bg-paper" onClick={() => doAction(p.id, p.isPublished ? "UNPUBLISH" : "PUBLISH")}>
                            {p.isPublished ? "Hide from online shop" : "Show in online shop"}
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={12} className="td py-10 text-center text-muted">
              {tab === "active" ? "No products yet — create your first one." : "No inactive products."}</td></tr>}
          </tbody>
        </table>
      </div>

      {total > 50 && (
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-muted">{total} products · page {page} of {Math.ceil(total / 50)}</span>
          <div className="flex gap-2">
            <button className="btn btn-ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>‹ Prev</button>
            <button className="btn btn-ghost" disabled={page >= Math.ceil(total / 50)} onClick={() => setPage((p) => p + 1)}>Next ›</button>
          </div>
        </div>
      )}

      {/* edit modal */}
      {editP && cfg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditP(null)}>
          <div className="card max-h-[90vh] w-full max-w-3xl space-y-3 overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h3 className="font-bold">Edit product</h3><button onClick={() => setEditP(null)}><X size={17} /></button></div>
            <input className="input" value={editP.name} onChange={(e) => setEditP({ ...editP, name: e.target.value })} />
            <div className="grid grid-cols-3 gap-2">
              <select className="input" value={editP.brandId ?? ""} onChange={(e) => setEditP({ ...editP, brandId: e.target.value })}>
                <option value="">Brand…</option>{cfg.brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <select className="input" value={editP.categoryId ?? ""} onChange={(e) => setEditP({ ...editP, categoryId: e.target.value })}>
                <option value="">Category…</option>{cfg.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select className="input" value={editP.warrantyPolicyId ?? ""} onChange={(e) => setEditP({ ...editP, warrantyPolicyId: e.target.value })}>
                <option value="">Warranty…</option>{cfg.warranties.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div className="text-[12px] font-semibold uppercase tracking-wide text-muted">Variants</div>
            <div className="grid grid-cols-[1fr_1fr_1fr_90px_90px_90px] gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
              <span>SKU</span><span>Color</span><span>Storage</span><span>Wholesale</span><span>Retail</span><span>MRP</span>
            </div>
            {editP.variants.map((v, i) => (
              <div key={v.id} className="grid grid-cols-[1fr_1fr_1fr_90px_90px_90px] items-center gap-2">
                <input className="input" value={v.sku} onChange={(e) => setEditVariant(i, { sku: e.target.value })} />
                <select className="input" value={v.colorId ?? ""} onChange={(e) => setEditVariant(i, { colorId: e.target.value })}>
                  <option value="">Color…</option>{cfg.colors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select className="input" value={v.sizeId ?? ""} onChange={(e) => setEditVariant(i, { sizeId: e.target.value })}>
                  <option value="">Storage…</option>{cfg.sizes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <input type="number" className="input" value={v.costPrice || ""} onChange={(e) => setEditVariant(i, { costPrice: e.target.value })} />
                <input type="number" className="input" value={v.salePrice || ""} onChange={(e) => setEditVariant(i, { salePrice: e.target.value })} />
                <input type="number" className="input" value={v.mrp ?? ""} onChange={(e) => setEditVariant(i, { mrp: e.target.value })} />
              </div>
            ))}
            {editErr && <div className="rounded-md bg-redsoft px-3 py-2 text-[12px] font-semibold text-red">{editErr}</div>}
            <button className="btn btn-primary w-full" onClick={saveEdit}>Save changes</button>
          </div>
        </div>
      )}

      {/* barcode modal */}
      {barcodeV && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setBarcodeV(null)}>
          <div className="card w-full max-w-sm space-y-3 p-5 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h3 className="font-bold">Barcode</h3><button onClick={() => setBarcodeV(null)}><X size={17} /></button></div>
            <div className="text-[13px] font-semibold">{barcodeV.p.name}</div>
            <div className="flex justify-center overflow-x-auto"
              dangerouslySetInnerHTML={{ __html: code39Svg(barcodeV.v.sku).svg }} />
            <div className="font-mono text-[14px] tracking-[.2em]">{barcodeV.v.sku}</div>
            <div className="text-[13px] font-bold">{taka(barcodeV.v.salePrice)}</div>
            <button className="btn btn-primary w-full" onClick={printBarcode}><Printer size={15} /> Print label</button>
          </div>
        </div>
      )}

      {/* create modal */}
      {show && cfg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShow(false)}>
          <div className="card max-h-[90vh] w-full max-w-3xl space-y-3 overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
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
              <div key={i} className="grid grid-cols-[1fr_1fr_1fr_80px_80px_80px_auto] items-center gap-2">
                <input className="input" placeholder="SKU" value={v.sku} onChange={(e) => setVariants((vs) => vs.map((x, j) => j === i ? { ...x, sku: e.target.value } : x))} />
                <select className="input" value={v.colorId} onChange={(e) => setVariants((vs) => vs.map((x, j) => j === i ? { ...x, colorId: e.target.value } : x))}>
                  <option value="">Color…</option>{cfg.colors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select className="input" value={v.sizeId} onChange={(e) => setVariants((vs) => vs.map((x, j) => j === i ? { ...x, sizeId: e.target.value } : x))}>
                  <option value="">Storage…</option>{cfg.sizes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <input type="number" className="input" placeholder="Cost" value={v.costPrice || ""} onChange={(e) => setVariants((vs) => vs.map((x, j) => j === i ? { ...x, costPrice: Number(e.target.value) } : x))} />
                <input type="number" className="input" placeholder="Price" value={v.salePrice || ""} onChange={(e) => setVariants((vs) => vs.map((x, j) => j === i ? { ...x, salePrice: Number(e.target.value) } : x))} />
                <input type="number" className="input" placeholder="MRP" value={v.mrp || ""} onChange={(e) => setVariants((vs) => vs.map((x, j) => j === i ? { ...x, mrp: Number(e.target.value) } : x))} />
                <button className="text-muted hover:text-red" onClick={() => setVariants((vs) => vs.filter((_, j) => j !== i))}><X size={15} /></button>
              </div>
            ))}
            <button className="text-[12px] font-semibold text-tealdark" onClick={() => setVariants((vs) => [...vs, { sku: "", colorId: "", sizeId: "", costPrice: 0, salePrice: 0, mrp: 0 }])}>+ Add variant</button>
            {err && <div className="rounded-md bg-redsoft px-3 py-2 text-[12px] font-semibold text-red">{err}</div>}
            <button className="btn btn-primary w-full" onClick={save}>Save product</button>
          </div>
        </div>
      )}
    </div>
  );
}
