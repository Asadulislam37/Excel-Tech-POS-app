"use client";

import { useCallback, useEffect, useState } from "react";
import { taka, dt } from "@/lib/format";
import { Eye, History, ImageIcon, Pencil, Plus, X } from "lucide-react";

type Customer = {
  id: string; name: string; phone: string; address?: string | null; imageUrl?: string | null;
  profession?: string | null; organization?: string | null;
  referenceName?: string | null; referencePhone?: string | null;
  totalPurchase: number; totalDue: number; rewardPoints: number;
};
type FullCustomer = Customer & {
  altPhone?: string | null; email?: string | null;
  familyName?: string | null; familyPhone?: string | null; referenceRelation?: string | null;
  designation?: string | null;
  sales: { id: string; invoiceNo: string; createdAt: string; grandTotal: string; dueTotal: string;
    items: { quantity: number; variant: { product: { name: string } } }[] }[];
};

const BLANK = {
  name: "", phone: "", address: "", familyName: "", familyPhone: "",
  referenceName: "", referencePhone: "", referenceRelation: "",
  profession: "", designation: "", organization: "",
};

export default function CustomersPage() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Customer[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState("");
  const [form, setForm] = useState({ ...BLANK });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<FullCustomer | null>(null);
  const [historyFor, setHistoryFor] = useState<FullCustomer | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/customers?q=${encodeURIComponent(q)}`);
    if (r.ok) setRows(await r.json());
  }, [q]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const openNew = () => { setErr(""); setEditId(""); setForm({ ...BLANK }); setShowForm(true); };
  const openEdit = async (id: string) => {
    const r = await fetch(`/api/customers/${id}`);
    if (!r.ok) return;
    const c = await r.json();
    setErr(""); setEditId(id);
    setForm({
      name: c.name ?? "", phone: c.phone ?? "", address: c.address ?? "",
      familyName: c.familyName ?? "", familyPhone: c.familyPhone ?? "",
      referenceName: c.referenceName ?? "", referencePhone: c.referencePhone ?? "", referenceRelation: c.referenceRelation ?? "",
      profession: c.profession ?? "", designation: c.designation ?? "", organization: c.organization ?? "",
    });
    setShowForm(true);
  };

  const save = async () => {
    setErr(""); setBusy(true);
    try {
      const res = await fetch(editId ? `/api/customers/${editId}` : "/api/customers", {
        method: editId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setShowForm(false); load();
    } catch (e) { setErr(e instanceof Error ? e.message : "Save failed."); }
    finally { setBusy(false); }
  };

  const openView = async (id: string, asHistory = false) => {
    const r = await fetch(`/api/customers/${id}`);
    if (!r.ok) return;
    const c = await r.json();
    if (asHistory) setHistoryFor(c); else setView(c);
  };

  const F = ({ label, k, ph, req }: { label: string; k: keyof typeof BLANK; ph?: string; req?: boolean }) => (
    <label className="block text-[12px] font-semibold text-muted">{label} {req && <span className="text-red">*</span>}
      <input className="input mt-1" placeholder={ph} value={form[k]} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} />
    </label>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-bold">Customer List</h1>
        <button className="btn text-white" style={{ background: "var(--amber)" }} onClick={openNew}><Plus size={15} /> Add Customer</button>
      </div>

      <input className="input" placeholder="Type here…" value={q} onChange={(e) => setQ(e.target.value)} />

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[980px]">
          <thead><tr>
            <th className="th">SL.</th><th className="th">Image</th><th className="th">Name</th><th className="th">Phone No.</th>
            <th className="th">Address</th><th className="th">Profession</th><th className="th">Organization</th>
            <th className="th">Reference Name</th><th className="th">Reference Phone</th><th className="th text-center">Actions</th>
          </tr></thead>
          <tbody>
            {rows.map((c, i) => (
              <tr key={c.id}>
                <td className="td">{i + 1}</td>
                <td className="td">
                  {c.imageUrl
                    ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={c.imageUrl} alt="" className="h-9 w-9 rounded-full border border-line object-cover" />
                    : <span className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-paper text-muted"><ImageIcon size={14} /></span>}
                </td>
                <td className="td font-semibold">{c.name}</td>
                <td className="td font-mono text-[12px]">{c.phone}</td>
                <td className="td max-w-[240px] text-[12px]">{c.address || "—"}</td>
                <td className="td">{c.profession || "—"}</td>
                <td className="td">{c.organization || "—"}</td>
                <td className="td">{c.referenceName || "—"}</td>
                <td className="td font-mono text-[12px]">{c.referencePhone || "—"}</td>
                <td className="td">
                  <div className="flex items-center justify-center gap-1.5">
                    <button title="View" className="rounded-md bg-orange-100 p-2 text-orange-600 hover:bg-orange-200" onClick={() => openView(c.id)}><Eye size={14} /></button>
                    <button title="Edit" className="rounded-md bg-blue-100 p-2 text-blue-700 hover:bg-blue-200" onClick={() => openEdit(c.id)}><Pencil size={14} /></button>
                    <button title="History" className="rounded-md bg-paper p-2 text-body hover:bg-line" onClick={() => openView(c.id, true)}><History size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={10} className="td py-10 text-center text-muted">No customers yet — add your first one.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Add / Edit form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowForm(false)}>
          <div className="card max-h-[90vh] w-full max-w-2xl space-y-4 overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h3 className="text-lg font-bold">{editId ? "Edit Customer" : "Add New Customer"}</h3><button onClick={() => setShowForm(false)}><X size={18} /></button></div>

            <section className="rounded-lg bg-paper p-4">
              <h4 className="font-bold">Basic Info</h4>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <F label="Customer Name" k="name" ph="Full name" req />
                <F label="Phone" k="phone" ph="01XXXXXXXXX" req />
              </div>
              <label className="mt-3 block text-[12px] font-semibold text-muted">Address
                <textarea className="input mt-1 min-h-20" placeholder="Enter customer address…" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
              </label>
            </section>

            <section className="rounded-lg bg-paper p-4">
              <h4 className="font-bold">Family Info</h4>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <F label="Family Member Name" k="familyName" ph="Name" />
                <F label="Family Member Phone" k="familyPhone" ph="Phone" />
              </div>
            </section>

            <section className="rounded-lg bg-paper p-4">
              <h4 className="font-bold">Reference Info</h4>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <F label="Reference Name" k="referenceName" ph="Name" />
                <F label="Reference Phone" k="referencePhone" ph="Phone" />
                <F label="Reference Relation" k="referenceRelation" ph="Relation" />
              </div>
            </section>

            <section className="rounded-lg bg-paper p-4">
              <h4 className="font-bold">Professional Info</h4>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <F label="Profession" k="profession" ph="Profession" />
                <F label="Designation" k="designation" ph="Designation" />
                <F label="Organization" k="organization" ph="Organization" />
              </div>
            </section>

            {err && <div className="rounded-md bg-redsoft px-3 py-2 text-[12px] font-semibold text-red">{err}</div>}
            <button className="btn w-full py-3 text-white" style={{ background: "var(--amber)" }} disabled={busy} onClick={save}>
              {busy ? "Saving…" : editId ? "Update Customer" : "Create Customer"}
            </button>
          </div>
        </div>
      )}

      {/* View detail */}
      {view && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setView(null)}>
          <div className="card max-h-[90vh] w-full max-w-lg space-y-3 overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h3 className="text-lg font-bold">{view.name}</h3><button onClick={() => setView(null)}><X size={18} /></button></div>
            <div className="grid grid-cols-2 gap-2 text-[13px]">
              <Info label="Phone" value={view.phone} /><Info label="Reward Points" value={String(view.rewardPoints)} />
              <Info label="Total Purchase" value={taka(view.totalPurchase)} /><Info label="Outstanding Due" value={taka(view.totalDue)} />
              <Info label="Profession" value={view.profession} /><Info label="Organization" value={view.organization} />
              <Info label="Reference" value={view.referenceName} /><Info label="Reference Phone" value={view.referencePhone} />
              <Info label="Family Member" value={view.familyName} /><Info label="Family Phone" value={view.familyPhone} />
            </div>
            <Info label="Address" value={view.address} />
          </div>
        </div>
      )}

      {/* Purchase history */}
      {historyFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setHistoryFor(null)}>
          <div className="card max-h-[90vh] w-full max-w-2xl space-y-3 overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div><h3 className="text-lg font-bold">{historyFor.name}</h3><p className="text-[12px] text-muted">{historyFor.sales.length} invoice(s) · {taka(historyFor.totalPurchase)} lifetime · {taka(historyFor.totalDue)} due</p></div>
              <button onClick={() => setHistoryFor(null)}><X size={18} /></button>
            </div>
            <table className="w-full">
              <thead><tr><th className="th">Invoice</th><th className="th">Items</th><th className="th text-right">Total</th><th className="th text-right">Due</th></tr></thead>
              <tbody>
                {historyFor.sales.map((s) => (
                  <tr key={s.id}>
                    <td className="td"><div className="font-mono text-[12px]">{s.invoiceNo}</div><div className="text-[11px] text-muted">{dt(s.createdAt)}</div></td>
                    <td className="td text-[12px] text-muted">{s.items.map((i) => `${i.quantity}× ${i.variant.product.name}`).slice(0, 2).join(", ")}{s.items.length > 2 && "…"}</td>
                    <td className="td text-right font-semibold">{taka(s.grandTotal)}</td>
                    <td className="td text-right">{Number(s.dueTotal) > 0 ? <span className="font-bold text-amber">{taka(s.dueTotal)}</span> : "—"}</td>
                  </tr>
                ))}
                {historyFor.sales.length === 0 && <tr><td colSpan={4} className="td py-8 text-center text-muted">No purchases yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return <div className="rounded-lg bg-paper px-3 py-2"><div className="text-[11px] text-muted">{label}</div><div className="font-semibold">{value || "—"}</div></div>;
}
