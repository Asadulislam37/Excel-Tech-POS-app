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

// PDF: open a clean, print-ready table and let the browser "Save as PDF".
// No dependency, works on desktop and mobile browsers.
export function exportPdf(filename: string, head: string[], rows: (string | number)[][], title?: string) {
  const esc = (c: string | number) =>
    String(c).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const w = window.open("", "_blank", "width=1000,height=800");
  if (!w) { alert("Allow pop-ups to download the PDF."); return; }
  w.document.write(
    `<html><head><meta charset="utf-8"><title>${esc(title ?? filename)}</title><style>
      *{box-sizing:border-box}
      body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:0;padding:22px;font-size:12px}
      h1{font-size:17px;margin:0 0 2px}
      .sub{color:#666;font-size:11px;margin-bottom:14px}
      table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #bbb;padding:6px 8px;text-align:left;vertical-align:top}
      th{background:#f2f2f2;font-weight:700}
      tbody tr:nth-child(even){background:#fafafa}
      @media print{body{padding:0}}
    </style></head><body>
      <h1>Excel Tech — ${esc(title ?? filename)}</h1>
      <div class="sub">Generated ${new Date().toLocaleString("en-GB")}</div>
      <table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>
      <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>
      <script>window.onload=()=>{setTimeout(()=>window.print(),150)}<\/script>
    </body></html>`
  );
  w.document.close();
}

// A small dialog to choose which columns go into the Excel file.
// Returns the selected column indices, or null if cancelled.
function pickColumns(head: string[]): Promise<number[] | null> {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px";
    const box = document.createElement("div");
    box.style.cssText = "background:var(--card,#fff);color:var(--body,#111);border:1px solid var(--line,#e5e7eb);border-radius:12px;width:100%;max-width:320px;padding:16px;max-height:82vh;overflow:auto;font-family:inherit;box-shadow:0 10px 40px rgba(0,0,0,.25)";
    const title = document.createElement("div");
    title.textContent = "Choose columns to export";
    title.style.cssText = "font-weight:700;font-size:14px;margin-bottom:2px";
    const hint = document.createElement("div");
    hint.textContent = "Untick any column you want to skip.";
    hint.style.cssText = "font-size:11px;opacity:.7;margin-bottom:10px";
    box.appendChild(title); box.appendChild(hint);

    const checks: HTMLInputElement[] = [];
    head.forEach((h) => {
      const label = document.createElement("label");
      label.style.cssText = "display:flex;align-items:center;gap:8px;padding:5px 4px;font-size:13px;cursor:pointer";
      const cb = document.createElement("input");
      cb.type = "checkbox"; cb.checked = true;
      cb.style.cssText = "width:16px;height:16px;accent-color:var(--teal,#0d9488)";
      checks.push(cb);
      label.appendChild(cb);
      label.appendChild(document.createTextNode(" " + h));
      box.appendChild(label);
    });

    const btns = document.createElement("div");
    btns.style.cssText = "display:flex;gap:8px;margin-top:12px";
    const mk = (text: string, primary: boolean) => {
      const b = document.createElement("button");
      b.textContent = text;
      b.style.cssText = `flex:1;padding:8px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;${primary ? "border:none;background:var(--teal,#0d9488);color:#fff" : "border:1px solid var(--line,#e5e7eb);background:transparent;color:inherit"}`;
      return b;
    };
    const cancel = mk("Cancel", false);
    const ok = mk("Export Excel", true);
    btns.appendChild(cancel); btns.appendChild(ok);
    box.appendChild(btns);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    const close = (result: number[] | null) => { document.body.removeChild(overlay); resolve(result); };
    cancel.onclick = () => close(null);
    overlay.onclick = (e) => { if (e.target === overlay) close(null); };
    ok.onclick = () => {
      const idx = checks.map((c, i) => (c.checked ? i : -1)).filter((i) => i >= 0);
      if (!idx.length) return; // need at least one column
      close(idx);
    };
  });
}

// Excel opens an HTML table saved as .xls and keeps the column formatting.
// Prompts for which columns to include before downloading.
export async function exportExcel(filename: string, head: string[], rows: (string | number)[][]) {
  const idx = await pickColumns(head);
  if (!idx) return;
  const selHead = idx.map((i) => head[i]);
  const selRows = rows.map((r) => idx.map((i) => r[i]));
  const esc = (c: string | number) =>
    String(c ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html =
    `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body>` +
    `<table border="1"><thead><tr>${selHead.map((h) => `<th style="background:#eee">${esc(h)}</th>`).join("")}</tr></thead>` +
    `<tbody>${selRows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></body></html>`;
  download(new Blob(["﻿" + html], { type: "application/vnd.ms-excel;charset=utf-8" }), `${filename}.xls`);
}
