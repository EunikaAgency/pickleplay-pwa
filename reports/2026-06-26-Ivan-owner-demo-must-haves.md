# Task Report — Owner-demo must-haves: manual booking, front-desk console, deposit/pay-at-venue, 7% service fee

- **Author:** Ivan
- **Date:** 2026-06-26
- **Area:** `api/` (settings, venues, bookings) and `app/` (PWA: checkout + owner console). Roadmap synced in `web/`.
- **Status:** ✅ Built. **API verified end-to-end via curl** on the live local API (restarted `pickleballer-api`). App typechecks + production-builds clean; PWA serves source live (Vite dev, port 9000). **App UI not yet browser-tested.** Not yet committed.

> **Scope of this report.** Covers the four owner-demo "must-haves" from the meeting notes (`PB-meeting-notes.pdf`) + master requirements sheet (`Standardised Pickleballers …csv`). It does **not** cover the other uncommitted owner work: **owner staff accounts** has its own report (`2026-06-26-Ivan-owner-staff-accounts.md`), and the **venue membership tab** is intentionally **excluded** per request.

---

## 1. Goal

Close the four remaining owner-demo "must-haves":

1. **Manual booking / slot-blocking** — the meeting's **#1 priority**. Let the owner/front-desk record a booking made off-platform (phone / Messenger / Instagram / walk-in) or block a slot, so the court is reserved and double-booking-guarded without going through player checkout.
2. **Operator / staff dashboard** — a front-desk view: today's schedule, pending approvals, manual entries.
3. **Deposit vs full vs pay-at-venue** at checkout.
4. **7% player service fee** shown as a single line.

---

## 2. How it works

### Manual booking / slot-blocking (#1, 2)
- New owner endpoint **`POST /api/v1/venues/:id/bookings`** (gated by `requireVenueManager` → owner **or** any active staff incl. front-desk).
  - `bookingType: 'manual'` — off-platform reservation; stores `customerName`/`customerPhone` + `bookingSource` (`walk_in`/`phone`/`messenger`/`instagram`/`other`) + `amount` + `paymentMethod`. No online payment (recorded as settled offline).
  - `bookingType: 'blocked'` — slot made unavailable; stores `blockReason`, `amount: 0`.
  - The platform `userId` is set to the **staff/owner** (the required ref) and the real entrant is recorded in **`createdByUserId`** — the manager is not the customer.
- **Reuses the player flow's double-booking guard:** `findSlotConflict` is now **exported** from `bookings.controller.ts` with an **optional `userId`** (the own-overlap check is skipped when there's no single customer). The court-clash + venue-pool-capacity + turnover-buffer checks all still run, so a manual entry can't sit on top of an existing reservation.
- Manual/blocked rows are **excluded from players' "My bookings"** (`listBookings` filter now `bookingType ∉ {game, manual, blocked}`) and surface in the owner inbox tagged **MANUAL/BLOCKED**.

### Operator / staff dashboard (#2)
- New **`OwnerFrontDeskScreen`** (`owner-front-desk`): per-venue **today's schedule** (time-sorted, with a ‹ Today › date stepper), **pending approvals** (inline approve/decline), **KPIs** (bookings today / awaiting approval / manual today), a **venue picker** for multi-venue owners, and the **Add booking** + **Block slot** forms (a shared `BottomSheet` reusing `CourtPicker`/`HourSelect`/`CalendarDatePicker`). Reached from a new **"Front desk"** quick action on the owner home.

### Deposit / full / pay-at-venue (#3)
- Owner enables any subset in the **Listing** editor: `Venue.paymentOptions` (`full`/`deposit`/`pay_at_venue`) + `Venue.depositPercent`.
- Player picks one at checkout (`BookCourtScreen`, instant-book venues only; approval venues stay full-pay-after-approval):
  - **full** → charge the grand total → confirmed.
  - **deposit** → charge `depositPercent%` now, **balance due at the venue** (shown).
  - **pay_at_venue** → reserve with **no online charge** (skips checkout; the booking auto-confirms at creation).
- Persisted on the booking: `paymentOption`, `amountPaid`, `balanceDue`.

### 7% service fee (#4)
- Single platform fee in **`AppSettings.serviceFeePercent`** (default **7**, admin-editable via `PATCH /settings`), surfaced on the public **`GET /settings`**.
- Shown as its own line in the **checkout review** + **My Bookings** + the **owner booking detail**: *Subtotal + Service fee (7%) + Total*. Stored as `Booking.serviceFeeAmount`.
- **The venue's `amount` stays the venue's own price** (court × hours + equipment), so owner **revenue analytics are unchanged** — the fee is the platform's, tracked separately.

---

## 3. What changed

### API (`api/`)
- **`features/settings/settings.model.ts`** — `serviceFeePercent` (default 7).
- **`features/settings/settings.controller.ts`** — public shape returns `serviceFeePercent`; `updateSettings` accepts it; new `getServiceFeePercent()` helper.
- **`features/venues/venues.model.ts`** — `paymentOptions: [String]` + `depositPercent`.
- **`features/venues/venues.controller.ts`** — `updateVenueSchema` gains `paymentOptions`/`depositPercent`; new `createVenueBookingSchema` + **`createVenueBooking`** handler (manual/blocked, validates court, runs `findSlotConflict`, enriches the response with court label).
- **`features/venues/venues.routes.ts`** — `POST /:id/bookings` (auth) → `createVenueBooking`.
- **`features/bookings/bookings.model.ts`** — payment breakdown (`serviceFeeAmount`/`paymentOption`/`amountPaid`/`balanceDue`) + owner-entry fields (`createdByUserId`/`customerName`/`customerPhone`/`bookingSource`/`blockReason`) + `notes`.
- **`features/bookings/bookings.controller.ts`** — `findSlotConflict` **exported** (optional `userId`); `createSchema` + `createBooking` persist the payment-breakdown fields; `listBookings` excludes `manual`/`blocked`.
- **`features/root/root.controller.ts`** — `/lists` updated (`POST /venues/:id/bookings`; settings now note the service-fee %).

### App (`app/`)
- **`shared/lib/api.ts`** — `PaymentOption` type; `ApiBooking` + `CreateBookingPayload` payment-breakdown + manual fields; `AppSettings.serviceFeePercent`; `ApiVenue.paymentOptions`/`depositPercent`; `VenueBookingPayload` + **`createVenueBooking()`**.
- **`features/bookings/BookCourtScreen.tsx`** — subtotal → service fee → grand total breakdown; payment-option selector (instant-book); pay-at-venue skips checkout; deposit shows balance due; CTA/amounts updated.
- **`features/bookings/MyBookingsScreen.tsx`** — detail breakdown (Subtotal/Service fee/Total + payment plan + due-at-venue); approved request-to-book now pays `amount + serviceFee`.
- **`features/bookings/bookingDisplay.ts`** — `paymentOptionLabel()` + `bookingSourceLabel()`.
- **`features/owner/OwnerFrontDeskScreen.tsx`** — **NEW** front-desk console + manual/block sheet.
- **`features/owner/OwnerHomeScreen.tsx`** — "Front desk" quick action (+ icon).
- **`features/owner/OwnerBookingDetailSheet.tsx`** + **`components/OwnerBookingRow.tsx`** — show the off-platform customer / block reason and the fee/deposit/balance breakdown; tag MANUAL/BLOCKED.
- **`features/owner/tabs/ListingEditorTab.tsx`** — "Payment options at checkout" config (option chips + deposit %).
- **`shared/lib/navigation.ts`** + **`App.tsx`** — `owner-front-desk` screen (union, path, parser, render case), `SCREEN_PERMISSIONS` (`owner.bookings.manage`), auth intent.

### Docs
- **`TASKS/owner-venue-tasks.md`** + **`TASKS/task.md`** — the four marked done.
- **`app/FILEMAP.md`** + **`api/FILEMAP.md`** — new screen + endpoint + model fields.
- **`web/src/features/marketing/RoadmapPage.jsx`** — hero "Last updated" + Change Log entry.

## 4. Permissions / `/lists` / FILEMAP
- **No new permission key.** Manual booking/front-desk reuse `requireVenueManager` (server) + `owner.bookings.manage` (app screen gate, so active staff can run it). Payment options reuse the existing `owner.venues.manage` listing edit. Service-fee % edit reuses `admin.settings.manage`.
- **API routes added:** `POST /api/v1/venues/:id/bookings` (in `/lists`); `GET/PATCH /api/v1/settings` descriptions refreshed.
- **FILEMAP:** updated on both `app/` and `api/`.

## 5. Verification (curl, live API)
- Manual booking on a specific court → **201**, persists `bookingType:'manual'` + customer/source/amount + `status:'confirmed'` ✓
- Same court + slot again → **409 SLOT_CONFLICT** (double-booking guard) ✓
- Court-less bookings on a 3-court venue do **not** clash (pool capacity) — correct ✓
- Block slot → **201**, `bookingType:'blocked'`, `amount:0`, block reason ✓
- Bad court id → **400**; unauthenticated → **401** ✓
- Manual + blocked appear in `GET /venues/:id/bookings`; absent from player `GET /bookings` ✓
- Player `createBooking` with `serviceFeeAmount`/`paymentOption:'deposit'`/`amountPaid`/`balanceDue` → all persisted, `status:'confirmed'` ✓
- `GET /settings` returns `serviceFeePercent: 7` ✓
- API typecheck clean; app `tsc -b` + `vite build` clean; web build clean. Lint: only the repo's pre-existing `react-hooks/set-state-in-effect` pattern (same idiom used across the codebase).
- Test rows created during curl were cleaned up from the DB afterward.

## 6. How to test the app UI (not yet done)
- App: `https://pickleballer-pwa.eunika.xyz` (or `localhost:9000`). Owner `20f3830a.pet@example.com` owns *Magallanes Village Association* (3 courts, instant-book); player `0418f540.king@example.com`. All `password123`.
- **Front desk:** owner Home → "Front desk" → Add booking / Block slot → appears on schedule (MANUAL/BLOCKED); re-add same court+time → error.
- **Payment options:** owner Listing → enable Deposit + Pay-at-venue (+ deposit %) → as **player**, book that court → selector appears at checkout.
- **Service fee:** any checkout review → Subtotal + Service fee (7%) + Total.

## 7. Commit status
- **Not yet committed.** Spans `api/` (settings + venues + bookings + `/lists`) and `app/` (checkout + owner front-desk + booking displays + nav). The `web/` roadmap entry and the `TASKS/`+FILEMAP doc updates are part of the same change. Ready to commit on request.

### Product defaults chosen (flag if different is wanted)
- **Deposit default = 50%** (owner-overridable per venue).
- **The 7% fee applies to every booking** (the marketplace model from the meeting) — all checkout totals now include it.
- **Payment options apply to instant-book venues only**; approval ("request-to-book") venues still pay in full after the owner approves.
