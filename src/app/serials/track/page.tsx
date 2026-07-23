"use client";

import { useState } from "react";
import { taka, dt } from "@/lib/format";
import { ScanBarcode, Search } from "lucide-react";

type Trace = {
  serialNo: string; status: string; warrantyUntil?: string | null; createdAt: string; costPrice?: string | null;
  variant: { sku: string; salePrice: string; color?: { name: string } | null; size?: { name: string } | null;
    product: { name: string; brand?: { name: string } | null; warrantyPolicy?: { name: string } | null } };
  saleItem?: { unitPrice: string; sale: { invoiceNo: string; createdAt: string; customer?: { name: string; phone: string } | null } } | null;
  purchaseItem?: { purchase: { purchaseNo: string; createdAt: string; supplier: { name: string } } } | null;
  warrantyClaims: { claimNo: string; issue: string; status: string; receivedAt: string }[];
};

const STATUS_STYLE: Record<string, string> = {
  IN_STOCK: "bg-tealsoft text-tealdark", SOLD: "bg-ambersoft text-amber",
  RETURNED: "bg-redsoft text-red", DEFECTIVE: "bg-redsoft text-red",
};

export default function SerialTrack() {
  const [q, setQ] = useState("");
  const [trace, setTrace] = useState<Trace | null>(null);
  const [err, setErr] = useState("");

  const search = async () => {
    setErr(""); setTrace(null);
    const res = await fetch(`/api/serials?serial=${encodeURIComponent(q.trim())}`);
    const data = await res.json();
    if (!res.ok) return setErr(data.error);
    setTrace(data);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="card p-5">
        <h1 className="flex items-center gap-2 text-lg font-bold"><ScanBarcode size={20} className="text-tealdark" /> Serial number track</h1>
        <p className="mt-1 text-[13px] text-muted">Scan or type an IMEI / serial number to trace its full history — purchase, sale, customer, and warranty.</p>
        <div className="mt-3 flex gap-2">
          <input className="input font-mono" placeholder="356938104263201" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} autoFocus />
          <button className="btn btn-primary shrink-0" onClick={search}><Search size={15} /> Trace</button>
        </div>
        {err && <div className="mt-3 rounded-md bg-redsoft px-3 py-2 text-[12px] font-semibold text-red">{err}</div>}
      </div>

      {trace && (
        <div className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="serial-chip text-[14px]">{trace.serialNo}</span>
            <span className={`rounded-md px-2.5 py-1 text-[12px] font-bold ${STATUS_STYLE[trace.status] ?? "bg-paper"}`}>{trace.status.replace(/_/g, " ")}</span>
          </div>
          <div className="mt-3 text-[15px] font-bold">{trace.variant.product.name}</div>
          <div className="text-[13px] text-muted">
            {[trace.variant.color?.name, trace.variant.size?.name].filter(Boolean).join(" · ")} · SKU {trace.variant.sku}
          </div>

          <div className="mt-4 space-y-3 border-t border-line pt-4 text-[13px]">
            {trace.purchaseItem && (
              <div className="flex justify-between"><span className="text-muted">Purchased</span>
                <span className="text-right">{trace.purchaseItem.purchase.purchaseNo} · {trace.purchaseItem.purchase.supplier.name}<br /><span className="text-muted">{dt(trace.purchaseItem.purchase.createdAt)}</span></span></div>
            )}
            {trace.saleItem && (
              <div className="flex justify-between"><span className="text-muted">Sold</span>
                <span className="text-right">{trace.saleItem.sale.invoiceNo} · {taka(trace.saleItem.unitPrice)}<br />
                <span className="text-muted">{trace.saleItem.sale.customer ? `${trace.saleItem.sale.customer.name} (${trace.saleItem.sale.customer.phone})` : "Walk-in"} · {dt(trace.saleItem.sale.createdAt)}</span></span></div>
            )}
            {trace.warrantyUntil && (
              <div className="flex justify-between"><span className="text-muted">Warranty until</span>
                <span className={new Date(trace.warrantyUntil) > new Date() ? "font-semibold text-tealdark" : "font-semibold text-red"}>
                  {new Date(trace.warrantyUntil).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </span></div>
            )}
            {trace.warrantyClaims.length > 0 && (
              <div><div className="text-muted">Warranty claims</div>
                {trace.warrantyClaims.map((c) => (
                  <div key={c.claimNo} className="mt-1 rounded-md bg-paper px-3 py-2">
                    <span className="font-mono text-[12px]">{c.claimNo}</span> — {c.issue} <span className="text-muted">({c.status}, {dt(c.receivedAt)})</span>
                  </div>))}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
