# Owner / Venue Tasks — from PB Owner App Meeting + Master Requirements Sheet

Source: [PB-meeting-notes.pdf](./PB-meeting-notes.pdf) + master requirements sheet (2026-06-25)
Last scanned against code: **2026-06-25** (updated same day — multi-sport, address, half-court, highlights, staff UI, identity verification, completion prompts all verified)

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
| Time-based pricing (e.g. after 6 PM) | Must | 🟡 | **Configurable but not charged.** Owner can set per-block "Hours pricing" windows (`VenueHour.price` via `WeeklyHoursEditor`) + venue `peakPrice`/`offPeakPrice` exist, but checkout ignores them (flat `rate × hours`). |
| Day-based pricing (weekday/weekend/holiday) | High | ⬜ | No day-tier pricing; not applied. |
| Member pricing (venue-member rate) | High | ⬜ | No membership concept in the owner slice. |
| Manual surge adjustment (owner raises/lowers a slot) | High | ⬜ | Not built. |
| Currency / VAT / tax-inclusive display | High | 🟡 | Currency shown (₱ via `money()`); **no VAT/tax field or calc**, no inclusive/exclusive convention. |
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
| Manual booking / slot blocking (phone/Messenger/IG/walk-in) | Must | ⬜ | **#1 meeting priority.** Only full-day closures exist; no slot-level or staff-entered booking. |
| Cancellation & refund rules (window, fees, no-show) | High | 🟡 | Player cancel + refund-request exists (`cancelBooking`, `BookingRefundScreen`); **owner-configurable policy not built**. |
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
| Operator/staff view (today's schedule, pending, manual entries, cancellations) | High | ⬜ | No operator-role view; depends on manual-booking + staff UI. |
| Role-based dashboard users (owner / manager / front-desk) | High | ✅ | `VenueStaff` model + `:id/staff` routes existed; **Staff tab UI built** (2026-06-25) — `StaffEditorTab` with search-by-name, role picker (manager/front_desk), add/remove. |
| Multi-user/staff accounts with permissions | High | ✅ | Same as above — backend scaffold + full owner UI. |
| Owner identity verification / anti-fraud on claim | Medium | ✅ | Claim form now collects legal name, role/title, and verification contact in addition to proof description + links. Admin review still gates approval. |

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
| Push notifications for confirmations & rebook loop | High | 🟡 | **Web Push implemented** (VAPID/service worker, `api/features/push`); **native APNs/FCM (Capacitor) not**. |
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

- ⬜ **Manual booking / slot blocking** *(#1 meeting priority)* — owner enters an off-platform booking (phone / Messenger / IG / walk-in) **or** blocks a single time slot. Today: full-day closures only, no slot-level entry, no owner-create-booking endpoint.
- 🟡 **Functional pricing rules (not display-only)** — actually **apply** Peak / Off-peak / hours-pricing windows to the booking cost. Today: configurable in the editor, but checkout charges flat `priceFrom × hours`.
- ⬜ **Time-based pricing applied** (e.g. different after 6 PM) — windows exist; wire them into the cost calc.
- ⬜ **Deposit vs full vs pay-at-venue** — decide + build the first-demo payment flow (only full-pay exists).
- ⬜ **7% player service fee display** — single fee shown to player (PayMongo buried inside).
- ⬜ **VAT / tax-inclusive display convention** — confirm + show.
- ⬜ **Operator/staff dashboard view** — today's schedule / pending / manual entries / cancellations (needs staff UI + manual booking).

## 3. ⬜ High priority (post-demo near-term)

- ⬜ **Day-based pricing** (weekday / weekend / holiday).
- ⬜ **Member pricing** — needs a membership concept in the owner slice.
- ⬜ **Manual surge adjustment** — owner raises/lowers a specific slot's rate.
- ⬜ **Per-player surcharge** — base rate + ₱/extra player (Pickleball-Junction style).
- ⬜ **Recurring bookings** (weekly regulars, leagues).
- 🟡 **Owner-configurable cancellation / refund policy** (window, fees, no-show) — cancel+refund-request exists; policy config does not.
- 🟡 **Multi-user / staff accounts with role-based permissions** — **DONE** (2026-06-25): `StaffEditorTab` built — search-by-name, role picker (manager/front_desk), add/remove, permission-gated behind `owner.staff.manage`.
- 🟡 **Owner-editable address in the editor** — **DONE** (2026-06-25): `LocationEditorTab` has full structured address fields (line1/line2/city/region/postcode) + map pin + type-ahead search.
- 🟡 **Active completion prompts** — **DONE** (2026-06-25): `CompletenessMeter` now receives `onJump` from VenueOverviewTab, so every incomplete item is a tappable nudge to its editor tab.
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
- 🟡 **Native push (APNs/FCM via Capacitor)** — web push exists; native wrappers do not.
- 🟡 **Owner identity verification** — **DONE** (2026-06-25): claim form now collects legal name, role/title, and verification contact alongside proof description + links. Admin review remains the gate.

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
- 🟡 Set basic + peak pricing rules **that actually apply** *(configurable, not yet charged — flat rate only)*
- ⬜ Manually block a time slot (phone / Messenger / Instagram / walk-in)
- ✅ Choose manual or automatic approval for bookings (per venue)
- ✅ System auto-generates a venue / court booking link (+ custom slug w/ live check)
- ✅ Booking link shareable / embeddable separate from venue website
- ⬜ Single player service fee (7%) + VAT-inclusive display at checkout
- ⬜ Explain future features (demand insights, dynamic pricing) without faking them

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
