# نقاء — Laundry & Home-Fabric Booking Demo

Client-facing interactive demo: a public Arabic (RTL) booking website plus a separate admin dashboard, sharing one persistent data store in the browser (LocalStorage). No backend, no paid services, works offline.

> All business data (brand name, prices, areas, phone numbers, customers, testimonials) is **illustrative demo data**.

---

## 1. Run it

**Option A — double-click (simplest).** Open `index.html` in Chrome, Edge or Firefox. Open `admin.html` the same way. Both files must be opened from the same folder in the same browser so they share data.

**Option B — local preview server (recommended).** Some browsers isolate LocalStorage between `file://` pages. A local server avoids that:

```bash
# from the project folder (Python is preinstalled on macOS/Linux)
python3 -m http.server 8080
```
or, with VS Code, right-click `index.html` → **Open with Live Server**.

Then open:
- Website: `http://localhost:8080/index.html`
- Dashboard: `http://localhost:8080/admin.html`

`localhost` only works on the computer running the server; it cannot be opened from another device.

### Demo login
| User | Password |
|------|----------|
| `admin` | `demo1234` |

The login screen also has a "fill demo credentials" button. This is **demonstration only**, not real security.

---

## 2. Quick tour for the client (5 minutes)

1. Website → **احجز خدمة** → choose *تنظيف كنب بالبخار* → change seats/options (price updates live) → **أضف إلى الحجز**.
2. **اختيار الموعد والعنوان** → fill details → choose area → only valid days/slots appear → **مراجعة وتأكيد الحجز** → confirm.
3. Copy the tracking link from the confirmation page.
4. Open `admin.html` → the new booking appears under **الحجوزات** (and in the sidebar counter).
5. Open it → **تأكيد الحجز** → record a partial payment → record the rest → status becomes *مدفوع بالكامل*.
6. Go back to the website checkout: the booked slot is no longer selectable. Cancel the booking in the dashboard → the slot becomes available again.
7. **المصروفات** → add an expense → **التقارير المالية** shows updated totals.

---

## 3. Features

### Public website (`index.html`)
Home (live "nearest available appointments" widget), services & pricing with category filter and search, service details with live price calculator, cart, checkout with area-driven date/slot picker and a review step, confirmation, booking tracking (by secure link or reference + last 4 phone digits), about, contact (opens WhatsApp with a prepared message), FAQ, service policies, privacy notice. Light/dark mode, mobile-first.

### Admin dashboard (`admin.html`)
Dashboard with date filters, KPIs, charts, pending confirmations, upcoming appointments and activity · Orders (search, filters, sorting, pagination, details, status actions, internal notes, status history, reschedule, payments, tracking link) · Manual booking · Customers (history, value, paid, outstanding) · Services (create/edit, pricing model, variants, per-unit add-ons, image upload, activate/feature, safe delete) · Categories · Workdays, time slots, blocked dates, single-day schedule view · Service areas with transport fee and weekly coverage matrix · Payments & refunds · Expenses · Financial reports (print-friendly) · Settings, data-consistency check, JSON export, **demo reset**.

### Design & motion
- **Palette "Linen & Eucalyptus"**: warm linen neutrals, one deep-green brand colour, saffron accent. Dark mode is a neutral warm charcoal. All colours are tokens in `base.css`.
- **Page transitions** use the View Transitions API (fallback: staggered entrance). **Theme switch** grows as a circle from the toggle button.
- **Scroll motion**: `data-reveal` / `data-stagger` elements animate in once; `data-count` numbers count up; header hides on scroll down and returns on scroll up; scroll progress bar; hero parallax.
- Data re-renders (another tab, a payment, a confirmation) never replay entrance animations.
- `prefers-reduced-motion: reduce` turns every effect into an instant state change.

### Dashboard UX
- **Ctrl/⌘+K** (or `/`) opens a command palette: bookings by reference, name or any phone format, customers, pages and quick actions. Arabic-aware matching.
- Shortcuts: `N` new booking, `T` theme, `[` collapse sidebar, `G` then `D/O/C/P/E/R/S/W/A` to jump to a section, `?` shows the list. They work with an Arabic keyboard layout too.
- Collapsible sidebar (remembered), breadcrumb top bar, KPIs with sparklines and change versus the previous period, interactive chart tooltip, status distribution bar, agenda grouped by day, activity feed with relative times.

---

## 4. Business rules (as implemented)

**Pricing.** Fixed, per seat, per m² (0.5 m² steps) or per item. Optional *types* (e.g. single/double mattress) set the unit price; *add-ons* are added per unit. Totals are always recalculated from the current service settings before saving; the page's displayed total is never trusted.

**Transport fee.** Added once per booking based on the selected area. It is revenue included in the booking total. Real transport costs are recorded separately as expenses (never subtracted twice).

**Scheduling.**
- Global workdays and time slots apply to all services.
- Each area has a weekly coverage (which slots on which days).
- A slot is offered only if: future time · workday · slot active · not blocked · area active and covering it · **not already booked by anyone**.
- **One booking per date + slot for the whole business**, regardless of area or service. Pending bookings reserve the slot; canceling releases it.
- Schedule edits affect new bookings only. If an edit makes existing future bookings fall outside the schedule, the admin is warned and must confirm; bookings are never moved or deleted automatically and are flagged until rescheduled.

**Order workflow** (separate from payment status):
- On-site (sofa, mattress, chairs): في انتظار التأكيد → تم التأكيد → مكتمل
- Pickup (carpets, curtains): في انتظار التأكيد → تم التأكيد → تم الاستلام → مكتمل
- A booking containing **any** pickup item follows the pickup workflow.
- Cancel is allowed from pending/confirmed. Invalid transitions are blocked.

**Payments.** Each payment or refund is its own record. Payment status (unpaid / partially paid / paid) is derived from records, never stored. Overpayment is rejected. Completing an order does not mark it paid.

**Cancellation policy.** Payments stay on record. A canceled booking with money paid shows *مستحق استرداد* until a refund transaction is recorded. Canceled bookings are excluded from order value and outstanding balances.

**Report definitions** (shown on the reports page):
- Order value = non-canceled bookings with appointment date in range.
- Collections = payments dated in range − refunds dated in range.
- Outstanding = unpaid part of non-canceled bookings in range.
- Estimated net operating cash surplus = Collections − Expenses (an estimate, not accounting profit).

**Price snapshots.** Each booking stores the service name, pricing method, unit price, options and quantity at booking time. Editing or deactivating a service never changes past bookings. Services/areas/slots used by bookings cannot be deleted, only deactivated.

**Customer matching.** Phone numbers are normalized (e.g. `+20 100 555 1234` → `01005551234`, Arabic digits accepted). Bookings with the same normalized number attach to the same customer record.

---

## 5. Project structure

```
index.html            Public website (hash routes: #/services, #/checkout, #/track/…)
admin.html            Admin dashboard (hash routes: #/dashboard, #/orders, …)
assets/css/base.css   Design tokens (light/dark), shared components
assets/css/motion.css Reveal, page/theme transitions, keyframes, reduced-motion rules
assets/css/site.css   Website styles
assets/css/admin.css  Dashboard styles (incl. command palette)
assets/js/core/       Shared logic used by both apps
  utils.js            Safe HTML templating (auto-escaping), dates, money, phone
  motion.js           Motion engine: page & theme transitions, scroll reveal, count-up, sticky header, nav ink
  seed.js             Demo data (generated relative to today)
  store.js            LocalStorage data layer, validation, versioning, cross-tab sync
  pricing.js          All price calculations
  schedule.js         Availability rules (single source of truth)
  workflow.js         Order statuses and allowed transitions
  finance.js          Payment status, summaries, reports, diagnostics
  bookings.js         Booking creation/validation, rescheduling, customers
  ui.js               Theme, toasts, dialogs, badges, SVG illustrations & charts
assets/js/site/app.js Website pages
assets/js/admin/      Dashboard (core, palette, ops, config, money)
  palette.js          Ctrl/⌘+K command palette and keyboard shortcuts
assets/vendor/        Bootstrap 5.3 RTL, Bootstrap Icons, Readex Pro & IBM Plex Sans Arabic (offline)
```

### Data model (LocalStorage key `naqaa_demo_db`, schema v1)
`settings, workdays, categories, services, slots, areas (with coverage), blocks, customers, bookings (items = price snapshots, history, internalNotes), payments (kind: payment|refund), expenses, activity`.
Other keys: `naqaa_demo_cart` (cart), `naqaa_theme` (theme). Admin session uses sessionStorage.

---

## 6. Reset & recovery
- **Dashboard → الإعدادات والبيانات → استعادة البيانات التجريبية** (asks for confirmation) restores the original demo data and clears the cart.
- If stored data is corrupted, both apps show a recovery screen instead of crashing. Individually malformed records are skipped and reported.
- **تنزيل نسخة JSON** downloads a backup of the current data.

---

## 7. Testing performed
Automated browser tests (Chromium via Playwright) were run against the live demo — **43/43 checks passed**, covering: customer booking end-to-end on a mobile viewport, admin visibility, global duplicate-slot prevention (including a different area and service), cancellation releasing the slot, on-site vs pickup workflows and blocked invalid transitions, partial/second/edited payments and overpayment rejection, expenses and dashboard/report consistency, price snapshots, schedule-change warnings without altering bookings, persistence after refresh, theme persistence, double-click protection, refresh on the confirmation page, tracking privacy, corrupted-storage recovery, and the reset confirmation. All pages were checked for horizontal overflow at 360 px (dark) and 1280 px (light) and for JavaScript errors.

---

## 8. Known limitations (demo by design)
- Data lives in **one browser on one device**. Another browser, device or private window starts with fresh demo data.
- The login is not secure; anyone with technical knowledge can read or edit LocalStorage.
- No real concurrency control: availability is re-checked immediately before saving, but a real server/database transaction is needed in production.
- No SMS/OTP, payment gateway or real notifications.
- Uploaded service images are stored inside LocalStorage (resized to ~720 px); browser storage is limited to roughly 5 MB.

**Next phase:** replace `store.js` with API calls to a real backend (e.g. ASP.NET Core or Laravel + SQL database). The pricing, schedule, workflow and finance modules are written as pure functions so their rules can be ported to the server unchanged.
