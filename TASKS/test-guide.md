# Test Guide — Done Tasks
Quick navigation paths to verify each completed feature. Sorted by CSV row number.

---

### Row 2 — Per-player surcharge (add-on-per-head pricing)
login as owner → select venue → Venues tab → Courts tab → open a court → Pricing tab → check "Per additional player" surcharge field

### Row 3 — Base court price (default hourly rate per court)
login as owner → Venues tab → Courts tab → open any court listed → Pricing tab → check base hourly rate

### Row 4 — Time-based pricing (price changes after 6 PM)
login as owner → Venues tab → Courts tab → open a court → Pricing tab → Slot Pricing sub-tab → check time-window price overrides (e.g. after 6 PM)

### Row 5 — Day-based pricing (weekday vs weekend vs holiday)
login as owner → Venues tab → Courts tab → open a court → Pricing tab → Slot Pricing sub-tab → toggle between weekday/weekend/holiday rates

### Row 6 — Member pricing (special rate for venue members)
login as owner → Venues tab → Courts tab → open a court → Pricing tab → check member-tier rate override section

### Row 7 — Court-specific price overrides
login as owner → Venues tab → Courts tab → open Court A (note price) → open Court B → compare — different courts should allow different pricing

### Row 8 — Manual surge adjustment (owner raises/lowers specific slots)
login as owner → Venues tab → Courts tab → open a court → Pricing tab → Slot Pricing → manually override a specific day×hour slot price

### Row 9 — Suggested dynamic pricing (demand-based recommendation)
login as owner → Venues tab → Courts tab → open a court → Pricing tab → check PricingSuggestionsCard → review confidence levels → bulk-apply suggestions

### Row 10 — Automated dynamic pricing (opt-in)
login as owner → Venues tab → Courts tab → open a court → Pricing tab → Slot Pricing → toggle "Auto Dynamic Pricing" → set min confidence + max adjustment cap

### Row 11 — Currency, VAT/tax handling, and whether displayed price is inclusive
login as player → browse venues → open any venue → check court pricing display — prices should show ₱ with VAT-inclusive notation

### Row 12 — Deposit vs full payment vs pay-at-venue at checkout
login as player → browse venues → book a court → proceed to checkout → verify payment options (deposit / full / pay-at-venue)

### Row 13 — 7% player service fee display
login as player → book a court → checkout screen → verify single service fee line item shown (not PayMongo 2.5% separately)

### Row 14 — Half-court / split-court pricing
login as owner → Venues tab → Courts tab → open a court → check if half-court / split-court rate option exists

### Row 15 — Open-play / per-session pricing vs whole-court block
login as player → browse venues → check if open-play sessions are listed separately from whole-court bookings

### Row 16 — Equipment/paddle rental add-ons
login as player → book a court → checkout screen → verify equipment/paddle rental add-on line items available

### Row 17 — Manual booking/blocking (phone, Messenger, IG, walk-ins)
login as owner/staff → Bookings tab → Manual Booking → fill player name + court + time slot → create booking from external channel

### Row 18 — Auto-generated booking link (system-created, optional custom slug)
login as owner → Venues tab → select venue → check Booking Link section → copy auto-generated link → verify custom slug option

### Row 19 — Manual vs automatic approval (configurable per venue/court)
login as owner → Venues tab → select venue → Settings → toggle between Manual Approval / Auto Approval

### Row 20 — Recurring bookings (weekly regulars, leagues)
login as player → Bookings tab → create booking → check "Recurring" option → set weekly repeat schedule

### Row 21 — Double-booking collision handling (Group B venues)
login as owner → Venues tab → Settings → enable Request-to-Approve mode → login as player → attempt to book an already-booked slot → verify pending_approval status instead of rejection

### Row 22 — Cancellation & refund rules (window, fees, no-show policy)
login as owner → Venues tab → select venue → Settings → Cancellation Policy → configure window/fees/no-show rules

### Row 23 — Booking modification (reschedule, change court)
login as player → Bookings tab → open an existing booking → Edit/Reschedule → change court or time slot

### Row 24 — Overbooking / waitlist for full slots
login as player → browse venues → find a fully-booked court → join waitlist → verify waitlist confirmation

### Row 25 — Buffer/turnover time between bookings
login as owner → Venues tab → Courts tab → open a court → Settings → set buffer time between bookings (e.g. 15 min turnover)

### Row 26 — Address autocomplete + auto-geocoding
login as owner → Venues tab → Add/Edit Venue → type address in address field → verify Google autocomplete suggestions appear → select → map pin auto-placed

### Row 27 — Multiple venues per owner
login as owner → Venues tab → verify multiple venues listed → switch between venues via venue picker

### Row 28 — Multiple courts per venue
login as owner → Venues tab → select a venue → Courts tab → verify multiple courts listed → add another court

### Row 29 — Court details (surface, photos, thumbnail, description)
login as owner → Venues tab → select venue → Courts tab → open a court → Edit → check surface type, photo upload, thumbnail, description fields

### Row 30 — Operating hours / availability per court
login as owner → Venues tab → select venue → Courts tab → open a court → Hours tab → set open/close times per day

### Row 31 — Separate venue website field vs platform booking link
login as owner → Venues tab → select venue → Edit → verify two distinct fields: Website URL + Booking Link

### Row 32 — Profile completion prompts
login as owner → Dashboard → check completeness meter/progress bar → follow prompts to complete missing fields

### Row 33 — Amenities/facilities (parking, showers, aircon, lighting, indoor/outdoor)
login as owner → Venues tab → select venue → Edit → Amenities section → toggle parking/showers/aircon/lighting/indoor-outdoor

### Row 34 — Venue claim flow (claim unclaimed directory listing)
login as owner → Venues tab → Claim Venue → search for unclaimed venue → fill claim form (legal name, role, contact, proof docs) → submit

### Row 35 — Court sport/type field in data model
login as owner → Venues tab → select venue → Courts tab → open/edit a court → check Sport field with 6-sport picker chips

### Row 37 — Owner view (revenue, occupancy, business performance)
login as owner → Dashboard tab → verify revenue metrics, occupancy %, booking volume cards

### Row 38 — Operator/staff view (today's schedule, pending approvals, manual entries, cancellations)
login as staff → Dashboard tab → verify today's schedule list, pending approvals queue, manual entry button, cancellation list

### Row 39 — Role-based views (owner vs manager vs front-desk vs staff)
login as owner → Settings → Staff tab → add staff with specific role → login as that staff → verify limited view vs owner view

### Row 40 — Busiest hours / underused slots / revenue by court
login as owner → Insights tab → check peak hours heatmap (7×24 grid) → check occupancy % → check revenue-by-court chart

### Row 41 — Minimum credible analytics view (MVP analytics)
login as owner → Insights tab → verify 6 sections present: Revenue, Bookings, Usage, Courts, Demand, Leakage

### Row 42 — Demand data capture (searches, views, attempts, completions, cancellations, empty slots)
login as owner → Insights tab → Demand section → verify search volume, view counts, booking attempts, completions, cancellations, empty slot metrics

### Row 43 — Platform-curated highlights
login as player → browse venues → open any venue → Court Details screen → verify "Best for" badges + "What players like" chips (e.g. "Beginner Friendly", "Has Coaching", "4.5★ Rating")

### Row 44 — Multi-user/staff accounts per venue with permissions
login as owner → Settings → Staff tab → invite/add staff user → assign role + permissions → login as staff → verify access matches assigned permissions

### Row 46 — Payout schedule & reconciliation to venue
login as owner → Payments tab → check payout schedule → verify reconciliation view (bookings → payouts → venue balance)

### Row 49 — Push notifications (FCM + VAPID) for booking confirmations
login as player → book a court → complete booking → verify push notification received for booking confirmation

### Row 49 — Push notification rebook loop
login as player → after booking ends → verify rebook reminder push notification received

### Row 50 — In-app messaging (owner-to-player)
login as player → Messages tab → send inquiry to venue owner → login as owner → Messages tab → verify inquiry received → reply → login as player → verify reply received

### Row 51 — Map owner features by priority (must-have vs roadmap)
reference: this CSV file — feature-priority matrix completed

### Row 52 — Research first target venues (systems used, membership needs)
reference: research completed — see docs/ for venue analysis notes

---

## Recent additions (2026-07-01)

### Custom amenities (ListingEditorTab)
login as owner → Venues tab → select venue → Listing tab → Amenities section → tap preset chips → type custom amenity in "Custom amenities" field → press Enter → Save → verify player-facing Court Details shows custom amenities

### Staff — per-venue only (no auto-all-venues)
login as owner → Owner → Staff → create staff account → login as staff → verify `/owner/venues` shows NO venues (unless assigned) → login as owner → venue → Staff tab → search staff → add as Manager → login as staff → verify only that venue appears

### Staff tab — search only owner's staff
login as owner → venue → Staff tab → click "Find a person" → verify on-focus shows all staff accounts of this owner → type to filter → verify only staff accounts appear (no random players)

### Club staff assignment
login as owner → Clubs tab → open a club you host → About tab → Staff section → search your staff → add as moderator → verify staff can now moderate that club (but not delete it or manage other staff)

---

## Notes

- **Role switching**: Use separate browser/incognito windows for testing multi-role flows (owner + player + staff simultaneously)
- **API-only checks**: Some features (auto-pricing cron, demand data capture) are backend-only — verify via API response or DB, not just UI
- **Payment flows**: Use PayMongo test mode for checkout testing
