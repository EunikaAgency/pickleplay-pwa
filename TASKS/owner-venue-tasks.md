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
| Deposit vs full vs pay-at-venue at checkout | Must | ✅ | **DONE (2026-06-26).** Owner enables any of full/deposit/pay-at-venue + a deposit % in `ListingEditorTab` (`Venue.paymentOptions`/`depositPercent`); `BookCourtScreen` shows a payment-option selector on instant-book venues — full charges the total, deposit charges `depositPercent%` now + shows balance due at venue, pay-at-venue reserves with no online charge (skips checkout). Persisted on the booking (`paymentOption`/`amountPaid`/`balanceDue`). |
| 7% player service fee display | Must | ✅ | **DONE (2026-06-26).** Single platform fee in `AppSettings.serviceFeePercent` (default 7, admin-editable), surfaced via `GET /settings`; shown as its own line in `BookCourtScreen` review/checkout + `MyBookings`/owner detail (Subtotal + Service fee + Total). Stored as `Booking.serviceFeeAmount`; the venue's `amount` stays its own price so revenue analytics are unchanged. |
| Open-play / per-session pricing | High | ✅ | **Phase 1 DONE (2026-06-26).** `venue.openPlayPrice` is now a real booking mode: a "Join open play" CTA on the court page → `OpenPlayBookScreen` (date + time + party size) → `createBooking({ bookingType:'open_play' })` (courtless, instant-confirm, priced `openPlayPrice × players`) → checkout → shows in My Bookings tagged "Open play". *(Phase 2 — scheduled open-play sessions w/ capacity — remains for later; organizer open-play sessions are still separate.)* |
| Equipment / paddle rental add-ons | Medium | ✅ | **DONE (2026-06-26).** Owner sets `venue.equipmentRentalPrice`; `BookCourtScreen` shows a rental toggle that adds it to the total and persists `hasEquipmentRental`/`equipmentRentalAmount` on the booking; shown as a line item on the booking detail. |
| Half-court / split-court pricing | Medium | ✅ | `Court.isSplittable` + `splitCount` (2-4 units) + per-unit `subUnitRates` in model + CourtsEditorTab UI. **Sub-court booking now enforced (2026-06-26)** — `BookCourtScreen` has a sub-unit picker + per-unit rate lookup; `createBooking` validates `subUnitIndex` and clash/capacity handle sub-unit vs whole-court. |
| Suggested dynamic pricing | Roadmap | ⏸️ | Deferred. |
| Automated dynamic pricing (opt-in) | Later | ⏸️ | Deferred. |

### Booking
| Requirement | Priority | Status | Reality in code |
|---|---|---|---|
| Auto-generated booking link (+ custom slug) | Must | ✅ | `…/venues/<slug>` + optional `bookingSlug`, live availability check, Copy/Share. |
| Manual vs automatic approval, per venue | High | ✅ | **Per-venue** (`requireBookingApproval` in `ListingEditorTab`) **+ per-court override** (`Court.approvalMode` `inherit`/`auto`/`manual` in `CourtsEditorTab`; `createBooking` resolves court-over-venue). |
| Double-booking collision handling | Must | ✅ | Clash detection in `bookings.controller` (court + venue-pool). |
| Manual booking / slot blocking (phone/Messenger/IG/walk-in) | Must | ✅ | **DONE (2026-06-26) — the #1 meeting priority.** (a) Owner `POST /api/v1/venues/:id/bookings` (gated by `requireVenueManager` — owner OR active staff incl. front-desk) with `bookingType:'manual'` (off-platform customer name/phone + source phone/messenger/instagram/walk_in) or `'blocked'` (slot unavailable + reason); reuses `findSlotConflict` so it's double-booking-guarded; no payment. (b)+(c) New `OwnerFrontDeskScreen` (`owner-front-desk`) front-desk console with an "Add booking" quick-book form (court→date→time→customer→pay method→amount) and a "Block slot" form. Manual/blocked bookings show on the schedule + owner inbox tagged MANUAL/BLOCKED and are excluded from players' "My bookings". |
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
| Operator/staff view (today's schedule, pending, manual entries, cancellations) | High | ✅ | **DONE (2026-06-26).** New `OwnerFrontDeskScreen` (`owner-front-desk`) = the operator console: today's schedule (time-sorted, with a date stepper), pending-approval list (inline approve/decline), KPIs (bookings today / awaiting approval / manual today), a venue picker for multi-venue owners, and the manual-booking + slot-block actions. Gated by `owner.bookings.manage` (so active staff can run it). |
| Role-based dashboard users (owner / manager / front-desk) | High | 🟡 | **Mostly done (2026-06-26):** `VenueStaff` model + `:id/staff` routes + StaffEditorTab + `OwnerStaffScreen` (create/manage staff logins); **staff now see the owner's venues** — `useOwnerDashboard` calls `listManagedVenues` via `effectiveOwnerId`. **Residual:** `viewerStaffRole` not yet consumed for role-tailored views (front-desk sees full console; structural edits blocked server-side). |
| Multi-user/staff accounts with permissions | High | 🟡 | **Mostly done (2026-06-26):** staff accounts (create/manage via `OwnerStaffScreen`) + scoping (`parentOwnerUserId`/`effectiveOwnerId`); **staff see the owner's venues** (`listManagedVenues` wired). **Residual:** `viewerStaffRole` not consumed for role-tailored view separation (front_desk sees full console; 403s on structural edits server-side). |
| Owner identity verification / anti-fraud on claim | Medium | ✅ | **DONE (2026-06-26).** Claim form collects legal name/role/contact/proof links **+ ID document upload** (`uploadClaimMedia`); **`needs_info` state + resubmit flow** + claimant notifications; **admin review UI on both surfaces** — web `ClaimsQueuePage` (existing) + app `AdminClaimsScreen` (new). |

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

- ✅ **Manual booking / slot blocking** *(#1 meeting priority)* — **DONE (2026-06-26).** `POST /api/v1/venues/:id/bookings` (owner/staff-gated, `bookingType:'manual'|'blocked'`, double-booking-guarded via `findSlotConflict`, no payment) + the new `OwnerFrontDeskScreen` "Add booking" / "Block slot" forms. See gap #7 below (now resolved).
- ✅ **Functional pricing rules (not display-only)** — **DONE** (2026-06-25): VenueHour time-block prices now resolved in BookCourtScreen rate calculation. If the selected start time falls in a priced block, that rate applies; otherwise falls back to court/venue rate.
- ✅ **Time-based pricing applied** — **DONE** (2026-06-25): `getHours` fetch + block-rate lookup in BookCourtScreen; "Time-block rate" sub-label shown when active.
- ✅ **Deposit vs full vs pay-at-venue** — **DONE (2026-06-26):** owner-configurable options + deposit % in `ListingEditorTab`; player picks at checkout (`BookCourtScreen`). Persisted on the booking.
- ✅ **7% player service fee display** — **DONE (2026-06-26):** single platform fee (`AppSettings.serviceFeePercent`, default 7) shown as its own line in checkout + booking detail.
- ✅ **VAT / tax-inclusive display convention** — **DONE** (2026-06-25): `pricingTaxLabel` on Venue (default "VAT inclusive"), owner-editable, shown on public page + checkout.
- ✅ **Operator/staff dashboard view** — **DONE (2026-06-26):** `OwnerFrontDeskScreen` (`owner-front-desk`) — today's schedule + pending approvals + manual-entry count + venue picker + Add-booking/Block-slot. Reached from the OwnerHome "Front desk" quick action; gated by `owner.bookings.manage`.
- 🟡 **Staff wiring** — **DONE (2026-06-26):** `useOwnerDashboard` now calls `listManagedVenues` (via `effectiveOwnerId`), so staff see the owner's venues. **Residual:** consume `viewerStaffRole` to gate tabs (hide structural-edit tabs for front-desk; show role badge per venue) — not yet wired.

## 3. ⬜ High priority (post-demo near-term)

- ⬜ **Day-based pricing** (weekday / weekend / holiday).
- ⬜ **Member pricing** — needs a membership concept in the owner slice.
- ⬜ **Manual surge adjustment** — owner raises/lowers a specific slot's rate.
- ⬜ **Per-player surcharge** — base rate + ₱/extra player (Pickleball-Junction style).
- ⬜ **Recurring bookings** (weekly regulars, leagues).
- ✅ **Owner-configurable cancellation / refund policy** — **DONE** (2026-06-25): `cancellationWindowHours`/`refundPercent`/`noShowFee` on Venue, editable in ListingEditorTab, shown on CourtDetails + BookCourtScreen.
- 🟡 **Multi-user / staff accounts with role-based permissions** — **MOSTLY DONE** (2026-06-26): staff accounts (create/manage via `OwnerStaffScreen`) + `StaffEditorTab` + account scoping; **staff now see the owner's venues** (`listManagedVenues` wired via `effectiveOwnerId`). **Residual:** `viewerStaffRole` not consumed for role-tailored views.
- ✅ **Owner-editable address in the editor** — **DONE** (2026-06-25): `LocationEditorTab` has full structured address fields (line1/line2/city/region/postcode) + map pin + type-ahead search.
- ✅ **Active completion prompts** — **DONE** (2026-06-25): `CompletenessMeter` now receives `onJump` from VenueOverviewTab, so every incomplete item is a tappable nudge to its editor tab.
- ✅ **Owner identity verification** — **DONE (2026-06-26)**: claim form collects legal name, role/title, verification contact + proof links, **file upload** for scanned IDs/permits (`uploadClaimMedia`), a **"needs more info" claim state + resubmit flow** (`/claims/mine`, `/claims/:id/resubmit`), and claimant status notifications. The **admin claim-review UI** now exists on both surfaces — web `ClaimsQueuePage` (existing) and the new app `AdminClaimsScreen` (`admin-claims`, gated by `admin.moderation.manage`: approve / reject / request-more-info → `PATCH /claims/:id`).
- ⬜ **Demand data capture** (searches/views/attempts/cancellations/empty slots) — foundation for future dynamic pricing.

## 4. ⬜ Strategic / medium

- ✅ **Multi-sport support** — `Court.sport` field + sport picker in CourtsEditorTab (Pickleball/Tennis/Badminton/Padel/Basketball/Volleyball); surfaced on court cards + public venue per-court breakdown.
- ✅ **Per-court approval mode** — a court can override the venue policy (`Court.approvalMode` `inherit`/`auto`/`manual`), edited in the Courts tab and resolved by `createBooking`.
- ⬜ **Booking modification** (reschedule, change court).
- ⬜ **Overbooking / waitlist** for full slots.
- ✅ **Buffer / turnover time** between bookings — optional per-court `Court.turnoverMinutes` gap, enforced by the booking guard + reflected in the time picker.
- ✅ **Half-court / split-court** — `Court.isSplittable` + `splitCount` (2-4) + per-unit `subUnitRates` in model + CourtsEditorTab UI; **sub-court booking now enforced (2026-06-26)** — `BookCourtScreen` sub-unit picker + rate; `createBooking` validates `subUnitIndex`, and clash/capacity handle sub-unit vs whole-court.
- ✅ **Open-play / per-session** booking as a price mode — **Phase 1 DONE (2026-06-26)**: courtless per-session drop-in booking (`bookingType:'open_play'`, priced from `openPlayPrice`), reachable from the court page, paid via the existing checkout. *(Phase 2 — scheduled sessions with capacity — deferred; needs Emmanuel's call.)*
- ✅ **Equipment / paddle rental** add-on line items at checkout — **DONE (2026-06-26)**: `BookCourtScreen` rental toggle adds `venue.equipmentRentalPrice` to the total; `hasEquipmentRental`/`equipmentRentalAmount` persisted + shown on the booking detail.
- ✅ **Platform-curated highlights** — `computeVenueHighlights()` in API generates `bestFor` + `whatPlayersLike` from amenities/ratings/bookings/editorial; ListingEditorTab + CourtDetailsScreen render them as read-only curated chips.
- ⬜ **Payout schedule & reconciliation** to venue (split-payment / settlement).
- ⬜ **BIR-compliant / official receipts.**
- ⬜ **In-app owner↔player messaging / inquiry** (replace Messenger/IG coordination).
- ✅ **Push notifications** — **Web Push (VAPID) done** — covers Android + iOS 16.4+ for a PWA via service worker. SSE handles in-app real-time. No Firebase/APNs needed (not a native app).
- ✅ **Owner identity verification** — **DONE (2026-06-26)**: claim form collects legal name, role/title, verification contact + proof links, **file upload** for scanned IDs/permits, a **"needs more info" claim state + resubmit flow**, and claimant status notifications. The **admin claim-review UI** now exists on both surfaces — web `ClaimsQueuePage` (existing) and the new app `AdminClaimsScreen`.

## 4b. 🔴 Critical wiring gaps (found in 2026-06-25 deep-dive)

These are features where the backend is built but the app doesn't wire to it — the code exists but is invisible to users.

### Gap 6: Staff venue visibility — ✅ RESOLVED (2026-06-26); role-tailored views still 🟡

**Severity: 🟡 Minor.** Staff accounts + scoping shipped (`OwnerStaffScreen`), and `useOwnerDashboard` now calls `listManagedVenues` (via `effectiveOwnerId`) so **staff see the owner's venues**. What remains is cosmetic role gating.

| What | File | Status |
|---|---|---|
| `listManagedVenues(userId)` client function | `app/src/shared/lib/api.ts` | ✅ Now called by `useOwnerDashboard` |
| `listVenues({ managedByUserId })` / `effectiveOwnerId` | `api/src/features/venues/venues.controller.ts` | ✅ Backend ready + used |
| `useOwnerDashboard` venue source | `app/src/features/owner/hooks/useOwnerDashboard.ts` | ✅ Uses `listManagedVenues` |
| `viewerStaffRole` consumed for role-tailored tab gating | `app/src/features/owner/OwnerVenueScreen.tsx` | ❌ Not yet — all tabs shown (structural edits 403 server-side) |
| Front-desk specific view ("today's schedule, check-ins, manual entries") | — | ❌ Doesn't exist (ties to manual-booking Gap 7) |

**Fix plan (app-only, no API change):**
1. `useOwnerDashboard` → call `listManagedVenues(user.id)` instead of `listOwnerVenues(user.id)`
2. `OwnerVenueScreen` → read `venue.viewerStaffRole`, hide structural-edit tabs (Listing/Location/Courts/Closures/FAQs/Photos/Staff) for non-owners
3. `OwnerVenuesScreen` → show a role badge per venue card (`viewerStaffRole`)
4. (Future) Front-desk sees a focused "Today" dashboard instead of the full console

### Gap 7: Manual booking / slot blocking — ✅ RESOLVED (2026-06-26)

**Severity: ✅ Done — the #1 meeting priority.** Owner/staff can now record off-platform bookings and block slots.

| Need | Status |
|---|---|
| Owner-create-booking endpoint | ✅ `POST /api/v1/venues/:id/bookings` — gated by `requireVenueManager` (owner OR active staff incl. front-desk) |
| `Booking.bookingType` | ✅ `'manual'` (off-platform customer name/phone + source) + `'blocked'` (slot unavailable + reason); plus `createdByUserId` |
| Slot-block UI | ✅ "Block slot" form in `OwnerFrontDeskScreen` (court + date + time + reason) |
| Front-desk quick-book | ✅ "Add booking" form (court → date → time → customer → pay method → amount, no online payment) |

Both flows reuse the player flow's `findSlotConflict` double-booking guard (exported, optional userId); manual/blocked rows are excluded from players' "My bookings" and tagged MANUAL/BLOCKED in the owner inbox + detail sheet.

### Gap 8: Claim identity verification — ✅ RESOLVED (2026-06-26)

**Severity: ✅ Done.** Both sides of the claim flow are now complete:
- ✅ **File upload** — `ClaimVenueScreen` uploads scanned permits/IDs via `uploadClaimMedia` (was free-text URLs only); links still supported alongside.
- ✅ **Intermediate `needs_info` state + resubmit** — reviewer can request more info; claimant sees it on the success screen and resubmits via `/claims/:id/resubmit` (`/claims/mine` for status).
- ✅ **Claimant notification on status change** — approve / reject / needs-info all notify the claimant.
- ✅ **Admin review UI** — web `ClaimsQueuePage` (existing) and the new app `AdminClaimsScreen` (`admin-claims`, gated by `admin.moderation.manage`) both list claims and approve / reject / request-more-info via `PATCH /claims/:id`. *(The earlier "no admin review UI in app or web" note was inaccurate — web already had `ClaimsQueuePage`; only the app was missing it.)*

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
- ✅ Manually block a time slot + record a phone / Messenger / Instagram / walk-in booking — **#1 priority, DONE 2026-06-26** (`OwnerFrontDeskScreen` + `POST /venues/:id/bookings`)
- ✅ Choose manual or automatic approval for bookings (per venue + per court override)
- ✅ System auto-generates a venue / court booking link (+ custom slug w/ live check)
- ✅ Booking link shareable / embeddable separate from venue website
- ✅ Single player service fee (7%) + VAT-inclusive display at checkout — **DONE 2026-06-26**
- ⬜ Explain future features (demand insights, dynamic pricing) without faking them
- 🟡 Staff/role-based views — staff accounts + venue visibility done (`listManagedVenues` wired); only `viewerStaffRole` role-tailored view gating remains
- ✅ Claim identity verification — claimant side (form + file upload + needs-info/resubmit + notifications) **and** admin review UI (web `ClaimsQueuePage` + new app `AdminClaimsScreen`) both done

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
| V3 | **Open-play / per-session booking mode** | High | **Phase 1 DONE (2026-06-26).** Real open-play booking path: "Join open play" CTA → `OpenPlayBookScreen` → courtless `bookingType:'open_play'` booking priced from `openPlayPrice`, instant-confirm, in My Bookings. *(Phase 2 — scheduled sessions + capacity — deferred pending Emmanuel.)* |

_V1 (split-court enforcement), V2 (equipment rental), V4 (sub-court pricing) — **DONE 2026-06-26**; moved to ✅ below._

### 🟡 Partial

| # | Task | Done | Missing |
|---|---|---|---|
| V6 | **Venue claim lifecycle depth** | ✅ effectively resolved *(2026-06-26)*: `unclaimed`→`claimed` + `needs_info` + admin review UI; **`verified` already exists** (`isVerified` → "Verified" chip) and **"suspended" already works** (public `listVenues`/`getVenue` exclude `listingStatus ∈ {pending,rejected}`). | Residual (deferred, not demo-required): suspending an *already-published* venue (`reviewVenueApproval` only acts on `pending`) + an in-app admin venues screen. Web already has `AdminVenuesPage`. |

_V5 (owner identity verification on claim) — **DONE 2026-06-26**; moved to ✅ below._

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
| ✅ | Split-court booking enforcement (V1) — `createBooking` validates `subUnitIndex`; clash + pool-capacity handle sub-unit vs whole-court; `BookCourtScreen` sub-unit picker *(2026-06-26)* |
| ✅ | Equipment rental checkout line item (V2) — `BookCourtScreen` toggle adds `equipmentRentalPrice` to the total; `hasEquipmentRental`/`equipmentRentalAmount` persisted + shown on booking detail *(2026-06-26)* |
| ✅ | Sub-court pricing (V4) — per-unit `Court.subUnitRates` config in CourtsEditorTab; resolved in `BookCourtScreen` *(2026-06-26)* |
| ✅ | Owner identity verification on claim (V5) — proof links + ID upload, `needs_info`/resubmit, claimant notifications, **admin review UI** (web `ClaimsQueuePage` + app `AdminClaimsScreen`) *(2026-06-26)* |

### 🎯 Venue demo-readiness gaps only

| # | Gap | Impact |
|---|---|---|
**Bottom line:** Venue setup is **~99% complete**. V1 (split-court enforcement), V2 (equipment rental), V4 (sub-court pricing), V5 (claim identity verification incl. admin review UI on web + app), and **V3 open-play (Phase 1)** are done; V6 lifecycle is effectively resolved (only a deferred, not-demo-required admin "suspend a published venue" tweak remains). No open venue-feature gap blocks the demo. Everything else in the full audit (manual booking, staff wiring, pricing tiers, payments, analytics) falls outside the "venue model" scope. *(Open follow-up beyond venue scope: open-play **Phase 2** — scheduled sessions + capacity — pending Emmanuel's call.)*
