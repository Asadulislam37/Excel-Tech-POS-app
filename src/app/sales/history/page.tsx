"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { taka, dt } from "@/lib/format";
import { exportCsv, exportExcel } from "@/lib/export";
import { Download, Eye, FileSpreadsheet, MessageSquare, MoreHorizontal, Pencil, Printer, Trash2, Truck, X } from "lucide-react";
import SalesTabs from "@/components/SalesTabs";
import InvoiceView, { InvoiceSale } from "@/components/InvoiceView";

type Named = { id: string; name: string };
type Sale = InvoiceSale & { status: string; courierConsignmentId?: string | null; courierTracking?: string | null; courierStatus?: string | null };
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
  const [cfg, setCfg] = useState<{ outlets: Named[]; delivery?: { insideDhaka: number; outsideDhaka: number } } | null>(null);
  const [view, setView] = useState<Sale | null>(null);
  const [menuFor, setMenuFor] = useState("");
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  // Open the row menu at a fixed viewport position so it never shifts the table.
  const openMenu = (e: React.MouseEvent, id: string) => {
    if (menuFor === id) { setMenuFor(""); return; }
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenuPos({ top: r.bottom + 4, left: Math.max(8, r.right - 176) });
    setMenuFor(id);
  };
  const [confirmDel, setConfirmDel] = useState<Sale | null>(null);
  const [sms, setSms] = useState<Sale | null>(null);
  const [smsText, setSmsText] = useState("");
  const [courier, setCourier] = useState<Sale | null>(null);
  const [courierNote, setCourierNote] = useState("");
  const [courierMsg, setCourierMsg] = useState("");
  const [deliveryCharge, setDeliveryCharge] = useState(80); // Inside Dhaka default
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  // Shop-wide delivery charges from Configuration (fallback to 80 / 120).
  const insideCharge = cfg?.delivery?.insideDhaka ?? 80;
  const outsideCharge = cfg?.delivery?.outsideDhaka ?? 120;

  // Default the courier charge to the configured Inside-Dhaka rate when opening.
  const openCourier = (s: Sale) => { setDeliveryCharge(insideCharge); setCourier(s); };

  const sendToCourier = async () => {
    if (!courier) return;
    setBusy(true); setCourierMsg("");
    try {
      const res = await fetch("/api/steadfast", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ saleId: courier.id, note: courierNote, deliveryCharge }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setCourier(null); setCourierNote(""); load();
    } catch (e) { setCourierMsg(e instanceof Error ? e.message : "Failed."); }
    finally { setBusy(false); }
  };

  const refreshCourier = async (s: Sale) => {
    const res = await fetch(`/api/steadfast?saleId=${s.id}`);
    const d = await res.json();
    alert(res.ok ? `Parcel ${s.courierTracking}\nStatus: ${d.status}` : (d.error || "Could not fetch status."));
    load();
  };

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

  const openSms = (s: Sale) => {
    setSmsText(
      `Dear ${s.customer?.name ?? "Customer"}, thank you for your purchase at Excel Tech. ` +
      `Invoice ${s.invoiceNo}, amount ${taka(s.grandTotal)}` +
      (Number(s.dueTotal) > 0 ? `, due ${taka(s.dueTotal)}` : "") + "."
    );
    setSms(s);
  };

  const doDelete = async () => {
    if (!confirmDel) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/sales/${confirmDel.id}`, { method: "DELETE" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setConfirmDel(null);
      load();
    } catch (e) { alert(e instanceof Error ? e.message : "Delete failed."); }
    finally { setBusy(false); }
  };

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
                  <div className="flex items-center justify-center gap-1.5">
                    <button title="View invoice" className="rounded-md bg-orange-100 p-2 text-orange-600 hover:bg-orange-200" onClick={() => setView(s)}><Eye size={14} /></button>
                    <button title="More" className="rounded-md bg-paper p-2 text-body hover:bg-line" onClick={(e) => openMenu(e, s.id)}><MoreHorizontal size={14} /></button>
                    {menuFor === s.id && (
                      <>
                      <div className="fixed inset-0 z-40" onClick={() => setMenuFor("")} />
                      <div className="card fixed z-50 w-44 p-1 text-left shadow-lg" style={{ top: menuPos.top, left: menuPos.left }}>
                        <button className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[13px] font-semibold hover:bg-paper"
                          onClick={() => { setMenuFor(""); router.push(`/sales/pos?edit=${s.id}`); }}>
                          <Pencil size={13} /> Edit
                        </button>
                        <button className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[13px] font-semibold hover:bg-paper"
                          onClick={() => { setMenuFor(""); openSms(s); }}>
                          <MessageSquare size={13} /> Send SMS
                        </button>
                        {s.courierTracking ? (
                          <button className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[13px] font-semibold hover:bg-paper"
                            onClick={() => { setMenuFor(""); refreshCourier(s); }}>
                            <Truck size={13} /> Track parcel
                          </button>
                        ) : (
                          <button className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[13px] font-semibold hover:bg-paper"
                            onClick={() => { setMenuFor(""); openCourier(s); }}>
                            <Truck size={13} /> Send to Courier
                          </button>
                        )}
                        <button className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[13px] font-semibold text-red hover:bg-redsoft"
                          onClick={() => { setMenuFor(""); setConfirmDel(s); }}>
                          <Trash2 size={13} /> Delete
                        </button>
                      </div>
                      </>
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

      {view && <InvoiceView sale={view} onClose={() => setView(null)} />}

      {/* Delete confirmation */}
      {confirmDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setConfirmDel(null)}>
          <div className="card w-full max-w-sm space-y-4 p-7 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-redsoft">
              <Trash2 size={30} className="text-red" />
            </div>
            <h3 className="text-xl font-extrabold">Are you sure?</h3>
            <p className="text-[13px] text-muted">
              Delete invoice <b className="font-mono">{confirmDel.invoiceNo}</b>? The sold items go back into stock
              and any reward points are reversed.
            </p>
            <div className="flex justify-center gap-3">
              <button className="btn btn-ghost px-6" onClick={() => setConfirmDel(null)}>Cancel</button>
              <button className="btn px-6 text-white" style={{ background: "#2563eb" }} disabled={busy} onClick={doDelete}>
                {busy ? "Deleting…" : "Submit Now"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send to Courier */}
      {courier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setCourier(null)}>
          <div className="card w-full max-w-md space-y-3 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-lg font-bold"><Truck size={18} /> Send to Steadfast</h3>
              <button onClick={() => setCourier(null)}><X size={17} /></button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[13px]">
              <Info label="Invoice" value={courier.invoiceNo} />
              <Info label="Customer" value={courier.customer?.name ?? "—"} />
              <Info label="Phone" value={courier.customer?.phone ?? "—"} />
              <Info label="COD (due)" value={taka(courier.dueTotal)} />
            </div>
            <div className="rounded-lg bg-paper px-3 py-2 text-[12px]"><span className="text-muted">Address:</span> {courier.customer?.address ?? "— (required)"}</div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-[12px] font-semibold text-muted">Delivery Zone
                <select className="input mt-1" value={deliveryCharge === insideCharge ? "inside" : deliveryCharge === outsideCharge ? "outside" : "custom"}
                  onChange={(e) => {
                    if (e.target.value === "inside") setDeliveryCharge(insideCharge);
                    else if (e.target.value === "outside") setDeliveryCharge(outsideCharge);
                  }}>
                  <option value="inside">Inside Dhaka — {taka(insideCharge)}</option>
                  <option value="outside">Outside Dhaka — {taka(outsideCharge)}</option>
                  <option value="custom">Custom</option>
                </select>
              </label>
              <label className="block text-[12px] font-semibold text-muted">Delivery Charge
                <input type="number" min={0} className="input mt-1" value={deliveryCharge} onChange={(e) => setDeliveryCharge(Number(e.target.value) || 0)} />
              </label>
            </div>
            <label className="block text-[12px] font-semibold text-muted">Delivery note (optional)
              <input className="input mt-1" placeholder="e.g. Call before delivery" value={courierNote} onChange={(e) => setCourierNote(e.target.value)} />
            </label>
            <div className="rounded-md bg-ambersoft px-3 py-2 text-[12px] font-semibold text-amber">
              Steadfast will collect <b>{taka(Number(courier.dueTotal) + deliveryCharge)}</b> COD
              (product due {taka(courier.dueTotal)} + delivery {taka(deliveryCharge)}). Phone must be 11 digits, address required.
              {Number(courier.dueTotal) > 0 && <><br />The {taka(courier.dueTotal)} due is cleared automatically once Steadfast marks the parcel <b>delivered</b>.</>}
            </div>
            {courierMsg && <div className="rounded-md bg-redsoft px-3 py-2 text-[12px] font-semibold text-red">{courierMsg}</div>}
            <button className="btn btn-primary w-full py-3" disabled={busy} onClick={sendToCourier}>{busy ? "Creating parcel…" : "Create Parcel"}</button>
          </div>
        </div>
      )}

      {/* Send SMS */}
      {sms && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSms(null)}>
          <div className="card w-full max-w-md space-y-3 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Send SMS</h3>
              <button onClick={() => setSms(null)}><X size={17} /></button>
            </div>
            <label className="block text-[12px] font-semibold text-muted">To
              <input className="input mt-1 bg-paper" readOnly value={sms.customer?.phone ?? "No phone on this invoice"} />
            </label>
            <label className="block text-[12px] font-semibold text-muted">Message
              <textarea className="input mt-1 min-h-28" value={smsText} onChange={(e) => setSmsText(e.target.value)} />
            </label>
            <div className="text-[11px] text-muted">{smsText.length} characters · {Math.ceil(smsText.length / 160) || 1} SMS</div>
            <div className="rounded-md bg-ambersoft px-3 py-2 text-[12px] font-semibold text-amber">
              No SMS gateway is connected yet, so this can&apos;t send automatically. Copy the text or open it in your phone app.
            </div>
            <div className="flex gap-2">
              <button className="btn btn-ghost flex-1" onClick={() => { navigator.clipboard.writeText(smsText); setSms(null); }}>
                Copy text
              </button>
              <a className="btn btn-primary flex-1" href={`sms:${sms.customer?.phone ?? ""}?body=${encodeURIComponent(smsText)}`}
                onClick={() => setSms(null)}>
                Open in SMS app
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return <div className="rounded-lg bg-paper px-3 py-2"><div className="text-[11px] text-muted">{label}</div><div className="font-semibold">{value || "—"}</div></div>;
}
