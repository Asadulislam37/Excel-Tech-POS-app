"use client";

import { useCallback, useEffect, useState } from "react";
import { taka, dt } from "@/lib/format";
import { exportCsv, exportExcel } from "@/lib/export";
import { Download, Eye, FileSpreadsheet, MoreHorizontal, Printer, X } from "lucide-react";
import SalesTabs from "@/components/SalesTabs";

type Named = { id: string; name: string };
type Sale = {
  id: string; invoiceNo: string; saleType: string; workOrder?: string | null; note?: string | null;
  subTotal: string; discount: string; additionalExpense: string; vat: string;
  grandTotal: string; paidTotal: string; dueTotal: string; status: string; createdAt: string;
  customer?: { name: string; phone: string; address?: string | null } | null;
  outlet?: { name: string } | null;
  payments: { method: string; amount: string; reference?: string | null }[];
  items: {
    quantity: number; unitPrice: string; lineTotal: string;
    variant: { sku: string; product: { name: string } };
    serialUnits: { serialNo: string }[];
  }[];
};
type Data = { total: number; totalAmount: number; totalDue: number; rows: Sale[] };

const TYPE_LABEL: Record<string, string> = {
  CUSTOMER: "Customer Sale", RETAIL: "Retail Sale", WHOLESALE: "Wholesale",
};

export default function SalesHistory() {
  const [q, setQ] = useState("");
  const [outletId, setOutletId] = useState("");
  const [type, setType] = useState("");
  const [date, setDate] = useState("");
  const [page, setPage] = useState(1);
  const [d, setD] = useState<Data | null>(null);
  const [cfg, setCfg] = useState<{ outlets: Named[] } | null>(null);
  const [view, setView] = useState<Sale | null>(null);
  const [menuFor, setMenuFor] = useState("");

  const load = useCallback(async () => {
    const p = new URLSearchParams({ q, page: String(page) });
    if (outletId) p.set("outletId", outletId);
    if (type) p.set("type", type);
    if (date) p.set("date", date);
    const r = await fetch(`/api/sales?${p}`);
    if (r.ok) setD(await r.json());
  }, [q, outletId, type, date, page]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  useEffect(() => { setPage(1); }, [q, outletId, type, date]);
  useEffect(() => { fetch("/api/config").then(async (r) => r.ok && setCfg(await r.json())); }, []);

  const qtyOf = (s: Sale) => s.items.reduce((t, i) => t + i.quantity, 0);

  const HEAD = ["SL.", "Date & Time", "Invoice No.", "Customer", "Phone", "Type", "Quantity", "Amount", "Due"];
  const sheet = () => (d?.rows ?? []).map((s, i) => [
    (page - 1) * 50 + i + 1, new Date(s.createdAt).toLocaleString("en-GB"), s.invoiceNo,
    s.customer?.name ?? "Walk-in", s.customer?.phone ?? "", TYPE_LABEL[s.saleType] ?? s.saleType,
    qtyOf(s), Number(s.grandTotal), Number(s.dueTotal),
  ]);

  const printInvoice = (s: Sale) => {
    const w = window.open("", "_blank", "width=720,height=800");
    if (!w) return;
    const rows = s.items.map((i) => `<tr>
      <td>${i.variant.product.name}${i.serialUnits.length ? `<div class="ser">${i.serialUnits.map((u) => u.serialNo).join(", ")}</div>` : ""}</td>
      <td class="r">${i.quantity}</td><td class="r">${taka(i.unitPrice)}</td><td class="r">${taka(i.lineTotal)}</td></tr>`).join("");
    w.document.write(`<html><head><title>${s.invoiceNo}</title><style>
      body{font-family:sans-serif;padding:24px;color:#111}
      h1{font-size:18px;margin:0}
      .muted{color:#666;font-size:12px}
      table{width:100%;border-collapse:collapse;margin-top:16px;font-size:13px}
      th,td{border-bottom:1px solid #ddd;padding:7px;text-align:left}
      .r{text-align:right}.ser{font-family:monospace;font-size:11px;color:#666}
      tfoot td{border:none;padding:3px 7px}
      .tot{font-weight:700;font-size:15px}
    </style></head><body>
      <h1>Excel Tech — ${s.outlet?.name ?? "Shyamoli"}</h1>
      <div class="muted">Invoice ${s.invoiceNo} · ${new Date(s.createdAt).toLocaleString("en-GB")} · ${TYPE_LABEL[s.saleType] ?? s.saleType}</div>
      <div class="muted">Customer: ${s.customer?.name ?? "Walk-in"} ${s.customer?.phone ?? ""}</div>
      ${s.workOrder ? `<div class="muted">Work order: ${s.workOrder}</div>` : ""}
      <table><thead><tr><th>Product</th><th class="r">Qty</th><th class="r">Price</th><th class="r">Total</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr><td colspan="3" class="r">Sub total</td><td class="r">${taka(s.subTotal)}</td></tr>
        ${Number(s.discount) ? `<tr><td colspan="3" class="r">Discount</td><td class="r">-${taka(s.discount)}</td></tr>` : ""}
        ${Number(s.additionalExpense) ? `<tr><td colspan="3" class="r">Additional expense</td><td class="r">${taka(s.additionalExpense)}</td></tr>` : ""}
        ${Number(s.vat) ? `<tr><td colspan="3" class="r">VAT</td><td class="r">${taka(s.vat)}</td></tr>` : ""}
        <tr class="tot"><td colspan="3" class="r">Total payable</td><td class="r">${taka(s.grandTotal)}</td></tr>
        <tr><td colspan="3" class="r">Paid</td><td class="r">${taka(s.paidTotal)}</td></tr>
        ${Number(s.dueTotal) ? `<tr><td colspan="3" class="r">Due</td><td class="r">${taka(s.dueTotal)}</td></tr>` : ""}
      </tfoot></table>
      <p class="muted">Thank you for shopping with Excel Tech.</p>
      <script>window.onload=()=>window.print()</script></body></html>`);
    w.document.close();
  };

  const Cell = ({ children }: { children: React.ReactNode }) => (
    <div className="min-w-[120px] flex-1 basis-[140px] lg:max-w-[190px]">{children}</div>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SalesTabs />
        <div className="card flex divide-x divide-line">
          <div className="px-4 py-2"><div className="text-[11px] font-semibold uppercase text-muted">Invoices</div>
            <div className="text-xl font-bold">{d ? d.total.toLocaleString() : "…"}</div></div>
          <div className="px-4 py-2"><div className="text-[11px] font-semibold uppercase text-muted">Amount</div>
            <div className="text-xl font-bold">{d ? taka(d.totalAmount) : "…"}</div></div>
          <div className="px-4 py-2"><div className="text-[11px] font-semibold uppercase text-muted">Due</div>
            <div className="text-xl font-bold text-amber">{d ? taka(d.totalDue) : "…"}</div></div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Cell><input className="input" placeholder="Type here…" value={q} onChange={(e) => setQ(e.target.value)} /></Cell>
        <Cell>
          <select className="input" value={outletId} onChange={(e) => setOutletId(e.target.value)}>
            <option value="">Select Outlet</option>
            {cfg?.outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </Cell>
        <Cell>
          <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All</option>
            <option value="CUSTOMER">Customer Sale</option>
            <option value="RETAIL">Retail Sale</option>
            <option value="WHOLESALE">Wholesale</option>
          </select>
        </Cell>
        <Cell><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></Cell>
        <div className="flex shrink-0 gap-2">
          <button className="btn btn-ghost px-3" title="Export to Excel" onClick={() => exportExcel("sold-history", HEAD, sheet())}><FileSpreadsheet size={16} /></button>
          <button className="btn btn-ghost px-3" title="Download CSV" onClick={() => exportCsv("sold-history", HEAD, sheet())}><Download size={16} /></button>
          <button className="btn btn-ghost px-3" title="Print" onClick={() => window.print()}><Printer size={16} /></button>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead><tr>
            <th className="th">SL.</th><th className="th">Date &amp; Time</th><th className="th">Invoice No.</th>
            <th className="th">Customer</th><th className="th">Phone</th><th className="th">Type</th>
            <th className="th text-right">Quantity</th><th className="th text-right">Amount</th><th className="th text-center">Action</th>
          </tr></thead>
          <tbody>
            {d?.rows.map((s, i) => (
              <tr key={s.id}>
                <td className="td">{(page - 1) * 50 + i + 1}</td>
                <td className="td text-[12px] text-muted">{dt(s.createdAt)}</td>
                <td className="td font-mono text-[12px]">{s.invoiceNo}</td>
                <td className="td font-semibold">{s.customer?.name ?? "Walk-in"}</td>
                <td className="td font-mono text-[12px]">{s.customer?.phone ?? "—"}</td>
                <td className="td"><span className="rounded bg-tealsoft px-2 py-0.5 text-[11px] font-bold text-tealdark">{TYPE_LABEL[s.saleType] ?? s.saleType}</span></td>
                <td className="td text-right font-bold">{qtyOf(s)}</td>
                <td className="td text-right font-semibold">{taka(s.grandTotal)}
                  {Number(s.dueTotal) > 0 && <div className="text-[11px] font-bold text-amber">due {taka(s.dueTotal)}</div>}</td>
                <td className="td">
                  <div className="relative flex items-center justify-center gap-1.5">
                    <button title="View" className="rounded-md bg-orange-100 p-2 text-orange-600 hover:bg-orange-200" onClick={() => setView(s)}><Eye size={14} /></button>
                    <button title="More" className="rounded-md bg-paper p-2 text-body hover:bg-line" onClick={() => setMenuFor(menuFor === s.id ? "" : s.id)}><MoreHorizontal size={14} /></button>
                    {menuFor === s.id && (
                      <div className="card absolute right-0 top-9 z-40 w-40 p-1 text-left shadow-lg">
                        <button className="block w-full rounded-md px-3 py-2 text-left text-[13px] font-semibold hover:bg-paper" onClick={() => { setMenuFor(""); printInvoice(s); }}>Print invoice</button>
                        <button className="block w-full rounded-md px-3 py-2 text-left text-[13px] hover:bg-paper" onClick={() => { setMenuFor(""); setView(s); }}>View details</button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {d && d.rows.length === 0 && <tr><td colSpan={9} className="td py-10 text-center text-muted">No invoices for this filter.</td></tr>}
          </tbody>
        </table>
      </div>

      {d && d.total > 50 && (
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-muted">{d.total} invoices · page {page} of {Math.ceil(d.total / 50)}</span>
          <div className="flex gap-2">
            <button className="btn btn-ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>‹ Prev</button>
            <button className="btn btn-ghost" disabled={page >= Math.ceil(d.total / 50)} onClick={() => setPage((p) => p + 1)}>Next ›</button>
          </div>
        </div>
      )}

      {view && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setView(null)}>
          <div className="card max-h-[90vh] w-full max-w-2xl space-y-3 overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">{view.invoiceNo}</h3>
                <p className="text-[12px] text-muted">{dt(view.createdAt)} · {TYPE_LABEL[view.saleType] ?? view.saleType}</p>
              </div>
              <button onClick={() => setView(null)}><X size={17} /></button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[13px]">
              <div className="rounded-lg bg-paper px-3 py-2"><span className="text-muted">Customer</span><div className="font-semibold">{view.customer?.name ?? "Walk-in"}</div></div>
              <div className="rounded-lg bg-paper px-3 py-2"><span className="text-muted">Phone</span><div className="font-semibold">{view.customer?.phone ?? "—"}</div></div>
            </div>
            <table className="w-full">
              <thead><tr><th className="th">Product</th><th className="th text-right">Qty</th><th className="th text-right">Price</th><th className="th text-right">Total</th></tr></thead>
              <tbody>
                {view.items.map((i, k) => (
                  <tr key={k}>
                    <td className="td">{i.variant.product.name}
                      {i.serialUnits.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{i.serialUnits.map((u) => <span key={u.serialNo} className="serial-chip">{u.serialNo}</span>)}</div>}
                    </td>
                    <td className="td text-right">{i.quantity}</td>
                    <td className="td text-right">{taka(i.unitPrice)}</td>
                    <td className="td text-right font-semibold">{taka(i.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="space-y-1 border-t border-line pt-3 text-[13px]">
              <div className="flex justify-between"><span className="text-muted">Sub total</span><span>{taka(view.subTotal)}</span></div>
              {Number(view.discount) > 0 && <div className="flex justify-between"><span className="text-muted">Discount</span><span>−{taka(view.discount)}</span></div>}
              {Number(view.additionalExpense) > 0 && <div className="flex justify-between"><span className="text-muted">Additional expense</span><span>{taka(view.additionalExpense)}</span></div>}
              {Number(view.vat) > 0 && <div className="flex justify-between"><span className="text-muted">VAT</span><span>{taka(view.vat)}</span></div>}
              <div className="flex justify-between text-[15px] font-bold"><span>Total payable</span><span>{taka(view.grandTotal)}</span></div>
              <div className="flex justify-between"><span className="text-muted">Paid</span><span>{taka(view.paidTotal)}</span></div>
              {Number(view.dueTotal) > 0 && <div className="flex justify-between font-bold text-amber"><span>Due</span><span>{taka(view.dueTotal)}</span></div>}
              <div className="text-[12px] text-muted">Paid via {view.payments.map((p) => `${p.method} ${taka(p.amount)}`).join(", ") || "—"}</div>
              {view.note && <div className="rounded-lg bg-paper px-3 py-2 text-[12px]">{view.note}</div>}
            </div>
            <button className="btn btn-primary w-full" onClick={() => printInvoice(view)}><Printer size={15} /> Print Invoice</button>
          </div>
        </div>
      )}
    </div>
  );
}
