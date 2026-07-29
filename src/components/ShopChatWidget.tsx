"use client";

import { useState } from "react";
import { MessageCircle, X } from "lucide-react";
import AgentChat from "@/components/AgentChat";

// Floating "chat with us" widget for the public storefront. Talks to the same
// agent core that (later) powers Facebook Messenger and WhatsApp.
export default function ShopChatWidget() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-4 z-50 flex h-[70vh] max-h-[560px] w-[92vw] max-w-sm flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-2xl sm:right-6">
          <div className="flex items-center gap-2 bg-teal px-4 py-3 text-white">
            <div>
              <div className="text-[14px] font-bold leading-tight">Excel Tech Assistant</div>
              <div className="text-[11px] opacity-90">Ask about products, price &amp; stock</div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="ml-auto opacity-90 hover:opacity-100"
              aria-label="Close chat"
            >
              <X size={18} />
            </button>
          </div>
          <AgentChat
            endpoint="/api/shop/agent"
            className="min-h-0 flex-1"
            greeting="Hi! Ask me about any product — price, colours, stock — or place an order. English, বাংলা, or 中文।"
            suggestions={["Do you have iPhone 16 cases?", "Show me power banks", "ভালো ইয়ারবাড আছে?"]}
          />
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-5 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-teal text-white shadow-xl transition hover:scale-105 sm:right-6"
        aria-label="Chat with us"
      >
        {open ? <X size={22} /> : <MessageCircle size={24} />}
      </button>
    </>
  );
}
