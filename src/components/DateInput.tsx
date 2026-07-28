"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Calendar as CalIcon, ChevronLeft, ChevronRight, X } from "lucide-react";

// A fully-English date picker used in place of the native <input type="date">,
// whose calendar popup otherwise follows the browser's locale (Chinese here).
// Drop-in: same value (yyyy-mm-dd) and onChange({ target: { value } }) contract.

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DOW = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fromISO = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, (m || 1) - 1, d || 1); };
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export default function DateInput({
  value, onChange, className = "input", placeholder = "dd/mm/yyyy",
}: {
  value: string;
  onChange: (e: { target: { value: string } }) => void;
  className?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = value ? fromISO(value) : null;
  const [view, setView] = useState<Date>(selected ?? new Date());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { if (selected) setView(selected); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [value]);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const display = selected
    ? `${String(selected.getDate()).padStart(2, "0")}/${String(selected.getMonth() + 1).padStart(2, "0")}/${selected.getFullYear()}`
    : "";

  // Days grid for the current month view, Monday-first, padded with blanks.
  const cells = useMemo(() => {
    const first = new Date(view.getFullYear(), view.getMonth(), 1);
    const startPad = (first.getDay() + 6) % 7; // Mon=0 … Sun=6
    const days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    const out: (Date | null)[] = [];
    for (let i = 0; i < startPad; i++) out.push(null);
    for (let d = 1; d <= days; d++) out.push(new Date(view.getFullYear(), view.getMonth(), d));
    return out;
  }, [view]);

  const pick = (d: Date) => { onChange({ target: { value: toISO(d) } }); setOpen(false); };
  const today = new Date();

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)}
        className={`${className} flex items-center justify-between gap-2 text-left`}>
        <span className={display ? "" : "text-muted"}>{display || placeholder}</span>
        <span className="flex items-center gap-1 text-muted">
          {display && <X size={14} className="hover:text-red" onClick={(e) => { e.stopPropagation(); onChange({ target: { value: "" } }); }} />}
          <CalIcon size={15} />
        </span>
      </button>

      {open && (
        <div className="card absolute left-0 top-11 z-50 w-64 p-3 shadow-lg">
          <div className="flex items-center justify-between">
            <button type="button" className="rounded-md p-1 hover:bg-paper" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}>
              <ChevronLeft size={16} />
            </button>
            <div className="text-[13px] font-bold">{MONTHS[view.getMonth()]} {view.getFullYear()}</div>
            <button type="button" className="rounded-md p-1 hover:bg-paper" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}>
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="mt-2 grid grid-cols-7 gap-0.5 text-center text-[11px] font-semibold text-muted">
            {DOW.map((d) => <div key={d} className="py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((d, i) => d ? (
              <button key={i} type="button" onClick={() => pick(d)}
                className={`rounded-md py-1.5 text-[12px] transition-colors ${
                  selected && sameDay(d, selected) ? "bg-teal font-bold text-white"
                  : sameDay(d, today) ? "bg-tealsoft font-semibold text-tealdark"
                  : "hover:bg-paper"}`}>
                {d.getDate()}
              </button>
            ) : <div key={i} />)}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-line pt-2 text-[12px] font-semibold">
            <button type="button" className="text-red hover:underline" onClick={() => { onChange({ target: { value: "" } }); setOpen(false); }}>Clear</button>
            <button type="button" className="text-tealdark hover:underline" onClick={() => pick(new Date())}>Today</button>
          </div>
        </div>
      )}
    </div>
  );
}
