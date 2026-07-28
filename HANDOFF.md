# Excel Tech POS — Handoff Summary

A complete handoff so a fresh session can continue seamlessly.

## 1. Project & Goal
Building **Excel Tech POS** — a full POS + ERP web app for a mobile-phone shop (Excel Tech,
Shyamoli Square, Dhaka). The owner (Asadul Islam) sells phones (IMEI-tracked) and accessories
(quantity-tracked), takes Facebook orders, and delivers via Steadfast courier. Goal: replicate the
feature set of a reference app called **AmarPOS** (owner sends AmarPOS screenshots; we match them).
Originally scaffolded as "PulsePOS," renamed to **Excel Tech POS**.

- **Live:** https://exceltechpos.netlify.app
- **GitHub:** https://github.com/Asadulislam37/Excel-Tech-POS-app (branch `main`)
- **Stack:** Next.js 16 (App Router) · Prisma 7 (pg driver adapter, Rust-free) · Supabase Postgres
  (project `iedwhqargvequhgzumgf`, ap-south-1 / Singapore) · Tailwind CSS 4 · Netlify
- **Local path:** `C:\Users\ASADUL ISLAM\Downloads\pulsepos (1)\pulsepos` (Windows, Git Bash + PowerShell)

## 2. Current State (working in production)
Roughly **55+ screens built and deployed.** All post real data to Supabase and are verified live.

- **Auth:** email login/signup/forgot-password/reset-password. First signup = ADMIN. Real users in
  DB: Asadul Islam (ADMIN), Ahsan Sabbir + Al Hasib (SALESMAN).
- **Dashboard:** cash flow, today's summary, quick access, low stock, recent invoices.
- **Inventory:** Product List (quick-edit, barcode print, edit, activate/deactivate, 4-price model
  cost/wholesale/retail/MRP), Stock Entry, Stock Report, Stock Report Detailed, Stock Ledger,
  Stock Transfer + History (needs 2nd outlet), Serial Number Manage/Track.
- **Sales:** Create Invoice (POS with sale types, hold list, split payments), Sold History
  (view/edit/delete/SMS/courier + A4/POS/Download invoice), Sold Products report.
- **Returns & Exchange:** Sales Return, Return History/Products, Sales Exchange, Exchange
  History/Products/Return Products — all reverse stock + post journals.
- **Purchase & Return:** Purchase (POS-style, IMEI entry), History, Products, Purchase Return +
  History + Products.
- **CRM:** Customers (full add form: basic/family/reference/professional), Customer History.
- **Accounting (ALL 16 built, real double-entry):** Daily Statement, Cash Statement, Manage Journal,
  Expense Voucher, Due Collection, Party KPI, Supplier Payment, Supplier KPI, Money Transfer,
  Money Adjustment, Ledger, Trial Balance, Profit or Loss, Balance Sheet, Chart of Account,
  Chart of Account Opening.
- **Configuration:** Brand, Category, Color, Size, Unit, Warranty, Supplier, Outlet (full CRUD).
- **Online Store:** `/shop` public catalog + checkout, Online Orders admin.
- **Steadfast courier integration:** create parcel + track from Sold History.
- **Dark/light theme** with header toggle.

**Still placeholders** (show "coming in Phase X" page): SMS Management (needs SMS gateway),
Warranty Claim, Rewards (Setup/Level/History), Role Management, Reports→Day Book.
**EMI, Sales Requisition, Sales Quotation were removed from nav per owner request.**

## 3. Key Decisions
- **Custom auth, NOT Supabase Auth** — scrypt password hashing (Node built-in, no native dep), HMAC
  session cookie `et_session` signed with Web Crypto (works in Edge middleware). `src/middleware.ts`
  gates everything except public prefixes.
- **Accounting is real double-entry.** Every money event posts a balanced journal via `postJournal()`
  in `src/lib/accounting.ts`. 20-account chart seeded. Trial Balance / P&L / Balance Sheet reconcile.
- **Node built-ins over native deps** (scrypt not bcrypt; nodemailer is pure-JS) so Netlify builds cleanly.
- **Manual deploys** via `netlify deploy --build --prod` — NOT auto-linked to GitHub.
- **All secrets in Netlify env vars + local `.env`** (gitignored), never in repo: `DATABASE_URL`,
  `DIRECT_URL`, `AUTH_SECRET`, `SMTP_HOST/PORT/USER/PASS`, `MAIL_FROM`, `STEADFAST_API_KEY`,
  `STEADFAST_SECRET_KEY`.
- **Email:** Gmail SMTP from `theexceltechbd@gmail.com` (app password in `SMTP_PASS`).
- **Invoice design:** matched the owner's exact Excel Tech PDF format (plain "INVOICE" header,
  columns SL/SKU/Product/Warranty/UnitPrice/QTY/Price, bordered totals, "In Words," "Created By," Terms).

## 4. Key Files
**Libs (`src/lib/`):** `prisma.ts`, `accounting.ts` (postJournal, METHOD_ACCOUNT, ACC codes,
nextVoucherNo), `sale-journal.ts` (postSaleJournal — revenue+COGS), `session.ts` (Web Crypto
sign/verify), `auth.ts` (currentUser), `password.ts` (scrypt), `reset-token.ts`, `email.ts`
(nodemailer), `steadfast.ts` (createOrder/statusByConsignment/getBalance), `format.ts` (taka/dt),
`words.ts` (takaInWords), `export.ts` (CSV/Excel), `nav.ts` (nested nav tree).

**Components (`src/components/`):** `Shell.tsx` (sidebar nav + header + theme toggle + Quick Access
dropdown + user menu — logo links home), `InvoiceView.tsx` (A4/POS/Download invoice),
`PurchaseView.tsx`, `ThemeToggle.tsx`, `ConfigCrud.tsx`, `ProductsReport.tsx`, `KpiReport.tsx`,
`StockTabs.tsx`, `StockFilterBar.tsx`, `SalesTabs.tsx`, `PurchaseTabs.tsx`, `ReportShell.tsx`,
`AuthForm.tsx`.

**Key API routes (`src/app/api/`):** `sales/route.ts` + `sales/[id]/route.ts` (posts/reverses sale
journals), `purchase/*`, `returns/*`, `exchanges/*`, `steadfast/route.ts`, `webhook/steadfast/route.ts`,
`journal/route.ts`, `money/route.ts`, `kpi/route.ts`, `accounts/*`, `reports/financials/route.ts`
(P&L/TB/BS), `config/[kind]/route.ts` (CRUD), `auth/*`.

Everything compiles; nothing is mid-edit. Last commit deployed successfully.

## 5. Open Problems
1. **P&L missing 2 old sales:** invoices CS-260728-0001 and -0002 were created *before* sales-journal
   posting existed, so they have no journal and don't show in P&L. Owner was asked about a backfill —
   not yet answered.
2. **Customer document uploads** (NID/driving-license photos) — form has the fields but actual image
   upload needs Supabase Storage (not built).
3. **SMS module** — all screens are placeholders; real sending needs a Bangladeshi SMS gateway
   (SSL Wireless / Alpha Net) API creds.
4. **Loading speed** — improved via config-API browser caching, but floor is Netlify serverless
   cold-starts + Supabase Singapore latency.

## 6. Next Steps (in order)
1. Await owner feedback on the 3 fixes just shipped: dashboard dark-text, ⋯-menu no-shift, courier
   delivery-charge zone.
2. If yes → **backfill journals for the 2 old sales** so P&L is complete.
3. Offered, awaiting confirmation: (a) add **"Assist By / Service Staff"** field to POS + invoice;
   (b) make **80/120 delivery charge a shop-wide Configuration setting** instead of per-order.
4. Remaining placeholder screens by value: Warranty Claim, Rewards, Role Management, Day Book, then
   SMS (blocked on gateway creds).
5. Customer document uploads (needs Supabase Storage setup).

## 7. Gotchas (important!)
- **Build MUST use `next build --webpack`.** Turbopack crashes on this Windows path (spaces + parens)
  with "failed to create junction point." Already set in package.json.
- **Prisma transactions over the Supabase pooler are slow** (network to Singapore). Any multi-step
  `prisma.$transaction` needs `{ timeout: 30000, maxWait: 15000 }` or it hits the 5s default and fails
  with *"commit cannot be executed on an expired transaction."* (This exact bug broke invoice creation once.)
- **Route.ts files can only export HTTP handlers + Next config** (`GET`, `POST`, `dynamic`, etc.).
  Helper functions must live in `src/lib/` (learned when a helper exported from a route.ts failed the build).
- **Custom CSS classes must be inside `@layer components`** in `globals.css`, or Tailwind width
  utilities (`w-44` etc.) get overridden and layouts break.
- **`cookies()` is async** in Next 16 (`await cookies()`). Middleware runs in **Edge** — use Web Crypto
  (`session.ts`), never Node `crypto` there.
- **Node/npm/netlify in Bash** work only via `~/bin` shims (the Bash tool's PATH lacks Node). If they
  break, recreate shims pointing to `/c/Program Files/nodejs` and
  `/c/Users/ASADUL ISLAM/AppData/Roaming/npm`.
- **Git push auth:** the harness sets env vars that block GCM. Push via PowerShell with
  `$env:GCM_INTERACTIVE='auto'; $env:GIT_TERMINAL_PROMPT='1'; git -c credential.gitHubAuthModes=browser push`
  (browser popup). Credentials are now cached, so plain `git push` works.
- **NEVER wipe data unscoped.** The owner actively tests with real products/customers/sales. When
  testing against live, mark everything (`note:"VERIFY-DELETE"`, SKU `VERIFY-*`, email
  `*-temp@example.com`) and delete only those. Temp cleanup scripts go in `prisma/tmp.mts`
  (gitignored `prisma/*.mts`), run `npx tsx prisma/tmp.mts`, then `rm`.
- **Serialized (phone) products REQUIRE IMEIs** at purchase and sale; accessories are quantity-only.
  This is intentional (drives Serial Number Track).
- **Steadfast:** API base `https://portal.packzy.com/api/v1`, headers `Api-Key`/`Secret-Key`. No
  delivery-charge field — you only control `cod_amount`. Owner's delivery charge (Inside Dhaka 80 /
  Outside 120) is **added to COD**; Steadfast's own merchant fee is separate/auto. Set webhook in the
  Steadfast portal to `https://exceltechpos.netlify.app/api/webhook/steadfast`.
- **Deploy flow:** `git add -A && git commit && git push` then `netlify deploy --build --prod`. Netlify
  blob-upload sometimes throws a transient "fetch failed" — just re-run the deploy.
