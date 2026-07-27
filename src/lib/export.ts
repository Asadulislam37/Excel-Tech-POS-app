// Client-side table exports — no dependencies, no server round-trip.

const download = (blob: Blob, filename: string) => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
};

export function exportCsv(filename: string, head: string[], rows: (string | number)[][]) {
  const esc = (c: string | number) => `"${String(c).replace(/"/g, '""')}"`;
  const body = [head.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
  download(new Blob(["﻿" + body], { type: "text/csv;charset=utf-8" }), `${filename}.csv`);
}

// Excel opens an HTML table saved as .xls and keeps the column formatting.
export function exportExcel(filename: string, head: string[], rows: (string | number)[][]) {
  const esc = (c: string | number) =>
    String(c).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html =
    `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body>` +
    `<table border="1"><thead><tr>${head.map((h) => `<th style="background:#eee">${esc(h)}</th>`).join("")}</tr></thead>` +
    `<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></body></html>`;
  download(new Blob(["﻿" + html], { type: "application/vnd.ms-excel;charset=utf-8" }), `${filename}.xls`);
}
