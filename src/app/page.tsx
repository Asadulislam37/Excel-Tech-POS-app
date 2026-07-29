"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { taka, dt } from "@/lib/format";
import NotificationsBell from "@/components/NotificationsBell";
import {
  ArrowDownLeft, ArrowUpRight, Wallet, ReceiptText, Smartphone, TrendingDown,
  HandCoins, FilePlus2, RotateCcw, FileMinus2, CalendarRange, ChevronRight,
} from "lucide-react";

type Dash = {
  todaySales: number; todayTotal: number; todayCollected: number; totalDue: number; phonesInStock: number;
  cashIn: number; cashOut: number; balance: number;
  lowStock: { id: string; sku: string; name: string; stock: number; alert: number }[];
  recent: { id: string; invoiceNo: string; grandTotal: string; dueTotal: string; createdAt: string;
    customer?: { name: string } | null;
    items: { variant: { product: { name: string } } }[] }[];
};

const today = () =>
  new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

// Sets the per-tile tint (--tone-bg / --tone-fg) consumed by .stat / .qa in globals.css.
const tone = (name: string): React.CSSProperties =>
  ({ ["--tone-bg"]: `var(--t-${name}-bg)`, ["--tone-fg"]: `var(--t-${name}-fg)` } as React.CSSProperties);

export default function Dashboard() {
  const [d, setD] = useState<Dash | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    fetch("/api/dashboard").then(async (r) => {
      if (r.ok) setD(await r.json());
      else setErr("Could not load dashboard. Check your DATABASE_URL and run the seed script.");
    }).catch(() => setErr("Could not reach the database. Check your DATABASE_URL in .env."));
  }, []);

  if (err) return <div className="card mx-auto max-w-lg p-6 text-center text-sm text-muted">{err}</div>;
  if (!d) return <div className="py-20 text-center text-sm text-muted">Loading…</div>;

  const kpis = [
    { t: "green",  icon: HandCoins,    label: "Collected Today", value: taka(d.todayCollected), sub: "incl. due collection" },
    { t: "blue",   icon: ReceiptText,  label: "Retail Sale",     value: taka(d.todayTotal),     sub: `${d.todaySales} invoice${d.todaySales === 1 ? "" : "s"}` },
    { t: "amber",  icon: TrendingDown, label: "Total Due",       value: taka(d.totalDue),       sub: "all customers" },
    { t: "purple", icon: Smartphone,   label: "Phones in Stock", value: String(d.phonesInStock),sub: "IMEI tracked" },
  ];

  const cash = [
    { t: "green", icon: ArrowDownLeft, label: "Cash In",  value: taka(d.cashIn) },
    { t: "red",   icon: ArrowUpRight,  label: "Cash Out", value: taka(d.cashOut) },
    { t: "blue",  icon: Wallet,        label: "Balance",  value: taka(d.balance) },
  ];

  const quick = [
    { label: "Create Invoice",  href: "/sales/pos",                  icon: FilePlus2,    t: "green"  },
    { label: "Create Return",   href: "/returns/sale",               icon: RotateCcw,    t: "orange" },
    { label: "Expense Voucher", href: "/accounting/expense",         icon: FileMinus2,   t: "red"    },
    { label: "Collect Due",     href: "/accounting/due-collection",  icon: HandCoins,    t: "purple" },
    { label: "Daily Statement", href: "/accounting/daily",           icon: CalendarRange,t: "blue"   },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">Dashboard</h1>
          <p className="text-[12px] text-muted">Here&apos;s what&apos;s happening in your shop today.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full border border-line bg-card px-3 py-1.5 text-[12px] font-semibold text-muted">{today()}</span>
          <NotificationsBell />
        </div>
      </div>

      {/* KPI hero strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="stat" style={tone(k.t)}>
            <div>
              <div className="stat-label">{k.label}</div>
              <div className="stat-value">{k.value}</div>
              <div className="stat-sub">{k.sub}</div>
            </div>
            <span className="stat-ico"><k.icon size={20} /></span>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        {/* Today's Cash Flow */}
        <div className="card space-y-3 p-4">
          <h2 className="sec-title">Today&apos;s Cash Flow</h2>
          {cash.map((c) => (
            <div key={c.label} className="stat" style={tone(c.t)}>
              <div>
                <div className="stat-label">{c.label}</div>
                <div className="stat-value">{c.value}</div>
              </div>
              <span className="stat-ico"><c.icon size={20} /></span>
            </div>
          ))}
        </div>

        {/* Quick Access */}
        <div className="card space-y-3 p-4">
          <h2 className="sec-title">Quick Access</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {quick.map((qa) => (
              <Link key={qa.label} href={qa.href} className="qa" style={tone(qa.t)}>
                <span className="qa-ico"><qa.icon size={20} /></span>
                <span className="qa-label">{qa.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Low Stock Alert */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <h2 className="sec-title">Low Stock Alert</h2>
            <Link href="/inventory/products" className="btn btn-ghost py-1.5 text-[12px]">See More <ChevronRight size={14} /></Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr><th className="th">SL.</th><th className="th">SKU</th><th className="th">Product Name</th><th className="th text-right">Stock</th></tr></thead>
              <tbody>
                {d.lowStock.map((l, i) => (
                  <tr key={l.id}>
                    <td className="td">{i + 1}</td>
                    <td className="td font-mono text-[12px]">{l.sku}</td>
                    <td className="td font-semibold">{l.name}</td>
                    <td className="td text-right">
                      <span className={`font-bold ${l.stock === 0 ? "text-red" : "text-amber"}`}>{l.stock} units&nbsp;!</span>
                    </td>
                  </tr>
                ))}
                {d.lowStock.length === 0 && <tr><td className="td py-8 text-center text-muted" colSpan={4}>All stocked up.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent invoices */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <h2 className="sec-title">Recent Invoices</h2>
            <Link href="/sales/history" className="btn btn-ghost py-1.5 text-[12px]">View All <ChevronRight size={14} /></Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr><th className="th">Invoice</th><th className="th">Customer</th><th className="th text-right">Total</th></tr></thead>
              <tbody>
                {d.recent.map((s) => (
                  <tr key={s.id}>
                    <td className="td"><div className="font-mono text-[12px]">{s.invoiceNo}</div><div className="text-[11px] text-muted">{dt(s.createdAt)}</div></td>
                    <td className="td">{s.customer?.name ?? "Walk-in"}<div className="text-[11px] text-muted">{s.items.map((i) => i.variant.product.name).slice(0, 2).join(", ")}{s.items.length > 2 && "…"}</div></td>
                    <td className="td text-right font-semibold">{taka(s.grandTotal)}{Number(s.dueTotal) > 0 && <div className="text-[11px] font-semibold text-amber">due {taka(s.dueTotal)}</div>}</td>
                  </tr>
                ))}
                {d.recent.length === 0 && <tr><td className="td py-8 text-center text-muted" colSpan={3}>No sales yet — create your first invoice.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
