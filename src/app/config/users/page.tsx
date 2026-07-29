"use client";

import { useEffect, useState } from "react";
import { UserPlus, ShieldCheck, KeyRound, Trash2, X, Check } from "lucide-react";

type User = { id: string; name: string; email: string; role: string; isActive: boolean; createdAt: string };
const ROLES = ["ADMIN", "MANAGER", "SALESMAN", "ACCOUNTANT"];

export default function UsersPage() {
  const [users, setUsers] = useState<User[] | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "SALESMAN" });
  const [resetFor, setResetFor] = useState<User | null>(null);
  const [newPass, setNewPass] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const r = await fetch("/api/users");
    if (r.status === 403) return setForbidden(true);
    if (r.ok) setUsers(await r.json());
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    setErr(""); setBusy(true);
    try {
      const r = await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setShowAdd(false); setForm({ name: "", email: "", password: "", role: "SALESMAN" }); load();
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed."); }
    finally { setBusy(false); }
  };

  const patch = async (id: string, body: Record<string, unknown>) => {
    const r = await fetch("/api/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...body }) });
    const d = await r.json();
    if (!r.ok) return alert(d.error);
    load();
  };

  const resetPassword = async () => {
    if (!resetFor) return;
    setErr(""); setBusy(true);
    try {
      const r = await fetch("/api/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: resetFor.id, password: newPass }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setResetFor(null); setNewPass("");
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed."); }
    finally { setBusy(false); }
  };

  const remove = async (u: User) => {
    if (!confirm(`Delete ${u.name}? If they have records they'll be deactivated instead.`)) return;
    const r = await fetch(`/api/users?id=${u.id}`, { method: "DELETE" });
    const d = await r.json();
    if (!r.ok) { if (confirm(`${d.error}\n\nDeactivate ${u.name} now?`)) patch(u.id, { isActive: false }); return; }
    load();
  };

  if (forbidden)
    return <div className="card mx-auto max-w-md p-8 text-center"><ShieldCheck size={30} className="mx-auto text-muted" /><h1 className="mt-2 font-bold">Admins only</h1><p className="mt-1 text-[13px] text-muted">Only an admin can manage staff accounts.</p></div>;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold"><ShieldCheck size={18} /> User Management</h1>
          <p className="text-[13px] text-muted">Control who can log in. Public sign-up is closed — add staff here.</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setShowAdd(true); setErr(""); }}><UserPlus size={15} /> Add user</button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[620px]">
          <thead><tr>
            <th className="th">Name</th><th className="th">Email</th><th className="th">Role</th>
            <th className="th text-center">Active</th><th className="th text-center">Actions</th>
          </tr></thead>
          <tbody>
            {users?.map((u) => (
              <tr key={u.id}>
                <td className="td font-semibold">{u.name}</td>
                <td className="td text-[12px] text-muted">{u.email}</td>
                <td className="td">
                  <select className="input h-8 py-0 text-[12px]" value={u.role} onChange={(e) => patch(u.id, { role: e.target.value })}>
                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </td>
                <td className="td text-center">
                  <button onClick={() => patch(u.id, { isActive: !u.isActive })}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${u.isActive ? "bg-tealsoft text-tealdark" : "bg-redsoft text-red"}`}>
                    {u.isActive ? "Active" : "Disabled"}
                  </button>
                </td>
                <td className="td">
                  <div className="flex items-center justify-center gap-1.5">
                    <button title="Reset password" className="rounded-md bg-paper p-2 hover:bg-line" onClick={() => { setResetFor(u); setNewPass(""); setErr(""); }}><KeyRound size={14} /></button>
                    <button title="Delete" className="rounded-md bg-redsoft p-2 text-red hover:bg-red hover:text-white" onClick={() => remove(u)}><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {users && users.length === 0 && <tr><td colSpan={5} className="td py-8 text-center text-muted">No users yet.</td></tr>}
            {!users && <tr><td colSpan={5} className="td py-8 text-center text-muted">Loading…</td></tr>}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowAdd(false)}>
          <div className="card w-full max-w-sm space-y-3 p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h3 className="font-bold">Add user</h3><button onClick={() => setShowAdd(false)}><X size={17} /></button></div>
            <input className="input" placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className="input" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <input className="input" type="password" placeholder="Password (min 6 chars)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            {err && <div className="rounded-md bg-redsoft px-3 py-2 text-[12px] font-semibold text-red">{err}</div>}
            <button className="btn btn-primary w-full" disabled={busy} onClick={add}>{busy ? "Saving…" : "Create user"}</button>
          </div>
        </div>
      )}

      {resetFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setResetFor(null)}>
          <div className="card w-full max-w-sm space-y-3 p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h3 className="font-bold">Reset password</h3><button onClick={() => setResetFor(null)}><X size={17} /></button></div>
            <p className="text-[13px] text-muted">New password for <b>{resetFor.name}</b></p>
            <input className="input" type="password" placeholder="New password (min 6 chars)" value={newPass} onChange={(e) => setNewPass(e.target.value)} />
            {err && <div className="rounded-md bg-redsoft px-3 py-2 text-[12px] font-semibold text-red">{err}</div>}
            <button className="btn btn-primary w-full" disabled={busy} onClick={resetPassword}><Check size={15} /> {busy ? "Saving…" : "Set password"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
