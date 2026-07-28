"use client";

import { Download, FileSpreadsheet, Printer } from "lucide-react";
import { exportCsv, exportExcel } from "@/lib/export";
import DateInput from "@/components/DateInput";

/** Shared header for the financial reports: title, date controls, export buttons. */
export default function ReportShell({
  title, subtitle, dates, filename, head, rows, children, badge,
}: {
  title: string;
  subtitle?: string;
  dates: React.ReactNode;
  filename: string;
  head: string[];
  rows: () => (string | number)[][];
  children: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">{title}</h1>
          {subtitle && <p className="text-[12px] text-muted">{subtitle}</p>}
        </div>
        {badge}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {dates}
        <div className="flex shrink-0 gap-2">
          <button className="btn btn-ghost px-3" title="Export to Excel" onClick={() => exportExcel(filename, head, rows())}><FileSpreadsheet size={16} /></button>
          <button className="btn btn-ghost px-3" title="Download CSV" onClick={() => exportCsv(filename, head, rows())}><Download size={16} /></button>
          <button className="btn btn-ghost px-3" title="Print" onClick={() => window.print()}><Printer size={16} /></button>
        </div>
      </div>

      {children}
    </div>
  );
}

export const DateBox = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
  <div className="min-w-[130px] flex-1 basis-[140px] lg:max-w-[170px]">
    <DateInput value={value} onChange={(e) => onChange(e.target.value)} />
  </div>
);
