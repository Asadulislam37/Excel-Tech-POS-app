"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot } from "lucide-react";

type Turn = { role: "user" | "model"; text: string };

// Reusable chat panel. Posts { messages } to `endpoint` and appends the reply.
// Stateless server side — we keep the running history here and resend it.
export default function AgentChat({
  endpoint,
  greeting,
  placeholder = "Type your message…",
  suggestions = [],
  className = "",
}: {
  endpoint: string;
  greeting?: string;
  placeholder?: string;
  suggestions?: string[];
  className?: string;
}) {
  const [messages, setMessages] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  async function sendText(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setError("");
    const next: Turn[] = [...messages, { role: "user", text: trimmed }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) setError(data?.error || "Something went wrong. Please try again.");
      else setMessages((m) => [...m, { role: "model", text: String(data.reply ?? "") }]);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3">
        {messages.length === 0 && (
          <div className="mx-auto max-w-md py-6 text-center">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-tealsoft">
              <Bot size={20} className="text-tealdark" />
            </div>
            <p className="text-[13px] text-muted">{greeting ?? "Hi! How can I help?"}</p>
            {suggestions.length > 0 && (
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendText(s)}
                    className="rounded-full border border-line bg-card px-3 py-1.5 text-[12px] text-body hover:bg-paper"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed ${
                m.role === "user"
                  ? "rounded-br-sm bg-teal text-white"
                  : "rounded-bl-sm bg-paper text-body"
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}

        {busy && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm bg-paper px-3.5 py-2.5">
              <span className="flex gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted" />
              </span>
            </div>
          </div>
        )}
      </div>

      {error && <div className="px-3 pb-1 text-[12px] text-red">{error}</div>}

      {/* Composer */}
      <div className="flex items-end gap-2 border-t border-line p-2.5">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendText(input);
            }
          }}
          rows={1}
          placeholder={placeholder}
          className="input max-h-28 flex-1 resize-none"
        />
        <button
          onClick={() => sendText(input)}
          disabled={busy || !input.trim()}
          className="btn btn-primary h-9 w-9 shrink-0 p-0"
          aria-label="Send"
        >
          <Send size={15} />
        </button>
      </div>
    </div>
  );
}
