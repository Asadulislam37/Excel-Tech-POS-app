"use client";

import { useCallback, useEffect, useState } from "react";
import { taka } from "@/lib/format";

type Row = { id: string; code: string; name: string; type: string; opening: number };
type Data = { rows: Row[]; totalDebit: number; totalCredit: number; balanced: boolean };

const TINT: Record<string, string> = {
  ASSET: "bg-tealsoft text-tealdark", LIABILITY: "bg-ambersoft text-amber",
  EQUITY: "bg-paper text-body", INCOME: "bg-tealsoft text-tealdark", EXPENSE: "bg-redsoft text-red",
};

export default function OpeningPage() {
  const [d, setD] = useState<Data | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState("");

  const load = useCallback(async () => {
    const r = await fetch("/api/accounts/opening");
    if (r.ok) setD(await r.json());
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async (row: Row) => {
    const val = edits[row.id];
    if (val === undefined) return;
    setSavingId(row.id);
    await fetch("/api/accounts/opening", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: row.id, opening: Number(val) || 0 }) });
    setEdits((e) => { const n = { ...e }; delete n[row.id]; return n; });
    setSavingId("");
    load();
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">Chart Of Account Opening</h1>
          <p className="text-[12px] text-muted">Set the starting balance for each account. Enter a figure and click Save on that row.</p>
        </div>
        {d && (
          <div className={`card px-4 py-2 ${d.balanced ? "" : "border-red"}`}>
            <div className="text-[11px] font-semibold uppercase text-muted">Openings</div>
            <div className={`text-lg font-bold ${d.balanced ? "text-tealdark" : "text-red"}`}>{d.balanced ? "Balanced ✓" : "Out of balance"}</div>
          </div>
        )}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead><tr><th className="th">Code</th><th className="th">Account Name</th><th className="th">Type</th><th className="th text-right">Opening Balance</th><th className="th text-center">Save</th></tr></thead>
          <tbody>
            {d?.rows.map((r) => {
              const dirty = edits[r.id] !== undefined;
              return (
                <tr key={r.id}>
                  <td className="td font-mono text-[12px]">{r.code}</td>
                  <td className="td font-semibold">{r.name}</td>
                  <td className="td"><span className={`rounded px-2 py-0.5 text-[11px] font-bold ${TINT[r.type]}`}>{r.type}</span></td>
                  <td className="td text-right">
                    <input type="number" className="input w-36 text-right" value={dirty ? edits[r.id] : String(r.opening || "")}
                      onChange={(e) => setEdits((ed) => ({ ...ed, [r.id]: e.target.value }))} />
                  </td>
                  <td className="td text-center">
                    <button className="btn btn-primary py-1.5 text-[12px]" disabled={!dirty || savingId === r.id} onClick={() => save(r)}>
                      {savingId === r.id ? "…" : "Save"}
                    </button>
                  </td>
                </tr>
              );
            })}
            {d && d.rows.length === 0 && <tr><td colSpan={5} className="td py-10 text-center text-muted">No accounts.</td></tr>}
          </tbody>
          {d && (
            <tfoot><tr className="bg-paper font-bold">
              <td className="td" colSpan={3}>Total (debit-natural vs credit-natural)</td>
              <td className="td text-right">{taka(d.totalDebit)} / {taka(d.totalCredit)}</td>
              <td className="td" />
            </tr></tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
