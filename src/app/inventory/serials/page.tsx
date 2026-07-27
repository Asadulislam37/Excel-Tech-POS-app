"use client";

import { useCallback, useEffect, useState } from "react";
import { ScanBarcode } from "lucide-react";

type Row = { id: string; sku: string; name: string; type: string; brand: string; variant: string; stock: number };

export default function SerialManage() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [picked, setPicked] = useState<Row | null>(null);
  const [serialText, setSerialText] = useState("");
  const [costPrice, setCostPrice] = useState<number | "">("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // Search across the whole catalogue — phones only.
  const search = useCallback(async () => {
    const params = new URLSearchParams({ type: "SERIALIZED", q });
    const res = await fetch(`/api/stock-entry?${params}`);
    if (res.ok) setRows((await res.json()).rows);
  }, [q]);

  useEffect(() => { const t = setTimeout(search, 250); return () => clearTimeout(t); }, [search]);

  const serials = serialText.split(/\r?\n|,/).map((s) => s.trim()).filter(Boolean);

  const submit = async () => {
    if (!picked) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/serials", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId: picked.id, serials, costPrice: costPrice || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMsg({ ok: true, text: `${data.added} unit(s) added to ${picked.name}.` });
      setSerialText("");
      search();
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "Failed." }); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-3">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-bold"><ScanBarcode size={20} className="text-tealdark" /> Serial Number Manage</h1>
        <p className="text-[13px] text-muted">Stock in IMEI/serial numbers for a phone. Each serial becomes a trackable unit. For purchases with supplier dues, use the Purchase screen.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
        <div className="card overflow-hidden">
          <div className="p-3">
            <input className="input" placeholder="Search phone by name or SKU…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="max-h-[520px] overflow-y-auto">
            <table className="w-full">
              <thead><tr><th className="th">SKU</th><th className="th">Product</th><th className="th">Brand</th><th className="th text-right">In stock</th><th className="th" /></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={picked?.id === r.id ? "bg-tealsoft/50" : ""}>
                    <td className="td font-mono text-[12px]">{r.sku}</td>
                    <td className="td font-semibold">{r.name}{r.variant && <span className="ml-1 text-[11px] font-normal text-muted">{r.variant}</span>}</td>
                    <td className="td">{r.brand || "—"}</td>
                    <td className="td text-right"><span className={`rounded px-2 py-0.5 text-[11px] font-bold ${r.stock === 0 ? "bg-redsoft text-red" : "bg-tealsoft text-tealdark"}`}>{r.stock}</span></td>
                    <td className="td text-right">
                      <button className="btn btn-ghost py-1 text-[12px]" onClick={() => { setPicked(r); setMsg(null); }}>Select</button>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={5} className="td py-10 text-center text-muted">No phones match — try another search.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card h-fit space-y-3 p-4">
          <h2 className="font-bold">Add IMEIs</h2>
          {picked ? (
            <div className="rounded-lg bg-paper p-3">
              <div className="font-semibold">{picked.name}</div>
              <div className="font-mono text-[12px] text-muted">{picked.sku} · currently {picked.stock} in stock</div>
            </div>
          ) : (
            <div className="rounded-lg bg-ambersoft px-3 py-2 text-[12px] font-semibold text-amber">Pick a phone from the list first.</div>
          )}
          <textarea className="input min-h-48 font-mono text-[13px]" placeholder={"One IMEI per line — scan straight into this box:\n356938104263201\n356938104263202"}
            value={serialText} onChange={(e) => setSerialText(e.target.value)} />
          <div className="text-[12px] text-muted">{serials.length} serial{serials.length === 1 ? "" : "s"} ready</div>
          <input type="number" className="input" placeholder="Unit cost price (optional)" value={costPrice}
            onChange={(e) => setCostPrice(e.target.value ? Number(e.target.value) : "")} />
          {msg && <div className={`rounded-md px-3 py-2 text-[12px] font-semibold ${msg.ok ? "bg-tealsoft text-tealdark" : "bg-redsoft text-red"}`}>{msg.text}</div>}
          <button className="btn btn-primary w-full" disabled={busy || !picked || serials.length === 0} onClick={submit}>
            {busy ? "Adding…" : `Add ${serials.length || ""} to stock`}
          </button>
        </div>
      </div>
    </div>
  );
}
