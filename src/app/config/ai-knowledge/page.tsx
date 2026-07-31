"use client";

import { useEffect, useState } from "react";
import { GraduationCap, Check, MessageSquare } from "lucide-react";
import AgentChat from "@/components/AgentChat";

const PLACEHOLDER = `Write anything you want the AI to know — in Bangla, English, or Banglish. For example:

DELIVERY: Inside Dhaka 80 taka, outside Dhaka 120 taka. Delivery takes 1–3 days via Steadfast courier. Cash on delivery available.

PAYMENT: bKash / Nagad: 01829789998 (personal). Or cash on delivery.

WARRANTY: All official phones have official warranty. Accessories 7-day replacement if defective.

SHOP: Excel Tech, Shyamoli Square Shopping Mall, Dhaka. Open 10am–9pm, closed Friday morning.

EMI: EMI available in-store for phones above 20000 taka.

FAQ:
- "Original?" → Yes, all our products are 100% original / official.
- "Delivery outside Dhaka?" → Yes, all over Bangladesh.
- Bargaining → Prices are mostly fixed, but say you'll try your best for a good price.

TONE: Always be polite, call customers "vai/apu". Never promise a discount without checking with staff.`;

export default function AiKnowledgePage() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/settings").then(async (r) => {
      if (r.ok) setText((await r.json()).knowledge ?? "");
      setLoading(false);
    });
  }, []);

  const save = async () => {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ knowledge: text }),
      });
      if (res.ok) {
        setText((await res.json()).knowledge ?? "");
        setMsg("Saved — the AI will use this from the next message.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-bold"><GraduationCap size={18} /> Train AI Chatbot</h1>
        <p className="mt-1 text-[13px] text-muted">
          Teach the AI about your shop. Write your delivery info, warranty, payment, policies, and common
          answers here. The AI reads this in <b>every</b> conversation (website, Messenger, WhatsApp,
          Instagram). Changes apply <b>instantly</b> — no coding. Live product prices &amp; stock still come
          from your POS automatically; this is for everything else.
        </p>
      </div>

      <div className="card space-y-3 p-5">
        {loading ? (
          <div className="py-8 text-center text-sm text-muted">Loading…</div>
        ) : (
          <>
            <label className="block text-[12px] font-semibold text-muted">Shop knowledge / instructions</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={PLACEHOLDER}
              rows={20}
              maxLength={12000}
              className="input w-full resize-y font-mono text-[12.5px] leading-relaxed"
            />
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted">{text.length} / 12000 characters</span>
              {msg && (
                <span className="flex items-center gap-1.5 text-[12px] font-semibold text-tealdark">
                  <Check size={14} /> {msg}
                </span>
              )}
            </div>
            <button className="btn btn-primary" disabled={busy} onClick={save}>
              {busy ? "Saving…" : "Save & train"}
            </button>
          </>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-line px-4 py-3">
          <div className="flex items-center gap-2 text-[14px] font-semibold"><MessageSquare size={15} /> Talk to your chatbot (test it)</div>
          <p className="mt-0.5 text-[12px] text-muted">
            Chat here exactly like a customer would, to check it answers correctly. <b>Save your knowledge above first</b>, then test — it uses your live products + what you trained.
          </p>
        </div>
        <AgentChat
          endpoint="/api/shop/agent"
          className="h-[440px]"
          greeting="Test me like a customer! Ask about products, price, delivery, warranty — anything you trained me on."
          suggestions={["ki ki phone ache?", "delivery charge koto?", "10000 er moddhe phone?"]}
        />
      </div>

      <div className="card p-5 text-[12.5px] text-body">
        <div className="mb-2 font-semibold">Tips for good training</div>
        <ul className="list-disc space-y-1 pl-5 text-muted">
          <li>Write short, clear facts — like notes. Bullet points work great.</li>
          <li>Cover the questions customers ask most (delivery, warranty, original or not, EMI, payment).</li>
          <li>Update it whenever something changes (new offer, holiday, new policy).</li>
          <li>Don&apos;t put live prices/stock here — the AI already reads those from your POS.</li>
          <li>You can write in Bangla, English, or Banglish — the AI understands all three.</li>
        </ul>
      </div>
    </div>
  );
}
