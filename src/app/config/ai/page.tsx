"use client";

import { useEffect, useState } from "react";
import { Bot, Check, Globe } from "lucide-react";

type Sourcing = { rate: number; shipping: number; profit: number; round: number };

export default function AiSettingsPage() {
  const [preorder, setPreorder] = useState(false);
  const [src, setSrc] = useState<Sourcing>({ rate: 18, shipping: 50, profit: 250, round: 10 });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/settings").then(async (r) => {
      if (r.ok) {
        const d = await r.json();
        setPreorder(!!d.preorder);
        if (d.sourcing) setSrc(d.sourcing);
      }
      setLoading(false);
    });
  }, []);

  const togglePreorder = async () => {
    const next = !preorder;
    setBusy(true); setMsg(""); setErr("");
    try {
      const res = await fetch("/api/settings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preorder: next }),
      });
      if (res.ok) { setPreorder(!!(await res.json()).preorder); setMsg("Saved."); }
    } finally { setBusy(false); }
  };

  const saveSourcing = async () => {
    setBusy(true); setMsg(""); setErr("");
    try {
      const res = await fetch("/api/settings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourcing: src }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSrc(data.sourcing);
      setMsg("Sourcing settings saved.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save.");
    } finally { setBusy(false); }
  };

  // Live preview using the ¥15 example.
  const raw = 15 * src.rate + Number(src.shipping) + Number(src.profit);
  const step = Number(src.round) > 0 ? Number(src.round) : 1;
  const preview = Math.ceil(raw / step) * step;
  const num = (v: number) => (Number.isFinite(v) ? v : 0);

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-bold"><Bot size={18} /> AI Assistant, Pre-orders & Sourcing</h1>
        <p className="text-[13px] text-muted">Settings for the AI sales agent on your website, Messenger, and WhatsApp.</p>
      </div>

      {/* Pre-orders */}
      <div className="card space-y-4 p-5">
        {loading ? (
          <div className="py-8 text-center text-sm text-muted">Loading…</div>
        ) : (
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[14px] font-semibold">Allow pre-orders</div>
              <p className="mt-0.5 text-[12px] text-muted">
                When on, the AI can take orders for <b>out-of-stock</b> items — the customer orders now and
                you fulfil when you restock. They appear in <b>Online Orders</b> tagged “⏳ PRE-ORDER”.
              </p>
            </div>
            <button
              role="switch" aria-checked={preorder} disabled={busy} onClick={togglePreorder}
              className={`relative mt-1 h-6 w-11 shrink-0 rounded-full transition-colors ${preorder ? "bg-teal" : "bg-line"}`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${preorder ? "left-[22px]" : "left-0.5"}`} />
            </button>
          </div>
        )}
      </div>

      {/* Sourcing calculator */}
      {!loading && (
        <div className="card space-y-4 p-5">
          <div>
            <div className="flex items-center gap-2 text-[14px] font-semibold"><Globe size={15} /> Taobao / Pinduoduo sourcing price</div>
            <p className="mt-0.5 text-[12px] text-muted">
              How the AI turns a Chinese Yuan (¥) cost into a customer price:
              <br /><b>(¥ × rate) + shipping + profit</b>, then rounded up to a clean number.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-[12px] font-semibold text-muted">Exchange rate (৳ per ¥1)
              <input type="number" min={0} step="0.01" className="input mt-1" value={src.rate}
                onChange={(e) => setSrc({ ...src, rate: num(Number(e.target.value)) })} />
            </label>
            <label className="block text-[12px] font-semibold text-muted">Shipping per item (৳)
              <input type="number" min={0} className="input mt-1" value={src.shipping}
                onChange={(e) => setSrc({ ...src, shipping: num(Number(e.target.value)) })} />
            </label>
            <label className="block text-[12px] font-semibold text-muted">Profit per item (৳)
              <input type="number" min={0} className="input mt-1" value={src.profit}
                onChange={(e) => setSrc({ ...src, profit: num(Number(e.target.value)) })} />
            </label>
            <label className="block text-[12px] font-semibold text-muted">Round up to nearest (৳)
              <input type="number" min={1} className="input mt-1" value={src.round}
                onChange={(e) => setSrc({ ...src, round: num(Number(e.target.value)) })} />
            </label>
          </div>

          <div className="rounded-md bg-paper px-3 py-2 text-[12px] text-body">
            Example: <b>¥15</b> → ¥15 × {src.rate || 0} = ৳{Math.round(15 * (Number(src.rate) || 0))} + ৳{num(Number(src.shipping))} + ৳{num(Number(src.profit))} = ৳{Math.round(raw)} → <b>৳{preview}</b>
          </div>

          {err && <div className="rounded-md bg-redsoft px-3 py-2 text-[12px] font-semibold text-red">{err}</div>}
          {msg && <div className="flex items-center gap-1.5 rounded-md bg-tealsoft px-3 py-2 text-[12px] font-semibold text-tealdark"><Check size={14} /> {msg}</div>}
          <button className="btn btn-primary" disabled={busy} onClick={saveSourcing}>{busy ? "Saving…" : "Save sourcing settings"}</button>
        </div>
      )}
    </div>
  );
}
