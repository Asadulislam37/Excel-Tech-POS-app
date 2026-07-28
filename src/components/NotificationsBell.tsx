"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, RefreshCw, ShoppingBag, Undo2, PackageX, CheckCircle2 } from "lucide-react";

type Note = { id: string; type: "order" | "return" | "stock"; title: string; detail: string; href: string; time?: string };

const ICON = {
  order: { Icon: ShoppingBag, bg: "#dbeafe", fg: "#1d4ed8" },
  return: { Icon: Undo2, bg: "#fee2e2", fg: "#b91c1c" },
  stock: { Icon: PackageX, bg: "#ffedd5", fg: "#c2410c" },
} as const;

const ago = (iso?: string) => {
  if (!iso) return "";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

export default function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/notifications");
      if (r.ok) setItems((await r.json()).items ?? []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const count = items.length;

  return (
    <div className="relative" ref={ref}>
      <button
        className="btn btn-ghost relative px-2.5"
        title="Notifications"
        onClick={() => { setOpen((o) => !o); if (!open) load(); }}
      >
        <Bell size={17} />
        {count > 0 && (
          <span className="absolute -right-1 -top-1 flex items-center justify-center rounded-full bg-red px-1 text-[10px] font-bold text-white" style={{ height: 18, minWidth: 18 }}>
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="card absolute right-0 top-11 z-50 w-80 p-0 shadow-lg">
          <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
            <h3 className="text-[13px] font-bold">Updates</h3>
            <button className="text-muted hover:text-body" title="Refresh" onClick={load}>
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-muted">
                <CheckCircle2 size={26} className="text-teal" />
                <div className="text-[13px] font-semibold">You&apos;re all caught up</div>
                <div className="text-[11px]">New orders, returned parcels and low stock show up here.</div>
              </div>
            ) : (
              items.map((n) => {
                const { Icon, bg, fg } = ICON[n.type];
                return (
                  <Link key={n.id} href={n.href} onClick={() => setOpen(false)}
                    className="flex items-start gap-3 border-b border-line px-3 py-2.5 last:border-0 hover:bg-paper">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ background: bg }}>
                      <Icon size={15} style={{ color: fg }} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-semibold leading-snug">{n.title}</div>
                      <div className="truncate text-[12px] text-muted">{n.detail}</div>
                      {n.time && <div className="mt-0.5 text-[11px] text-muted">{ago(n.time)}</div>}
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
