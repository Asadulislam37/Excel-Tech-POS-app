"use client";

import { useCallback, useEffect, useState } from "react";
import { taka } from "@/lib/format";

type Customer = { id: string; name: string; phone: string; address?: string | null; rewardPoints: number; totalPurchase: number; totalDue: number };

export default function CustomersPage() {
  const [q, setQ] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const load = useCallback(async () => {
    const res = await fetch(`/api/customers?q=${encodeURIComponent(q)}`);
    if (res.ok) setCustomers(await res.json());
  }, [q]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-bold">Customers</h1>
        <input className="input w-64" placeholder="Search name or phone…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[560px]">
          <thead><tr><th className="th">Customer</th><th className="th">Phone</th><th className="th text-right">Lifetime purchase</th><th className="th text-right">Due</th><th className="th text-right">Points</th></tr></thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id}>
                <td className="td font-semibold">{c.name}<div className="text-[11px] font-normal text-muted">{c.address}</div></td>
                <td className="td font-mono text-[12px]">{c.phone}</td>
                <td className="td text-right">{taka(c.totalPurchase)}</td>
                <td className="td text-right">{c.totalDue > 0 ? <span className="font-bold text-amber">{taka(c.totalDue)}</span> : <span className="text-muted">—</span>}</td>
                <td className="td text-right font-semibold text-tealdark">{c.rewardPoints}</td>
              </tr>
            ))}
            {customers.length === 0 && <tr><td colSpan={5} className="td py-10 text-center text-muted">No customers yet. They are added automatically at the POS.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
