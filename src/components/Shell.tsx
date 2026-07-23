"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV, NavGroup, NavLeaf } from "@/lib/nav";
import {
  LayoutDashboard, ScanBarcode, Boxes, ShoppingCart, ClipboardList, FileText,
  RefreshCcw, PackagePlus, Users, MessageSquare, Calculator, ShieldCheck,
  CalendarClock, Gift, Settings, BarChart3, ChevronDown, Menu, X, Store, Globe,
} from "lucide-react";

const ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  LayoutDashboard, ScanBarcode, Boxes, ShoppingCart, ClipboardList, FileText,
  RefreshCcw, PackagePlus, Users, MessageSquare, Calculator, ShieldCheck,
  CalendarClock, Gift, Settings, BarChart3, Globe,
};

function isGroup(item: (typeof NAV)[number]): item is NavGroup {
  return (item as NavGroup).children !== undefined;
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/shop")) return <>{children}</>;
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [mobileOpen, setMobileOpen] = useState(false);

  const leaf = (l: NavLeaf, indent = false) => {
    const active = pathname === l.href;
    return (
      <Link
        key={l.href}
        href={l.href}
        onClick={() => setMobileOpen(false)}
        className={`flex items-center justify-between rounded-md px-3 py-1.5 text-[13px] transition-colors ${
          indent ? "ml-7" : ""
        } ${active ? "bg-teal text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"}`}
      >
        <span>{l.label}</span>
        {!l.built && l.phase && (
          <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-slate-400">P{l.phase}</span>
        )}
      </Link>
    );
  };

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 shrink-0 overflow-y-auto bg-ink px-3 py-4 transition-transform lg:static lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-5 flex items-center gap-2.5 px-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal">
            <Store size={18} className="text-white" />
          </div>
          <div>
            <div className="text-[15px] font-bold leading-tight text-white">PulsePOS</div>
            <div className="text-[11px] text-slate-400">Excel Tech · Shyamoli</div>
          </div>
          <button className="ml-auto text-slate-400 lg:hidden" onClick={() => setMobileOpen(false)}>
            <X size={18} />
          </button>
        </div>

        <nav className="space-y-0.5">
          {NAV.map((item) => {
            if (!isGroup(item)) {
              const Icon = ICONS[item.icon];
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium ${
                    active ? "bg-teal text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {Icon && <Icon size={16} />}
                  {item.label}
                </Link>
              );
            }
            const Icon = ICONS[item.icon];
            const expanded = open[item.label] ?? item.children.some((c) => pathname.startsWith(c.href) && c.href !== "/");
            return (
              <div key={item.label}>
                <button
                  onClick={() => setOpen((o) => ({ ...o, [item.label]: !expanded }))}
                  className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium text-slate-300 hover:bg-white/5 hover:text-white"
                >
                  {Icon && <Icon size={16} />}
                  {item.label}
                  <ChevronDown size={14} className={`ml-auto transition-transform ${expanded ? "rotate-180" : ""}`} />
                </button>
                {expanded && <div className="mb-1 space-y-0.5">{item.children.map((c) => leaf(c, true))}</div>}
              </div>
            );
          })}
        </nav>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-card px-4">
          <button className="lg:hidden" onClick={() => setMobileOpen(true)}>
            <Menu size={20} />
          </button>
          <div className="text-[13px] text-muted">
            {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </div>
          <div className="ml-auto flex items-center gap-3">
            <Link href="/sales/pos" className="btn btn-primary h-9">
              <ShoppingCart size={15} /> New Invoice
            </Link>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-tealsoft text-[12px] font-bold text-tealdark">
              AS
            </div>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
