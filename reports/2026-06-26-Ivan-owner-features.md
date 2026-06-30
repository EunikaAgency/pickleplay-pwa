# Ivan Report — 2026-06-26: Owner Features


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
---

- **Author:** Ivan
- **Date:** 2026-06-26
- **Area:** `api/` (new role + staff feature + scoping) and `app/` (PWA owner console). Permission catalogue synced to `web/`.
- **Status:** ✅ Built & **verified end-to-end** (curl, on the live local API). API restarted (`pickleballer-api`); PWA serves source live (Vite dev). Not yet committed.

---

## 1. Goal

Let a venue owner create staff **login accounts** that run the owner console on their
behalf. A staff member created by an owner can manage **all** of that owner's venues,
bookings, and clubs — but cannot create more staff or list/claim new venues. Only owners
and admins can create staff. Entry point lives on the owner **Profile** page (per request).

> This is **org-level** delegation — distinct from the pre-existing per-venue `VenueStaff`
> (which attaches an *existing* user to a *single* venue). This feature creates a brand-new
> account scoped to the owner's whole org.

## 2. How it works

- **New `staff` role** — operational owner permissions (`owner.access`, `owner.venues.manage`,
  `owner.bookings.manage`, analytics/games/market/reviews/coaches/tournaments/notifications +
  the player base set) **minus** `owner.staff.manage`, `owner.venues.create`, `owner.venues.claim`.
- **`parentOwnerUserId`** on the `User` model ties each staff account to its creating owner.
  Carried in the JWT as `parentOwnerId`.
- **`effectiveOwnerId(user)`** (new helper in `shared/lib/permissions.ts`) = the creating
  owner's id for a staff member, else the user's own id. **Single lever:** every "is this my
  resource?" check compares the resource's owner to this id, so staff inherit their owner's
  resources without owning them.
- **`isActive`** on `User` — a backend safety net (an inactive account is refused a session,
  403). The owner UI itself removes accounts outright (hard delete) rather than deactivating.

## 3. What changed

### API
- **`shared/lib/permissions.ts`** — `staff` role + `STAFF_PERMISSIONS`; new `effectiveOwnerId()`.
- **`features/auth/auth.model.ts`** — `parentOwnerUserId` + `isActive` on `User`.
- **`features/auth/auth.controller.ts`** — token + `/me` payload carry `parentOwnerId`/`parentOwnerUserId`/`isActive`; **login rejects deactivated accounts (403)**.
- **`shared/lib/jwt.ts`** — `parentOwnerId` on `TokenPayload`.
- **`features/roles/roles.controller.ts`** — seed metadata for the `staff` role ("Venue staff").
- **`features/staff/` (new slice)** — `staff.controller.ts` + `staff.routes.ts` (no model; reuses `User`):
  - `POST /api/v1/staff` — create a staff account (owner → under self; admin → `?ownerUserId`).
  - `GET /api/v1/staff` — list the owner's staff (admin may pass `?ownerUserId`).
  - `PATCH /api/v1/staff/:id` — rename / reset password / toggle `isActive`.
  - `DELETE /api/v1/staff/:id` — **remove** the account outright (hard-deletes the login;
    scoped to staff sub-accounts only). The owner UI uses Remove (with a confirm), not deactivate.
  - All gated by `owner.staff.manage`; non-admins scoped to their own staff via `effectiveOwnerId`.
- **Scoping honored:** `venues.controller.ts` (`requireVenueOwner`, `getVenueManagerRole`,
  `listVenues` managed-mode + `viewerStaffRole`) and `clubs.controller.ts` (`isHostOf` /
  `canViewClub` made staff-aware) now resolve ownership via `effectiveOwnerId`. Bookings come
  along for free (the owner inbox is venue-scoped).

### App (PWA)
- **`features/owner/hooks/useOwnerDashboard.ts`** — the owner console now loads
  `listManagedVenues` (`?managedByUserId=self`, resolved server-side via `effectiveOwnerId`)
  instead of `listOwnerVenues` (`?ownerUserId=self`). This was the bug that made a staff
  member see **0 venues** (they own none) even though their owner has venues; managed-mode
  returns the owner's full set. `OwnerVenuesScreen` hides Create/Claim for staff (no permission).
  Also: `listVenues` now sends the auth token (`auth: true`) — the `managedByUserId` filter is
  self-only and 403s without it, so the whole owner/staff dashboard would otherwise fail to load
  (safe for guests: the endpoint is optionalAuth and only reads the token for the self-check).
- **`features/owner/OwnerStaffScreen.tsx` (new)** — `/owner/staff`: list staff, add account
  (name/email/temp password), reset password, **remove** (with an inline confirm). Gated by `owner.staff.manage`.
- **`OwnerProfileScreen.tsx`** — new **"Staff"** row in the Manage section (the requested
  `/profile` entry point); role pill/label now reflect the real role (a staff member sees "Staff").
- **`shared/lib/api.ts`** — `StaffAccount` type + `listStaffAccounts`/`createStaffAccount`/
  `updateStaffAccount`/`removeStaffAccount`.
- **`shared/lib/permissions.ts` + `roleDisplay.ts`** — `staff` role synced + ranked/labelled.
- **`navigation.ts` + `App.tsx`** — `owner-staff` screen, path, parser, `SCREEN_PERMISSIONS`
  (`owner.staff.manage`), auth intent.

## 4. Permissions / `/lists` / FILEMAP
- **No new permission key** — reuses `owner.staff.manage` (already on owner + admin). The new
  `staff` **role** is added to all three permission copies (api/app/web) + seeded to the DB.
- **API routes added:** `GET/POST /api/v1/staff`, `PATCH/DELETE /api/v1/staff/:id` — all in `/lists`.
- **FILEMAP:** updated (api `staff/` slice + `effectiveOwnerId`; app `OwnerStaff` screen).

## 5. Verification (curl, live API)
- Owner login → manages **7 venues**. Create staff → `parentOwnerUserId` set ✓
- Owner lists staff (1) ✓
- Staff login → role `staff`, `parentOwner` set, **has** `owner.access`, **lacks**
  `owner.staff.manage` + `owner.venues.create` ✓
- Staff lists managed venues → **same 7**, `viewerStaffRole: 'owner'` ✓ (`?ownerUserId=self`
  returns 0 — confirming why the console must use managed-mode, now fixed in `useOwnerDashboard`)
- Staff reads an owner venue's bookings inbox → **200** ✓
- Staff views + **edits the owner's private club** (`isHost: true`, PATCH **200**) ✓
- Staff create venue → **403**; staff create staff → **403** ✓
- Owner **removes** staff → account gone from DB, removed staff login → **401** ✓
- `staff` role seeded in DB (label "Venue staff", 29 perms) ✓
- **QA regression caught + fixed:** the owner/staff dashboard fetches `?managedByUserId=self`
  (self-only). With the token it returns 7 venues; without it → **403** ("Couldn't load your
  venues" for owners *and* staff). Fixed by having `listVenues` send `auth: true`. Re-verified
  both owner and staff load the dashboard.
- API typecheck, app build, web build, scoped ESLint — all clean.

## 6. Commit status
- **Not yet committed.** Spans `api/` (new role, staff slice, scoping) + `app/` (owner staff
  screen + profile entry) + the `web/` permission sync and roadmap entry. Ready to commit on request.
---

## Completed: Medium/Strategic Features (API)

All 6 medium-priority items from the master requirements sheet have their
backend (API) implementation complete. The app-side UI wiring for features 3–6
is the next phase.

### 1. In-App Owner↔Player Messaging ✅ (API + App)
- Venue-scoped conversations: `contextType`/`contextId` on the Conversation model
- `GET /messages/venue/:venueId` — find-or-create a thread between player and venue owner
- Auto intro message: "Hi, I have a question about {venue name}."
- "Message venue" button on CourtDetailsScreen (Contact section)
- Venue context labels in conversation list and chat header

### 2. Cash Booking Leakage Mitigation ✅ (API + App)
- 3 new demand event types: `checkout_started`, `checkout_abandoned`, `booking_link_shared`
- `GET /demand/venues/:id/leakage` — owner leakage report with funnel + daily timeseries
- LeakageTab in owner venue console (funnel bar chart, daily breakdown, KPI cards)
- Demand events wired in BookCourtScreen (checkout steps) and BookingLinkShare (share/copy)
- Fixed pre-existing TS errors in demand.controller.ts

### 3. Booking Modification ✅ (API)
- `BookingModification` audit model (bookingId, userId, changes, priceDelta)
- `PATCH /bookings/:id/modify` — player-scoped; accepts date/startTime/endTime/courtId changes
- Re-checks slot availability via `findSlotConflict()`
- Max 3 modifications per booking; rejects past/cancelled bookings
- Modification audit log tracks old→new values

### 4. Waitlist System ✅ (API)
- `WaitlistEntry` model (userId, venueId, courtId, date, startTime, endTime, playerCount, status)
- Status flow: waiting → promoted → claimed | expired | cancelled
- `POST /waitlist` join, `GET /waitlist/mine`, `DELETE /waitlist/:id` leave, `POST /waitlist/:id/claim`
- Auto-promotion on booking cancellation: first waitlisted player gets promoted + push notified
- 2-hour claim window; expired promotions cascade to next in line

### 5. BIR-Compliant Official Receipts ✅ (API)
- `OfficialReceipt` model with sequential OR numbering per venue (OR-{code}-{year}-{seq})
- `ReceiptCounter` for atomic auto-increment
- Auto-generates draft receipt on booking confirmation (12% VAT breakdown)
- Player endpoints: `GET /receipts/mine`, `GET /receipts/:id`
- Owner endpoints: `GET /venues/:id/receipts`, `PATCH /receipts/:id` (issue/void, payor info)

### 6. Payout Schedule & Reconciliation ✅ (API)
- `Settlement` model (settlementRef, venueId, periodStart/End, grossRevenue, platformFees, netPayout, status)
- `SettlementLineItem` per-booking breakdown
- `OwnerPayoutMethod` model (bank_transfer/gcash/maya/other)
- Admin: `POST /admin/settlements/generate`, `GET /admin/settlements`, `PATCH /admin/settlements/:id`
- Owner: `GET /owner/settlements`, `GET /owner/settlements/balance`, payout methods CRUD

## Remaining Work

- **App UI** for features 3–6: ModifyBookingSheet, waitlist UI in BookCourtScreen/MyBookings, ReceiptScreen/ReceiptsScreen, OwnerPayoutsScreen/AdminSettlementsScreen
- **Permissions**: `owner.finance.view` and `admin.finance.manage` need syncing across api/app/web
- **Documentation**: `/lists` endpoint catalogue, FILEMAPs, testing
- **Testing**: API curl verification + Playwright browser tests

## New Files Created

### API
- `api/src/features/waitlist/waitlist.controller.ts`
- `api/src/features/waitlist/waitlist.routes.ts`

### App
- `app/src/features/owner/tabs/LeakageTab.tsx`

### Modified Files (key)
- `api/src/features/messages/messages.model.ts` — +contextType/contextId
- `api/src/features/messages/messages.controller.ts` — +getVenueConversation
- `api/src/features/messages/messages.routes.ts` — +venue route
- `api/src/features/demand/demand.model.ts` — +3 event types
- `api/src/features/demand/demand.controller.ts` — +leakage report, fixed TS errors
- `api/src/features/demand/demand.routes.ts` — +leakage route
- `api/src/features/bookings/bookings.model.ts` — +BookingModification, +WaitlistEntry
- `api/src/features/bookings/bookings.controller.ts` — +modifyBooking, waitlist promotion on cancel
- `api/src/features/bookings/bookings.routes.ts` — +modify route
- `api/src/features/payments/payments.model.ts` — +OfficialReceipt, +ReceiptCounter, +Settlement, +SettlementLineItem, +OwnerPayoutMethod
- `api/src/features/payments/payments.controller.ts` — +receipt CRUD, +settlement CRUD, +payout methods
- `api/src/features/payments/payments.routes.ts` — +receipt/settlement/owner routes
- `api/src/routes/index.ts` — +waitlist routes
- `app/src/shared/lib/api.ts` — +types and client functions for all features
- `app/src/features/venues/CourtDetailsScreen.tsx` — +"Message venue" button
- `app/src/features/messages/ConversationsScreen.tsx` — venue context labels
- `app/src/features/messages/ChatScreen.tsx` — venue context in header
- `app/src/features/bookings/BookCourtScreen.tsx` — demand events for checkout steps
- `app/src/features/owner/components/BookingLinkShare.tsx` — demand events on share
- `app/src/features/owner/OwnerVenueScreen.tsx` — +leakage tab
- `web/src/features/marketing/RoadmapPage.jsx` — updated changelog + date
- `TASKS/task.md` — marked all 6 medium items done

