"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { taka } from "@/lib/format";
import { FileSpreadsheet, ImageIcon, MoreHorizontal, Pencil, Plus, Printer, ScanBarcode, X } from "lucide-react";

type Named = { id: string; name: string };
type Config = { brands: Named[]; categories: Named[]; colors: Named[]; sizes: Named[]; units: Named[]; warranties: Named[] };
type Variant = {
  id: string; sku: string; salePrice: string; costPrice: string; wholesalePrice?: string | null; mrp?: string | null;
  reorderLevel?: number;
  colorId?: string | null; sizeId?: string | null;
  color?: { name: string } | null; size?: { name: string } | null;
  stockLevels: { quantity: number }[]; _count: { serialUnits: number };
};
type Product = {
  id: string; name: string; type: string; imageUrl?: string | null; isPublished: boolean;
  brandId?: string | null; categoryId?: string | null; unitId?: string | null; warrantyPolicyId?: string | null;
  brand?: { name: string } | null; category?: { name: string } | null; warrantyPolicy?: { name: string } | null;
  variants: Variant[];
};
type NewVariant = { sku: string; colorId: string; sizeId: string; costPrice: number; wholesalePrice: number; salePrice: number; mrp: number };
type QuickEdit = {
  p: Product; v: Variant; name: string;
  cost: string; wholesale: string; mrp: string; rp: string; stockIn: string; stockOut: string;
};
type BarcodeJob = {
  p: Product; v: Variant; qty: number; type: "a4" | "single";
  storeName: boolean; productName: boolean; code: boolean; price: boolean;
};

const STORE_NAME = "Excel Tech";

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
function code39Svg(text: string, height = 56) {
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
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${x}" height="${height}" viewBox="0 0 ${x} ${height}" preserveAspectRatio="xMidYMid meet" style="max-width:100%">${rects.join("")}</svg>`;
}

const stockOf = (p: Product, v: Variant) =>
  p.type === "SERIALIZED" ? v._count.serialUnits : (v.stockLevels[0]?.quantity ?? 0);

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
  const [quick, setQuick] = useState<QuickEdit | null>(null);
  const [quickErr, setQuickErr] = useState("");
  const [editP, setEditP] = useState<Product | null>(null);
  const [editErr, setEditErr] = useState("");
  const [barcode, setBarcode] = useState<BarcodeJob | null>(null);
  const [confirmP, setConfirmP] = useState<Product | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", type: "SERIALIZED", brandId: "", categoryId: "", warrantyPolicyId: "" });
  const [variants, setVariants] = useState<NewVariant[]>([{ sku: "", colorId: "", sizeId: "", costPrice: 0, wholesalePrice: 0, salePrice: 0, mrp: 0 }]);
  const menuRef = useRef<HTMLDivElement>(null);

  const loadCfg = useCallback(async () => {
    const r = await fetch("/api/config");
    if (r.ok) setCfg(await r.json());
  }, []);

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
  useEffect(() => { loadCfg(); }, [loadCfg]);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenuFor(""); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const patch = async (id: string, body: object) => {
    const res = await fetch(`/api/products/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Update failed.");
  };

  // quick-add a config entry (brand/category/color/size/unit/warranty); returns new id
  const quickAdd = async (kind: string): Promise<string> => {
    const name = window.prompt(`New ${kind} name:`);
    if (!name?.trim()) return "";
    const res = await fetch("/api/config", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, name: name.trim() }),
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error ?? "Failed"); return ""; }
    await loadCfg();
    return data.id as string;
  };

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
    setVariants([{ sku: "", colorId: "", sizeId: "", costPrice: 0, wholesalePrice: 0, salePrice: 0, mrp: 0 }]);
    load();
  };

  const openQuick = (p: Product, v: Variant) => {
    setQuickErr("");
    setQuick({
      p, v, name: p.name,
      cost: String(Number(v.costPrice) || ""), wholesale: String(Number(v.wholesalePrice) || ""),
      mrp: String(Number(v.mrp) || ""), rp: "",
      stockIn: "0", stockOut: "0",
    });
  };

  const saveQuick = async () => {
    if (!quick) return;
    setQuickErr("");
    setBusy(true);
    try {
      const rp = Number(quick.rp) || 0;
      const mrp = Number(quick.mrp) || 0;
      await patch(quick.p.id, {
        quickEdit: {
          variantId: quick.v.id,
          name: quick.name,
          costPrice: Number(quick.cost) || 0,
          wholesalePrice: Number(quick.wholesale) || 0,
          salePrice: rp || mrp || Number(quick.v.salePrice) || 0, // retail if given, else MRP
          mrp,
          stockIn: Number(quick.stockIn) || 0,
          stockOut: Number(quick.stockOut) || 0,
        },
      });
      setQuick(null);
      load();
    } catch (e) { setQuickErr(e instanceof Error ? e.message : "Update failed."); }
    finally { setBusy(false); }
  };

  const saveEdit = async () => {
    if (!editP) return;
    setEditErr("");
    setBusy(true);
    try {
      await patch(editP.id, {
        name: editP.name, brandId: editP.brandId ?? "", categoryId: editP.categoryId ?? "",
        unitId: editP.unitId ?? "", warrantyPolicyId: editP.warrantyPolicyId ?? "",
        variants: editP.variants.map((v) => ({
          id: v.id, sku: v.sku, costPrice: Number(v.costPrice) || 0, wholesalePrice: Number(v.wholesalePrice) || 0,
          salePrice: Number(v.salePrice) || 0, mrp: Number(v.mrp) || 0,
          colorId: v.colorId ?? "", sizeId: v.sizeId ?? "", reorderLevel: Number(v.reorderLevel) || 0,
        })),
      });
      setEditP(null);
      load();
    } catch (e) { setEditErr(e instanceof Error ? e.message : "Update failed."); }
    finally { setBusy(false); }
  };

  const doInactive = async () => {
    if (!confirmP) return;
    setBusy(true);
    try { await patch(confirmP.id, { action: "DEACTIVATE" }); setConfirmP(null); load(); }
    catch (e) { alert(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  };

  const doAction = async (id: string, action: string) => {
    setMenuFor("");
    try { await patch(id, { action }); load(); } catch (e) { alert(e instanceof Error ? e.message : "Failed"); }
  };

  const setEditVariant = (i: number, patchV: Partial<Variant>) =>
    setEditP((p) => p && { ...p, variants: p.variants.map((v, j) => (j === i ? { ...v, ...patchV } : v)) });

  const rows = products.flatMap((p) => p.variants.map((v) => ({ p, v })));

  const exportCsv = () => {
    const head = ["SKU", "Category", "Brand", "Product", "Variant", "Costing", "Wholesale", "Retail", "MRP", "Warranty", "Stock"];
    const lines = rows.map(({ p, v }) => [
      v.sku, p.category?.name ?? "", p.brand?.name ?? "", p.name,
      [v.color?.name, v.size?.name].filter(Boolean).join(" · "),
      v.costPrice, v.wholesalePrice ?? "", v.salePrice, v.mrp ?? "", p.warrantyPolicy?.name ?? "", stockOf(p, v),
    ].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","));
    const blob = new Blob(["﻿" + [head.join(","), ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `products-${tab}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const printBarcodes = () => {
    if (!barcode) return;
    const { p, v, qty, type, storeName, productName, code, price } = barcode;
    const label = `
      <div class="label">
        ${storeName ? `<div class="store">${STORE_NAME}</div>` : ""}
        ${productName ? `<div class="pname">${p.name}</div>` : ""}
        ${code39Svg(v.sku)}
        ${code ? `<div class="code">${v.sku}</div>` : ""}
        ${price ? `<div class="price">${taka(v.salePrice)}</div>` : ""}
      </div>`;
    const labels = Array.from({ length: Math.max(1, Math.min(500, qty)) }, () => label).join("");
    const grid = type === "a4"
      ? "display:grid;grid-template-columns:repeat(3,1fr);gap:4mm;padding:8mm;"
      : "display:block;padding:2mm;";
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    w.document.write(`<html><head><title>Barcodes — ${v.sku}</title><style>
      body{font-family:sans-serif;margin:0}
      .sheet{${grid}}
      .label{border:1px dashed #ccc;text-align:center;padding:3mm 2mm;page-break-inside:avoid;overflow:hidden}
      .store{font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase}
      .pname{font-size:10px;margin:1px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .code{font-family:monospace;font-size:12px;letter-spacing:.15em}
      .price{font-size:12px;font-weight:700}
      svg{max-width:100%;height:40px}
      @media print{.label{border:none}}
    </style></head><body><div class="sheet">${labels}</div>
    <script>window.onload=()=>{window.print()}</script></body></html>`);
    w.document.close();
  };

  const inp = "input"; // shorthand kept for readability in the dense grids below

  return (
    <div className="space-y-3">
      {/* tabs */}
      <div className="inline-flex rounded-full border border-line bg-card p-1">
        {(["active", "inactive"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-full px-5 py-2 text-[13px] font-bold transition-colors ${tab === t ? "bg-ink text-white" : "text-body hover:bg-paper"}`}>
            {t === "active" ? "Active Product" : "Inactive Product"}
          </button>
        ))}
      </div>

      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn text-white" style={{ background: "var(--amber)" }} onClick={() => setShow(true)}>
          <Plus size={15} /> Create
        </button>
        <input className={`${inp} w-56`} placeholder="Type here…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={`${inp} w-44`} value={fCat} onChange={(e) => setFCat(e.target.value)}>
          <option value="">Select Category</option>
          {cfg?.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className={`${inp} w-44`} value={fBrand} onChange={(e) => setFBrand(e.target.value)}>
          <option value="">Select Brand</option>
          {cfg?.brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <div className="ml-auto flex gap-2">
          <button className="btn btn-ghost" title="Export CSV / Excel" onClick={exportCsv}><FileSpreadsheet size={16} /></button>
          <button className="btn btn-ghost" title="Print list" onClick={() => window.print()}><Printer size={16} /></button>
        </div>
      </div>

      {/* table */}
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[960px]">
          <thead><tr>
            <th className="th">SL.</th><th className="th">SKU</th><th className="th">Category</th><th className="th">Brand</th>
            <th className="th">Photo</th><th className="th">Product Name</th>
            <th className="th text-right">Wholesale</th><th className="th text-right">Retail Price</th><th className="th text-right">MRP</th>
            <th className="th">Warranty</th><th className="th text-right">Stock</th><th className="th text-center">Action</th>
          </tr></thead>
          <tbody>
            {rows.map(({ p, v }, idx) => {
              const stock = stockOf(p, v);
              const variant = [v.color?.name, v.size?.name].filter(Boolean).join(" · ");
              return (
                <tr key={v.id}>
                  <td className="td">{(page - 1) * 50 + idx + 1}</td>
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
                  <td className="td text-right">{v.wholesalePrice ? taka(v.wholesalePrice) : "—"}</td>
                  <td className="td text-right font-semibold">{taka(v.salePrice)}</td>
                  <td className="td text-right">{v.mrp ? taka(v.mrp) : "—"}</td>
                  <td className="td">{p.warrantyPolicy?.name ?? "—"}</td>
                  <td className="td text-right"><span className={`rounded px-2 py-0.5 text-[11px] font-bold ${stock === 0 ? "bg-redsoft text-red" : "bg-tealsoft text-tealdark"}`}>{stock}</span></td>
                  <td className="td">
                    <div className="relative flex items-center justify-center gap-1.5">
                      <button title="Quick edit" className="rounded-md bg-blue-100 p-2 text-blue-700 hover:bg-blue-200"
                        onClick={() => openQuick(p, v)}><Pencil size={14} /></button>
                      <button title="Generate barcode" className="rounded-md bg-green-100 p-2 text-green-700 hover:bg-green-200"
                        onClick={() => setBarcode({ p, v, qty: 1, type: "a4", storeName: true, productName: true, code: true, price: true })}><ScanBarcode size={14} /></button>
                      <button title="More" className="rounded-md bg-orange-100 p-2 text-orange-600 hover:bg-orange-200"
                        onClick={() => setMenuFor(menuFor === v.id ? "" : v.id)}><MoreHorizontal size={14} /></button>
                      {menuFor === v.id && (
                        <div ref={menuRef} className="card absolute right-0 top-9 z-40 w-48 p-1 text-left shadow-lg">
                          <button className="block w-full rounded-md px-3 py-2 text-left text-[13px] font-semibold hover:bg-paper"
                            onClick={() => { setMenuFor(""); setEditErr(""); setEditP(JSON.parse(JSON.stringify(p))); }}>Edit</button>
                          {tab === "active"
                            ? <button className="block w-full rounded-md px-3 py-2 text-left text-[13px] font-semibold text-red hover:bg-redsoft"
                                onClick={() => { setMenuFor(""); setConfirmP(p); }}>Inactive</button>
                            : <button className="block w-full rounded-md px-3 py-2 text-left text-[13px] font-semibold text-tealdark hover:bg-tealsoft"
                                onClick={() => doAction(p.id, "ACTIVATE")}>Activate</button>}
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

      {/* ── Quick Edit ── */}
      {quick && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setQuick(null)}>
          <div className="card w-full max-w-xl space-y-3 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h3 className="text-lg font-bold">Quick Edit</h3><button onClick={() => setQuick(null)}><X size={17} /></button></div>
            <label className="block text-[12px] font-semibold text-muted">Product Name
              <input className={`${inp} mt-1`} value={quick.name} onChange={(e) => setQuick({ ...quick, name: e.target.value })} />
            </label>
            <label className="block text-[12px] font-semibold text-muted">Costing Price
              <input type="number" className={`${inp} mt-1`} value={quick.cost} onChange={(e) => setQuick({ ...quick, cost: e.target.value })} />
            </label>
            <div className="grid grid-cols-3 gap-2">
              <label className="block text-[12px] font-semibold text-muted">Wholesale Price
                <input type="number" className={`${inp} mt-1`} value={quick.wholesale} onChange={(e) => setQuick({ ...quick, wholesale: e.target.value })} />
              </label>
              <label className="block text-[12px] font-semibold text-muted">MRP
                <input type="number" className={`${inp} mt-1`} value={quick.mrp} onChange={(e) => setQuick({ ...quick, mrp: e.target.value })} />
              </label>
              <label className="block text-[12px] font-semibold text-muted">RP Price
                <input type="number" className={`${inp} mt-1`} placeholder="Enter Retailer Price" value={quick.rp} onChange={(e) => setQuick({ ...quick, rp: e.target.value })} />
              </label>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <label className="block text-[12px] font-semibold text-muted">Current Stock
                <input className={`${inp} mt-1 bg-paper`} readOnly value={stockOf(quick.p, quick.v)} />
              </label>
              <label className="block text-[12px] font-semibold text-muted">Stock In
                <input type="number" className={`${inp} mt-1`} disabled={quick.p.type === "SERIALIZED"} value={quick.stockIn} onChange={(e) => setQuick({ ...quick, stockIn: e.target.value })} />
              </label>
              <label className="block text-[12px] font-semibold text-muted">Stock Out
                <input type="number" className={`${inp} mt-1`} disabled={quick.p.type === "SERIALIZED"} value={quick.stockOut} onChange={(e) => setQuick({ ...quick, stockOut: e.target.value })} />
              </label>
            </div>
            {quick.p.type === "SERIALIZED" && (
              <div className="rounded-md bg-tealsoft px-3 py-2 text-[12px] font-semibold text-tealdark">
                IMEI-tracked product — stock in/out happens through Serial Number Manage or Purchase, so every IMEI stays traceable.
              </div>
            )}
            {quickErr && <div className="rounded-md bg-redsoft px-3 py-2 text-[12px] font-semibold text-red">{quickErr}</div>}
            <button className="btn btn-primary w-full py-3" disabled={busy} onClick={saveQuick}>{busy ? "Updating…" : "Update Now"}</button>
          </div>
        </div>
      )}

      {/* ── Generate Barcode ── */}
      {barcode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setBarcode(null)}>
          <div className="card w-full max-w-xl space-y-3 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h3 className="text-lg font-bold">Generate Barcode</h3><button onClick={() => setBarcode(null)}><X size={17} /></button></div>
            <label className="block text-[12px] font-semibold text-muted">Product Name
              <input className={`${inp} mt-1 bg-paper`} readOnly value={barcode.p.name} />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-[12px] font-semibold text-muted">Barcode Quantity
                <input type="number" min={1} max={500} className={`${inp} mt-1`} value={barcode.qty}
                  onChange={(e) => setBarcode({ ...barcode, qty: Number(e.target.value) || 1 })} />
              </label>
              <label className="block text-[12px] font-semibold text-muted">Barcode Type
                <select className={`${inp} mt-1`} value={barcode.type} onChange={(e) => setBarcode({ ...barcode, type: e.target.value as "a4" | "single" })}>
                  <option value="a4">A4 sheet (3 per row)</option>
                  <option value="single">Single / roll printer</option>
                </select>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {([["storeName", "Add Store Name"], ["productName", "Add Product Name"], ["code", "Add Product Code"], ["price", "Add Price"]] as const).map(([k, label]) => (
                <label key={k} className="flex items-center justify-between rounded-lg border border-line px-3 py-2.5 text-[13px] font-semibold">
                  {label}
                  <input type="checkbox" className="h-4 w-4 accent-[var(--teal)]" checked={barcode[k]}
                    onChange={(e) => setBarcode({ ...barcode, [k]: e.target.checked })} />
                </label>
              ))}
            </div>
            <div className="flex justify-center rounded-lg border border-line bg-paper p-3"
              dangerouslySetInnerHTML={{ __html: code39Svg(barcode.v.sku, 44) }} />
            <button className="btn btn-primary w-full py-3" onClick={printBarcodes}><Printer size={15} /> Generate Barcode</button>
          </div>
        </div>
      )}

      {/* ── Inactive confirm ── */}
      {confirmP && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setConfirmP(null)}>
          <div className="card w-full max-w-md space-y-4 p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-2xl font-extrabold text-red">Are you Sure!</h3>
            <p className="text-[14px] font-semibold" style={{ color: "var(--amber)" }}>You want to Inactive this Product?</p>
            <div className="rounded-lg border px-3 py-2.5 font-semibold" style={{ borderColor: "var(--amber)" }}>{confirmP.name}</div>
            <button className="btn w-full py-3 text-white" style={{ background: "var(--amber)" }} disabled={busy} onClick={doInactive}>
              {busy ? "Working…" : "Inactive Now"}
            </button>
          </div>
        </div>
      )}

      {/* ── Full Edit ── */}
      {editP && cfg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditP(null)}>
          <div className="card max-h-[90vh] w-full max-w-4xl space-y-3 overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h3 className="font-bold">Edit product</h3><button onClick={() => setEditP(null)}><X size={17} /></button></div>
            <input className={inp} value={editP.name} onChange={(e) => setEditP({ ...editP, name: e.target.value })} />
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {([
                ["categoryId", "Category…", "category", cfg.categories],
                ["brandId", "Brand…", "brand", cfg.brands],
                ["unitId", "Units…", "unit", cfg.units],
                ["warrantyPolicyId", "Warranty…", "warranty", cfg.warranties],
              ] as const).map(([field, ph, kind, list]) => (
                <div key={field} className="flex gap-1">
                  <select className={inp} value={(editP[field] as string) ?? ""} onChange={(e) => setEditP({ ...editP, [field]: e.target.value })}>
                    <option value="">{ph}</option>{list.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                  </select>
                  <button className="btn btn-ghost px-2" title={`Add ${kind}`}
                    onClick={async () => { const id = await quickAdd(kind); if (id) setEditP((p) => p && { ...p, [field]: id }); }}><Plus size={14} /></button>
                </div>
              ))}
            </div>
            <div className="text-[12px] font-semibold uppercase tracking-wide text-muted">Variants</div>
            <div className="grid grid-cols-[1fr_1fr_1fr_80px_80px_80px_80px_60px] gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
              <span>SKU</span><span>Color</span><span>Size</span><span>Costing</span><span>Wholesale</span><span>Retail</span><span>MRP</span><span>Alert</span>
            </div>
            {editP.variants.map((v, i) => (
              <div key={v.id} className="grid grid-cols-[1fr_1fr_1fr_80px_80px_80px_80px_60px] items-center gap-2">
                <input className={inp} value={v.sku} onChange={(e) => setEditVariant(i, { sku: e.target.value })} />
                <select className={inp} value={v.colorId ?? ""} onChange={(e) => setEditVariant(i, { colorId: e.target.value })}>
                  <option value="">Color…</option>{cfg.colors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select className={inp} value={v.sizeId ?? ""} onChange={(e) => setEditVariant(i, { sizeId: e.target.value })}>
                  <option value="">Size…</option>{cfg.sizes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <input type="number" className={inp} value={v.costPrice || ""} onChange={(e) => setEditVariant(i, { costPrice: e.target.value })} />
                <input type="number" className={inp} value={v.wholesalePrice ?? ""} onChange={(e) => setEditVariant(i, { wholesalePrice: e.target.value })} />
                <input type="number" className={inp} value={v.salePrice || ""} onChange={(e) => setEditVariant(i, { salePrice: e.target.value })} />
                <input type="number" className={inp} value={v.mrp ?? ""} onChange={(e) => setEditVariant(i, { mrp: e.target.value })} />
                <input type="number" className={inp} title="Stock alert quantity" value={v.reorderLevel ?? 0} onChange={(e) => setEditVariant(i, { reorderLevel: Number(e.target.value) || 0 })} />
              </div>
            ))}
            <div className="flex gap-1 text-[12px]">
              <button className="font-semibold text-tealdark" onClick={async () => { const id = await quickAdd("color"); if (id) loadCfg(); }}>+ Add color</button>
              <span className="text-muted">·</span>
              <button className="font-semibold text-tealdark" onClick={async () => { const id = await quickAdd("size"); if (id) loadCfg(); }}>+ Add size</button>
            </div>
            {editErr && <div className="rounded-md bg-redsoft px-3 py-2 text-[12px] font-semibold text-red">{editErr}</div>}
            <button className="btn btn-primary w-full" disabled={busy} onClick={saveEdit}>{busy ? "Updating…" : "Update Now"}</button>
          </div>
        </div>
      )}

      {/* ── Create ── */}
      {show && cfg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShow(false)}>
          <div className="card max-h-[90vh] w-full max-w-4xl space-y-3 overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h3 className="font-bold">New product</h3><button onClick={() => setShow(false)}><X size={17} /></button></div>
            <input className={inp} placeholder="Product name — e.g. Redmi Note 13" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <select className={inp} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="SERIALIZED">Phone / IMEI tracked</option>
                <option value="STANDARD">Accessory / quantity tracked</option>
              </select>
              {([
                ["brandId", "Brand…", "brand", cfg.brands],
                ["categoryId", "Category…", "category", cfg.categories],
                ["warrantyPolicyId", "Warranty…", "warranty", cfg.warranties],
              ] as const).map(([field, ph, kind, list]) => (
                <div key={field} className="flex gap-1">
                  <select className={inp} value={form[field]} onChange={(e) => setForm({ ...form, [field]: e.target.value })}>
                    <option value="">{ph}</option>{list.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                  </select>
                  <button className="btn btn-ghost px-2" title={`Add ${kind}`}
                    onClick={async () => { const id = await quickAdd(kind); if (id) setForm((f) => ({ ...f, [field]: id })); }}><Plus size={14} /></button>
                </div>
              ))}
            </div>
            <div className="text-[12px] font-semibold uppercase tracking-wide text-muted">Variants</div>
            <div className="grid grid-cols-[1fr_1fr_1fr_75px_75px_75px_75px_auto] gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
              <span>SKU</span><span>Color</span><span>Size</span><span>Costing</span><span>Wholesale</span><span>Retail</span><span>MRP</span><span />
            </div>
            {variants.map((v, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_1fr_75px_75px_75px_75px_auto] items-center gap-2">
                <input className={inp} placeholder="SKU" value={v.sku} onChange={(e) => setVariants((vs) => vs.map((x, j) => j === i ? { ...x, sku: e.target.value } : x))} />
                <select className={inp} value={v.colorId} onChange={(e) => setVariants((vs) => vs.map((x, j) => j === i ? { ...x, colorId: e.target.value } : x))}>
                  <option value="">Color…</option>{cfg.colors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select className={inp} value={v.sizeId} onChange={(e) => setVariants((vs) => vs.map((x, j) => j === i ? { ...x, sizeId: e.target.value } : x))}>
                  <option value="">Size…</option>{cfg.sizes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <input type="number" className={inp} placeholder="Cost" value={v.costPrice || ""} onChange={(e) => setVariants((vs) => vs.map((x, j) => j === i ? { ...x, costPrice: Number(e.target.value) } : x))} />
                <input type="number" className={inp} placeholder="Whole" value={v.wholesalePrice || ""} onChange={(e) => setVariants((vs) => vs.map((x, j) => j === i ? { ...x, wholesalePrice: Number(e.target.value) } : x))} />
                <input type="number" className={inp} placeholder="Retail" value={v.salePrice || ""} onChange={(e) => setVariants((vs) => vs.map((x, j) => j === i ? { ...x, salePrice: Number(e.target.value) } : x))} />
                <input type="number" className={inp} placeholder="MRP" value={v.mrp || ""} onChange={(e) => setVariants((vs) => vs.map((x, j) => j === i ? { ...x, mrp: Number(e.target.value) } : x))} />
                <button className="text-muted hover:text-red" onClick={() => setVariants((vs) => vs.filter((_, j) => j !== i))}><X size={15} /></button>
              </div>
            ))}
            <button className="text-[12px] font-semibold text-tealdark" onClick={() => setVariants((vs) => [...vs, { sku: "", colorId: "", sizeId: "", costPrice: 0, wholesalePrice: 0, salePrice: 0, mrp: 0 }])}>+ Add variant</button>
            {err && <div className="rounded-md bg-redsoft px-3 py-2 text-[12px] font-semibold text-red">{err}</div>}
            <button className="btn btn-primary w-full" onClick={save}>Save product</button>
          </div>
        </div>
      )}
    </div>
  );
}
