"use client";

import { useEffect, useState } from "react";
import { Bot, Check } from "lucide-react";

export default function AiSettingsPage() {
  const [preorder, setPreorder] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/settings").then(async (r) => {
      if (r.ok) setPreorder(!!(await r.json()).preorder);
      setLoading(false);
    });
  }, []);

  const toggle = async () => {
    const next = !preorder;
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preorder: next }),
      });
      if (res.ok) {
        setPreorder(!!(await res.json()).preorder);
        setMsg("Saved.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-bold"><Bot size={18} /> AI Assistant & Pre-orders</h1>
        <p className="text-[13px] text-muted">Settings for the AI sales agent on your website, Messenger, and WhatsApp.</p>
      </div>

      <div className="card space-y-4 p-5">
        {loading ? (
          <div className="py-8 text-center text-sm text-muted">Loading…</div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[14px] font-semibold">Allow pre-orders</div>
                <p className="mt-0.5 text-[12px] text-muted">
                  When on, the AI can take orders for <b>out-of-stock</b> items — the customer orders now
                  and you fulfil it when you restock. Pre-orders appear in <b>Online Orders</b> tagged
                  “⏳ PRE-ORDER”. When off, the AI tells customers the item is unavailable.
                </p>
              </div>
              <button
                role="switch"
                aria-checked={preorder}
                disabled={busy}
                onClick={toggle}
                className={`relative mt-1 h-6 w-11 shrink-0 rounded-full transition-colors ${
                  preorder ? "bg-teal" : "bg-line"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                    preorder ? "left-[22px]" : "left-0.5"
                  }`}
                />
              </button>
            </div>
            {msg && (
              <div className="flex items-center gap-1.5 rounded-md bg-tealsoft px-3 py-2 text-[12px] font-semibold text-tealdark">
                <Check size={14} /> {msg}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
