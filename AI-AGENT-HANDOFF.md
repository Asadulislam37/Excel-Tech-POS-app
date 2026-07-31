# Excel Tech — AI Agent Handoff

_Last updated: 2026-07-31. Paste this into a new chat to continue where we left off._

## What this project is

A **free** AI sales + owner assistant built into the Excel Tech POS, working across **website chat, Facebook Messenger, WhatsApp, and Instagram** — plus owner analytics, Taobao/Pinduoduo sourcing, demand tracking, pre-orders, and a "one-brain" integration for the exceltech.com.bd website. AI brain = **Google Gemini free tier** (no Claude — Claude has no free tier).

## The two systems (important)

- **POS = single source of truth:** `https://exceltechpos.netlify.app` — this app (Next.js 16, Prisma 7, Supabase Postgres, Netlify). Owner manages products, stock, sales here.
- **Website = separate site:** `exceltech.com.bd` — a **separate custom-coded site** built by the owner's developer. It connects to the POS by **reading** products + stock from a public API (so no more manual double-entry). Handoff for the dev: `WEBSITE-INTEGRATION.md`.
- **Channels:** FB Page `facebook.com/theexceltech` · WhatsApp `8801829789998` · Meta app **ExceltechAI** (App ID `4444913055825579`).

## Owner's 8-point spec — status

| # | Feature | Status |
|---|---|---|
| 1 | Chat channels | **Messenger LIVE.** Owner decided 2026-07-31 to go **Messenger-only** — WhatsApp + Instagram SKIPPED (code stays, dormant). |
| 2 | Website demand report (exceltech.com.bd) | **Done** — search tracking + daily email |
| 3 | Collect orders (FB/WA/IG) → admin | **Done** — bot books into POS **Online Orders** |
| 4 | POS stock → website | **POS side done** — dev connects website (public API) |
| 5 | POS sale → website stock down | **POS side done** — same integration |
| 6 | Pre-order capture (data + photos) | **Done** |
| 7 | Budget product suggestions | **Done** |
| 8 | AI chatbot on exceltech.com.bd | **Done** — one-line embed widget |
| + | Train AI Chatbot (knowledge + test chat) | **Done** — Configuration → Train AI Chatbot |

## AI brain notes

- Models: customer chat `gemini-flash-lite-latest`, owner assistant + vision `gemini-flash-latest`. **Use `-latest` aliases** — `gemini-2.5-flash` is retired for new keys.
- **China gotcha:** owner's PC can't reach Gemini (geo-blocked) — it runs fine from Netlify (US). **Test via the deployed site, not localhost.**
- **Banglish:** the agent understands + mirrors romanized Bengali ("charjar ache?", "dam koto").

## What's LIVE now

- Website chat widget (`/shop`) + storefront.
- Owner assistant (POS → **AI Assistant**): sales, profit, low/dead stock, top products, sourcing price, sourcing requests, search demand report.
- Messenger bot (Dev mode — replies to testers only until App Review).
- Pre-orders (toggle at Configuration → AI, Pre-orders & Sourcing).
- Sourcing price calculator + customer-photo sourcing (vision → Chinese keywords → owner tool).
- Website demand tracking + **daily email** (03:00 UTC / 09:00 Dhaka) to `asadulislamsagor37@gmail.com`.
- Budget suggestions.
- Public API for the website + embeddable chat widget.
- **Train AI Chatbot** page: knowledge base + live "talk to the bot" test chat.

## Public endpoints for exceltech.com.bd (see WEBSITE-INTEGRATION.md)

- `GET /api/public/products` — catalog + live stock
- `GET|POST /api/public/stock` — SKU → stock
- `POST /api/track/search` — search demand (snippet)
- `/chat-embed.js` — one-line AI chat widget (`window.ExcelChat.open()`, `ExcelChatConfig.showBubble:false`)

## Netlify env vars

- **Set:** `GEMINI_API_KEY`, `MESSENGER_PAGE_TOKEN`, `META_APP_SECRET`, `META_VERIFY_TOKEN` (= `exceltech_verify_2026`), `REPORTS_SECRET` (= `rpt_8Qw3Zx7Lm2Vt9Kn4Bp`), `REPORT_EMAIL`.
- **MISSING / needed for WhatsApp:** `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`.
- **Optional:** `GEMINI_CUSTOMER_MODEL`, `GEMINI_OWNER_MODEL`, `GEMINI_VISION_MODEL`, `STOREFRONT_URL`, `CORS_ALLOW_ORIGIN`.

## What the OWNER still needs to do (Messenger-only path)

1. **Publish products (with images) in the POS** — the bot + website need a catalog.
2. **Give the developer `WEBSITE-INTEGRATION.md`** — connects exceltech.com.bd (products, stock, search tracking, AI chat widget).
3. **Messenger App Review + switch app to Live** — so the bot replies to **real customers**, not just testers (app is in Development mode now).
4. **Train the chatbot:** Configuration → Train AI Chatbot.

_WhatsApp + Instagram are SKIPPED for now (owner's decision). If revisited later: WhatsApp needs `WHATSAPP_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID` from Meta → WhatsApp → API Setup, subscribe the `messages` webhook field, and publish the app; Instagram needs the IG acct linked to the Page + `instagram_manage_messages`._

## Deploy flow

From `pulsepos/`: `git add -A && git commit && git push` (branch `main`) then `netlify deploy --build --prod`.
- Netlify build occasionally fails transiently (blob upload) — **just re-run**; local `npm run build` confirms the code is fine.
- Push auth (from China): `$env:GCM_INTERACTIVE='auto'; $env:GIT_TERMINAL_PROMPT='1'; git push`.

## Gotchas (learned the hard way)

- **Setting-table key ranges break** (Postgres collation orders `:`/`;`/digits oddly) — always use Prisma `startsWith`, filter in code.
- **Middleware matcher must exclude static assets** (`js|css|txt|map|woff2?`) or `/chat-embed.js` 307-redirects to login.
- **PowerShell `Invoke-WebRequest` returns HTTP 0 on some GETs** (owner's China proxy) — verify webhooks with `curl` (Bash) instead.
- **`WEBSITE-INTEGRATION.md` got auto-deleted from the working tree once** after a deploy — it's committed; `git restore` if missing.
- **Cold-start 504** on the first request after a deploy (China proxy timeout) — real BD customers unaffected.

## Key code map

- Agent core: `src/lib/agent/` (run.ts loop, tools.ts, customer.ts, owner.ts, gemini.ts, vision.ts, metrics.ts, channels/).
- Shared reads: `src/lib/catalog.ts` (stock formula, public catalog), `src/lib/online-order.ts`, `src/lib/sourcing.ts`, `src/lib/search-log.ts`, `src/lib/settings.ts`.
- Routes: `src/app/api/{shop/agent,assistant,webhook/*,public/*,track/search,cron/search-daily,settings}/`.
- Owner pages: `/assistant`, `/config/ai`, `/config/ai-knowledge`.
- Website embed: `public/chat-embed.js`.
