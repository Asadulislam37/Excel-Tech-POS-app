"use client";

import { useEffect, useState } from "react";
import { taka, dt } from "@/lib/format";

type Sale = {
  id: string; invoiceNo: string; grandTotal: string; paidTotal: string; dueTotal: string; status: string; createdAt: string;
  customer?: { name: string; phone: string } | null;
  payments: { method: string; amount: string }[];
  items: { quantity: number; variant: { product: { name: string } }; serialUnits: { serialNo: string }[] }[];
};

export default function SalesHistory() {
  const [sales, setSales] = useState<Sale[]>([]);
  useEffect(() => { fetch("/api/sales").then(async (r) => r.ok && setSales(await r.json())); }, []);

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-bold">Sold history</h1>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px]">
          <thead><tr><th className="th">Invoice</th><th className="th">Customer</th><th className="th">Items</th><th className="th">Paid via</th><th className="th text-right">Total</th><th className="th text-right">Due</th></tr></thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s.id}>
                <td className="td"><div className="font-mono text-[12px]">{s.invoiceNo}</div><div className="text-[11px] text-muted">{dt(s.createdAt)}</div></td>
                <td className="td">{s.customer ? <>{s.customer.name}<div className="font-mono text-[11px] text-muted">{s.customer.phone}</div></> : "Walk-in"}</td>
                <td className="td">
                  {s.items.map((i, k) => (
                    <div key={k}>{i.quantity}× {i.variant.product.name}
                      {i.serialUnits.length > 0 && <div className="mt-0.5 flex flex-wrap gap-1">{i.serialUnits.map((u) => <span key={u.serialNo} className="serial-chip">{u.serialNo}</span>)}</div>}
                    </div>
                  ))}
                </td>
                <td className="td text-[12px] text-muted">{s.payments.map((p) => `${p.method} ${taka(p.amount)}`).join(", ") || "—"}</td>
                <td className="td text-right font-semibold">{taka(s.grandTotal)}</td>
                <td className="td text-right">{Number(s.dueTotal) > 0 ? <span className="font-bold text-amber">{taka(s.dueTotal)}</span> : <span className="text-muted">—</span>}</td>
              </tr>
            ))}
            {sales.length === 0 && <tr><td colSpan={6} className="td py-10 text-center text-muted">No sales yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
