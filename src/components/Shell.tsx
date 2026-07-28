"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { NAV, NavGroup, NavLeaf, NavNode, isGroup } from "@/lib/nav";
import ThemeToggle from "@/components/ThemeToggle";
import {
  LayoutDashboard, ScanBarcode, Boxes, ShoppingCart, ClipboardList, FileText,
  RefreshCcw, PackagePlus, Users, MessageSquare, Calculator, ShieldCheck,
  CalendarClock, Gift, Settings, BarChart3, ChevronDown, Menu, X, Store, Globe, LogOut,
  LayoutGrid, FilePlus2, RotateCcw, DollarSign, HandCoins, ArrowUpRight,
} from "lucide-react";

// Header "Quick Access" shortcuts.
const QUICK = [
  { label: "Create Invoice", href: "/sales/pos", icon: FilePlus2 },
  { label: "Create Return", href: "/returns/sale", icon: RotateCcw },
  { label: "Create Expense", href: "/accounting/expense", icon: DollarSign },
  { label: "Collect Due", href: "/accounting/due-collection", icon: HandCoins },
  { label: "Create Purchase", href: "/purchase", icon: ShoppingCart },
  { label: "Supplier Payment", href: "/accounting/supplier-payment", icon: ArrowUpRight },
];

const ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  LayoutDashboard, ScanBarcode, Boxes, ShoppingCart, ClipboardList, FileText,
  RefreshCcw, PackagePlus, Users, MessageSquare, Calculator, ShieldCheck,
  CalendarClock, Gift, Settings, BarChart3, Globe,
};

/** Does this branch contain the page we're on? Used to auto-expand on load. */
function containsPath(node: NavNode, pathname: string): boolean {
  if (isGroup(node)) return node.children.some((c) => containsPath(c, pathname));
  return node.href !== "/" && pathname.startsWith(node.href);
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<{ name: string; role: string } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  // Today's date is time/timezone dependent — rendering it during SSR (UTC on the
  // server) vs the browser (local time) can differ near midnight and cause a
  // hydration mismatch that kills every <Link>'s client navigation. Fill it in
  // only after mount so the server and first client render always agree.
  const [todayStr, setTodayStr] = useState("");
  useEffect(() => {
    setTodayStr(new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }));
  }, []);

  const bare = pathname.startsWith("/shop") || ["/login", "/signup", "/forgot-password", "/reset-password"].includes(pathname);

  useEffect(() => {
    if (bare) return;
    fetch("/api/auth/me").then(async (r) => { if (r.ok) setUser((await r.json()).user); });
  }, [bare, pathname]);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  };

  if (bare) return <>{children}</>;

  const initials = (user?.name ?? "").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "··";

  const leaf = (l: NavLeaf, depth: number) => {
    const active = pathname === l.href;
    return (
      <Link
        key={l.href + l.label}
        href={l.href}
        onClick={() => setMobileOpen(false)}
        style={{ paddingLeft: 12 + depth * 14 }}
        className={`flex items-center justify-between rounded-md py-1.5 pr-3 text-[13px] transition-colors ${
          active ? "bg-teal text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"
        }`}
      >
        <span>{l.label}</span>
        {!l.built && l.phase && (
          <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-slate-400">P{l.phase}</span>
        )}
      </Link>
    );
  };

  /** Sub-groups nest to any depth; the top level is rendered separately for its icon. */
  const node = (n: NavNode, depth: number): React.ReactNode => {
    if (!isGroup(n)) return leaf(n, depth);
    const key = `${depth}:${n.label}`;
    const expanded = open[key] ?? containsPath(n, pathname);
    const Icon = n.icon ? ICONS[n.icon] : undefined;
    return (
      <div key={key}>
        <button
          onClick={() => setOpen((o) => ({ ...o, [key]: !expanded }))}
          style={{ paddingLeft: 12 + depth * 14 }}
          className="flex w-full items-center gap-2 rounded-md py-1.5 pr-3 text-[13px] font-semibold text-slate-200 hover:bg-white/5 hover:text-white"
        >
          {Icon && <Icon size={14} />}
          {n.label}
          <ChevronDown size={13} className={`ml-auto transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
        {expanded && <div className="space-y-0.5">{n.children.map((c) => node(c, depth + 1))}</div>}
      </div>
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
          <Link href="/" onClick={() => setMobileOpen(false)} className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal">
              <Store size={18} className="text-white" />
            </div>
            <div>
              <div className="text-[15px] font-bold leading-tight text-white">Excel Tech POS</div>
              <div className="text-[11px] text-slate-400">Shyamoli Square, Dhaka</div>
            </div>
          </Link>
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
            const expanded = open[item.label] ?? containsPath(item, pathname);
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
                {expanded && <div className="mb-1 space-y-0.5">{item.children.map((c) => node(c, 1))}</div>}
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
          <div className="text-[13px] text-muted" suppressHydrationWarning>{todayStr}</div>
          <div className="ml-auto flex items-center gap-3">
            <Link href="/sales/pos" className="btn btn-primary h-9">
              <ShoppingCart size={15} /> New Invoice
            </Link>

            <ThemeToggle />

            {/* Quick Access */}
            <div className="relative">
              <button className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-body hover:bg-paper"
                title="Quick Access" onClick={() => setQuickOpen((o) => !o)}>
                <LayoutGrid size={17} />
              </button>
              {quickOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setQuickOpen(false)} />
                  <div className="card absolute right-0 top-11 z-40 w-56 p-1 shadow-lg">
                    <div className="px-3 py-2 text-[13px] font-bold">Quick Access</div>
                    <div className="border-t border-line pt-1">
                      {QUICK.map((qa) => (
                        <Link key={qa.href} href={qa.href} onClick={() => setQuickOpen(false)}
                          className="flex items-center gap-3 rounded-md px-3 py-2 text-[13px] font-medium text-body hover:bg-paper">
                          <qa.icon size={15} className="text-tealdark" /> {qa.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="relative">
              <button className="flex items-center gap-2" onClick={() => setMenuOpen((m) => !m)}>
                {user && <div className="hidden text-right sm:block"><div className="text-[13px] font-semibold leading-tight">{user.name}</div><div className="text-[11px] capitalize text-muted">{user.role.toLowerCase()}</div></div>}
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-tealsoft text-[12px] font-bold text-tealdark">{initials}</div>
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                  <div className="card absolute right-0 top-11 z-40 w-48 p-1 shadow-lg">
                    <div className="border-b border-line px-3 py-2">
                      <div className="text-[13px] font-semibold">{user?.name ?? "—"}</div>
                      <div className="text-[11px] text-muted">{user?.role ?? ""}</div>
                    </div>
                    <button className="mt-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[13px] font-semibold text-red hover:bg-redsoft" onClick={logout}>
                      <LogOut size={14} /> Log out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
