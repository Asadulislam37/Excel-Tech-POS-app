"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";

export type Field = {
  key: string;
  label: string;
  type?: "text" | "number" | "checkbox";
  placeholder?: string;
  width?: string;
};

type Row = Record<string, unknown> & { id: string };

/** Shared add/edit/delete screen for every simple configuration list. */
export default function ConfigCrud({
  kind, title, subtitle, fields,
}: {
  kind: string;
  title: string;
  subtitle?: string;
  fields: Field[];
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [show, setShow] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState<Record<string, string | boolean>>({});
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(`/api/config/${kind}`);
    if (r.ok) setRows(await r.json());
  }, [kind]);
  useEffect(() => { load(); }, [load]);

  const blank = () => Object.fromEntries(fields.map((f) => [f.key, f.type === "checkbox" ? false : ""]));

  const openNew = () => { setErr(""); setEditing(null); setForm(blank()); setShow(true); };
  const openEdit = (row: Row) => {
    setErr(""); setEditing(row);
    setForm(Object.fromEntries(fields.map((f) => [f.key, f.type === "checkbox" ? Boolean(row[f.key]) : String(row[f.key] ?? "")])));
    setShow(true);
  };

  const save = async () => {
    setErr(""); setBusy(true);
    try {
      const res = await fetch(`/api/config/${kind}`, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? { ...form, id: editing.id } : form),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setShow(false);
      load();
    } catch (e) { setErr(e instanceof Error ? e.message : "Save failed."); }
    finally { setBusy(false); }
  };

  const remove = async (row: Row) => {
    if (!confirm(`Delete "${row.name}"?`)) return;
    const res = await fetch(`/api/config/${kind}?id=${row.id}`, { method: "DELETE" });
    const d = await res.json();
    if (!res.ok) return alert(d.error);
    load();
  };

  const filtered = rows.filter((r) =>
    !q || String(r.name ?? "").toLowerCase().includes(q.toLowerCase()));

  const render = (row: Row, f: Field) => {
    const v = row[f.key];
    if (f.type === "checkbox") return v ? <span className="rounded bg-tealsoft px-2 py-0.5 text-[11px] font-bold text-tealdark">Yes</span> : <span className="text-muted">—</span>;
    if (v === null || v === undefined || v === "") return <span className="text-muted">—</span>;
    return String(v);
  };

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-lg font-bold">{title}</h1>
        {subtitle && <p className="text-[12px] text-muted">{subtitle}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button className="btn text-white" style={{ background: "var(--amber)" }} onClick={openNew}>
          <Plus size={15} /> Create
        </button>
        <div className="min-w-[150px] flex-1 basis-[180px] lg:max-w-[240px]">
          <input className="input" placeholder="Type here…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <span className="ml-auto text-[12px] text-muted">{filtered.length} entries</span>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[480px]">
          <thead><tr>
            <th className="th">SL.</th>
            {fields.map((f) => <th key={f.key} className="th">{f.label}</th>)}
            <th className="th text-center">Action</th>
          </tr></thead>
          <tbody>
            {filtered.map((row, i) => (
              <tr key={row.id}>
                <td className="td">{i + 1}</td>
                {fields.map((f) => (
                  <td key={f.key} className={`td ${f.key === "name" ? "font-semibold" : ""}`}>{render(row, f)}</td>
                ))}
                <td className="td">
                  <div className="flex items-center justify-center gap-1.5">
                    <button title="Edit" className="rounded-md bg-blue-100 p-2 text-blue-700 hover:bg-blue-200" onClick={() => openEdit(row)}><Pencil size={14} /></button>
                    <button title="Delete" className="rounded-md bg-red-100 p-2 text-red-700 hover:bg-red-200" onClick={() => remove(row)}><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={fields.length + 2} className="td py-10 text-center text-muted">Nothing here yet — click Create to add the first one.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShow(false)}>
          <div className="card w-full max-w-md space-y-3 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">{editing ? `Edit ${title}` : `New ${title}`}</h3>
              <button onClick={() => setShow(false)}><X size={17} /></button>
            </div>
            {fields.map((f) => (
              f.type === "checkbox" ? (
                <label key={f.key} className="flex items-center justify-between rounded-lg border border-line px-3 py-2.5 text-[13px] font-semibold">
                  {f.label}
                  <input type="checkbox" className="h-4 w-4 accent-[var(--teal)]"
                    checked={Boolean(form[f.key])} onChange={(e) => setForm({ ...form, [f.key]: e.target.checked })} />
                </label>
              ) : (
                <label key={f.key} className="block text-[12px] font-semibold text-muted">{f.label}
                  <input type={f.type === "number" ? "number" : "text"} className="input mt-1"
                    placeholder={f.placeholder}
                    value={String(form[f.key] ?? "")}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
                </label>
              )
            ))}
            {err && <div className="rounded-md bg-redsoft px-3 py-2 text-[12px] font-semibold text-red">{err}</div>}
            <button className="btn btn-primary w-full py-3" disabled={busy} onClick={save}>
              {busy ? "Saving…" : editing ? "Update Now" : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
