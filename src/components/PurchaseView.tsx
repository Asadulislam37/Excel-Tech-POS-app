"use client";

import { taka, dt } from "@/lib/format";
import { takaInWords } from "@/lib/words";
import { Download, Printer, X } from "lucide-react";

export type PurchaseDoc = {
  id: string; purchaseNo: string; createdAt: string; note?: string | null;
  subTotal: string; discount: string; additionalExpense: string; grandTotal: string; paidTotal: string; dueTotal: string;
  supplier?: { name: string; phone?: string | null; address?: string | null } | null;
  outlet?: { name: string; address?: string | null; phone?: string | null } | null;
  items: {
    quantity: number; unitCost: string; lineTotal: string;
    variant: { sku: string; color?: { name: string } | null; size?: { name: string } | null; product: { name: string } };
    serialUnits: { serialNo: string }[];
  }[];
};

const rowsHtml = (p: PurchaseDoc) =>
  p.items.map((i, k) => {
    const variant = [i.variant.color?.name, i.variant.size?.name].filter(Boolean).join(" ");
    return `<tr>
      <td class="c">${k + 1}</td>
      <td>${i.variant.product.name}${variant ? ` - ${variant}` : ""}${i.serialUnits.length ? `<div class="ser">${i.serialUnits.map((u) => u.serialNo).join(", ")}</div>` : ""}</td>
      <td class="c">--</td>
      <td class="c">${i.quantity}</td>
      <td class="r">${Number(i.unitCost).toLocaleString()}</td>
      <td class="r">${Number(i.lineTotal).toLocaleString()}</td>
    </tr>`;
  }).join("");

export function purchaseA4(p: PurchaseDoc) {
  return `<html><head><meta charset="utf-8"><title>${p.purchaseNo}</title><style>
    body{font-family:"Segoe UI",sans-serif;color:#111;padding:28px;margin:0}
    .brand{display:flex;justify-content:space-between;align-items:flex-start}
    .brand h2{margin:0;font-size:16px}.muted{color:#555;font-size:12px}
    .title{background:#e7f4ec;text-align:center;font-size:19px;font-weight:700;padding:8px;border-bottom:3px solid #026a40;margin-top:12px}
    .head{display:flex;justify-content:space-between;margin-top:12px;font-size:13px;line-height:1.9}
    table{width:100%;border-collapse:collapse;margin-top:14px;font-size:13px}
    th{background:#fdf6ec;border:1px solid #e6ddd2;padding:8px}
    td{border:1px solid #e6ddd2;padding:8px}
    .c{text-align:center}.r{text-align:right}.ser{font-family:monospace;font-size:11px;color:#666}
    .below{display:flex;justify-content:space-between;margin-top:14px;font-size:13px}
    .totals{background:#fdf6ec;border-radius:8px;padding:12px 16px;min-width:260px}
    .totals div{display:flex;justify-content:space-between;gap:28px;padding:2px 0}
    @media print{body{padding:0}}
  </style></head><body>
    <div class="brand"><div><h2>EXCEL TECH</h2><div class="muted">Phone: ${p.outlet?.phone ?? "01715894999"}</div><div class="muted">${p.outlet?.address ?? "Shyamoli Square Shopping Complex, Dhaka"}</div></div></div>
    <div class="title">Purchase Order</div>
    <div class="head">
      <div>
        <div>Supplier Name : <b>${p.supplier?.name ?? "-"}</b></div>
        <div>Phone : <b>${p.supplier?.phone ?? "-"}</b></div>
        <div>Address : ${p.supplier?.address ?? "-"}</div>
      </div>
      <div style="text-align:right">
        <div>Invoice No : <b>${p.purchaseNo}</b></div>
        <div>Date &amp; Time : ${new Date(p.createdAt).toLocaleString("en-GB")}</div>
      </div>
    </div>
    <table><thead><tr><th>Sl No.</th><th>Product Name</th><th>Warranty</th><th>Quantity</th><th>Unit Price</th><th>Total</th></tr></thead>
    <tbody>${rowsHtml(p)}</tbody></table>
    <div class="below">
      <div>In words : ${takaInWords(p.grandTotal)}${p.note ? `<br>Remarks: ${p.note}` : ""}</div>
      <div class="totals">
        <div><span>Total Quantity</span><b>${p.items.reduce((t, i) => t + i.quantity, 0)}</b></div>
        <div><span>Sub Total</span><b>${Number(p.subTotal).toLocaleString()}</b></div>
        ${Number(p.discount) ? `<div><span>Discount</span><b>-${Number(p.discount).toLocaleString()}</b></div>` : ""}
        ${Number(p.additionalExpense) ? `<div><span>Additional Expense</span><b>${Number(p.additionalExpense).toLocaleString()}</b></div>` : ""}
        <div><span>Payable Amount</span><b>${Number(p.grandTotal).toLocaleString()}</b></div>
        <div><span>Paid</span><b>${Number(p.paidTotal).toLocaleString()}</b></div>
        ${Number(p.dueTotal) ? `<div><span>Due</span><b>${Number(p.dueTotal).toLocaleString()}</b></div>` : ""}
      </div>
    </div>
  </body></html>`;
}

function printDoc(html: string) {
  const w = window.open("", "_blank", "width=900,height=800");
  if (!w) return alert("Allow pop-ups to print.");
  w.document.write(html.replace("</body>", "<script>window.onload=()=>window.print()<\/script></body>"));
  w.document.close();
}

export default function PurchaseView({ purchase, onClose }: { purchase: PurchaseDoc; onClose: () => void }) {
  const qty = purchase.items.reduce((t, i) => t + i.quantity, 0);
  const download = () => {
    const blob = new Blob([purchaseA4(purchase)], { type: "text/html;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `${purchase.purchaseNo}.html`; a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="card max-h-[76vh] overflow-y-auto p-6">
          <div className="flex items-start justify-between">
            <div><h2 className="font-bold">EXCEL TECH</h2><div className="text-[12px] text-muted">Phone: {purchase.outlet?.phone ?? "01715894999"}</div><div className="text-[12px] text-muted">{purchase.outlet?.address ?? "Shyamoli Square Shopping Complex"}</div></div>
            <button onClick={onClose}><X size={18} /></button>
          </div>
          <div className="mt-3 rounded bg-tealsoft py-2 text-center text-lg font-bold" style={{ borderBottom: "3px solid var(--teal)" }}>Purchase Order</div>
          <div className="mt-3 flex flex-wrap justify-between gap-4 text-[13px] leading-7">
            <div>
              <div>Supplier Name : <b>{purchase.supplier?.name ?? "-"}</b></div>
              <div>Phone : <b>{purchase.supplier?.phone ?? "-"}</b></div>
              <div>Address : {purchase.supplier?.address ?? "-"}</div>
            </div>
            <div className="text-right">
              <div>Invoice No : <b>{purchase.purchaseNo}</b></div>
              <div>Date &amp; Time : {dt(purchase.createdAt)}</div>
            </div>
          </div>
          <table className="mt-4 w-full text-[13px]">
            <thead><tr><th className="th text-center">Sl</th><th className="th">Product</th><th className="th text-center">Warranty</th><th className="th text-center">Qty</th><th className="th text-right">Unit Price</th><th className="th text-right">Total</th></tr></thead>
            <tbody>
              {purchase.items.map((i, k) => (
                <tr key={k}>
                  <td className="td text-center">{k + 1}</td>
                  <td className="td">{i.variant.product.name}
                    {i.serialUnits.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{i.serialUnits.map((u) => <span key={u.serialNo} className="serial-chip">{u.serialNo}</span>)}</div>}
                  </td>
                  <td className="td text-center">--</td>
                  <td className="td text-center">{i.quantity}</td>
                  <td className="td text-right">{taka(i.unitCost)}</td>
                  <td className="td text-right font-semibold">{taka(i.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 flex flex-wrap justify-between gap-4 text-[13px]">
            <div className="max-w-sm">In words : {takaInWords(purchase.grandTotal)}{purchase.note && <div>Remarks: {purchase.note}</div>}</div>
            <div className="min-w-[250px] rounded-lg bg-ambersoft px-4 py-3">
              <div className="flex justify-between"><span>Total Quantity</span><b>{qty}</b></div>
              <div className="flex justify-between"><span>Sub Total</span><b>{taka(purchase.subTotal)}</b></div>
              {Number(purchase.discount) > 0 && <div className="flex justify-between"><span>Discount</span><b>−{taka(purchase.discount)}</b></div>}
              {Number(purchase.additionalExpense) > 0 && <div className="flex justify-between"><span>Additional Expense</span><b>{taka(purchase.additionalExpense)}</b></div>}
              <div className="flex justify-between"><span>Payable Amount</span><b>{taka(purchase.grandTotal)}</b></div>
              <div className="flex justify-between"><span>Paid</span><b>{taka(purchase.paidTotal)}</b></div>
              {Number(purchase.dueTotal) > 0 && <div className="flex justify-between text-amber"><span>Due</span><b>{taka(purchase.dueTotal)}</b></div>}
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap justify-center gap-3">
          <button className="btn text-white" style={{ background: "#a855f7" }} onClick={() => printDoc(purchaseA4(purchase))}><Printer size={15} /> A4 Print</button>
          <button className="btn text-white" style={{ background: "var(--amber)" }} onClick={download}><Download size={15} /> Download</button>
        </div>
      </div>
    </div>
  );
}
