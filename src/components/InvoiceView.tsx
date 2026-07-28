"use client";

import { taka, dt } from "@/lib/format";
import { takaInWords } from "@/lib/words";
import { Download, Printer, X } from "lucide-react";

export type InvoiceSale = {
  id: string; invoiceNo: string; saleType: string; workOrder?: string | null; note?: string | null;
  subTotal: string; discount: string; additionalExpense: string; vat: string;
  grandTotal: string; paidTotal: string; dueTotal: string; createdAt: string;
  customer?: { name: string; phone: string; address?: string | null } | null;
  outlet?: { name: string; address?: string | null; phone?: string | null } | null;
  soldBy?: { name: string } | null;
  payments: { method: string; amount: string }[];
  items: {
    quantity: number; unitPrice: string; lineTotal: string;
    variant: {
      sku: string;
      color?: { name: string } | null; size?: { name: string } | null;
      product: { name: string; warrantyPolicy?: { name: string } | null };
    };
    serialUnits: { serialNo: string }[];
  }[];
};

export const TERMS = [
  "10 days replacement warranty for internal hardware issues. No coverage for software or external damage unless during our delivery (must be reported immediately with proper evidence).",
  "2 years of service warranty (for both new and used phones; parts cost not included).",
];

const rowsHtml = (s: InvoiceSale) =>
  s.items.map((i, k) => {
    const variant = [i.variant.color?.name, i.variant.size?.name].filter(Boolean).join(" ");
    return `<tr>
      <td class="c">${k + 1}</td>
      <td class="c mono">${i.variant.sku}</td>
      <td>${i.variant.product.name}${variant ? ` - ${variant}` : ""}${
        i.serialUnits.length ? `<div class="ser">${i.serialUnits.map((u) => u.serialNo).join(", ")}</div>` : ""
      }</td>
      <td class="c">${i.variant.product.warrantyPolicy?.name ?? "--"}</td>
      <td class="c">${i.quantity}</td>
      <td class="r">${Number(i.unitPrice).toLocaleString()}</td>
      <td class="r">${Number(i.lineTotal).toLocaleString()}</td>
    </tr>`;
  }).join("");

const totalsRows = (s: InvoiceSale) => {
  const qty = s.items.reduce((t, i) => t + i.quantity, 0);
  const paidLines = s.payments.map((p) => `<div><span>${p.method}</span><b>${Number(p.amount).toLocaleString()}</b></div>`).join("");
  return `
    <div><span>Total Quantity</span><b>${qty}</b></div>
    <div><span>Sub Total</span><b>${Number(s.subTotal).toLocaleString()}</b></div>
    ${Number(s.discount) ? `<div><span>Discount</span><b>-${Number(s.discount).toLocaleString()}</b></div>` : ""}
    ${Number(s.additionalExpense) ? `<div><span>Additional Expense</span><b>${Number(s.additionalExpense).toLocaleString()}</b></div>` : ""}
    ${Number(s.vat) ? `<div><span>VAT</span><b>${Number(s.vat).toLocaleString()}</b></div>` : ""}
    <div><span>Payable Amount</span><b>${Number(s.grandTotal).toLocaleString()}</b></div>
    ${paidLines}
    ${Number(s.dueTotal) ? `<div class="due"><span>Due</span><b>${Number(s.dueTotal).toLocaleString()}</b></div>` : ""}`;
};

/** Full A4 invoice document. */
export function a4Html(s: InvoiceSale) {
  return `<html><head><meta charset="utf-8"><title>${s.invoiceNo}</title><style>
    *{box-sizing:border-box}
    body{font-family:"Segoe UI",sans-serif;color:#111;padding:28px;margin:0}
    .title{background:#e6f2ee;text-align:center;font-size:20px;font-weight:700;padding:9px;border-bottom:3px solid #0d7a72}
    .head{display:flex;justify-content:space-between;margin-top:14px;font-size:13px;line-height:1.9}
    .head b{font-weight:700}
    table{width:100%;border-collapse:collapse;margin-top:16px;font-size:13px}
    th{background:#fdf6ec;border:1px solid #e6ddd2;padding:8px;font-weight:700}
    td{border:1px solid #e6ddd2;padding:8px}
    .c{text-align:center}.r{text-align:right}.mono{font-family:monospace;font-size:12px}
    .ser{font-family:monospace;font-size:11px;color:#666;margin-top:3px}
    .below{display:flex;justify-content:space-between;gap:24px;margin-top:14px;font-size:13px}
    .totals{background:#fdf6ec;border-radius:8px;padding:12px 16px;min-width:270px}
    .totals div{display:flex;justify-content:space-between;gap:28px;padding:2px 0}
    .totals .due{color:#b45309}
    .terms{border:1px solid #e3e8ee;border-radius:8px;padding:12px 16px;margin-top:18px;font-size:12.5px;line-height:1.9}
    .terms h4{margin:0 0 6px;font-size:13.5px}
    .by{margin-top:18px;font-size:13px}
    @media print{body{padding:0}}
  </style></head><body>
    <div class="title">Invoice</div>
    <div class="head">
      <div>
        <div>Customer Name &nbsp;: <b>${s.customer?.name ?? "Walk-in"}</b></div>
        <div>Phone &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: <b>${s.customer?.phone ?? "--"}</b></div>
        <div>Address &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: ${s.customer?.address ?? "--"}</div>
        ${s.workOrder ? `<div>Work Order &nbsp;&nbsp;&nbsp;: ${s.workOrder}</div>` : ""}
      </div>
      <div style="text-align:right">
        <div>Invoice No &nbsp;: <b>${s.invoiceNo}</b></div>
        <div>Date &amp; Time &nbsp;: ${new Date(s.createdAt).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })}</div>
        <div>Outlet &nbsp;: ${s.outlet?.name ?? "Excel Tech"}</div>
      </div>
    </div>
    <table>
      <thead><tr><th>Sl No.</th><th>SKU</th><th>Product Name</th><th>Warranty</th><th>Quantity</th><th>Unit Price</th><th>Total</th></tr></thead>
      <tbody>${rowsHtml(s)}</tbody>
    </table>
    <div class="below">
      <div>
        <div>In words : ${takaInWords(s.grandTotal)}</div>
        ${s.note ? `<div>Remarks: ${s.note}</div>` : ""}
      </div>
      <div class="totals">${totalsRows(s)}</div>
    </div>
    <div class="terms"><h4>Terms &amp; Conditions</h4>${TERMS.map((t) => `<div>• ${t}</div>`).join("")}</div>
    <div class="by">Prepared by : ${s.soldBy?.name ?? "Excel Tech"}</div>
  </body></html>`;
}

/** Narrow thermal-printer receipt (80mm). */
export function posHtml(s: InvoiceSale) {
  const lines = s.items.map((i, k) => `
    <div class="it">
      <div>${k + 1}. ${i.variant.product.name}</div>
      ${i.serialUnits.length ? `<div class="ser">${i.serialUnits.map((u) => u.serialNo).join(", ")}</div>` : ""}
      <div class="row"><span>${i.quantity} x ${Number(i.unitPrice).toLocaleString()}</span><b>${Number(i.lineTotal).toLocaleString()}</b></div>
    </div>`).join("");
  return `<html><head><meta charset="utf-8"><title>${s.invoiceNo}</title><style>
    @page{size:80mm auto;margin:3mm}
    body{font-family:"Segoe UI",sans-serif;width:74mm;margin:0;color:#000;font-size:12px}
    .ctr{text-align:center}
    h2{margin:0;font-size:15px}
    .muted{color:#444;font-size:11px}
    hr{border:none;border-top:1px dashed #999;margin:7px 0}
    .row{display:flex;justify-content:space-between;gap:8px}
    .it{margin-bottom:5px}
    .ser{font-family:monospace;font-size:10px;color:#555}
    .tot{font-size:14px;font-weight:700}
    .terms{font-size:9.5px;color:#444;line-height:1.5;margin-top:6px}
  </style></head><body>
    <div class="ctr"><h2>Excel Tech</h2>
      <div class="muted">${s.outlet?.name ?? ""}</div>
      ${s.outlet?.phone ? `<div class="muted">${s.outlet.phone}</div>` : ""}
    </div>
    <hr>
    <div class="row"><span>Invoice</span><b>${s.invoiceNo}</b></div>
    <div class="row"><span>Date</span><span>${new Date(s.createdAt).toLocaleString("en-GB")}</span></div>
    <div class="row"><span>Customer</span><span>${s.customer?.name ?? "Walk-in"}</span></div>
    ${s.customer?.phone ? `<div class="row"><span>Phone</span><span>${s.customer.phone}</span></div>` : ""}
    <hr>${lines}<hr>
    <div class="row"><span>Sub Total</span><span>${Number(s.subTotal).toLocaleString()}</span></div>
    ${Number(s.discount) ? `<div class="row"><span>Discount</span><span>-${Number(s.discount).toLocaleString()}</span></div>` : ""}
    ${Number(s.additionalExpense) ? `<div class="row"><span>Add. Expense</span><span>${Number(s.additionalExpense).toLocaleString()}</span></div>` : ""}
    ${Number(s.vat) ? `<div class="row"><span>VAT</span><span>${Number(s.vat).toLocaleString()}</span></div>` : ""}
    <div class="row tot"><span>Payable</span><span>${Number(s.grandTotal).toLocaleString()}</span></div>
    ${s.payments.map((p) => `<div class="row"><span>${p.method}</span><span>${Number(p.amount).toLocaleString()}</span></div>`).join("")}
    ${Number(s.dueTotal) ? `<div class="row"><span>Due</span><span>${Number(s.dueTotal).toLocaleString()}</span></div>` : ""}
    <hr>
    <div class="muted">In words: ${takaInWords(s.grandTotal)}</div>
    <div class="terms">${TERMS.map((t) => `• ${t}`).join("<br>")}</div>
    <div class="ctr muted" style="margin-top:8px">Prepared by ${s.soldBy?.name ?? "Excel Tech"}<br>Thank you for shopping!</div>
  </body></html>`;
}

function printDoc(html: string, width: number) {
  const w = window.open("", "_blank", `width=${width},height=800`);
  if (!w) return alert("Allow pop-ups to print.");
  w.document.write(html.replace("</body>", "<script>window.onload=()=>{window.print()}<\/script></body>"));
  w.document.close();
}

export default function InvoiceView({ sale, onClose }: { sale: InvoiceSale; onClose: () => void }) {
  const qty = sale.items.reduce((t, i) => t + i.quantity, 0);

  const download = () => {
    const blob = new Blob([a4Html(sale)], { type: "text/html;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${sale.invoiceNo}.html`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="card max-h-[76vh] overflow-y-auto p-6">
          <div className="flex justify-end"><button onClick={onClose}><X size={18} /></button></div>

          <div className="rounded bg-tealsoft py-2 text-center text-lg font-bold" style={{ borderBottom: "3px solid var(--teal)" }}>Invoice</div>

          <div className="mt-3 flex flex-wrap justify-between gap-4 text-[13px] leading-7">
            <div>
              <div>Customer Name : <b>{sale.customer?.name ?? "Walk-in"}</b></div>
              <div>Phone : <b>{sale.customer?.phone ?? "--"}</b></div>
              <div>Address : {sale.customer?.address ?? "--"}</div>
              {sale.workOrder && <div>Work Order : {sale.workOrder}</div>}
            </div>
            <div className="text-right">
              <div>Invoice No : <b>{sale.invoiceNo}</b></div>
              <div>Date &amp; Time : {dt(sale.createdAt)}</div>
              <div>Outlet : {sale.outlet?.name ?? "Excel Tech"}</div>
            </div>
          </div>

          <table className="mt-4 w-full text-[13px]">
            <thead><tr>
              <th className="th text-center">Sl No.</th><th className="th">SKU</th><th className="th">Product Name</th>
              <th className="th text-center">Warranty</th><th className="th text-center">Quantity</th>
              <th className="th text-right">Unit Price</th><th className="th text-right">Total</th>
            </tr></thead>
            <tbody>
              {sale.items.map((i, k) => (
                <tr key={k}>
                  <td className="td text-center">{k + 1}</td>
                  <td className="td font-mono text-[12px]">{i.variant.sku}</td>
                  <td className="td">{i.variant.product.name}
                    {i.serialUnits.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {i.serialUnits.map((u) => <span key={u.serialNo} className="serial-chip">{u.serialNo}</span>)}
                      </div>
                    )}
                  </td>
                  <td className="td text-center">{i.variant.product.warrantyPolicy?.name ?? "--"}</td>
                  <td className="td text-center">{i.quantity}</td>
                  <td className="td text-right">{taka(i.unitPrice)}</td>
                  <td className="td text-right font-semibold">{taka(i.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 flex flex-wrap justify-between gap-4 text-[13px]">
            <div className="max-w-sm">
              <div>In words : {takaInWords(sale.grandTotal)}</div>
              {sale.note && <div>Remarks: {sale.note}</div>}
            </div>
            <div className="min-w-[250px] rounded-lg bg-ambersoft px-4 py-3">
              <div className="flex justify-between"><span>Total Quantity</span><b>{qty}</b></div>
              <div className="flex justify-between"><span>Sub Total</span><b>{taka(sale.subTotal)}</b></div>
              {Number(sale.discount) > 0 && <div className="flex justify-between"><span>Discount</span><b>−{taka(sale.discount)}</b></div>}
              {Number(sale.additionalExpense) > 0 && <div className="flex justify-between"><span>Additional Expense</span><b>{taka(sale.additionalExpense)}</b></div>}
              {Number(sale.vat) > 0 && <div className="flex justify-between"><span>VAT</span><b>{taka(sale.vat)}</b></div>}
              <div className="flex justify-between"><span>Payable Amount</span><b>{taka(sale.grandTotal)}</b></div>
              {sale.payments.map((p, k) => <div key={k} className="flex justify-between"><span>{p.method}</span><b>{taka(p.amount)}</b></div>)}
              {Number(sale.dueTotal) > 0 && <div className="flex justify-between text-amber"><span>Due</span><b>{taka(sale.dueTotal)}</b></div>}
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-line p-4 text-[12.5px] leading-7">
            <h4 className="font-bold">Terms &amp; Conditions</h4>
            {TERMS.map((t, k) => <div key={k}>• {t}</div>)}
          </div>

          <div className="mt-4 text-[13px]">Prepared by : {sale.soldBy?.name ?? "Excel Tech"}</div>
        </div>

        <div className="mt-3 flex flex-wrap justify-center gap-3">
          <button className="btn text-white" style={{ background: "#a855f7" }} onClick={() => printDoc(a4Html(sale), 900)}>
            <Printer size={15} /> A4 Print
          </button>
          <button className="btn text-white" style={{ background: "#a855f7" }} onClick={() => printDoc(posHtml(sale), 420)}>
            <Printer size={15} /> Pos Print
          </button>
          <button className="btn text-white" style={{ background: "var(--amber)" }} onClick={download}>
            <Download size={15} /> Download
          </button>
        </div>
      </div>
    </div>
  );
}
