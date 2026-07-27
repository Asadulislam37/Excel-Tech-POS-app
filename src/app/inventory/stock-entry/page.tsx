"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ScanBarcode, Save } from "lucide-react";

type Named = { id: string; name: string };
type Row = {
  id: string; sku: string; name: string; type: string; brand: string; category: string;
  variant: string; costing: number; stock: number;
};

export default function StockEntryPage() {
  const [q, setQ] = useState("");
  const [fCat, setFCat] = useState("");
  const [fBrand, setFBrand] = useState("");
  const [fType, setFType] = useState("STANDARD");
  const [mode, setMode] = useState<"set" | "add">("set");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [cfg, setCfg] = useState<{ brands: Named[]; categories: Named[] } | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ q, page: String(page) });
    if (fCat) params.set("categoryId", fCat);
    if (fBrand) params.set("brandId", fBrand);
    if (fType) params.set("type", fType);
    const res = await fetch(`/api/stock-entry?${params}`);
    if (res.ok) { const d = await res.json(); setRows(d.rows); setTotal(d.total); }
  }, [q, fCat, fBrand, fType, page]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  useEffect(() => { setPage(1); }, [q, fCat, fBrand, fType]);
  useEffect(() => { fetch("/api/config").then(async (r) => r.ok && setCfg(await r.json())); }, []);

  const pending = Object.entries(draft).filter(([, v]) => v.trim() !== "");

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/stock-entry", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, entries: pending.map(([variantId, quantity]) => ({ variantId, quantity: Number(quantity) })) }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setDraft({});
      setMsg({
        ok: true,
        text: `${d.updated} product${d.updated === 1 ? "" : "s"} updated.` +
          (d.skipped?.length ? ` ${d.skipped.length} IMEI-tracked item(s) skipped — use Serial Number Manage for those.` : ""),
      });
      load();
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "Failed." }); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold">Stock Entry</h1>
          <p className="text-[13px] text-muted">Type quantities and save — every change is written to the stock ledger.</p>
        </div>
        <Link href="/inventory/serials" className="btn btn-ghost"><ScanBarcode size={15} /> IMEI stock in</Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input className="input w-52" placeholder="Search product or SKU…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input w-40" value={fCat} onChange={(e) => setFCat(e.target.value)}>
          <option value="">All categories</option>
          {cfg?.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="input w-40" value={fBrand} onChange={(e) => setFBrand(e.target.value)}>
          <option value="">All brands</option>
          {cfg?.brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select className="input w-44" value={fType} onChange={(e) => setFType(e.target.value)}>
          <option value="STANDARD">Accessories (quantity)</option>
          <option value="SERIALIZED">Phones (IMEI)</option>
          <option value="">All types</option>
        </select>
        <select className="input w-44" value={mode} onChange={(e) => setMode(e.target.value as "set" | "add")}>
          <option value="set">Set opening stock to</option>
          <option value="add">Add to current stock</option>
        </select>
      </div>

      {fType === "SERIALIZED" && (
        <div className="rounded-md bg-tealsoft px-3 py-2 text-[12px] font-semibold text-tealdark">
          Phones are IMEI-tracked — each unit needs its serial number. Use <Link href="/inventory/serials" className="underline">Serial Number Manage</Link> or the Purchase screen to stock them in.
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[820px]">
          <thead><tr>
            <th className="th">SL.</th><th className="th">SKU</th><th className="th">Category</th><th className="th">Brand</th>
            <th className="th">Product Name</th><th className="th text-right">Current</th>
            <th className="th text-right w-40">{mode === "set" ? "Set to" : "Add"}</th>
          </tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} className={draft[r.id]?.trim() ? "bg-tealsoft/40" : ""}>
                <td className="td">{(page - 1) * 50 + i + 1}</td>
                <td className="td font-mono text-[12px]">{r.sku}</td>
                <td className="td">{r.category || "—"}</td>
                <td className="td">{r.brand || "—"}</td>
                <td className="td font-semibold">
                  {r.type === "SERIALIZED" && <ScanBarcode size={13} className="mr-1 inline text-tealdark" />}
                  {r.name}{r.variant && <span className="ml-1 text-[11px] font-normal text-muted">{r.variant}</span>}
                </td>
                <td className="td text-right">
                  <span className={`rounded px-2 py-0.5 text-[11px] font-bold ${r.stock === 0 ? "bg-redsoft text-red" : "bg-tealsoft text-tealdark"}`}>{r.stock}</span>
                </td>
                <td className="td text-right">
                  {r.type === "SERIALIZED"
                    ? <Link href="/inventory/serials" className="text-[12px] font-semibold text-tealdark underline">Add IMEIs</Link>
                    : <input type="number" min={0} className="input text-right" placeholder="—"
                        value={draft[r.id] ?? ""} onChange={(e) => setDraft((d) => ({ ...d, [r.id]: e.target.value }))} />}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="td py-10 text-center text-muted">No products match this filter.</td></tr>}
          </tbody>
        </table>
      </div>

      {msg && <div className={`rounded-md px-3 py-2 text-[12px] font-semibold ${msg.ok ? "bg-tealsoft text-tealdark" : "bg-redsoft text-red"}`}>{msg.text}</div>}

      <div className="sticky bottom-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-card p-3 shadow-lg">
        <span className="text-[12px] text-muted">
          {total} products · page {page} of {Math.max(1, Math.ceil(total / 50))}
          {pending.length > 0 && <strong className="ml-2 text-tealdark">{pending.length} pending change{pending.length === 1 ? "" : "s"}</strong>}
        </span>
        <div className="flex gap-2">
          <button className="btn btn-ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>‹ Prev</button>
          <button className="btn btn-ghost" disabled={page >= Math.ceil(total / 50)} onClick={() => setPage((p) => p + 1)}>Next ›</button>
          <button className="btn btn-primary" disabled={busy || pending.length === 0} onClick={save}>
            <Save size={15} /> {busy ? "Saving…" : `Save ${pending.length || ""} change${pending.length === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
