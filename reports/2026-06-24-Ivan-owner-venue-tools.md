# Task Report — Venue Owner tools (claim, per-court setup, booking link, profile)

- **Author:** Ivan
- **Date:** 2026-06-24
- **Area:** `app/` (PWA) — Venue Owner experience (+ `api/` for the claim gate & booking-slug routes)
- **Status:** ✅ Built. Booking link, address type-ahead, slim create form, claim, and editor tab-memory are **verified** (curl + Playwright) and the booking-link/courts/hours batch is **committed & pushed** (`7cd1dee`). The remaining owner work (Claim screen, Owner Profile, per-court hours, Courts/Reviews polish) is built and in the working tree — **QA pending**.

---

## 1. Goal

Round out the venue-owner side of the app: let owners onboard without creating duplicate
listings, set up each court properly, share a booking link, and manage their venue from a
profile/dashboard that fits an owner (not a player).

## 2. What changed

### Claim an existing venue — `features/owner/ClaimVenueScreen.tsx` (new)
- Debounced directory search scoped to **unclaimed** listings (`listVenues({ search, state: 'unclaimed', excludePendingClaims: true })`) → pick a venue → proof form (description ≥10 chars + up to 5 links) → `submitVenueClaim()` (`POST /api/v1/claims`) → "submitted, pending review" success view.
- Entry points: a **Claim** button beside "Create venue" on `OwnerVenuesScreen.tsx` and `OwnerNearbyScreen.tsx`, plus the (previously dead) "Already in our directory? Claim it instead" hint on `OwnerNewVenueScreen.tsx`.
- New permission **`owner.venues.claim`** synced to all three copies + `PERMISSION_CATALOGUE` + owner role default, and backfilled onto the live owner role. Wired in `navigation.ts` (path `/owner/venues/claim`) + `App.tsx`.

### Slimmer "Add a venue" + smart address — `OwnerNewVenueScreen.tsx`, `components/AddressAutocomplete.tsx`, `MapPinPicker.tsx`
- Create form reduced to identity + location + contact (courts/pricing moved to the post-create Courts tab). Visible Latitude/Longitude fields added.
- New debounced (350 ms) type-ahead address combobox: picking a suggestion fills the address, drops/flies the map pin, and auto-fills city + address line 1/2 + postcode (free-text `cityName`, seeded `cityId` linked silently when the name matches). Backed by new `GET /api/v1/geocode/suggest`.

### System-generated booking link — `components/BookingLinkShare.tsx` (new), `tabs/ListingEditorTab.tsx`, `tabs/VenueOverviewTab.tsx`
- Each venue gets a canonical `…/venues/<slug>` booking link with **Copy** + **Share**, surfaced as the first card on the Overview tab and inside the Listing editor. Free-text `bookingUrl` removed.
- Optional **custom slug** with a 400 ms-debounced live availability check (`GET /venues/:id/booking-slug-available`) — green "Available" / "Taken" / "Invalid", and Save is blocked while a bad slug is entered. Backed by a new `bookingSlug` field (normalized + uniqueness-checked across all venue slugs/bookingSlugs).

### Per-court setup — `components/WeeklyHoursEditor.tsx` (new), `tabs/CourtsEditorTab.tsx`, `tabs/ClosuresEditorTab.tsx` (renamed from HoursEditorTab)
- Court rows gained **court name**, **description**, and a **photo gallery** (up to 8, uploaded via `uploadCourtMedia`); court fields collapse onto one row.
- Weekly operating hours moved **out of the venue Hours tab and into each court**: the new `WeeklyHoursEditor` (open/close per day + optional per-block "Hours pricing" windows with overlap/operating-hours validation, mirrored on the API via `putCourtHours`). The old venue Hours tab is now **Closures** only (one-off closed dates).

### Owner Profile tab — `OwnerProfileScreen.tsx` (new)
- The v2.1 profile design populated with the owner's account + venue-business content (theme Light/Dark/System, notifications, venues, insights, logout). `App.tsx` branches the profile tab on `owner.access` so owners get this instead of the player profile.

### Reviews inbox + dashboard polish — `tabs/ReviewsInboxTab.tsx`, `OwnerHomeScreen.tsx`, `OwnerNearbyScreen.tsx`
- Reviews: rounder cards on the surface tone, gold star rating (`--star`), formatted visit dates; owner reply unchanged.
- Owner Home: real unread notification badge, avatar photo fallback, 6-venue grid (was 4). Owner Nearby header: Claim + Create venue buttons.
- (Earlier today) the venue editor's active tab is **derived from the URL** so it survives a reload and is shareable/deep-linkable.

## 3. Permissions / `/lists` / FILEMAP
- **New permission:** `owner.venues.claim` (3 synced copies + catalogue + owner default + live backfill). Everything else reuses `owner.venues.manage` / `owner.bookings.manage` / `owner.reviews.manage`.
- **API routes added/changed:** `POST /claims` now gated by `owner.venues.claim`; `GET /venues` gained `state=claimed|unclaimed`; `GET /geocode/suggest`; `bookingSlug` field + `GET /venues/:id/booking-slug-available`. All reflected in `/lists`.
- **FILEMAP:** updated (app + api) for the new screens/components/endpoints.

## 4. Verification
- **Verified (curl + Playwright):** claim flow (player 403 / unauth 401 / short-proof 400 / owner 201 / duplicate 409 / admin approve → venue claimed + DB restored); booking-link set/normalize/collision/clear + live availability; address type-ahead pick → pin + city/line1/postcode auto-fill; slim create form; editor tab-memory survives reload.
- **QA pending:** per-court Weekly Hours editor, enriched Courts editor (gallery), Owner Profile tab, Reviews/dashboard polish — built and running, not yet browser-clicked end-to-end.
- App build + scoped lint clean.

## 5. Commit status
- **Committed & pushed** (`7cd1dee`, monorepo `EunikaAgency/pickleplay-pwa`): auto booking link + Copy/Share + custom slug, courts-on-one-row, per-day hours-pricing windows, address type-ahead + map pin.
- **In working tree (pending commit):** Claim Venue screen + permission, Owner Profile tab, per-court WeeklyHoursEditor (Hours → Closures), enriched Courts editor, Reviews inbox polish, Owner Home/Nearby header.
