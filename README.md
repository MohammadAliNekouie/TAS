# تاس — نرم‌افزار حسابداری (Persian RTL Accounting App)

نسخه 2.0.0: React (RTL, Farsi) frontend + Node/Express + SQLite backend با چرخه یکپارچه خرید/فروش، خزانه، انبار و حسابداری دوطرفه.

## What's in every section

- **داشبورد (Dashboard)** — live KPIs, sales trend chart (7/30 day toggle), recent events, low-stock alerts, cheques due, and a grouped quick-access menu to every module — all served from the backend API.
- **انبارداری (Warehouse)** — the 3-level inventory coding scheme: category tree browser + combined search by ID, code, or any part of the item name.
- **خرید و فروش, دریافت و پرداخت, مدیریت چک, تنخواه‌گردان, حسابداری چند ارزی, مدیریت تولید, سامانه مودیان** — each is a full CRUD module: a table of records plus an "افزودن جدید" (add new) button that opens a form, an edit (pencil) icon per row, and a delete (trash) icon per row with an inline confirm. All seven share one generic component (`frontend/src/components/CrudModule.jsx`) and one generic backend route factory (`backend/lib/crud.js`) — each module is just a small field/column config, which also makes them easy to extend later (add a field, add a validation rule, etc.) in one place.
- **گزارش‌گیری (Reports)** — deliberately **read-only**: it aggregates totals (sales vs. purchases, receipts vs. payments, petty cash balance, outstanding cheques, etc.) computed live from the other modules' data, since reports by nature summarize what's entered elsewhere rather than being their own data-entry point.

## Editing the sample/demo data

The database seeds category-tree inventory data, sample events, and sample cheques on first run so the dashboard isn't empty. The other CRUD modules start empty — use the "افزودن جدید" button in each to add your own records.

## Invoices, inventory items, bank accounts, and automatic accounting entries

**خرید و فروش (Sales & Purchase)** is no longer a flat CRUD table — each invoice has a header (type, party, date, bank account) plus multiple line items, and each line item points at a real inventory item:

- While adding invoice lines, typing into the item search box hits the same ID/code/name search built for انبارداری. If the item you need doesn't exist yet, a **"+ تعریف کالای جدید در انبار"** option appears right there in the dropdown — it opens a small form (category, name, unit, warehouse, starting stock), creates the item in the inventory table on the spot, and drops it straight into the invoice row. No need to leave the invoice form.
- فاکتورهای خرید/فروش با تخفیف، مالیات و برگشت ثبت می‌شوند و سند دوطرفهٔ خودکار در `journal_vouchers`/`journal_voucher_lines` ساخته می‌شود. موجودی بانک از رویدادهای مالی دوباره محاسبه می‌شود تا با اسناد دوباره‌شماری نشود.

**تنظیمات اولیه (Settings)**, new page reachable from the bottom of the sidebar:
- **Company info** — legal name, شناسه ملی, کد اقتصادی, address, phone. Single record, one save button.
- **Bank accounts** — name, bank name, شبا (IBAN), and an initial balance (set once at creation). After creation, the balance only ever changes through invoices/journal entries, never a direct edit — this keeps the ledger trustworthy. You'll want to define at least one bank account here before creating invoices that should post accounting entries.

## Light / dark theme

A sun/moon toggle sits at the top of the sidebar. The whole app is built on CSS custom properties (`--bg`, `--surface`, `--ink`, `--teal`, etc., defined in `frontend/src/index.css`), so every page follows the toggle automatically — no per-page theme logic. The choice is remembered in the browser (`localStorage`) and defaults to the OS-level light/dark preference on first visit.

## Requirements

- Node.js 18 or newer
- npm

## Run locally (development)

```bash
cd accounting-app
npm run install:all   # installs backend and frontend dependencies
npm run dev            # runs backend on :4000 and frontend on :5173 together
```

Open http://localhost:5173 in your browser. The database is created automatically at `backend/data/accounting.db` and seeded with sample data on first run.

## Run as a single server (production-style, for local server or VPS)

```bash
npm run install:all
npm run build          # builds the React app into frontend/dist
npm run start           # starts the Express server on :4000, serving the built frontend too
```

Then open http://localhost:4000 (or `http://<your-server-ip>:4000` from another device on the network / VPS).

To keep it running persistently on a VPS, use a process manager, e.g.:

```bash
npm install -g pm2
pm2 start backend/server.js --name accounting-app
pm2 save
```

Put Nginx or Caddy in front of it as a reverse proxy if you want HTTPS on a domain name.

## Resetting the sample data

Delete `backend/data/accounting.db` and restart the server — it will re-seed automatically. Or run `npm run seed` after deletion.

## Operational deployment notes

1. **Auth** — login is enabled; JWT is stored only in an HttpOnly cookie. For public deployment, put the server behind HTTPS and set `NODE_ENV=production`.
2. **Jalali dates** — the existing date picker remains the UI layer; financial period/date validation is enforced server-side using the stored date strings.
3. **سامانه مودیان integration** — build as its own backend module with a queued/retry job (don't block invoice creation on a live call to the tax authority API), following the design discussed earlier in this conversation. The current مودیان page is a manual status-tracking CRUD table, not a live integration.
4. **Self-host the Farsi font** — swap the Google Fonts `<link>` in `frontend/index.html` for a locally hosted Vazirmatn file, since external font CDNs can be unreliable from inside Iran.
5. **Swap SQLite for PostgreSQL** if you expect concurrent multi-user write load — the schema in `backend/schema.sql` translates directly (see the accounting/inventory schema designed earlier in this conversation, including the `pg_trgm` search index).
6. **Double-entry ledger** — operational accounting now uses `journal_vouchers` and `journal_voucher_lines`; the legacy `journal_entries` table is retained only for backward compatibility.

## Project structure

```
accounting-app/
  backend/
    server.js          # Express app entry point
    db.js               # SQLite connection, schema init, auto-seed
    schema.sql           # table definitions
    routes/
      dashboard.js        # KPIs, sales trend, events, low stock, cheques
      inventory.js         # 3-level tree + ID/code/name search
    lib/persian.js        # Persian text normalization for search
  frontend/
    src/
      layout/            # Sidebar (grouped menu) + AppLayout
      pages/
        Dashboard.jsx       # home page
        Inventory.jsx        # warehouse module (tree + search)
        Placeholder.jsx       # stand-in for unbuilt modules
      lib/
        api.js              # fetch wrapper for the backend
        persian.js            # Persian digit/currency formatting
```

## طرف‌های حساب (Parties: customers & suppliers)

New master-data page (sidebar, next to تنظیمات اولیه): define customers/suppliers once — name, type, phone, economic code — then reuse them everywhere instead of retyping. On the خرید و فروش invoice form (and on دریافت و پرداخت / مدیریت چک), the party field is now a search box: type to filter existing parties, pick one, or hit **"+ تعریف طرف حساب جدید"** to create one inline without leaving the form — the same pattern as the inventory item picker. The list itself has full add/edit/delete like every other module.

## Bank account creation bug fix

An earlier build could silently fail to add a bank account: the form had no error handling, so if a save failed for any reason, the modal just sat there — no error, no account added, no clue why. That's fixed (errors now surface inline in the form), and the initial-balance field is no longer strictly required (left blank, it now safely defaults to 0).

## Party list not updating, no duplicate detection, no permanent code — fixed

Three related fixes:

1. **Systemic silent-failure bug**: `CrudModule` (used by 7 of the modules — including طرف‌های حساب, مدیریت چک, تنخواه‌گردان, etc.) had no error handling around save/delete. If a save failed for any reason, the form just sat there with nothing visibly wrong — no error, no new row, no clue why. Every module using it now shows the real error inline.
2. **Stale list data**: the fetch client didn't disable HTTP caching, so a GET could in principle be served from cache instead of hitting the server for fresh data. All API requests now send `cache: "no-store"`.
3. **Unique, never-reused party codes + duplicate detection**: each party now gets a permanent code like `P-0001`, derived directly from its database id. Because SQLite's `AUTOINCREMENT` guarantees an id is never reused even after the row is deleted, this code is guaranteed unique for the life of the database — deleting P-0003 will never result in a future party also being P-0003. Creating (or renaming, via edit) a party to a name that already exists is now rejected with a clear error message naming the existing party's code, instead of silently allowing duplicates.

## Troubleshooting: "ECONNREFUSED" / "http proxy error" on every /api request

This means the **frontend is running but the backend isn't** — Vite is trying to proxy `/api/...` to `http://localhost:4000` and finding nothing listening there. It's not a bug in a specific feature; the whole backend process either never started or crashed immediately. To see the real reason:

```bash
cd backend
npm run dev
```

Run it directly like this (not through the root `npm run dev`, which interleaves backend/frontend logs and can bury the actual error). You should see:

```
✅ Accounting backend running on http://localhost:4000
```

If instead it prints an error and exits, the two most common causes, in order of likelihood:

1. **`better-sqlite3`'s native module didn't build/install correctly** for your OS/Node version — by far the most common cause of "backend won't start" for this stack. The backend now prints a clear message with exact recovery steps if this happens (reinstall, `npm rebuild better-sqlite3`, or install platform build tools). Node 18 or 20 (LTS) is recommended; very new/unreleased Node versions sometimes don't have prebuilt binaries yet, forcing a from-source compile that needs a C++ toolchain installed.
2. **Port 4000 is already in use** by something else on your machine. The backend now detects this specifically and tells you so, with the option to run on a different port via `PORT=4001 npm run start` (remember to also update the proxy target in `frontend/vite.config.js` if you do).

Once `cd backend && npm run dev` shows the ✅ line and stays running, go back to the project root and use `npm run dev` as usual.

## Troubleshooting: "SqliteError: attempt to write a readonly database"

This is a filesystem permissions issue, not an app bug — it means SQLite can't write to `backend/data/accounting.db` or its folder. The backend now detects this specifically and prints these steps directly, but in short:

```bash
cd backend
ls -ld data                 # check the folder's owner/permissions
chmod -R u+w data           # fix permissions, or:
rm -rf data && npm run dev  # start completely fresh
```

If that still doesn't help, confirm the project folder itself isn't on a read-only or network-mounted drive (e.g. an NTFS/exFAT drive mounted read-only by default):

```bash
touch backend/data/test-write && echo writable || echo "NOT writable"
```

If it prints "NOT writable", move the whole project folder to somewhere on your normal home-directory filesystem (e.g. `~/projects/accounting-app`) and run it from there.

## Logo, warehouse/category management, Jalali dates, Rial formatting, server health, and backup/wipe

A large batch of additions:

- **Logo**: the uploaded dice logo is now the sidebar header icon and the browser favicon.
- **Inventory categories & subcategories**: انبارداری now has full add/edit/delete for groups (سطح ۱), subgroups (سطح ۲), and items (سطح ۳) directly in the page — not just browsing.
- **Multiple warehouses**: a proper warehouses list (add/edit/delete) with "انبار مرکزی" seeded as the default; every inventory item now picks its warehouse from this list instead of free text. At least one warehouse must always remain (the last one can't be deleted).
- **Jalali (Shamsi) date picker**: every date field across the app (invoice date, cheque due date, petty cash, FX entries, production orders, مودیان submissions, receipts/payments) is now a calendar-only picker — typing digits or text directly is disabled, removing an entire class of malformed-date input errors.
- **Rial currency formatting**: every amount field now uses a grouped-digit input (e.g. "1,250,000") that displays and stores the value in ریال, and all currency displays app-wide were switched from تومان to ریال to match. This is a real unit change, not just a label swap — keep that in mind if you're mentally converting from an earlier version that showed تومان.
- **Sales invoices restricted to in-stock items**: as requested, a فروش invoice can only select items with `qty_on_hand > 0` and cannot create new items inline (خرید invoices can still do both — search the full catalog and quick-add new items).
- **Stock now actually moves**: creating/editing/deleting a sale or purchase invoice adjusts `qty_on_hand` on the referenced inventory items (sale decreases it, purchase increases it), with the same reverse-then-reapply correctness pattern used for bank balances. Sales are blocked with a clear error if requested quantity exceeds current stock.
- **Dashboard: server health + recent errors**: two new panels poll every 3 seconds — CPU/RAM usage of the machine the app is running on (via Node's `os` module), and the last 3 errors captured from the backend console (any `console.error` call anywhere in the app is intercepted and logged in-memory, so this reflects real runtime problems, not a curated list).
- **تنظیمات اولیه: backup, restore, and full data wipe**:
  - **Backup**: downloads a single `.xlsx` file with one sheet per database table — a complete snapshot, not just financial data.
  - **Restore**: uploading a previously-exported `.xlsx` wipes the current database and reloads it from the file, preserving original ids/relationships. This is a full replace, not a merge — the UI makes that explicit before you confirm.
  - **Wipe financial data**: a separate, narrower destructive action (typed confirmation required) that clears invoices, journal entries, receipts/payments, cheques, petty cash, FX entries, production orders, مودیان submissions, inventory categories/items, and parties — while preserving company info, bank accounts (balances reset to their initial value), and warehouses, since those are setup rather than transactional history.

A couple of honest caveats on the newer pieces: CPU usage is measured as an instantaneous delta sample (not a smoothed average), and the Excel restore assumes the file was produced by this app's own export (it doesn't attempt to validate or repair an arbitrary spreadsheet).

## Fixed: "Failed to resolve import react-multi-date-picker/dist/styles.css" crash

This project didn't ship a `package-lock.json`, so every `npm install` re-resolves dependency versions against whatever's currently newest — and in at least one real case this caused Vite itself to install as v8 despite the `^5.4.2` range in `package.json`, alongside the date-picker library's CSS file moving/disappearing at whatever newer version got pulled in.

Two changes:

1. Removed the fragile `import "react-multi-date-picker/dist/styles.css"` entirely and replaced it with a small hand-written stylesheet (in `frontend/src/index.css`) targeting the library's own stable class names — so the calendar looks correct and the app no longer depends on a specific file existing inside a third-party package's `dist` folder.
2. **Pinned exact versions** (no `^` ranges) for every dependency in both `backend/package.json` and `frontend/package.json`, so `npm install` can no longer silently drift to an incompatible major version.

If you're upgrading from an earlier copy: delete `node_modules` (and any `package-lock.json`) in both `backend/` and `frontend/`, then run `npm run install:all` again from the project root.

## کدینگ حسابداری (Chart of Accounts) and manual journal vouchers

From the standard Iranian chart-of-accounts file you provided (which contained three template variants — خدماتی, تولیدی, and بازرگانی), the software is now seeded with the **بازرگانی (commercial/general trading)** version: 8 fixed گروه اصلی (level 1), 45 گروه کل (level 2), and 180 حساب معین (level 3). If you'd rather start from تولیدی or خدماتی instead, let me know and I can re-seed from either — swapping now, before you've customized anything, is easy.

- **کدینگ حسابداری** (new sidebar page, under a new "حسابداری" group): a tree browser exactly like انبارداری's — drill into a گروه اصلی → گروه کل → حساب معین, with a search box matching by code, id, or name.
  - **گروه اصلی (level 1) is fixed** — it's the standard financial-statement classification (دارایی جاری, بدهی بلندمدت, درآمدها, etc.) and isn't meant to change, so there's no add/edit/delete there, only navigation.
  - **گروه کل and حساب معین (levels 2–3) are fully yours** — add, rename, or delete freely. New codes are generated automatically (e.g. a new حساب معین under گروه ۱۱ becomes `1104`), and deleting a گروه کل is blocked while it still has حساب‌های معین under it.
- **اسناد حسابداری** (new page, same group): manual double-entry journal vouchers. Each سند has a date, a description, and at least two ردیف — every ردیف picks a حساب معین (search by code or name) and enters either بدهکار or بستانکار (never both). The form shows a live running total and won't let you save until debit and credit are equal — this is enforced both in the UI (submit button disabled) and on the server (so it can't be bypassed by calling the API directly).

This is intentionally a simpler, single-currency manual voucher system — it does not yet auto-generate journal vouchers from invoices/cheques/etc. (that would mean picking a specific account for every transaction type, which is a bigger design decision better made once you've seen how the coding fits your actual workflow).

## Major addition: authentication, real GL posting, financial statements, and PWA

This is a large batch — the app now has actual security, actual double-entry accounting driving real financial statements, and is installable as a standalone app.

### Authentication & roles
There is now a real login. **On first run, a default admin account is created with a random password printed once to the backend console** — note it down, log in, and change it (or create your own admin and delete the default) from **کاربران و دسترسی** (admin-only, in the sidebar).

Three roles:
- **مدیر سیستم (admin)** — full access, plus تنظیمات اولیه, کاربران و دسترسی, and backup/restore/wipe (all admin-only, enforced by the backend, not just hidden in the UI).
- **حسابدار (accountant)** — full read/write on day-to-day modules.
- **مشاهده‌گر (viewer)** — read-only. This is enforced server-side (any POST/PUT/DELETE from a viewer token is rejected with 403), not just a UI restriction.

### Real double-entry GL posting from invoices
New **اتصال حسابداری** section in تنظیمات اولیه (admin only): pick your default حساب فروش, حساب بهای تمام‌شده, حساب موجودی کالا, حساب دریافتنی, and حساب پرداختنی from your کدینگ حسابداری. Each bank account (also in تنظیمات اولیه) can now link to a specific حساب معین too.

Once that's set up, every sales/purchase invoice **automatically creates a real journal voucher** — actual debit/credit lines against your chart of accounts, not just a bank-balance update. These auto-generated vouchers are locked from direct editing in اسناد حسابداری (you'll get a clear message pointing you back to the source invoice) so the subledger and GL can't drift apart.

If the mapping isn't (fully) configured, invoices still save exactly as before — GL posting is additive, never a hard requirement — and the response includes a warning explaining what's missing.

### Weighted-average inventory costing
Purchases now blend into a real moving-average unit cost per item; sales consume that cost to post a real COGS entry. **Known, deliberate limitation**: editing a historical purchase invoice does not retroactively recompute cost blends that already happened from it — this is a genuine limitation of moving-average costing in general (not specific to this app), so if you need to correct a purchase shortly after entering it, deleting and recreating it is more reliable than editing it.

### Financial statements (گزارش‌گیری)
Three new tabs, computed from real ledger data (once GL posting is active):
- **تراز آزمایشی** (Trial Balance) — every account with activity, its debit/credit totals, and balance.
- **صورت سود و زیان** (Income Statement) — revenue minus expenses.
- **ترازنامه** (Balance Sheet) — assets vs. liabilities + equity (current-period net income folds into equity so it balances without a separate period-close step).

Also fixed a real, previously-silent bug: the Reports summary endpoint had been querying a database column (`amount`) that no longer existed after invoices gained line items — it's been broken since that change and is now fixed.

### PWA (installable, standalone)
The app now has a real manifest and service worker (via `vite-plugin-pwa`) — your browser will offer to install it, and it opens in its own window (`display: standalone`), no browser chrome. The app shell (JS/CSS/fonts/icons) is cached for fast/offline loading, but **`/api` is deliberately never cached** — offline means the app opens, not that you can see or change data without a connection to your own backend, which matters for an accounting tool.

### Other additions in this batch
- Cheques gained شناسه صیاد and واگذار شده به (endorsement) fields.

### What's still not built
Real سامانه مودیان cryptographic signing (needs real INTA credentials), BOM/manufacturing costing, floating تفصیلی dimensions beyond parties/bank accounts, a bank reconciliation wizard, and a custom-fields engine remain out of scope for now.

## Major fixes and additions: login bug, dark mode, currency, مودیان reminders, debug logging, and full manufacturing

### Critical bug fixes
- **Login bouncing back to the login screen** — a real race condition: the JWT was written to `localStorage` inside a `useEffect`, but React fires a *child* component's effects before its *parent's*. Dashboard/Sidebar's data-fetching effects (children of `AuthProvider`) ran and called the API before the token was actually persisted, those first requests went out with no `Authorization` header, got 401, and the 401 handler logged the user right back out. Fixed by making the token available synchronously the instant `login()` runs.
- **Dark mode text contrast** — two real bugs: the Jalali date picker's calendar popup never got an explicit text color (we intentionally don't import the library's bundled CSS — see the earlier fix for why — so it silently fell back to black-on-dark-surface), and two destructive buttons (wipe data / confirm restore) used a color that turns bright in dark mode, losing contrast against their white text. Both fixed; also fixed a **generic bug in the reusable form component**: optional dropdown fields could never be reset back to "unset" once you picked something, because the placeholder option was always `disabled`. That's now correctly conditional on whether the field is actually required.
- **Reports summary endpoint was silently broken** (from an earlier session) — fixed as part of this pass too.

### طرف حساب: حقیقی / حقوقی + یادآوری سامانه مودیان
Parties now have an optional "نوع شخص" (حقیقی/حقوقی). Saving a **sale to a حقیقی party** or a **purchase from a حقوقی party** automatically creates a dismissible reminder on the dashboard — since this app doesn't submit to سامانه مودیان directly, this is a nudge to go check/register it there yourself. Tick the checkbox once you've handled it and it's gone. Editing or deleting the invoice keeps the reminder in sync. Note: since parties are linked to invoices by name (not id — a known simplification documented earlier), this only works when the invoice's party name matches an actual party record; a free-typed name with no matching party can't be checked.

### Live exchange rates
USD/EUR/CNY→Rial rates refresh every 30 minutes in the background and show on the dashboard. Pick a "ارز ترجیحی" in Settings → company info, and item search results (in انبارداری and on invoices) show the converted price alongside the Rial figure. **Please verify this works on your machine** — it was built and packaged in a sandbox with no network access, so the live API call couldn't be tested end-to-end. The source URL is one constant (`EXCHANGE_RATE_API_URL` env var or the default in `backend/lib/exchangeRates.js`) if you need to swap it.

### Rolling debug log
Every `console.log`/`console.error` in the backend now also writes to `backend/data/debug.log`, capped at the last 1000 lines (oldest dropped as new ones come in), surviving restarts. This is a raw troubleshooting file only — never shown in the UI. The dashboard's existing "recent errors" panel remains the user-facing summary of anything serious. **Note**: the one-time admin password shown on first run also gets written to this file, same as it appears in your terminal scrollback — if that's a concern, clear `debug.log` after your first login.

### Manufacturing: فرمول تولید, فرایند تولید, کالا در گردش
Three new modules, replacing the old placeholder "مدیریت تولید" (still reachable, data preserved, just no longer linked in the sidebar):

- **فرمول تولید** (BOM) — define a formula (e.g. "هواپیما مدل ۳۲") naming an output product, a list of required components with quantities, and optional named services (مونتاژ, برش‌کاری, ...). No prices are stored here, by design — only structure.
- **فرایند تولید** — pick a formula and a quantity to produce; you'll be prompted for **today's price** for every component (prefilled from its current average cost, editable) and **today's cost** for every service (always blank — services have no stored price). Stock is checked before anything happens; if sufficient, components are deducted, the output product is added to inventory at a real computed cost (blended into its existing weighted-average cost, same mechanism as purchase invoices), and the whole run is recorded for history. **Known limitation, same as elsewhere**: a run can be deleted (which reverses quantities) but not edited, and deleting doesn't retroactively un-blend the cost it caused — moving-average costing genuinely can't be cleanly reversed after the fact.
- **کالا در گردش** — free-form stock in/out for anything that doesn't fit a formula (partial/staged production, ad-hoc consumption) or for tracking کالای امانی (consignment/loaned goods) leaving or returning. A description is mandatory since there's no structured "reason" otherwise.

None of the three currently post to the General Ledger automatically (only sales/purchase invoices do that today) — extending GL auto-posting to production is a reasonable next step if you want inventory-driven manufacturing costs to flow into your financial statements automatically.

## Fixed: dashboard showing stale data after wiping financial data

This turned out to be two separate real bugs, not a caching issue:

1. **The dashboard's KPI cards, sales chart, and "recent events" feed were mockup placeholders that never got wired to real data.** They read from three static tables (`kpis`, `sales_daily`, `events`) that were seeded once, very early in this project, with fake demo numbers — and nothing in the codebase ever updated them afterward, wipe or no wipe. These three widgets now compute live from real data instead:
   - KPIs: today's real sales (from `sales_purchase_invoices`), receivables/payables (from the actual GL balance of whichever accounts you've mapped in اتصال حسابداری), and real cash+bank total.
   - Sales chart: real daily sales sums for the selected range, zero-filled so the timeline stays continuous even on days with no sales.
   - Recent events: a live merge of your most recent invoices, cheques, vouchers, receipts/payments, and production runs, sorted by actual creation time.
   The three now-unused tables were removed from the schema.

2. **"پاک‌سازی اطلاعات مالی" never actually cleared اسناد حسابداری, کدینگ حسابداری (سطح ۲/۳), or the production system.** Its table list was written before journal vouchers, chart of accounts, and manufacturing existed, and was never updated as those got built — so Trial Balance / Balance Sheet / Income Statement (which all read from real ledger data) would keep showing old numbers even after a "wipe." Fixed: the wipe now also clears journal vouchers/lines, level-2/3 chart-of-accounts entries (level 1 stays, since it's a fixed classification), and the full production history (formulas, runs, stock adjustments). Company info, bank accounts, warehouses, اتصال حسابداری, and users are still preserved, as intended.

Also, both **wipe** and **restore-from-backup** now automatically reload the page a moment after finishing, instead of leaving you to notice stale data and manually refresh — this directly addresses "doesn't update automatically."

If you're upgrading from an earlier copy: delete `backend/data/accounting.db` before running, since the schema changed again (new `created_at` columns for a real activity feed, removed the three placeholder tables).

## Fixed: date picker not closing, category creation missing, layout overflow

Three real bugs from this round:

1. **Date picker popup wouldn't close after selecting a date.** The library (`react-multi-date-picker`) expects its controlled `value` to be a real `DateObject` (carrying calendar/locale info), but it was being fed a plain string. Without that, the library could never recognize "the value now matches what was just clicked," so it kept the popup open. Fixed by converting the stored string to a proper `DateObject` before passing it back in.

2. **Category selection in "تعریف کالای جدید در فاکتور" couldn't create a new category.** Added a "+" button next to the دسته‌بندی dropdown that opens a small form to create a new subgroup — either under an existing گروه اصلی or a brand-new one — and immediately selects it, without leaving the invoice form.

3. **"حداقل موجودی" (and other fields) overflowing their containers.** A structural CSS bug, not specific to one field: number/text inputs were missing `width`/`min-width` in their shared style object, and flex-row layouts default to a `min-width` that prevents children from shrinking properly — so when two fields shared a row, one could overflow instead of resizing to fit. Fixed everywhere this pattern appears (14 files use the same shared input style).

**Bonus fix found while testing the above**: opening "دسته‌بندی جدید" (or "طرف حساب جدید") from inside another already-open form, then clicking its backdrop to dismiss it, was accidentally closing *both* modals — the click was bubbling up to the parent modal's own backdrop handler. Fixed by stopping that propagation, for both the new category-creation modal and the existing quick-add-item/quick-add-party modals (the latter had this same bug already, just not yet reported).

## Date picker still not closing — real fix this time

The previous fix (feeding it a proper `DateObject` instead of a plain string) was necessary but not sufficient. This turns out to be a widely-reported issue with `react-multi-date-picker` specifically — relying on its automatic close-on-select behavior isn't reliable, and the library's own maintainers document the actual fix: grab a `ref` to the picker and explicitly call `.closeCalendar()` yourself inside `onChange`, rather than trusting it to close on its own. That's what `JalaliDatePicker.jsx` now does. Also memoized the `DateObject` construction so a new one isn't created on every render (which was giving the library a new reference each time even when the date hadn't actually changed).

## Date picker still not closing — the actual root cause, finally

Two earlier attempts (proper `DateObject` value, then explicit `ref.closeCalendar()`) were reasonable but treated symptoms, not the cause. The real issue traces back further: when a dependency-drift crash forced removing `react-multi-date-picker`'s own stylesheet import (see the "Failed to resolve import ... styles.css" fix earlier in this document), it was replaced with a small hand-written CSS block covering *colors only*, for dark-mode readability. But that stylesheet isn't just colors — the library also relies on it for the calendar's positioning/visibility mechanics. Without it, the popup's own "hide yourself when closed" behavior never had the CSS it needed, regardless of what our `onChange`/`ref` logic did on the JS side.

Now that exact dependency versions are pinned (a fix made specifically to prevent the drift that caused the original crash), it's safe to bring the stylesheet import back — loaded *before* our own `index.css`, so our dark-mode color overrides still take precedence for anything they specifically target, while everything else (positioning, open/close mechanics) comes from the library's own, correct CSS.

If you still see this after refreshing, it likely means your installed `node_modules` predates the version pin — run `npm install` in `frontend/` again to be sure you're on the exact pinned version.

## نسخه نهایی — 2.0.0

این نسخه شامل سخت‌سازی‌های زیر است:

- محاسبه مجدد موجودی و میانگین موزون بر اساس گردش‌های تاریخی خرید، فروش، تعدیل و تولید.
- ثبت Inventory Ledger قابل حسابرسی برای هر کالا.
- جلوگیری از ویرایش مستقیم `qty_on_hand` پس از ایجاد کالا.
- جلوگیری از حذف کالایی که گردش انبار دارد.
- اعتبارسنجی دقیق مقدار/قیمت ردیف‌های فاکتور و جلوگیری از مقادیر منفی.
- تراز اسناد حسابداری با دقت بسیار بالاتر کنترل می‌شود.
- ثبت Audit Log برای عملیات تغییردهنده API.
- دوره‌های مالی، جلوگیری از ثبت در دوره بسته و سند اختتامیه.
- rate limit برای ورود.
- CORS محدود به originهای مشخص از طریق `CORS_ORIGIN`.
- JWT فقط در HttpOnly Cookie نگهداری می‌شود و frontend توکن را در localStorage ذخیره نمی‌کند.
- Migration خودکار برای دیتابیس‌های قدیمی و ایجاد ساختارهای جدید حسابداری.

### اجرای نسخه اصلاح‌شده

```bash
npm run install:all
npm run dev
```

برای deployment عمومی، مقدار `CORS_ORIGIN` را به origin واقعی frontend تنظیم کنید و `NODE_ENV=production` قرار دهید تا cookie با `Secure` ارسال شود.

> توجه: تست کامل browser/e2e و نصب dependencyهای native مانند `better-sqlite3` باید در محیط توسعه مقصد انجام شود؛ محیط ساخت این بسته دسترسی شبکه لازم برای نصب npm را نداشت. syntax تمام فایل‌های JavaScript backend در زمان ساخت با `node --check` بررسی شده است.


## Accounting controls in 2.0.0

- سندهای خودکار همهٔ عملیات مالی از طریق `journal_vouchers` و `journal_voucher_lines` ثبت می‌شوند و هر سند باید دقیقاً تراز باشد.
- فاکتور خرید/فروش از تخفیف، مالیات و برگشت پشتیبانی می‌کند.
- موجودی از `inventory_ledger` بازسازی می‌شود و بهای تمام‌شده فروش پس از تغییرات تاریخی دوباره محاسبه و در سندهای خودکار فروش اصلاح می‌شود.
- دریافت/پرداخت، چک، تنخواه، تعدیل و تولید دارای سند حسابداری منبع‌دار هستند.
- دوره‌های مالی قابل تعریف و بسته‌شدن هستند و ثبت جدید در دوره بسته مسدود می‌شود.
- Restore ابتدا یک snapshot از دیتابیس ایجاد می‌کند و فایل پشتیبان قبلی را نگه می‌دارد.
- JWT فقط در Cookie با `HttpOnly` نگهداری می‌شود؛ frontend دیگر توکن را در `localStorage` ذخیره نمی‌کند.
- برای هر حساب بانکی، در صورت عدم انتخاب حساب کدینگ دستی، یک حساب معین مستقل به‌صورت خودکار ساخته می‌شود.
