"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Plus, Search, Trash2 } from "lucide-react";

type Variant = { id: string; sku: string; color?: { name: string } | null; size?: { name: string } | null; stockLevels: { quantity: number; outletId: string }[]; _count: { serialUnits: number } };
type Product = { id: string; name: string; type: "SERIALIZED" | "STANDARD"; variants: Variant[] };
type Outlet = { id: string; name: string };
type Line = { variantId: string; label: string; type: string; quantity: number; serialNos: string[]; available: { id: string; serialNo: string }[] };

export default function StockTransferPage() {
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [fromOutletId, setFromOutletId] = useState("");
  const [toOutletId, setToOutletId] = useState("");
  const [q, setQ] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ transferNo: string } | null>(null);

  useEffect(() => { fetch("/api/config/outlet").then(async (r) => r.ok && setOutlets(await r.json())); }, []);
  const loadProducts = useCallback(async (query: string) => {
    const r = await fetch(`/api/products?q=${encodeURIComponent(query)}`);
    if (r.ok) setProducts(await r.json());
  }, []);
  useEffect(() => { const t = setTimeout(() => loadProducts(q), 250); return () => clearTimeout(t); }, [q, loadProducts]);

  const addProduct = async (p: Product, v: Variant) => {
    if (lines.some((l) => l.variantId === v.id)) return;
    let available: { id: string; serialNo: string }[] = [];
    if (p.type === "SERIALIZED" && fromOutletId) {
      const r = await fetch(`/api/serials?variantId=${v.id}&status=IN_STOCK`);
      available = r.ok ? await r.json() : [];
    }
    setLines((ls) => [...ls, { variantId: v.id, label: `${p.name} — ${[v.color?.name, v.size?.name].filter(Boolean).join(" ") || v.sku}`, type: p.type, quantity: p.type === "SERIALIZED" ? 0 : 1, serialNos: [], available }]);
    setQ("");
  };

  const submit = async () => {
    setErr(""); setBusy(true);
    try {
      const items = lines.filter((l) => l.quantity > 0).map((l) => ({ variantId: l.variantId, quantity: l.quantity, serialNos: l.type === "SERIALIZED" ? l.serialNos : undefined }));
      const res = await fetch("/api/stock-transfer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fromOutletId, toOutletId, note, items }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setDone({ transferNo: d.transferNo });
      setLines([]); setNote("");
    } catch (e) { setErr(e instanceof Error ? e.message : "Transfer failed."); }
    finally { setBusy(false); }
  };

  const valid = fromOutletId && toOutletId && fromOutletId !== toOutletId && lines.length > 0 && lines.every((l) => l.quantity > 0 && (l.type !== "SERIALIZED" || l.serialNos.length === l.quantity));

  if (done) {
    return (
      <div className="mx-auto max-w-md"><div className="card p-8 text-center">
        <CheckCircle2 size={44} className="mx-auto text-teal" />
        <h2 className="mt-3 text-lg font-bold">Stock transferred</h2>
        <div className="mt-1 font-mono text-sm text-muted">{done.transferNo}</div>
        <div className="mt-6 flex justify-center gap-3"><a href="/inventory/transfer-history" className="btn btn-ghost">View history</a><button className="btn btn-primary" onClick={() => setDone(null)}>New transfer</button></div>
      </div></div>
    );
  }

  if (outlets.length < 2) {
    return (
      <div className="mx-auto max-w-md"><div className="card p-8 text-center">
        <h2 className="text-lg font-bold">Add a second outlet first</h2>
        <p className="mt-2 text-[13px] text-muted">Stock transfer moves stock between two outlets. You currently have {outlets.length} outlet. Create another under Configuration → Outlet.</p>
        <a href="/config/outlet" className="btn btn-primary mt-5 inline-flex">Manage Outlets</a>
      </div></div>
    );
  }

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-bold">Stock Transfer</h1>
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div>
          <div className="card p-4">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-2.5 text-muted" />
              <input className="input pl-9" placeholder="Search a product to transfer…" value={q} onChange={(e) => setQ(e.target.value)} disabled={!fromOutletId} />
              {q && (
                <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-line bg-card shadow-lg">
                  {products.flatMap((p) => p.variants.map((v) => {
                    const stock = p.type === "SERIALIZED" ? v._count.serialUnits : (v.stockLevels.find((s) => s.outletId === fromOutletId)?.quantity ?? 0);
                    return (
                      <button key={v.id} disabled={stock === 0} onClick={() => addProduct(p, v)} className="flex w-full items-center justify-between border-b border-line px-3 py-2 text-left text-[13px] last:border-0 hover:bg-paper disabled:opacity-40">
                        <span>{p.name} <span className="text-muted">{[v.color?.name, v.size?.name].filter(Boolean).join(" ") || v.sku}</span></span>
                        <span className="flex items-center gap-2 text-[11px] text-muted">{stock} at source <Plus size={13} /></span>
                      </button>
                    );
                  }))}
                </div>
              )}
            </div>
            {!fromOutletId && <p className="mt-2 text-[12px] text-muted">Choose the source outlet first (on the right).</p>}
          </div>
          {lines.length > 0 && (
            <div className="card mt-3 overflow-x-auto">
              <table className="w-full min-w-[520px]">
                <thead><tr><th className="th">SL.</th><th className="th">Product</th><th className="th text-center">Qty</th><th className="th" /></tr></thead>
                <tbody>
                  {lines.map((l, idx) => (
                    <tr key={l.variantId}>
                      <td className="td">{idx + 1}</td>
                      <td className="td">
                        <div className="font-semibold">{l.label}</div>
                        {l.type === "SERIALIZED" && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {l.available.map((u) => (
                              <button key={u.id} onClick={() => setLines((ls) => ls.map((x, j) => { if (j !== idx) return x; const has = x.serialNos.includes(u.serialNo); const serialNos = has ? x.serialNos.filter((s) => s !== u.serialNo) : [...x.serialNos, u.serialNo]; return { ...x, serialNos, quantity: serialNos.length }; }))} className={`serial-chip ${l.serialNos.includes(u.serialNo) ? "!bg-teal !text-white" : "!bg-white"}`}>{u.serialNo}</button>
                            ))}
                            {l.available.length === 0 && <span className="text-[11px] text-muted">No IMEIs at source</span>}
                          </div>
                        )}
                      </td>
                      <td className="td text-center"><input type="number" min={0} disabled={l.type === "SERIALIZED"} className="input w-20 text-center" value={l.quantity} onChange={(e) => setLines((ls) => ls.map((x, j) => j === idx ? { ...x, quantity: Math.max(0, Number(e.target.value)) } : x))} /></td>
                      <td className="td text-right"><button className="rounded-md bg-red-100 p-2 text-red-700 hover:bg-red-200" onClick={() => setLines((ls) => ls.filter((_, j) => j !== idx))}><Trash2 size={14} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="card h-fit space-y-3 p-4 lg:sticky lg:top-[72px]">
          <h2 className="text-[15px] font-bold">Transfer Details</h2>
          <label className="block text-[12px] font-semibold text-muted">From Outlet *
            <select className="input mt-1" value={fromOutletId} onChange={(e) => { setFromOutletId(e.target.value); setLines([]); }}>
              <option value="">Select source</option>{outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </label>
          <label className="block text-[12px] font-semibold text-muted">To Outlet *
            <select className="input mt-1" value={toOutletId} onChange={(e) => setToOutletId(e.target.value)}>
              <option value="">Select destination</option>{outlets.filter((o) => o.id !== fromOutletId).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </label>
          <label className="block text-[12px] font-semibold text-muted">Note<textarea className="input mt-1 min-h-16" value={note} onChange={(e) => setNote(e.target.value)} /></label>
          {err && <div className="rounded-md bg-redsoft px-3 py-2 text-[12px] font-semibold text-red">{err}</div>}
          <button className="btn btn-primary w-full py-3" disabled={!valid || busy} onClick={submit}>{busy ? "Transferring…" : "Transfer Now"}</button>
        </div>
      </div>
    </div>
  );
}
