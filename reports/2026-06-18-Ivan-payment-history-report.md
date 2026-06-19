# Task Report — Player payment history + spend report (with graph)

- **Author:** Ivan
- **Date:** 2026-06-18
- **Area:** `app/` (PWA — new Profile screen + entry points) + the 3-copy permission catalogue (`api/` source of truth, `web/` + `app/` synced) + roadmap
- **Status:** ✅ Implemented. Payments endpoint **verified end-to-end via curl** with a real seeded user token. App + web builds and API typecheck all clean. App UI is **compiled-only** (not runtime-clicked — no headless browser in env).

---

## 1. Goal

A player asks: *"create me a report history with graph of payment for players."*
Give a player a **payment history / spend report** inside the app — a graph of
what they've paid over time plus an itemised receipt list — reachable from the
Profile (both the current design and the v2.1 design they were viewing).

## 2. What already existed (reused, not rebuilt)

- **`GET /api/v1/payments`** (`payments` slice) — already **self-scoped**:
  `listPayments` filters by `userId: user.sub` and returns the caller's own
  payments (newest first, capped 50). **No API change was needed** — the data was
  already there; every checkout (court bookings + the court a game host pays for)
  writes a `Payment` row.
- **`shared/components/ui/Chart.tsx`** — the dependency-free `BarChart` /
  `ChartLegend` primitives built for owner analytics; reused for the spend graph.
- The **web already has** a `/dashboard/payments` page — this brings the **app to
  parity**.
- **`MyBookingsScreen`** patterns (header, loading/error/empty states, money
  formatter) — matched for consistency.

---

## Task 1 — App: payments client
- Added **`ApiPayment`** type + **`listPayments({status?})`** to the PWA api
  client — one `GET /api/v1/payments` call, self-scoped server-side.

## Task 2 — App: the report screen
- New **`features/profile/PaymentHistoryScreen.tsx`**:
  - **KPI cards** — Total spent (+ paid-payment count) and This month (+ pending).
  - **6-month spend bar graph** (`BarChart`) — **paid vs pending** segments, with a
    legend when there's pending spend.
  - **Receipts list** — date, method, amount, and a **Paid / Pending / Refunded**
    status chip; court-booking payments get a calendar icon.
  - Owns its **loading / error / empty** states (empty → "Find a court" CTA).
- **Status handling:** checkout writes `'completed'`; older/seeded rows use
  `'paid'`. **Both count as paid spend** (caught this from the live data — the DB
  had 38 `paid` + 58 `completed` rows; counting only `completed` would have
  under-reported every spend total).
- **Slice hygiene:** money/status/date formatters are **inlined** in the screen —
  the profile slice must not import the bookings slice's `bookingDisplay` (same
  rule `home/` and `ProfileScreenV2` already follow).

## Task 3 — Entry points (both designs)
- **`ProfileScreen.tsx`** (New/Classic) — a "Payment history" row in the Activity menu.
- **`v2/ProfileScreenV2.tsx`** (v2.1) — a "Payment History" item in the Account
  settings list, under "My Bookings".
- Both rows are **permission-gated** (hidden when the user lacks the perm).

## Task 4 — Permission
- Added **`player.payments.view`** — gates the spend report.
- **Synced** across **API, web, and app** (`ALL_PERMISSIONS` + player base set);
  added the **catalogue** entry (admin Roles & permissions matrix) + the **player
  role default**.
- Resolves **client-side** from roles (`resolveRolePermissions`), so existing
  players get it on **next login** — no DB role toggle needed for the app.
- Gated the **screen** via `SCREEN_PERMISSIONS` in `App.tsx` (+ a guest auth
  intent). The pre-existing `GET /payments` route stays `requireAuth` + self-scoped
  (no route-surface change → **no `/lists` edit**).

## Task 5 — Wiring
- Registered `payment-history` in **`navigation.ts`** (Screen union) and
  **`App.tsx`** (`renderScreen` case, `SCREEN_PERMISSIONS`, `SCREEN_AUTH_INTENT`).

## Task 6 — Testing & verification
- **End-to-end:** found the seeded user with the most payments
  (`84a3be4a.hernandez@example.com` — the *Kenneth Hernandez* profile in the
  request screenshot), logged in via curl, hit `GET /api/v1/payments` → **32 rows,
  ₱18,842.50 paid**. The report renders populated for that account.
- Confirmed **API typecheck**, **PWA build**, and **web build** all pass.
- **Restarted** the API to pick up the `permissions.ts` catalogue change.
- Updated the public **roadmap + changelog** + **`app/CLAUDE.md`** change history +
  **`app/FILEMAP.md`** (profile slice + "Where to look first" row).

## Task 7 — Known gaps / not fully tested
- The **app UI builds cleanly** but was **not manually clicked through** in a
  browser (no headless browser in env) — verification is endpoint-level + build.
- The `/payments` route is **self-scoped `requireAuth`** (not a hard permission
  gate) — the `player.payments.view` gate is applied **in the app**, consistent
  with how `listBookings` is treated. A user can only ever read their own rows.
- **No time-range toggle / no booking-vs-game breakdown** yet — fixed 6-month
  window, paid-vs-pending split only. Easy follow-ups if wanted.
- One pre-existing repo-wide **lint** baseline (`react-hooks/set-state-in-effect`)
  fires on the new screen's fetch effect — it **matches the shipped
  `MyBookingsScreen`** pattern exactly; build stays clean.

---

## How to test locally
- **PWA:** `http://localhost:9000` (PM2 `pickleplay-pwa`) / `pickleballer-pwa.eunika.xyz`.
- **Login:** `84a3be4a.hernandez@example.com` / `password123` (the screenshot user,
  most payments) — or any seeded player. The new permission takes effect on **next
  login** (resolved from roles client-side).
- **Try:** Profile → **Payment history** (Activity menu in New/Classic; Account
  list in v2.1) → see Total/This-month KPIs, the 6-month spend bar graph, and the
  receipts list (Paid / Pending / Refunded).
- **API:** `curl http://localhost:9002/api/v1/payments -H "Authorization: Bearer <token>"`
  — returns the caller's own payments.

## Roadmap
Change Log entry added to `web/src/features/marketing/RoadmapPage.jsx` (top of the
list, dated 2026-06-18, tagged `app` + `api`); hero "Last updated" already on
2026-06-18.

## Not committed
All changes are uncommitted across the monorepo (`app/`, roadmap, this report) +
the nested `api/` repo, pending review.
