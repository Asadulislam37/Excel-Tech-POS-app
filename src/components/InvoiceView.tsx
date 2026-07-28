"use client";

import { dt } from "@/lib/format";
import { takaInWords } from "@/lib/words";
import { Download, Printer, X } from "lucide-react";

export type InvoiceSale = {
  id: string; invoiceNo: string; saleType: string; workOrder?: string | null; assistedBy?: string | null; note?: string | null;
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

// Plain numbers, two decimals, no currency symbol — matches the printed invoice.
const fmt = (n: number | string) => Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qtyFmt = (n: number) => Number(n).toFixed(3);
const methodLabel = (m: string) => m.charAt(0).toUpperCase() + m.slice(1).toLowerCase().replace(/_/g, " ");
const inWords = (n: number | string) => takaInWords(n).replace(/\.$/, "");

const rowsHtml = (s: InvoiceSale) =>
  s.items.map((i, k) => {
    const variant = [i.variant.color?.name, i.variant.size?.name].filter(Boolean).join(" ");
    return `<tr>
      <td class="c">${k + 1}</td>
      <td class="c mono">${i.variant.sku}</td>
      <td>${i.variant.product.name}${variant ? ` - ${variant}` : ""}${
        i.serialUnits.length ? `<div class="ser">${i.serialUnits.map((u) => u.serialNo).join(", ")}</div>` : ""
      }</td>
      <td class="c">${i.variant.product.warrantyPolicy?.name ?? ""}</td>
      <td class="r">${fmt(i.unitPrice)}</td>
      <td class="c">${qtyFmt(i.quantity)}</td>
      <td class="r">${fmt(i.lineTotal)}</td>
    </tr>`;
  }).join("");

const totalsRows = (s: InvoiceSale) => {
  const qty = s.items.reduce((t, i) => t + i.quantity, 0);
  const rows = [`<tr><td class="lbl">Sub Total</td><td class="c">${qtyFmt(qty)}</td><td class="r">${fmt(s.subTotal)}</td></tr>`];
  if (Number(s.discount)) rows.push(`<tr><td class="lbl">Discount</td><td></td><td class="r">-${fmt(s.discount)}</td></tr>`);
  if (Number(s.additionalExpense)) rows.push(`<tr><td class="lbl">Additional Expense</td><td></td><td class="r">${fmt(s.additionalExpense)}</td></tr>`);
  if (Number(s.vat)) rows.push(`<tr><td class="lbl">VAT</td><td></td><td class="r">${fmt(s.vat)}</td></tr>`);
  rows.push(`<tr><td class="lbl">Payable Amount</td><td></td><td class="r">${fmt(s.grandTotal)}</td></tr>`);
  for (const p of s.payments) rows.push(`<tr><td class="lbl">${methodLabel(p.method)}</td><td></td><td class="r">${fmt(p.amount)}</td></tr>`);
  if (Number(s.dueTotal)) rows.push(`<tr><td class="lbl">Due</td><td></td><td class="r">${fmt(s.dueTotal)}</td></tr>`);
  return rows.join("");
};

/** Full A4 invoice document — plain black-and-white, letterhead space on top. */
export function a4Html(s: InvoiceSale) {
  const date = new Date(s.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  return `<html><head><meta charset="utf-8"><title>${s.invoiceNo}</title><style>
    *{box-sizing:border-box}
    body{font-family:"Segoe UI",Arial,sans-serif;color:#000;margin:0}
    .page{padding:32px 44px}
    .letterhead{height:150px}
    hr{border:none;border-top:1px solid #333;margin:0}
    .titlebar{display:flex;justify-content:space-between;align-items:center;padding:12px 2px}
    .titlebar .side{font-size:13px;min-width:170px}
    .titlebar .side.r{text-align:right}
    .titlebar h1{font-size:23px;font-weight:700;letter-spacing:1px;margin:0}
    .cust{margin:16px 2px;font-size:13px;line-height:2.2}
    .cust b{font-weight:700}
    table.items{width:100%;border-collapse:collapse;font-size:13px}
    table.items th,table.items td{border:1px solid #333;padding:7px 8px;vertical-align:top}
    table.items th{background:#f2f2f2;text-align:center;font-weight:700}
    .c{text-align:center}.r{text-align:right}.mono{font-family:monospace;font-size:12px}
    .ser{font-family:monospace;font-size:11px;color:#555;margin-top:3px}
    .below{display:flex;justify-content:space-between;align-items:flex-start;font-size:13px}
    .words{padding:8px 2px}.words b{font-weight:700}
    table.tot{border-collapse:collapse;font-size:13px}
    table.tot td{border:1px solid #333;padding:6px 14px}
    table.tot .lbl{font-weight:700;text-align:center}
    table.tot .c{text-align:center;font-weight:700}
    table.tot .r{text-align:right;font-weight:700;min-width:90px}
    .by{text-align:right;margin-top:10px;font-size:13px;line-height:1.8}
    .by b{font-weight:700}
    .terms{margin-top:40px;font-size:12.5px;line-height:1.85}
    .terms h4{margin:0 0 4px;font-weight:700;font-size:13px}
    @media print{.page{padding:0 10mm}}
  </style></head><body><div class="page">
    <div class="letterhead"></div>
    <hr>
    <div class="titlebar">
      <div class="side">${s.invoiceNo}</div>
      <h1>INVOICE</h1>
      <div class="side r">${date}</div>
    </div>
    <hr>
    <div class="cust">
      <div><b>Customer Name :</b> ${s.customer?.name ?? "Walk-in"}</div>
      <div><b>Phone No. :</b> ${s.customer?.phone ?? "--"}</div>
      <div><b>Address :</b> ${s.customer?.address ?? "--"}</div>
      ${s.workOrder ? `<div><b>Work Order :</b> ${s.workOrder}</div>` : ""}
    </div>
    <table class="items">
      <thead><tr><th>SL No</th><th>SKU</th><th>Product Name</th><th>Warranty</th><th>Unit Price</th><th>QTY</th><th>Price</th></tr></thead>
      <tbody>${rowsHtml(s)}</tbody>
    </table>
    <div class="below">
      <div class="words">
        <div><b>In Words :</b> ${inWords(s.grandTotal)}</div>
        ${s.note ? `<div>Remarks: ${s.note}</div>` : ""}
      </div>
      <table class="tot">${totalsRows(s)}</table>
    </div>
    <div class="by">
      <div><b>Created By:</b> ${s.soldBy?.name ?? "Excel Tech"}</div>
      ${s.assistedBy ? `<div><b>Assist By:</b> ${s.assistedBy}</div>` : ""}
    </div>
    <div class="terms"><h4>Terms &amp; Conditions:</h4>${TERMS.map((t) => `<div>• ${t}</div>`).join("")}</div>
  </div></body></html>`;
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
    <div class="ctr muted" style="margin-top:8px">Prepared by ${s.soldBy?.name ?? "Excel Tech"}${s.assistedBy ? `<br>Assist by ${s.assistedBy}` : ""}<br>Thank you for shopping!</div>
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
        <div className="card max-h-[76vh] overflow-y-auto bg-white p-6 text-black">
          <div className="flex justify-end"><button onClick={onClose}><X size={18} /></button></div>

          <div className="mt-8 border-t border-neutral-700" />
          <div className="flex items-center justify-between py-3">
            <div className="min-w-[150px] text-[13px]">{sale.invoiceNo}</div>
            <h2 className="text-xl font-bold tracking-wide">INVOICE</h2>
            <div className="min-w-[150px] text-right text-[13px]">{dt(sale.createdAt)}</div>
          </div>
          <div className="border-t border-neutral-700" />

          <div className="mt-4 text-[13px] leading-8">
            <div><b>Customer Name :</b> {sale.customer?.name ?? "Walk-in"}</div>
            <div><b>Phone No. :</b> {sale.customer?.phone ?? "--"}</div>
            <div><b>Address :</b> {sale.customer?.address ?? "--"}</div>
            {sale.workOrder && <div><b>Work Order :</b> {sale.workOrder}</div>}
          </div>

          <table className="mt-3 w-full border-collapse text-[13px]">
            <thead><tr className="bg-neutral-100">
              {["SL No", "SKU", "Product Name", "Warranty", "Unit Price", "QTY", "Price"].map((h) => (
                <th key={h} className="border border-neutral-700 px-2 py-1.5 text-center font-bold">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {sale.items.map((i, k) => (
                <tr key={k}>
                  <td className="border border-neutral-700 px-2 py-1.5 text-center">{k + 1}</td>
                  <td className="border border-neutral-700 px-2 py-1.5 text-center font-mono text-[12px]">{i.variant.sku}</td>
                  <td className="border border-neutral-700 px-2 py-1.5">{i.variant.product.name}
                    {i.serialUnits.length > 0 && <div className="mt-1 font-mono text-[11px] text-neutral-500">{i.serialUnits.map((u) => u.serialNo).join(", ")}</div>}
                  </td>
                  <td className="border border-neutral-700 px-2 py-1.5 text-center">{i.variant.product.warrantyPolicy?.name ?? ""}</td>
                  <td className="border border-neutral-700 px-2 py-1.5 text-right">{fmt(i.unitPrice)}</td>
                  <td className="border border-neutral-700 px-2 py-1.5 text-center">{qtyFmt(i.quantity)}</td>
                  <td className="border border-neutral-700 px-2 py-1.5 text-right">{fmt(i.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="pt-2 text-[13px]">
              <div><b>In Words :</b> {inWords(sale.grandTotal)}</div>
              {sale.note && <div>Remarks: {sale.note}</div>}
            </div>
            <table className="border-collapse text-[13px]">
              <tbody>
                <tr>
                  <td className="border border-neutral-700 px-3 py-1.5 text-center font-bold">Sub Total</td>
                  <td className="border border-neutral-700 px-3 py-1.5 text-center font-bold">{qtyFmt(qty)}</td>
                  <td className="border border-neutral-700 px-3 py-1.5 text-right font-bold">{fmt(sale.subTotal)}</td>
                </tr>
                {Number(sale.discount) > 0 && <TotRow label="Discount" value={`-${fmt(sale.discount)}`} />}
                {Number(sale.additionalExpense) > 0 && <TotRow label="Additional Expense" value={fmt(sale.additionalExpense)} />}
                {Number(sale.vat) > 0 && <TotRow label="VAT" value={fmt(sale.vat)} />}
                <TotRow label="Payable Amount" value={fmt(sale.grandTotal)} />
                {sale.payments.map((p, k) => <TotRow key={k} label={p.method.charAt(0) + p.method.slice(1).toLowerCase().replace(/_/g, " ")} value={fmt(p.amount)} />)}
                {Number(sale.dueTotal) > 0 && <TotRow label="Due" value={fmt(sale.dueTotal)} />}
              </tbody>
            </table>
          </div>

          <div className="mt-2 text-right text-[13px]">
            <div><b>Created By:</b> {sale.soldBy?.name ?? "Excel Tech"}</div>
            {sale.assistedBy && <div><b>Assist By:</b> {sale.assistedBy}</div>}
          </div>

          <div className="mt-8 text-[12.5px] leading-7">
            <h4 className="font-bold">Terms &amp; Conditions:</h4>
            {TERMS.map((t, k) => <div key={k}>• {t}</div>)}
          </div>
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

function TotRow({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td className="border border-neutral-700 px-3 py-1.5 text-center font-bold">{label}</td>
      <td className="border border-neutral-700 px-3 py-1.5" />
      <td className="border border-neutral-700 px-3 py-1.5 text-right font-bold">{value}</td>
    </tr>
  );
}
