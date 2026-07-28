"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { taka, dt } from "@/lib/format";
import {
  ArrowDownLeft, ArrowUpRight, Wallet, ReceiptText, Package, TrendingDown,
  FilePlus2, RotateCcw, FileMinus2, HandCoins, ArrowLeftRight,
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

  const quick = [
    { label: "Create Invoice", href: "/sales/pos", icon: FilePlus2, bg: "#dbeafe", fg: "#1d4ed8" },
    { label: "Create Return", href: "/returns/sale", icon: RotateCcw, bg: "#dcfce7", fg: "#15803d" },
    { label: "Expense Voucher", href: "/accounting/expense", icon: FileMinus2, bg: "#fee2e2", fg: "#b91c1c" },
    { label: "Collect Due", href: "/accounting/due-collection", icon: HandCoins, bg: "#f3e8ff", fg: "#7e22ce" },
    { label: "Daily Statement", href: "/accounting/daily", icon: ArrowLeftRight, bg: "#ffedd5", fg: "#c2410c" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Dashboard</h1>
        <span className="text-[13px] font-semibold text-muted">{today()}</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        {/* Today's Cash Flow */}
        <div className="card space-y-3 p-4">
          <h2 className="border-l-4 pl-2 font-bold" style={{ borderColor: "var(--teal)" }}>Today&apos;s Cash Flow</h2>
          <div className="flex items-center justify-between rounded-xl p-4" style={{ background: "#dbeafe", color: "#111827" }}>
            <div><div className="text-[13px] font-semibold">Cash In</div><div className="text-2xl font-bold">{taka(d.cashIn)}</div></div>
            <ArrowDownLeft size={22} className="text-blue-700" />
          </div>
          <div className="flex items-center justify-between rounded-xl p-4" style={{ background: "#dcfce7", color: "#111827" }}>
            <div><div className="text-[13px] font-semibold">Cash Out</div><div className="text-2xl font-bold">{taka(d.cashOut)}</div></div>
            <ArrowUpRight size={22} className="text-green-700" />
          </div>
          <div className="flex items-center justify-between rounded-xl p-4" style={{ background: "#fee2e2", color: "#111827" }}>
            <div><div className="text-[13px] font-semibold">Balance</div><div className="text-2xl font-bold">{taka(d.balance)}</div></div>
            <Wallet size={22} className="text-red-700" />
          </div>
        </div>

        <div className="space-y-4">
          {/* Today's Summary */}
          <div className="card space-y-3 p-4">
            <h2 className="border-l-4 pl-2 font-bold" style={{ borderColor: "var(--teal)" }}>Today&apos;s Summary</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="flex items-center justify-between rounded-xl p-4" style={{ background: "#dbeafe", color: "#111827" }}>
                <div><div className="text-[13px] font-semibold">Retail Sale</div><div className="text-2xl font-bold">{taka(d.todayTotal)}</div>
                  <div className="text-[11px] text-muted">{d.todaySales} invoices</div></div>
                <ReceiptText size={20} className="text-blue-700" />
              </div>
              <div className="flex items-center justify-between rounded-xl p-4" style={{ background: "#f3e8ff", color: "#111827" }}>
                <div><div className="text-[13px] font-semibold">Collected</div><div className="text-2xl font-bold">{taka(d.todayCollected)}</div>
                  <div className="text-[11px] text-muted">incl. due collection</div></div>
                <Package size={20} className="text-purple-700" />
              </div>
              <div className="flex items-center justify-between rounded-xl p-4" style={{ background: "#fee2e2", color: "#111827" }}>
                <div><div className="text-[13px] font-semibold">Total Due</div><div className="text-2xl font-bold">{taka(d.totalDue)}</div>
                  <div className="text-[11px] text-muted">all customers</div></div>
                <TrendingDown size={20} className="text-red-700" />
              </div>
            </div>
          </div>

          {/* Quick Access */}
          <div className="card space-y-3 p-4">
            <h2 className="border-l-4 pl-2 font-bold" style={{ borderColor: "var(--teal)" }}>Quick Access</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {quick.map((qa) => (
                <Link key={qa.label} href={qa.href}
                  className="flex flex-col items-center gap-2 rounded-xl p-4 text-center transition-transform hover:-translate-y-0.5"
                  style={{ background: qa.bg }}>
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/70">
                    <qa.icon size={18} style={{ color: qa.fg }} />
                  </span>
                  <span className="text-[12px] font-semibold" style={{ color: qa.fg }}>{qa.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Low Stock Alert */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <h2 className="border-l-4 pl-2 font-bold" style={{ borderColor: "var(--red)" }}>Low Stock Alert</h2>
            <Link href="/inventory/products" className="btn btn-ghost py-1.5 text-[12px]">See More</Link>
          </div>
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

        {/* Recent invoices */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <h2 className="border-l-4 pl-2 font-bold" style={{ borderColor: "var(--teal)" }}>Recent Invoices</h2>
            <Link href="/sales/history" className="btn btn-ghost py-1.5 text-[12px]">View All</Link>
          </div>
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
  );
}
