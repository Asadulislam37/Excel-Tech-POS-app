"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { taka, dt } from "@/lib/format";
import { exportCsv, exportExcel } from "@/lib/export";
import { Download, Eye, FileSpreadsheet, MoreHorizontal, Pencil, Printer, Trash2 } from "lucide-react";
import { PurchaseTabs } from "@/components/PurchaseTabs";
import PurchaseView, { PurchaseDoc, purchaseA4 } from "@/components/PurchaseView";

type Purchase = PurchaseDoc & { supplier?: { name: string; phone?: string | null } | null };
type Data = { total: number; totalAmount: number; totalDue: number; rows: Purchase[] };

export default function PurchaseHistoryPage() {
  const [q, setQ] = useState("");
  const [date, setDate] = useState("");
  const [page, setPage] = useState(1);
  const [d, setD] = useState<Data | null>(null);
  const [view, setView] = useState<Purchase | null>(null);
  const [menuFor, setMenuFor] = useState("");
  const [confirmDel, setConfirmDel] = useState<Purchase | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const load = useCallback(async () => {
    const p = new URLSearchParams({ q, page: String(page) });
    if (date) p.set("date", date);
    const r = await fetch(`/api/purchase?${p}`);
    if (r.ok) setD(await r.json());
  }, [q, date, page]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  useEffect(() => { setPage(1); }, [q, date]);

  const qtyOf = (p: Purchase) => p.items.reduce((t, i) => t + i.quantity, 0);

  const doDelete = async () => {
    if (!confirmDel) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/purchase/${confirmDel.id}`, { method: "DELETE" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setConfirmDel(null); load();
    } catch (e) { alert(e instanceof Error ? e.message : "Delete failed."); }
    finally { setBusy(false); }
  };

  const HEAD = ["SL.", "Date & Time", "Invoice No.", "Supplier", "Phone", "Quantity", "Amount"];
  const sheet = () => (d?.rows ?? []).map((p, i) => [
    (page - 1) * 50 + i + 1, new Date(p.createdAt).toLocaleString("en-GB"), p.purchaseNo,
    p.supplier?.name ?? "", p.supplier?.phone ?? "", qtyOf(p), Number(p.grandTotal),
  ]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PurchaseTabs />
        <div className="card flex divide-x divide-line">
          <div className="px-4 py-2"><div className="text-[11px] font-semibold uppercase text-muted">Purchases</div><div className="text-xl font-bold">{d ? d.total : "…"}</div></div>
          <div className="px-4 py-2"><div className="text-[11px] font-semibold uppercase text-muted">Amount</div><div className="text-xl font-bold">{d ? taka(d.totalAmount) : "…"}</div></div>
          <div className="px-4 py-2"><div className="text-[11px] font-semibold uppercase text-muted">Due</div><div className="text-xl font-bold text-amber">{d ? taka(d.totalDue) : "…"}</div></div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[160px] flex-1 basis-[200px] lg:max-w-none"><input className="input" placeholder="Type here…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="min-w-[130px] basis-[150px]"><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div className="flex shrink-0 gap-2">
          <button className="btn btn-ghost px-3" title="Export to Excel" onClick={() => exportExcel("purchase-history", HEAD, sheet())}><FileSpreadsheet size={16} /></button>
          <button className="btn btn-ghost px-3" title="Download CSV" onClick={() => exportCsv("purchase-history", HEAD, sheet())}><Download size={16} /></button>
          <button className="btn btn-ghost px-3" title="Print" onClick={() => window.print()}><Printer size={16} /></button>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[860px]">
          <thead><tr>
            <th className="th">SL.</th><th className="th">Date &amp; Time</th><th className="th">Invoice No.</th>
            <th className="th">Supplier</th><th className="th">Phone</th><th className="th text-right">Quantity</th>
            <th className="th text-right">Amount</th><th className="th text-center">Action</th>
          </tr></thead>
          <tbody>
            {d?.rows.map((p, i) => (
              <tr key={p.id}>
                <td className="td">{(page - 1) * 50 + i + 1}</td>
                <td className="td text-[12px] text-muted">{dt(p.createdAt)}</td>
                <td className="td font-mono text-[12px]">{p.purchaseNo}</td>
                <td className="td font-semibold">{p.supplier?.name ?? "—"}</td>
                <td className="td font-mono text-[12px]">{p.supplier?.phone ?? "—"}</td>
                <td className="td text-right font-bold">{qtyOf(p)}</td>
                <td className="td text-right font-semibold">{taka(p.grandTotal)}{Number(p.dueTotal) > 0 && <div className="text-[11px] font-bold text-amber">due {taka(p.dueTotal)}</div>}</td>
                <td className="td">
                  <div className="relative flex items-center justify-center gap-1.5">
                    <button title="View" className="rounded-md bg-orange-100 p-2 text-orange-600 hover:bg-orange-200" onClick={() => setView(p)}><Eye size={14} /></button>
                    <button title="More" className="rounded-md bg-paper p-2 text-body hover:bg-line" onClick={() => setMenuFor(menuFor === p.id ? "" : p.id)}><MoreHorizontal size={14} /></button>
                    {menuFor === p.id && (
                      <div className="card absolute right-0 top-9 z-40 w-40 p-1 text-left shadow-lg">
                        <button className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[13px] font-semibold hover:bg-paper" onClick={() => { setMenuFor(""); router.push(`/purchase?edit=${p.id}`); }}><Pencil size={13} /> Edit</button>
                        <button className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[13px] font-semibold hover:bg-paper" onClick={() => { setMenuFor(""); const w = window.open("", "_blank", "width=900,height=800"); if (w) { w.document.write(purchaseA4(p).replace("</body>", "<script>window.onload=()=>window.print()<\/script></body>")); w.document.close(); } }}><Printer size={13} /> Print</button>
                        <button className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[13px] font-semibold text-red hover:bg-redsoft" onClick={() => { setMenuFor(""); setConfirmDel(p); }}><Trash2 size={13} /> Delete</button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {d && d.rows.length === 0 && <tr><td colSpan={8} className="td py-10 text-center text-muted">No purchases yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {d && d.total > 50 && (
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-muted">{d.total} purchases · page {page} of {Math.ceil(d.total / 50)}</span>
          <div className="flex gap-2">
            <button className="btn btn-ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>‹ Prev</button>
            <button className="btn btn-ghost" disabled={page >= Math.ceil(d.total / 50)} onClick={() => setPage((p) => p + 1)}>Next ›</button>
          </div>
        </div>
      )}

      {view && <PurchaseView purchase={view} onClose={() => setView(null)} />}

      {confirmDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setConfirmDel(null)}>
          <div className="card w-full max-w-sm space-y-4 p-7 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-redsoft"><Trash2 size={30} className="text-red" /></div>
            <h3 className="text-xl font-extrabold">Are you sure?</h3>
            <p className="text-[13px] text-muted">Delete purchase <b className="font-mono">{confirmDel.purchaseNo}</b>? Its stock and IMEIs will be removed. This is blocked if any unit was already sold.</p>
            <div className="flex justify-center gap-3">
              <button className="btn btn-ghost px-6" onClick={() => setConfirmDel(null)}>Cancel</button>
              <button className="btn px-6 text-white" style={{ background: "#2563eb" }} disabled={busy} onClick={doDelete}>{busy ? "Deleting…" : "Submit Now"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
