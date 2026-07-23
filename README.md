# PulsePOS — Excel Tech Retail ERP

Full POS + ERP for Excel Tech (Shyamoli Square, Dhaka), built to eventually share one
database with the exceltech.com.bd storefront rebuild.

**Stack:** Next.js 16 (App Router) · Prisma 7 (Rust-free, pg driver adapter) · Supabase Postgres · Tailwind CSS 4 · Netlify

## What works now (Phase 1)

- **Dashboard** — today's sales, collections, outstanding due, low stock
- **Create Invoice (POS)** — product search, IMEI/serial picking for phones,
  quantity for accessories, walk-in or registered customer, quick customer add,
  discount, split payments (Cash / bKash / Nagad / Rocket / Card / Bank), due sales
- **Serial Number Track** — scan any IMEI → purchase, sale, customer, warranty history
- **Serial Number Manage** — bulk IMEI stock-in
- **Product List** — create products with variants (color / storage), phone vs accessory
- **Purchase** — record supplier purchases with IMEI entry, supplier dues
- **Customers** — lifetime purchase, dues, reward points
- **Sold History** — invoices with serials and payment breakdown
- **Due Collection** — collect partial/full dues against invoices
- **Online store** (`/shop`) — public catalog of published products, variant picker,
  cart, checkout with Cash-on-Delivery / bKash / Nagad and Dhaka-based delivery charges
- **Online Orders** (admin) — confirm orders (auto-converts to a POS sale, assigns
  IMEIs FIFO, links/creates the customer), mark delivered (collects COD), cancel

Every other module in the sidebar (returns, exchange, requisition, quotation, SMS,
accounting, EMI, rewards, reports, configuration screens) already has its **database
schema in place** — see `prisma/schema.prisma` — and shows a phase-tagged placeholder.

## Setup

1. **Create a Supabase project** → copy both connection strings into `.env`
   (see `.env.example` — transaction pooler for `DATABASE_URL`, direct for `DIRECT_URL`;
   Prisma 7 reads them via `prisma.config.ts`, not from the schema file).

2. **Install & push the schema**

   ```bash
   npm install
   npx prisma db push      # creates all tables
   npm run db:seed         # outlet, brands, categories, sample products + demo IMEIs
   ```

3. **Run locally**

   ```bash
   npm run dev             # http://localhost:3000
   ```

4. **Deploy to Netlify** (netlify.toml is already included)

   ```bash
   git init && git add . && git commit -m "PulsePOS"
   # create an empty repo on github.com, then:
   git remote add origin https://github.com/YOUR-USERNAME/pulsepos.git
   git push -u origin main
   ```

   Then on **app.netlify.com** → *Add new site* → *Import an existing project* →
   pick the `pulsepos` repo. Build settings are read from `netlify.toml` automatically.
   Before the first deploy, open **Site configuration → Environment variables** and add:

   | Key | Value |
   |-----|-------|
   | `DATABASE_URL` | Supabase transaction-pooler string (port 6543) |
   | `DIRECT_URL` | Supabase direct string (port 5432) |

   Deploy. Your POS will be at `https://your-site.netlify.app` and the public shop
   at `https://your-site.netlify.app/shop`. Later you can point the
   `exceltech.com.bd` domain (or `pos.exceltech.com.bd`) at it from
   **Domain management**.

## Roadmap

| Phase | Modules |
|-------|---------|
| 1 ✅ | POS, serials, products, purchase, customers, dues |
| 2 | Returns & exchange, warranty claims, stock reports, config CRUD screens |
| 3 | EMI orders & installments, stock transfer, requisition, quotation |
| 4 | SMS campaigns, accounting (journal, vouchers, ledgers, chart of accounts) |
| 5 | Financial reports (trial balance, P&L, balance sheet), rewards program |
| 6 | exceltech.com.bd storefront on this same database (`isPublished`, `onlinePrice`, `slug` are already in the schema) |

## Notes

- Phones are `SERIALIZED` products — every unit is an IMEI-tracked `SerialUnit`.
  Accessories are `STANDARD` — tracked by quantity. Both feed `StockLedger`.
- Sales run in one DB transaction: stock, serials, payments, dues, reward points.
- Warranty end dates are stamped on each serial at sale time from the product's policy.
