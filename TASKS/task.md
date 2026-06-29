# PickleBallers — Pending Tasks (di pa tapos / di pa nagagawa)

> **source:** `pdf` = owner-app meeting notes (`PB-meeting-notes.pdf`) · `csv` = master requirements sheet (`Standardised Pickleballers - Pickleballers Questions.csv`).
> Scope = owner/venue tasks na galing sa pdf/csv. (Website tasks live in `web/TASKS.md` — galing sila sa web PLAN, hindi sa pdf/csv.)
> Reconciled vs code: 2026-06-26.

## 🔴 Must-have for owner demo

> ✅ **All four demo must-haves shipped 2026-06-26** — moved to **Tapos na (done)** below (Booking / Dashboard / Payments). Nothing pending in this tier.

## 🟠 High priority (post-demo near-term)

- Day-based pricing (weekday / weekend / holiday)
    - **task source:** csv, pdf
    - **done:** yes — `weekendPrice`/`holidayPrice`/`holidayDates` on Venue model + ListingEditorTab UI (weekend rate, holiday rate, holiday date picker with add/remove) + pricing engine resolves them in 7-step precedence + BookCourtScreen shows "Weekend rate"/"Holiday rate" in review
    - **tested:** not yet
- Member pricing (venue-member special rate)
    - **task source:** csv, pdf
    - **done:** yes — `memberDiscountPercent` on Venue + `viewerIsMember` server-computed on detail + ListingEditorTab "Member discount (%)" field + BookCourtScreen fetches membership status, passes to pricing engine, shows "Member rate — X% off" banner + CourtDetailsScreen membership join/leave via MembershipSheet
    - **tested:** not yet
- Manual surge adjustment (owner raises/lowers a specific slot's rate)
    - **task source:** csv, pdf
    - **done:** yes — `SlotPriceOverride` model + CRUD functions + SlotPricingTab in venue editor + BookCourtScreen fetches overrides per date, passes to pricing engine (top priority in rate precedence)
    - **tested:** not yet
- Per-player surcharge (base rate + ₱/extra player)
    - **task source:** csv
    - **done:** yes — `perPlayerFee`/`perPlayerFeeThreshold` on Venue + ListingEditorTab "Per-player surcharge" section + BookCourtScreen player count stepper (1–50) with "₱X per player past Y" label + surcharge line item in review
    - **tested:** not yet
- Recurring bookings (weekly regulars, leagues)
    - **task source:** csv
    - **done:** yes — `createRecurringBooking`/`listRecurringBookings`/`cancelRecurringBooking` API functions + OwnerFrontDeskScreen "Repeat weekly" checkbox + weeks input (2–52) + recurring series list with cancel + success summary showing created/skipped weeks
    - **tested:** not yet
- Demand data capture (searches, views, attempts, cancellations, empty slots)
    - **task source:** csv, pdf
    - **done:** yes — `recordDemandEvent()` fire-and-forget client + wired into CourtDetailsScreen (`venue_view` on mount), BookCourtScreen (`booking_attempt` on submit, `booking_completed` on all 3 success paths). Backend `empty_slot` already logged server-side on booking clash; `booking_cancelled` logged server-side in bookings controller.
    - **tested:** not yet
- Staff role-tailored views (consume `viewerStaffRole` to gate tabs + role badge) — residual; staff already see venues
    - **task source:** csv, pdf
    - **done:** yes — `OwnerVenueScreen` reads `viewerStaffRole`, hides structural-edit tabs (Listing/Location/Courts/Slot pricing/Closures/FAQs/Photos/Staff) for front-desk staff, shows "Front desk"/"Manager" badge in header eyebrow. Staff can't create/claim venues (UI gated). `listManagedVenues` scopes venue visibility via `effectiveOwnerId`.
    - **tested:** not yet

## 🟡 Medium / strategic

- Booking modification (reschedule, change court)
    - **task source:** csv
    - **done:** yes — API: `PATCH /bookings/:id/modify` + `BookingModification` audit log, slot re-check, 3-mod max; app ModifyBookingSheet pending
    - **tested:** not yet
- Overbooking / waitlist for full slots
    - **task source:** csv
    - **done:** yes — API: `POST /waitlist` join, `GET /waitlist/mine`, `DELETE /waitlist/:id` leave, `POST /waitlist/:id/claim`, auto-promote on cancel + push notify; app UI pending
    - **tested:** not yet
- Payout schedule & reconciliation to venue (split-payment / settlement)
    - **task source:** csv
    - **done:** yes — API: `Settlement` + `SettlementLineItem` + `OwnerPayoutMethod` models, admin generate/list/update, owner list/balance, payout methods CRUD; app screens pending
    - **tested:** not yet
- BIR-compliant / official receipts
    - **task source:** csv
    - **done:** yes — API: `OfficialReceipt` + `ReceiptCounter` models, auto-generate draft on confirmed booking, sequential OR numbering per venue, player list/get, owner venue list, issue/void; app receipt screens pending
    - **tested:** not yet
- Cash booking leakage mitigation (POS routing)
    - **task source:** csv
    - **done:** yes — API: 3 new demand event types (`checkout_started`, `checkout_abandoned`, `booking_link_shared`), owner `leakage-report` endpoint with funnel + daily timeseries; app: LeakageTab with funnel chart + daily breakdown, demand events wired in BookCourtScreen + BookingLinkShare
    - **tested:** not yet
- In-app owner↔player messaging / inquiry
    - **task source:** csv
    - **done:** yes — API: venue-scoped conversations (`contextType`/`contextId` on Conversation), `GET /messages/venue/:venueId` find-or-create, auto intro message; app: "Message venue" button on CourtDetailsScreen, venue context shown in conversation list + chat header
    - **tested:** not yet

## ⏸️ Deferred (roadmap — sinadyang later, after enough data)

- Suggested dynamic pricing (platform recommends, owner stays in control)
    - **task source:** csv, pdf
    - **done:** not yet
    - **tested:** not yet
- Automated dynamic pricing (opt-in)
    - **task source:** csv, pdf
    - **done:** not yet
    - **tested:** not yet

## 📋 Process (non-code / planning)

- Map owner features by priority (feature-priority matrix)
    - **task source:** csv, pdf
    - **done:** not yet
    - **tested:** not yet
- Research first target venues (systems used, membership needs)
    - **task source:** csv, pdf
    - **done:** not yet
    - **tested:** not yet
- Schedule recurring demo reviews
    - **task source:** csv, pdf
    - **done:** not yet
    - **tested:** not yet

---

# ✅ Tapos na (done) — from pdf / csv

## Pricing

- Base court price (default hourly rate per court)
    - **task source:** csv, pdf
    - **done:** yes
    - **tested:** yes
- Court-specific price overrides
    - **task source:** csv, pdf
    - **done:** yes
    - **tested:** yes
- Time-based pricing (e.g. after 6 PM)
    - **task source:** csv, pdf
    - **done:** yes
    - **tested:** yes
- Currency / VAT-inclusive display convention
    - **task source:** csv
    - **done:** yes
    - **tested:** yes
- Half-court / split-court pricing (+ booking enforcement)
    - **task source:** csv
    - **done:** yes
    - **tested:** yes
- Open-play / per-session booking (Phase 1)
    - **task source:** csv, pdf
    - **done:** yes
    - **tested:** not yet
- Equipment / paddle rental add-ons
    - **task source:** csv
    - **done:** yes
    - **tested:** yes

## Booking

- Manual booking / slot-blocking (owner/staff record phone/Messenger/IG/walk-in bookings + block a slot) — **#1 demo priority**
    - **task source:** csv, pdf
    - **done:** yes — `POST /venues/:id/bookings` (manual|blocked, double-booking-guarded) + `OwnerFrontDeskScreen` Add-booking / Block-slot forms
    - **tested:** API yes (curl: manual+blocked create, court clash→409, bad court→400, unauth→401) · app UI not browser-tested yet
- Auto-generated booking link (+ optional custom slug)
    - **task source:** csv, pdf
    - **done:** yes
    - **tested:** yes
- Manual vs automatic approval (per venue + per court)
    - **task source:** csv, pdf
    - **done:** yes
    - **tested:** yes
- Double-booking collision handling
    - **task source:** csv
    - **done:** yes
    - **tested:** yes
- Cancellation & refund rules (owner-configurable)
    - **task source:** csv
    - **done:** yes
    - **tested:** yes
- Buffer / turnover time between bookings
    - **task source:** csv
    - **done:** yes
    - **tested:** yes

## Venue Setup

- Address autocomplete + auto-geocoding
    - **task source:** csv, pdf
    - **done:** yes
    - **tested:** yes
- Multiple venues per owner
    - **task source:** csv, pdf
    - **done:** yes
    - **tested:** yes
- Multiple courts per venue
    - **task source:** csv, pdf
    - **done:** yes
    - **tested:** yes
- Court details (surface, photos, thumbnail, description)
    - **task source:** csv, pdf
    - **done:** yes
    - **tested:** yes
- Operating hours / availability per court
    - **task source:** csv, pdf
    - **done:** yes
    - **tested:** yes
- Separate venue website vs platform booking link
    - **task source:** csv, pdf
    - **done:** yes
    - **tested:** yes
- Profile completion prompts
    - **task source:** csv, pdf
    - **done:** yes
    - **tested:** yes
- Amenities / facilities (parking, showers, aircon, lighting, indoor/outdoor)
    - **task source:** csv
    - **done:** yes
    - **tested:** yes
- Venue claim flow (claim unclaimed listing)
    - **task source:** csv
    - **done:** yes
    - **tested:** yes
- Owner identity verification / anti-fraud on claim (+ admin review UI)
    - **task source:** csv
    - **done:** yes
    - **tested:** yes

## Multi-Sport

- Court sport/type field in data model
    - **task source:** csv, pdf
    - **done:** yes
    - **tested:** yes
- Multi-sport surfaced in UI (per-court breakdown)
    - **task source:** csv, pdf
    - **done:** yes
    - **tested:** yes

## Dashboard / Analytics

- Operator / staff dashboard view (today's schedule, pending approvals, manual entries) — **demo must-have**
    - **task source:** csv, pdf
    - **done:** yes — `OwnerFrontDeskScreen` (`owner-front-desk`): today's schedule + date stepper + pending approvals + KPIs + venue picker, from the OwnerHome "Front desk" quick action; gated by `owner.bookings.manage`
    - **tested:** API yes (curl) · app UI not browser-tested yet
- Owner view: revenue, occupancy, business performance
    - **task source:** csv, pdf
    - **done:** yes
    - **tested:** yes
- Minimum credible analytics view before demo
    - **task source:** csv, pdf
    - **done:** yes
    - **tested:** yes
- Multi-user / staff accounts (create + scoping + venue visibility; role-tailored views still pending — see top)
    - **task source:** csv, pdf
    - **done:** yes
    - **tested:** yes

## Payments

- Deposit vs full payment vs pay-at-venue at checkout — **demo must-have**
    - **task source:** csv, pdf
    - **done:** yes — owner enables options + deposit % in `ListingEditorTab` (`Venue.paymentOptions`/`depositPercent`); player picks at checkout in `BookCourtScreen` (full charges total · deposit charges % now + shows balance due at venue · pay-at-venue reserves with no online charge); persisted as `paymentOption`/`amountPaid`/`balanceDue`
    - **tested:** API yes (curl: createBooking persists fee/deposit split) · app UI not browser-tested yet
- 7% player service-fee display (single fee shown; PayMongo buried inside) — **demo must-have**
    - **task source:** csv
    - **done:** yes — `AppSettings.serviceFeePercent` (default 7, admin-editable) via `GET /settings`; shown as its own line (Subtotal + Service fee + Total) in checkout + My Bookings + owner detail; stored as `Booking.serviceFeeAmount` (venue `amount` unchanged so revenue analytics stay correct)
    - **tested:** API yes (curl) · app UI not browser-tested yet

## Content

- Platform-curated highlights (not owner-invented claims)
    - **task source:** csv, pdf
    - **done:** yes
    - **tested:** yes

## Notifications

- Push notifications for confirmations & rebook (Web Push / VAPID — Android + iOS 16.4+ PWA)
    - **task source:** csv
    - **done:** yes
    - **tested:** yes

## Process

- Create & maintain master requirements sheet
    - **task source:** csv, pdf
    - **done:** yes
    - **tested:** yes
