# Owner / Venue Tasks — from PB Owner App Meeting + Master Requirements Sheet

Source: [PB-meeting-notes.pdf](./PB-meeting-notes.pdf) + master requirements sheet (2026-06-25)
Last scanned against code: **2026-06-25** (deep-dive gap analysis — verified every model field, API route, and UI surface; 6 of 9 previously-flagged items are actually done; real gaps documented below)

Legend: `✅` done · `🟡` partial (built but incomplete / data-only / not applied) · `⬜` not started · `⏸️` deferred (roadmap)

---

## 0. Master Requirements Sheet — status audit (2026-06-25)

Every row of the master sheet, checked against the actual code.

### Pricing
| Requirement | Priority | Status | Reality in code |
|---|---|---|---|
| Base court price (default hourly rate per court) | Must | ✅ | `Court.hourlyRate` + venue `priceFrom`; Book flow uses it (`BookCourtScreen` L141). |
| Court-specific price overrides | Must | ✅ | Per-court `hourlyRate` overrides venue rate; blank → falls back to venue. |
| Per-player surcharge (base + ₱/extra head) | Must | ⬜ | `Booking.playerCount` exists but pricing is flat `rate × hours` — no per-head charge. |
| Time-based pricing (e.g. after 6 PM) | Must | ✅ | **Configurable + now charged.** Owner sets per-block "Hours pricing" windows (`VenueHour.price` via `WeeklyHoursEditor`); **BookCourtScreen now resolves the time-block rate** (2026-06-25) — if the selected start time falls in a priced block, that rate applies; otherwise falls back to court/venue rate. |
| Day-based pricing (weekday/weekend/holiday) | High | ⬜ | No day-tier pricing; not applied. |
| Day-based pricing (weekday/weekend/holiday) | High | ⬜ | No day-tier pricing; not applied. |
| Member pricing (venue-member rate) | High | ⬜ | No membership concept in the owner slice. |
| Manual surge adjustment (owner raises/lowers a slot) | High | ⬜ | Not built. |
| Currency / VAT / tax-inclusive display | High | ✅ | Currency shown (₱ via `money()`); **`pricingTaxLabel` field added** (2026-06-25) — owner-editable ("VAT inclusive" default), shown on public page + checkout review. |
| Deposit vs full vs pay-at-venue at checkout | Must | ⬜ | Full-pay only (request-approval still pays full, later). No deposit / pay-at-venue. |
| 7% player service fee display | Must | ⬜ | No fee shown — total is `rate × hours` only. |
| Open-play / per-session pricing | High | ⬜ | Not a court-booking price mode (`venue.openPlayPrice` is unused data). *(Organizer open-play sessions are a separate feature.)* |
| Equipment / paddle rental add-ons | Medium | ⬜ | `venue.equipmentRentalPrice` is unused data; no checkout line item. |
| Half-court / split-court pricing | Medium | ✅ | `Court.isSplittable` + `splitCount` (2-4 units) in model + CourtsEditorTab UI. Sub-court booking enforcement not yet in booking flow. |
| Suggested dynamic pricing | Roadmap | ⏸️ | Deferred. |
| Automated dynamic pricing (opt-in) | Later | ⏸️ | Deferred. |

### Booking
| Requirement | Priority | Status | Reality in code |
|---|---|---|---|
| Auto-generated booking link (+ custom slug) | Must | ✅ | `…/venues/<slug>` + optional `bookingSlug`, live availability check, Copy/Share. |
| Manual vs automatic approval, per venue | High | ✅ | **Per-venue** (`requireBookingApproval` in `ListingEditorTab`) **+ per-court override** (`Court.approvalMode` `inherit`/`auto`/`manual` in `CourtsEditorTab`; `createBooking` resolves court-over-venue). |
| Double-booking collision handling | Must | ✅ | Clash detection in `bookings.controller` (court + venue-pool). |
| Manual booking / slot blocking (phone/Messenger/IG/walk-in) | Must | ⬜ | **#1 meeting priority — zero backend, zero UI.** No owner-create-booking endpoint, no slot-block (court-level unavailability), no walk-in entry, no front-desk quick-book. Only player-initiated `POST /bookings` exists. Needs: (a) owner `POST /venues/:id/bookings` endpoint with `bookingType:'manual'|'blocked'`, (b) slot-block UI in courts/calendar, (c) front-desk quick-book form (pick court→time→player→confirm, no payment). |
| Cancellation & refund rules (window, fees, no-show) | High | ✅ | Player cancel + refund-request exists; **owner-configurable policy built** (2026-06-25) — `cancellationWindowHours`, `refundPercent`, `noShowFee` on Venue model, editable in ListingEditorTab, shown on CourtDetailsScreen + BookCourtScreen review step. |
| Recurring bookings (weekly regulars, leagues) | High | ⬜ | Not for court bookings. *(Organizer recurring open-play is separate.)* |
| Booking modification (reschedule, change court) | Medium | ⬜ | Not built. |
| Overbooking / waitlist for full slots | Medium | ⬜ | Not built for court bookings. |
| Buffer / turnover time between bookings | Medium | ✅ | Per-court `Court.turnoverMinutes` gap; the create-booking guard + per-court availability both honor it. |

### Venue Setup
| Requirement | Priority | Status | Reality in code |
|---|---|---|---|
| Multiple venues per owner | Must | ✅ | `OwnerVenuesScreen`. |
| Multiple courts per venue | Must | ✅ | `CourtsEditorTab`. |
| Court details: surface, photos, thumbnail, description, **name** | Must | ✅ | **2026-06-25:** court editor now 3 tabs (Court Info / Gallery / Hours): name, rate, surface, description, thumbnail + multi-photo **gallery with tap-to-preview lightbox**. |
| Operating hours / availability per court | Must | ✅ | Per-court `WeeklyHoursEditor` (`VenueHour.courtId`); inherits venue default until saved. |
| Address autocomplete + auto-geocoding | High | ✅ | **Create form done** (`AddressAutocomplete` type-ahead → pin + city/line1/postcode). **Editor done** — `LocationEditorTab` has full structured address editing (line1/line2/city/region/postcode) + map pin + type-ahead search. |
| Separate website field vs booking link | Must | ✅ | Two distinct fields. |
| Amenities / facilities (parking, showers, aircon, lighting, indoor/outdoor) | Medium | ✅ | Rich amenity fields in model + editable in `ListingEditorTab`. |
| Profile completion prompts | Medium | ✅ | Passive `CompletenessMeter` existed; **active deep-linked nudges wired** (2026-06-25) — tapping an incomplete item jumps to the right editor tab. |
| Venue claim flow (claim unclaimed listing) | High | ✅ | `ClaimVenueScreen` + `owner.venues.claim` + admin review. |

### Multi-Sport
| Requirement | Priority | Status | Reality in code |
|---|---|---|---|
| Court sport/type field in data model | Strategic | ✅ | `Court.sport` field + sport picker (Pickleball/Tennis/Badminton/Padel/Basketball/Volleyball) in `CourtsEditorTab`. |
| Multi-sport visible in demo or data-model only | Strategic | ✅ | Sport surfaced on court cards + public venue page per-court breakdown. |

### Dashboard / Access
| Requirement | Priority | Status | Reality in code |
|---|---|---|---|
| Owner view: revenue, occupancy, performance | Must | ✅ | `OwnerHomeScreen`, `VenueOverviewTab`, `OwnerInsightsScreen`. |
| Operator/staff view (today's schedule, pending, manual entries, cancellations) | High | ⬜ | No operator-role view; depends on manual-booking + staff wiring (see gap #6 below). |
| Role-based dashboard users (owner / manager / front-desk) | High | 🟡 | `VenueStaff` model + `:id/staff` routes + StaffEditorTab UI done. **But app never calls `listManagedVenues` — uses `listOwnerVenues` only, so staff see zero venues.** `viewerStaffRole` returned by API but never consumed. No role-tailored views. |
| Multi-user/staff accounts with permissions | High | 🟡 | Backend (model+routes+perms) + StaffEditorTab UI done. **But `listManagedVenues` is never called — staff see zero venues because only `listOwnerVenues` is used.** `viewerStaffRole` returned by API but never consumed in app. No role-based view separation (front_desk sees full owner console but gets 403s on structural edits). |
| Owner identity verification / anti-fraud on claim | Medium | 🟡 | Claim form collects legal name, role/title, contact, proof links. **No formal ID document upload** (links only — no file picker for scanned IDs/permits). **No admin review UI** in app or web (API-only). No "needs more info" state between pending→approved/rejected. |

### Analytics
| Requirement | Priority | Status | Reality in code |
|---|---|---|---|
| Minimum credible analytics view before demo | High | ✅ | Insights: revenue + booking trends, utilization & peak hours, per-venue compare. |
| Busiest hours / underused / revenue by court | Roadmap | ⏸️ | Partial in Insights; deeper per-court demand view deferred. |
| Demand data capture (searches, views, attempts, cancellations, empty slots) | High | ⬜ | No demand-capture instrumentation. |

### Content / Payments / Notifications / Comms
| Requirement | Priority | Status | Reality in code |
|---|---|---|---|
| Platform-curated highlights (not owner claims) | Medium | ✅ | `computeVenueHighlights()` in API derives `bestFor` + `whatPlayersLike` from amenities/ratings/bookings; ListingEditorTab + CourtDetailsScreen both render them as read-only curated chips. |
| Payout schedule & reconciliation to venue | High | ⬜ | No payout/split/settlement. |
| BIR-compliant / official receipts | High | ⬜ | Not built. |
| Cash booking leakage mitigation (POS routing) | High | ⬜ | Strategy only, no feature. |
| Push notifications for confirmations & rebook loop | High | ✅ | **Web Push working** (VAPID/service worker, `api/features/push`) — covers Android + iOS 16.4+ as a PWA. SSE handles real-time in-app updates. No Firebase/APNs needed (PWA, not native). |
| In-app owner↔player messaging / inquiry | Medium | ⬜ | Game/club/tournament chat exist; no owner-to-player venue inquiry. |

### Process (non-code)
| Requirement | Status |
|---|---|
| Master requirements sheet | 🟡 In progress (this file) |
| Feature-priority matrix | ⬜ |
| Research first target venues | ⬜ |
| Schedule recurring demo reviews | ⬜ |

---

## 1. ✅ Done (existing functionality)

- ✅ **Owner dashboard** — revenue, today's + upcoming bookings, occupancy KPIs → `OwnerHomeScreen.tsx`, `tabs/VenueOverviewTab.tsx`
- ✅ **Analytics / insights** — revenue + booking trends, utilization & peak hours, per-venue compare → `OwnerInsightsScreen.tsx`, `tabs/InsightsTab.tsx`, `tabs/VenueOverviewTab.tsx`
- ✅ **Multiple venues per owner** → `OwnerVenuesScreen.tsx`
- ✅ **Multiple courts per venue** → `tabs/CourtsEditorTab.tsx`
- ✅ **Court details — name, surface, thumbnail, description, multi-photo gallery** *(2026-06-25: editor reorganised into 3 tabs — Court Info / Gallery / Hours; gallery is a square grid with tap-to-preview lightbox)* → `tabs/CourtsEditorTab.tsx`
- ✅ **Per-court operating hours + per-block hours-pricing windows** *(configurable; pricing windows are stored but not yet charged — see audit)* → `components/WeeklyHoursEditor.tsx`
- ✅ **Holiday / full-day closures** → `tabs/ClosuresEditorTab.tsx` (renamed from `HoursEditorTab`)
- ✅ **Court-level base pricing** — each court's own `hourlyRate`, used by Book flow, fallback to venue rate → `tabs/CourtsEditorTab.tsx`, `BookCourtScreen.tsx`, api `Court.hourlyRate`
- ✅ **Manual vs automatic booking approval (per venue)** + pay window → `tabs/ListingEditorTab.tsx` (Booking policy)
- ✅ **Bookings inbox** — approve / decline / cancel, request-to-book → `tabs/BookingsInboxTab.tsx`, `OwnerBookingDetailSheet.tsx`
- ✅ **Double-booking collision handling** → api `bookings.controller` clash detection
- ✅ **Auto-generated booking link (+ optional custom slug, live availability check, Copy/Share)** → `components/BookingLinkShare.tsx`, `tabs/{ListingEditorTab,VenueOverviewTab}.tsx`, api `Venue.bookingSlug` + `GET /venues/:id/booking-slug-available`
- ✅ **Separate venue website field vs booking link** → `tabs/ListingEditorTab.tsx`
- ✅ **Amenities / facilities editing** (parking, showers, aircon, lighting, lockers, indoor/outdoor) → `tabs/ListingEditorTab.tsx`
- ✅ **Address autocomplete (true type-ahead) on venue create** → `components/AddressAutocomplete.tsx`, `OwnerNewVenueScreen.tsx`
- ✅ **Map pin** via address search + reverse-geocode city autofill → `tabs/LocationEditorTab.tsx`, `components/MapPinPicker.tsx`
- ✅ **Venue claim flow** — search unclaimed listing → submit proof → admin approve → `state:'claimed'` + owner link → `ClaimVenueScreen.tsx`, api `POST /claims` (gated by `owner.venues.claim`) + `GET /venues?state=unclaimed`
- ✅ **Web Push notifications** (VAPID / service worker) → `app/shared/lib/push.ts`, api `features/push/`

---

## 2. ⬜ Remaining — Must-have for owner demo

- ⬜ **Manual booking / slot blocking** *(#1 meeting priority)* — owner enters an off-platform booking (phone / Messenger / IG / walk-in) **or** blocks a single time slot. Today: full-day closures only, no slot-level entry, no owner-create-booking endpoint. Needs new API endpoint (`POST /venues/:id/bookings` owner-gated) + Calendar UI with slot-level block + front-desk quick-book form. See gap #7 below for full spec.
- ✅ **Functional pricing rules (not display-only)** — **DONE** (2026-06-25): VenueHour time-block prices now resolved in BookCourtScreen rate calculation. If the selected start time falls in a priced block, that rate applies; otherwise falls back to court/venue rate.
- ✅ **Time-based pricing applied** — **DONE** (2026-06-25): `getHours` fetch + block-rate lookup in BookCourtScreen; "Time-block rate" sub-label shown when active.
- ⬜ **Deposit vs full vs pay-at-venue** — decide + build the first-demo payment flow (only full-pay exists).
- ⬜ **7% player service fee display** — single fee shown to player (PayMongo buried inside).
- ✅ **VAT / tax-inclusive display convention** — **DONE** (2026-06-25): `pricingTaxLabel` on Venue (default "VAT inclusive"), owner-editable, shown on public page + checkout.
- ⬜ **Operator/staff dashboard view** — today's schedule / pending / manual entries / cancellations (needs staff wiring fix + manual booking API + dedicated front-desk screen).
- 🟡 **Staff wiring fix** — switch `useOwnerDashboard` from `listOwnerVenues` to `listManagedVenues` so staff can actually see their venues; consume `viewerStaffRole` to gate tabs (hide structural-edit tabs for non-owners; show role badge per venue). **One-line change in useOwnerDashboard + a role check in OwnerVenueScreen.**

## 3. ⬜ High priority (post-demo near-term)

- ⬜ **Day-based pricing** (weekday / weekend / holiday).
- ⬜ **Member pricing** — needs a membership concept in the owner slice.
- ⬜ **Manual surge adjustment** — owner raises/lowers a specific slot's rate.
- ⬜ **Per-player surcharge** — base rate + ₱/extra player (Pickleball-Junction style).
- ⬜ **Recurring bookings** (weekly regulars, leagues).
- ✅ **Owner-configurable cancellation / refund policy** — **DONE** (2026-06-25): `cancellationWindowHours`/`refundPercent`/`noShowFee` on Venue, editable in ListingEditorTab, shown on CourtDetails + BookCourtScreen.
- 🟡 **Multi-user / staff accounts with role-based permissions** — **PARTIAL** (2026-06-25): `StaffEditorTab` built — search-by-name, role picker (manager/front_desk), add/remove working. **BUT: `listManagedVenues` never called in the app — only `listOwnerVenues` is used, so staff see zero venues.** `viewerStaffRole` returned by API but never consumed — no role-tailored views. See gap analysis for full spec.
- ✅ **Owner-editable address in the editor** — **DONE** (2026-06-25): `LocationEditorTab` has full structured address fields (line1/line2/city/region/postcode) + map pin + type-ahead search.
- ✅ **Active completion prompts** — **DONE** (2026-06-25): `CompletenessMeter` now receives `onJump` from VenueOverviewTab, so every incomplete item is a tappable nudge to its editor tab.
- 🟡 **Owner identity verification** — **PARTIAL** (2026-06-25): claim form collects legal name, role/title, verification contact + proof links. **Missing: file upload for scanned IDs/permits (links only), admin review UI (API-only), "needs more info" claim state.**
- ⬜ **Demand data capture** (searches/views/attempts/cancellations/empty slots) — foundation for future dynamic pricing.

## 4. ⬜ Strategic / medium

- ✅ **Multi-sport support** — `Court.sport` field + sport picker in CourtsEditorTab (Pickleball/Tennis/Badminton/Padel/Basketball/Volleyball); surfaced on court cards + public venue per-court breakdown.
- ✅ **Per-court approval mode** — a court can override the venue policy (`Court.approvalMode` `inherit`/`auto`/`manual`), edited in the Courts tab and resolved by `createBooking`.
- ⬜ **Booking modification** (reschedule, change court).
- ⬜ **Overbooking / waitlist** for full slots.
- ✅ **Buffer / turnover time** between bookings — optional per-court `Court.turnoverMinutes` gap, enforced by the booking guard + reflected in the time picker.
- ✅ **Half-court / split-court** — `Court.isSplittable` + `splitCount` (2-4) in model + CourtsEditorTab UI (sub-court booking enforcement not yet in booking flow, but model + config ready).
- ⬜ **Open-play / per-session** booking as a price mode (confirm Phase-1 vs Phase-2 with Emmanuel).
- ⬜ **Equipment / paddle rental** add-on line items at checkout.
- ✅ **Platform-curated highlights** — `computeVenueHighlights()` in API generates `bestFor` + `whatPlayersLike` from amenities/ratings/bookings/editorial; ListingEditorTab + CourtDetailsScreen render them as read-only curated chips.
- ⬜ **Payout schedule & reconciliation** to venue (split-payment / settlement).
- ⬜ **BIR-compliant / official receipts.**
- ⬜ **In-app owner↔player messaging / inquiry** (replace Messenger/IG coordination).
- ✅ **Push notifications** — **Web Push (VAPID) done** — covers Android + iOS 16.4+ for a PWA via service worker. SSE handles in-app real-time. No Firebase/APNs needed (not a native app).
- 🟡 **Owner identity verification** — **PARTIAL** (2026-06-25): claim form collects legal name, role/title, verification contact + proof links. **Missing: file upload for scanned IDs/permits, admin review UI, "needs more info" claim state.**

## 4b. 🔴 Critical wiring gaps (found in 2026-06-25 deep-dive)

These are features where the backend is built but the app doesn't wire to it — the code exists but is invisible to users.

### Gap 6: Staff can't see their venues (`listManagedVenues` unused)

**Severity: 🔴 Blocker for multi-user demo.** An owner adds staff via StaffEditorTab, the API returns `viewerStaffRole` and supports `managedByUserId` — but the app never uses any of it.

| What | File | Status |
|---|---|---|
| `listManagedVenues(userId)` client function | `app/src/shared/lib/api.ts:829` | ✅ Exists, never called |
| `listVenues({ managedByUserId })` API param | `api/src/features/venues/venues.controller.ts:347` | ✅ Backend ready |
| `viewerStaffRole` on venue responses | `api/src/features/venues/venues.controller.ts:419-420` | ✅ Returned, never read |
| `useOwnerDashboard` calls `listOwnerVenues` | `app/src/features/owner/hooks/useOwnerDashboard.ts:54` | ❌ Should call `listManagedVenues` |
| `OwnerVenueScreen` gates tabs by `viewerStaffRole` | `app/src/features/owner/OwnerVenueScreen.tsx` | ❌ No role check — all tabs shown to everyone |
| Front-desk specific view ("today's schedule, check-ins, manual entries") | — | ❌ Doesn't exist |

**Fix plan (app-only, no API change):**
1. `useOwnerDashboard` → call `listManagedVenues(user.id)` instead of `listOwnerVenues(user.id)`
2. `OwnerVenueScreen` → read `venue.viewerStaffRole`, hide structural-edit tabs (Listing/Location/Courts/Closures/FAQs/Photos/Staff) for non-owners
3. `OwnerVenuesScreen` → show a role badge per venue card (`viewerStaffRole`)
4. (Future) Front-desk sees a focused "Today" dashboard instead of the full console

### Gap 7: Manual booking / slot blocking — zero implementation

**Severity: 🔴 #1 meeting priority, not started.** The only booking path is player-initiated `POST /api/v1/bookings`. No owner-side create, no slot block, no walk-in entry.

| Need | Details |
|---|---|
| Owner-create-booking endpoint | `POST /api/v1/venues/:id/bookings` — gated by `owner.bookings.manage` or staff via `requireVenueManager` |
| `Booking.bookingType` | Add `'manual'` (staff-entered) and `'blocked'` (slot unavailable) variants |
| Slot-block UI | Calendar/day view in the owner console — tap a court+time, "Block slot" action |
| Front-desk quick-book | Streamlined form: pick court → time → player name/phone → confirm (no payment) |

### Gap 8: Claim identity verification — missing admin UI + file upload

**Severity: 🟡 Partial.** Claim form collects identity text fields but:
- `proofDocumentUrls` are free-text URL strings (one per line), not actual file uploads — no way to upload a scanned business permit or government ID
- No admin review UI in app or web (only API `PATCH /claims/:id`)
- No intermediate claim states (only pending→approved/rejected, no "needs more info")
- No notification to claimant on status change

## 5. ⏸️ Roadmap (later, per meeting)

- ⏸️ **Demand analytics** — busiest/underused hours, **revenue by court**, price opportunities.
- ⏸️ **Suggested dynamic pricing** (platform recommends, owner in control).
- ⏸️ **Automated dynamic pricing** (opt-in).

---

## Demo-readiness checklist (meeting §9)

- ✅ Owner login → venue performance + today's / upcoming bookings + revenue
- ✅ Create / edit venue with map location
- ✅ Address autocomplete (true type-ahead) on venue create
- ✅ Add multiple courts under a venue
- ✅ Configure court availability + operating hours (per court)
- ✅ Court details — name, surface, description, thumbnail, photo gallery with preview
- ✅ Set basic + peak pricing rules **that actually apply** *(time-block rates now resolved in checkout)*
- ⬜ Manually block a time slot (phone / Messenger / Instagram / walk-in) — **#1 priority, zero implementation**
- ✅ Choose manual or automatic approval for bookings (per venue + per court override)
- ✅ System auto-generates a venue / court booking link (+ custom slug w/ live check)
- ✅ Booking link shareable / embeddable separate from venue website
- ⬜ Single player service fee (7%) + VAT-inclusive display at checkout
- ⬜ Explain future features (demand insights, dynamic pricing) without faking them
- 🟡 Staff/role-based views — backend + UI done, but `listManagedVenues` not wired (staff see zero venues)
- 🟡 Claim identity verification — form done, missing file upload + admin review UI

---

## 🎨 UI / UX polish — owner / court screens

- ✅ **Court editor → 3 tabs** (Court Info / Gallery / Hours), persistent Save/Delete footer, lazy-mounted Hours → `tabs/CourtsEditorTab.tsx` *(2026-06-25)*
- ✅ **Gallery** — square 4-col (mobile) / 6-col (tablet) grid, tap-to-preview full-screen lightbox, un-clipped remove badge, empty-state drop-zone *(2026-06-25)*
- ✅ **Hours pricing** — "Add hour pricing" anchored at the bottom of the card; ✕ pinned inline on each window's row (no longer wraps) → `components/WeeklyHoursEditor.tsx` *(2026-06-25)*
- ✅ **Court thumbnail** — fixed square, visible border, 8px radius *(2026-06-25)*
- ✅ **Visible-border pill tabs** on the venue screen → `OwnerVenueScreen.tsx` + `.chip-tab` in `index.css`
- ✅ **Insights drill-downs → cards** on Overview → `tabs/VenueOverviewTab.tsx`
- ✅ **Clearer card borders app-wide** (`.card` `0.5px hairline` → `1px var(--field-border)`) → `index.css`
- ✅ **Back-navigation fix** — non-Overview tab back exits the venue screen directly → `OwnerVenueScreen.tsx`
- ✅ **Editor active tab survives reload** (derived from `?tab=` URL) → `OwnerVenueScreen.tsx`
- ✅ **Strict 576px frame cap** → `index.css` (`--frame-max`)

---

## 🏟️ Venue-only focus — remaining gaps (filtered from full audit)

Items below are scoped strictly to **venue model, court model, venue setup, and venue content**. Pricing, payments, staff/access, analytics, and booking-operations items are excluded — those live in the main audit above.

### ⬜ Not started

| # | Task | Priority | Details |
|---|---|---|---|
| V1 | **Half-court / split-court booking enforcement** | Medium | Model + config UI done (`Court.isSplittable`, `splitCount` 2-4, editor toggle). But `createBooking` in the API does not check split-court sub-units — can't book "Court A, half 1" vs "Court A, half 2." Sub-court units exist only as data; booking flow treats the court as one unit. |
| V2 | **Equipment rental as checkout line item** | Medium | `Venue.equipmentRentalPrice` exists in model + editable in `ListingEditorTab`, but is dead data — never appears in checkout or player-facing UI. Needs a line-item adder in BookCourtScreen review step. |
| V3 | **Open-play / per-session booking mode** | High | `Venue.openPlayPrice` exists in model + editable in `ListingEditorTab`, but unused — no "open play" booking path. Confirm with Emmanuel if Phase 1 or Phase 2. |
| V4 | **Sub-court pricing** | Medium | When a court is splittable, each sub-unit currently inherits the court `hourlyRate`. No per-sub-unit price config. Blocked by V1 (sub-court enforcement). |

### 🟡 Partial

| # | Task | Done | Missing |
|---|---|---|---|
| V5 | **Owner identity verification on claim** | Claim form collects legal name, role/title, contact, proof links (`ClaimVenueScreen.tsx` + `POST /claims`) | No file upload for scanned IDs/permits (free-text URL strings only, one per line). No admin review UI in app or web (API-only `PATCH /claims/:id`). No "needs more info" state between `pending` → `approved`/`rejected`. No notification to claimant on status change. |
| V6 | **Venue claim lifecycle depth** | Basic `state: 'unclaimed'` → claim → `'claimed'` works | No "needs more info" intermediate state. `Venue.state` only tracks `unclaimed` (default); no `claimed`/`verified`/`suspended` lifecycle. Claim review is API-only — no admin-facing screen. |

### ✅ Already done (venue-only)

| # | Item |
|---|---|
| ✅ | Multiple venues per owner |
| ✅ | Multiple courts per venue |
| ✅ | Court details: name, surface, thumbnail, description, multi-photo gallery + lightbox |
| ✅ | Per-court operating hours + pricing windows |
| ✅ | Holiday / full-day closures |
| ✅ | Address autocomplete (create + editor) with map pin + structured fields |
| ✅ | Amenities / facilities editing |
| ✅ | Profile completion prompts (deep-linked nudges) |
| ✅ | Venue claim flow (basic) |
| ✅ | Multi-sport: `Court.sport` field + picker + per-court breakdown |
| ✅ | Per-court approval mode override (`inherit`/`auto`/`manual`) |
| ✅ | Buffer / turnover time per court |
| ✅ | Platform-curated highlights (`bestFor` + `whatPlayersLike` from `computeVenueHighlights()`) |
| ✅ | Separate website vs booking link fields |
| ✅ | Auto-generated booking link + custom slug + Copy/Share |
| ✅ | Court editor 3-tab reorg (Court Info / Gallery / Hours) |

### 🎯 Venue demo-readiness gaps only

| # | Gap | Impact |
|---|---|---|
| V1 | Split-court booking not enforced | Can't demo "book half-court" — model says it exists but booking doesn't honor it |
| V5 | Claim identity verification incomplete | Can't demo a trustworthy claim review; ID docs are text URLs, no admin UI |
| V3 | Open-play mode unused | `openPlayPrice` field visible in editor but does nothing — may confuse demo |

**Bottom line:** Venue setup is ~90% complete. The remaining venue-specific gaps are: split-court enforcement (V1), equipment rental wiring (V2), open-play booking mode (V3), and claim identity verification depth (V5+V6). Everything else in the full audit (manual booking, staff wiring, pricing tiers, payments, analytics) falls outside the "venue model" scope.
