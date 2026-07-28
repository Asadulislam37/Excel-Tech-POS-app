"use client";

import { useEffect, useState } from "react";
import { Truck, Check } from "lucide-react";

export default function DeliveryConfigPage() {
  const [inside, setInside] = useState("");
  const [outside, setOutside] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/settings").then(async (r) => {
      if (r.ok) {
        const { delivery } = await r.json();
        setInside(String(delivery.insideDhaka));
        setOutside(String(delivery.outsideDhaka));
      }
      setLoading(false);
    });
  }, []);

  const save = async () => {
    setBusy(true); setMsg(""); setErr("");
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delivery: { insideDhaka: Number(inside), outsideDhaka: Number(outside) } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setInside(String(data.delivery.insideDhaka));
      setOutside(String(data.delivery.outsideDhaka));
      setMsg("Delivery charges saved.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-bold"><Truck size={18} /> Delivery Charge</h1>
        <p className="text-[13px] text-muted">
          Shop-wide delivery charges. Used as the default when sending a parcel to Steadfast (added to COD)
          and as the delivery fee on your online store checkout.
        </p>
      </div>

      <div className="card space-y-4 p-5">
        {loading ? (
          <div className="py-8 text-center text-sm text-muted">Loading…</div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-[12px] font-semibold text-muted">Inside Dhaka (৳)
                <input type="number" min={0} className="input mt-1" value={inside} placeholder="80"
                  onChange={(e) => setInside(e.target.value)} />
              </label>
              <label className="block text-[12px] font-semibold text-muted">Outside Dhaka (৳)
                <input type="number" min={0} className="input mt-1" value={outside} placeholder="120"
                  onChange={(e) => setOutside(e.target.value)} />
              </label>
            </div>
            {err && <div className="rounded-md bg-redsoft px-3 py-2 text-[12px] font-semibold text-red">{err}</div>}
            {msg && <div className="flex items-center gap-1.5 rounded-md bg-tealsoft px-3 py-2 text-[12px] font-semibold text-tealdark"><Check size={14} /> {msg}</div>}
            <button className="btn btn-primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save changes"}</button>
          </>
        )}
      </div>
    </div>
  );
}
