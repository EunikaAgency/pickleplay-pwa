# Pickleballers seed data — schema

This workbook is the initial seed import for the Pickleballers venue directory. It contains **only data that cannot be derived by the site itself** (scraped from public sources, researched by VAs/AI, sourced from venue social pages and federation PDFs).

Anything the site can generate from these structured facts — descriptions, taglines, FAQs, SEO metadata, "best for" categorization, hero badges, nearby-venue lists — is **not** in the sheet. It is rendered at upload time (and on data change) by the site's AI generation layer.

---

## Files

| File | Rows | Purpose |
|---|---|---|
| `venues.csv` | one per venue | Identity, location, contact, facility specs, amenities, hours, gallery, editorial overrides. Pricing lives in `venue_pricing.csv`. |
| `venue_pricing.csv` | many per venue | One row per pricing tier. Supports `court_hour`, `session_per_player`, `entry_fee`, `membership`, `free`, `unknown`. Captures member/non-member tiers, time-of-day blocks, group-size adjustments. |
| `venue_courts.csv` | many per venue | One row per court. Only needed when per-court pricing overrides exist (premium courts). Otherwise the widget just shows `court_count` as a hint. |
| `coaches.csv` | one per coach | Independent entity. `venues_worked_at` is a pipe-separated list of `venue_id` references — a coach can work at multiple venues |
| `venue_sessions.csv` | one per recurring/one-off open play session | Open play, clinics, tournaments. Belongs to one venue |

**Not in the workbook** — populated via the site/dashboard:
- Venue updates (owner posts via dashboard)
- Reviews (user-generated)
- Bookings (live transactions)
- Generated copy: descriptions, taglines, FAQs, SEO

---

## Entity relationships

```
venues (1) ─────┬───── (N) venue_pricing
                ├───── (N) venue_courts
                ├───── (N) venue_sessions
                │
                └───── (M) coaches (via coaches.venues_worked_at pipe-list)
```

Coaches own their own profile and list which venues they work at. The venue profile page renders its "Coaches at this venue" section by querying `coaches WHERE venue_id IN venues_worked_at`. Same coach appears on multiple venue pages without duplication.

`venue_pricing` rows are FK→`venues.venue_id`. Optionally FK→`venue_courts.court_id` when a price is court-specific (premium court premium).

---

## Right-rail booking widget — variant × state model

The right-rail card has **two orthogonal axes**: the **variant** (driven by `primary_pricing_model`) and the **state** (driven by whether we have structured pricing + claim status).

### Variant — driven by `venues.primary_pricing_model`

| Variant | When | What renders |
|---|---|---|
| `court_hour` | Pure hourly court rental venues (Pickleball HQ Biñan, 24/7 Pickle Mandaluyong, Conquest Sports) | Date strip → court selector → hourly grid with peak/off-peak colours → price summary → Book |
| `session_per_player` | Open-play-driven community clubs (~60% of PH venues — The PickleGround, Richmond Angono, Mira Nila Clubhouse) | Session list grouped by day; each session shows time range, audience-tier prices, "Reserve slot" CTA |
| `simple` | `entry_fee` / `free` / `membership` / `unknown` (Zone Sports Center, Fitness Hub BFR, Alabang Country Club) | Single price line + booking/contact CTA |

### State — driven by data availability + claim status

| State | Trigger | What renders |
|---|---|---|
| **A — Live booking** | `claim_status = active` AND `venue_pricing` rows exist AND booking system integrated | Full interactive widget for the variant, real-time availability, "Confirm booking" CTA |
| **B — Preview (blurred)** | `venue_pricing` rows exist AND `claim_status ≠ active` | Same widget rendered from data but with `filter: blur(2px)` and a glass overlay: "Profile not yet claimed — instant booking unavailable" + CTA "Book on {provider} →" linking to `external_booking_url` (fallback: "Contact venue") |
| **C — Contact only** | No `venue_pricing` rows | Card collapses to phone/email/directions buttons + "Pricing not listed — contact venue" |

Other page elements still driven by `claim_status`:
- **Verified badge** in title row → shown if `claimed` or `active`
- **Unclaim banner** at top of page → shown only if `unclaimed`
- **"Claim this venue" CTA** prominence → huge if `unclaimed`, sidebar nudge if `claimed`, hidden if `active`
- **"Verify with venue" stamps** on pricing/hours cards → shown if `unclaimed`
- **Heatmap card** → only rendered if `claim_status = active` (needs real booking data)

---

## venues.csv — column dictionary

### Identity & status (8)
| Column | Type | Required | Notes |
|---|---|---|---|
| `venue_id` | string (PK) | yes | Stable unique ID. Format `ph-{slug}-{city}`. Never changes |
| `slug` | string | yes | URL slug (without city/region), e.g., `zone-sports-center` |
| `venue_name` | string | yes | Display name |
| `alternate_names` | pipe-list | no | Other names players might search by |
| `venue_type` | enum | yes | `dedicated_pickleball` \| `multi_sport_venue` \| `private_club` \| `country_club` \| `community_court` \| `condo_facility` \| `school_venue` \| `mall_venue` \| `resort` \| `barangay_court` |
| `claim_status` | enum | yes | `unclaimed` \| `claimed` \| `active`. Drives booking widget + verified badge |
| `listing_status` | enum | yes | `published` \| `draft` \| `hidden` \| `soft_launch` \| `closed` \| `needs_review` |
| `is_verified` | bool | yes | TRUE if claimed/active. Redundant with claim_status but explicit |

### Location (10)
| Column | Type | Required | Notes |
|---|---|---|---|
| `country` | string | yes | "Philippines" |
| `region` | string | yes | "Metro Manila", "Calabarzon", etc. |
| `city` | string | yes | "Makati", "Quezon City" |
| `area` | string | no | Barangay or neighborhood ("BGC", "Salcedo Village") |
| `full_address` | string | yes | Complete street address |
| `postal_code` | string | no | |
| `latitude` | decimal | recommended | For map + "X km away" calc |
| `longitude` | decimal | recommended | |
| `google_maps_url` | url | yes | Used for "Get directions" button |
| `directions_short` | string | no | Short address line for hero ("5th Ave cor. 28th St, BGC") |

### Contact & social (10)
All optional but the site shows whichever are populated.
| Column | Type | Notes |
|---|---|---|
| `phone_primary` | string | |
| `phone_secondary` | string | |
| `email` | string | |
| `website_url` | url | |
| `facebook_url` | url | |
| `instagram_url` | url | |
| `viber_url` | url | Viber group invite link |
| `reclub_url` | url | Reclub club page |
| `external_booking_url` | url | **Drives booking widget** when not active. Can be Reclub, Skedda, Playbypoint, Sparrk, Ticketwave, SimplyBook, Rezerv, Booking.page, Viber group |
| `external_booking_provider` | enum | `reclub` \| `skedda` \| `playbypoint` \| `sparrk` \| `ticketwave` \| `simplybook` \| `rezerv` \| `booking_page` \| `viber` \| `custom`. Used to label the CTA button |

### Facility specs (7)
| Column | Type | Notes |
|---|---|---|
| `court_count` | integer | Number of pickleball-playable courts |
| `indoor_outdoor` | enum | `indoor` \| `outdoor` \| `mixed` |
| `covered_uncovered` | enum | `covered` \| `uncovered` \| `mixed` |
| `surface_type` | string | `hard` \| `wood` \| `acrylic` \| `sport_court` \| `carpet` \| `concrete` \| `usapa_grade` |
| `has_dedicated_lines` | bool/unknown | TRUE if permanent PB lines (vs lined badminton or temp tape) |
| `has_permanent_nets` | bool/unknown | TRUE if fixed nets (vs portable) |

### Service offerings (5)
| Column | Type | Notes |
|---|---|---|
| `has_open_play` | bool | |
| `has_coaching` | bool | |
| `has_court_rental` | bool | |
| `is_beginner_friendly` | bool | Drives FAQ generation |
| `allows_walkins` | bool | |

### Amenities (12 booleans)
Each is `TRUE` \| `FALSE` \| `unknown`. Renders the amenity grid (12 chips, yes/no/dimmed).
- `amenity_air_conditioning`
- `amenity_tournament_lighting`
- `amenity_parking`
- `amenity_showers`
- `amenity_lockers`
- `amenity_seating_area`
- `amenity_water_refill`
- `amenity_cafe_food`
- `amenity_paddle_rental`
- `amenity_pro_shop`
- `amenity_wifi`
- `amenity_covered_terrace`

### Pricing (deprecated — see venue_pricing.csv)

The legacy 15-column pricing model (`price_court_rental_offpeak`, `price_openplay_peak`, etc.) cannot represent the most common PH pattern: per-player session pricing with member/non-member tiers and time-of-day blocks. **It has been replaced by `venue_pricing.csv`** — see column dictionary at the bottom of this doc.

`venues.csv` retains a small set of pricing-related columns as routing/display hints:

| Column | Notes |
|---|---|
| `primary_pricing_model` | enum: `court_hour` \| `session_per_player` \| `entry_fee` \| `membership` \| `free` \| `mixed` \| `unknown`. Drives which widget variant renders. |
| `booking_slot_minutes` | integer, default 60. Only used when `primary_pricing_model = court_hour`. |
| `booking_advance_window_days` | integer, default 14. How many days the widget shows. |
| `accepts_walk_ins` | bool. Drives the "Reservation-only — no walk-ins" banner when FALSE (Pickler's Lounge, Goldentop Pandacan). |
| `pricing_currency` | Default `PHP` (kept for `venue_pricing` rows that don't override). |
| `pricing_blocks_last_verified_at` | YYYY-MM-DD. When the structured `venue_pricing` rows were last verified. |
| `pricing_notes` | Free-text editorial overflow shown beneath the widget. |
| `pricing_last_verified_at` | Legacy column kept for now. |

### Hours (23)
For each day: `hours_{day}_open` (HH:MM 24h), `hours_{day}_close` (HH:MM 24h), `hours_{day}_note` (free text, e.g., "Beginner clinic 7 PM"). Empty open+close = closed that day.

Days: `monday`, `tuesday`, `wednesday`, `thursday`, `friday`, `saturday`, `sunday`.

Plus:
- `hours_timezone` — default `Asia/Manila`
- `hours_last_verified_at` — YYYY-MM-DD

### Editorial overrides (4)
These override or supplement AI-generated copy. Leave blank for venues that should use defaults.

| Column | Notes |
|---|---|
| `custom_tagline` | Overrides AI-generated tagline. Use for headline-worthy positioning ("Strongest publicly verifiable Makati pickleball venue") |
| `custom_highlights` | Pipe-list, 3-5 items. Renders the green "What players love" card. Source: actual review reading |
| `custom_caveats` | Pipe-list, 3-5 items. Renders the amber "Things to know" card |
| `editorial_note` | **Internal only** — never displayed. Notes for the editorial team ("MPC is the resident club, separate from venue itself") |

### Gallery (3)
| Column | Notes |
|---|---|
| `main_image_url` | Hero image. Currently Drive URLs from research; will need CDN migration before launch |
| `gallery_image_urls` | Pipe-list, ordered. Up to ~20 images |
| `image_credits` | Pipe-list, parallel to gallery_image_urls. Source attribution (FB, Google, Instagram) |

### Provenance (3)
| Column | Notes |
|---|---|
| `source_urls` | Pipe-list of all sources cross-referenced |
| `data_completeness` | `complete` \| `partial` \| `needs_review` \| `blank`. Drives "verify with venue" stamp prominence |
| `data_quality_notes` | Free text, internal: "Saturday hours unknown", "Address needs finer pinpointing" |
| `last_verified_at` | YYYY-MM-DD of most recent VA/agent check |

---

## venue_pricing.csv — column dictionary

One row per pricing tier. A single venue can have many rows — six is common for a venue with morning/afternoon/evening × member/non-member tiers.

| Column | Type | Required | Notes |
|---|---|---|---|
| `pricing_id` | string (PK) | yes | Stable unique ID. Format `{venue_id}-p{n}` |
| `venue_id` | FK → venues | yes | |
| `pricing_model` | enum | yes | `court_hour` \| `session_per_player` \| `entry_fee` \| `membership` \| `free` \| `unknown` |
| `label` | string | yes | Human display label: "Off-peak weekday", "Morning open play — member", "Evening DUPR night" |
| `price` | numeric | recommended | No currency symbol, no commas. `0` for free; empty for `unknown`/`membership` |
| `currency` | string | yes | Default `PHP` |
| `days` | pipe-list | no | `mon\|tue\|wed\|thu\|fri\|sat\|sun`. Empty = any day. |
| `time_start` | time | no | `HH:MM` 24h. Empty = all day or duration-based. |
| `time_end` | time | no | `HH:MM` 24h. Exclusive. |
| `duration_minutes` | integer | no | For `session_per_player`: session length (e.g. 240 for 4-hr OP). For `court_hour`: typically 60. |
| `court_id` | FK → venue_courts | no | Empty = applies to all courts. Set = premium-court override. |
| `tier_audience` | enum | no | `member` \| `non_member` \| `homeowner` \| `guest` \| `walk_in` \| `in_house` \| empty (no tier) |
| `group_size_min` | integer | no | For "<4 players ₱200/hr" → min=1, max=3. For "4+ players ₱50/head" → min=4. Empty = no restriction. |
| `group_size_max` | integer | no | |
| `source_url` | url | recommended | Where this price came from. Critical for re-verification. |
| `notes` | string | no | Free text overflow ("includes 1 free paddle", "+₱50 entrance fee may apply") |

**Pattern examples** (full set in `venue_pricing.csv`):

```csv
# Pure hourly court rental
ph-247-pickle-mandaluyong-p1, ph-247-pickle-mandaluyong, court_hour, "Court rental", 800, PHP, , , , 60, , , , , https://www.sparrk.ph/...

# Per-player session with no tiers (most common)
ph-zone-sports-center-makati-p1, ph-zone-sports-center-makati, session_per_player, "Open play", 200, PHP, mon|tue|wed|thu|fri, 10:00, 13:00, 180, , , , , https://www.pickleball.ph/...

# Multi-tier (time-of-day × member/non-member) — 6 rows
ph-pickleground-cavite-p1, ph-pickleground-cavite, session_per_player, "Morning (Member)", 150, PHP, mon|tue|wed|thu|fri|sat|sun, 07:00, 12:00, , , member, , , https://...
ph-pickleground-cavite-p2, ph-pickleground-cavite, session_per_player, "Morning (Non-member)", 180, PHP, mon|tue|wed|thu|fri|sat|sun, 07:00, 12:00, , , non_member, , , https://...
# ... etc

# Group-size tiered hourly
ph-bpc-bacnotan-p1, ph-bpc-bacnotan, court_hour, "Court rental (1-3 players)", 200, PHP, , 18:00, 22:00, 60, , , 1, 3, https://...
ph-bpc-bacnotan-p2, ph-bpc-bacnotan, session_per_player, "Court rental (4+ players)", 50, PHP, , 18:00, 22:00, 60, , , 4, , https://...

# Free community
ph-fitness-hub-las-pinas-p1, ph-fitness-hub-las-pinas, free, "Free community play", 0, PHP, mon|wed|fri, 17:00, 21:00, 240, , , , , https://...

# Private membership (price empty)
ph-alabang-country-club-muntinlupa-p1, ph-alabang-country-club-muntinlupa, membership, "Members only", , PHP, , , , , , , , , https://...
```

The renderer picks the variant from `venues.primary_pricing_model` and iterates `venue_pricing` rows for that venue, grouped/sorted appropriately.

---

## venue_courts.csv — column dictionary

One row per court. Only needed when a venue has **per-court pricing overrides** (e.g. premium centre court) or when courts have distinguishing names. For most venues, this file is empty — the widget just shows `court_count` as a hint.

| Column | Type | Required | Notes |
|---|---|---|---|
| `court_id` | string (PK) | yes | Format `{venue_id}-c{n}` |
| `venue_id` | FK → venues | yes | |
| `court_number` | integer | yes | 1-indexed |
| `court_name` | string | no | Display name ("Center Court", "Court 1") |
| `surface` | string | no | Per-court surface override (rare) |
| `is_premium` | bool | no | Drives a "Premium court" badge in the picker |
| `notes` | string | no | Free text |

---

## coaches.csv — column dictionary

Coaches are **independent entities** (freelancers). The relationship is coach→venues, not venue→coaches.

| Column | Type | Notes |
|---|---|---|
| `coach_id` | string (PK) | Format `ph-coach-{slug}` |
| `slug` | string | URL slug |
| `coach_name` | string | |
| `coach_role_label` | string | Display role ("Head Coach — The Picc BGC", "Women's Pickleball Lead", "Junior Development") |
| `coach_bio` | string | Short bio (1-2 sentences) |
| `coach_dupr_rating` | decimal | Optional |
| `years_coaching` | integer | Optional |
| `certifications` | pipe-list | "PPF certified", "USAP certified", "IPTPA Level 2" |
| `specialties` | pipe-list | "Beginners", "Women", "Kids", "Competitive", "Group", "Private" |
| `languages` | pipe-list | "English", "Filipino" |
| `city_primary` | string | Where they're based |
| `regions_served` | pipe-list | |
| `venues_worked_at` | pipe-list of `venue_id` | **The join.** Pipe-separated venue IDs where this coach teaches. The venue profile page queries this list to render its Coaches section |
| `price_private_per_hour` | numeric | |
| `price_group_per_player` | numeric | |
| `price_currency` | string | Default `PHP` |
| `booking_lead_time_hours` | integer | How far ahead lessons must be booked |
| `phone` | string | |
| `email` | string | |
| `website_url` | url | |
| `facebook_url` | url | |
| `instagram_url` | url | |
| `reclub_url` | url | |
| `external_booking_url` | url | Direct booking link if not via venue |
| `avatar_url` | url | Profile photo |
| `gallery_image_urls` | pipe-list | Optional teaching photos |
| `claim_status` | enum | `unclaimed` \| `claimed` \| `active` |
| `is_verified` | bool | |
| `is_lead_coach_anywhere` | bool | TRUE if they head a program at any venue |
| `source_urls` | pipe-list | |
| `data_completeness` | enum | `complete` \| `partial` \| `needs_review` |
| `last_verified_at` | date | |

---

## venue_sessions.csv — column dictionary

Recurring open play, clinics, and tournaments. One venue can have many. Belongs to one venue (1:N).

| Column | Type | Notes |
|---|---|---|
| `session_id` | string (PK) | Format `{venue_id_short}-{day}-{type}` |
| `venue_id` | FK → venues | |
| `session_title` | string | Display title ("Sunday New Players Welcome", "Tuesday Beginner Clinic") |
| `session_type` | enum | `open_play` \| `clinic` \| `tournament` \| `social` \| `league` \| `drills` \| `private_booking` |
| `is_recurring` | bool | TRUE = uses `day_of_week`. FALSE = uses `one_off_date` |
| `day_of_week` | pipe-list | Lowercase day names if recurring: `monday|wednesday|friday` |
| `one_off_date` | date | YYYY-MM-DD if `is_recurring = FALSE` |
| `start_time` | time | HH:MM 24h |
| `duration_minutes` | integer | |
| `skill_level` | string | "All Levels" \| "Beginner" \| "3.0-3.5" \| "3.5-4.0" \| "4.0+" \| "DUPR-rated" |
| `price_per_player` | numeric | 0 = free |
| `price_currency` | string | Default `PHP` |
| `max_players` | integer | |
| `coach_id` | FK → coaches | Optional. If set, surfaces "with Coach X" in the session card |
| `host_name` | string | If coach_id not set, free text host ("Makati Pickleball Club", "Coach EA") |
| `booking_url` | url | Where to register (Reclub, Viber, etc.) |
| `booking_provider` | enum | Same vocabulary as `external_booking_provider` |
| `registration_required` | bool | |
| `is_community_submitted` | bool | TRUE if scraped from public Reclub/FB rather than venue-confirmed. Adds "Community-submitted — verify before going" disclaimer on the session card |
| `session_notes` | string | Free text |
| `source_url` | url | Where this session info was found |
| `last_verified_at` | date | |

---

## What is NOT in the sheet (site-generated)

The site renders these from the structured data above, using AI generation at upload time and on data change:

| Profile page element | Generated from |
|---|---|
| `description` (hero tagline) | `venue_name` + `court_count` + `indoor_outdoor` + `city` + `has_*` |
| `long_description` (About card) | All structured fields. Custom_tagline used as hook if present |
| `hero_badge` ("Open now · Closes 22:00") | Current time vs `hours_{today}_*` |
| `one_line_summary` chip | `venue_type` + headline price + court count |
| `best_for` chips | `has_open_play` + `has_coaching` + amenities + price tier |
| 4 standard FAQs (price, openplay, beginner, reservation) | Pricing fields + `has_open_play` + `is_beginner_friendly` + `allows_walkins` |
| `seo_title`, `meta_description`, `canonical_url` | All structured fields |
| Nearby venues / Areas grid | DB query on `latitude`/`longitude` + `city` |
| "Verified by venue" stamps | `claim_status` + `pricing_last_verified_at` / `hours_last_verified_at` |
| "X playing now", court-utilization heatmap | Live booking data (only when `claim_status = active`) |
| Reviews + review distribution + tag chips | User-generated, separate DB |

---

## Conventions

- **Booleans**: `TRUE` \| `FALSE` \| `unknown`. Use `unknown` (not blank) when intentionally not researched yet
- **Pipe-separated lists**: use `|` with no spaces around (`Monday|Wednesday|Friday`, not `Monday | Wednesday | Friday`)
- **Empty cells**: data genuinely not available. The site renders these gracefully (skips the row, shows "Verify with venue", or omits the section)
- **Dates**: ISO format `YYYY-MM-DD`
- **Times**: 24-hour `HH:MM` (e.g., `14:00`, not `2:00 PM`)
- **Prices**: numeric only, no currency symbol, no thousands separator (`200`, not `₱200` or `1,200`)
- **URLs**: full URL with protocol
- **IDs**: lowercase, hyphenated, prefixed (`ph-` for Philippines venues, `ph-coach-` for coaches)

---

## Migration from current `standardised_pickleballers_combined.csv`

The existing 95-column sheet rolls up cleanly. Key mappings:

| Old column | New location |
|---|---|
| `description`, `one_line_summary`, `public_note`, `hero_badge`, `tagline` | **Dropped** — site generates these |
| `seo_title`, `meta_description`, `canonical_url` | **Dropped** — site generates |
| `faq_1_question`...`faq_4_answer` | **Dropped** — site generates 4 standard FAQs |
| `best_for`, `best_for_secondary` | **Dropped** — site derives from amenities + offerings |
| `nearby_courts`, `nearby_cities` | **Dropped** — site queries by lat/lng |
| `latest_updates_block_enabled`, `reviews_block_enabled` | **Dropped** — always show; site handles empty states |
| `what_players_like` | → `custom_highlights` (re-delimited with pipe) |
| `things_to_know` | → `custom_caveats` |
| `booking_url` | → `external_booking_url` + new `external_booking_provider` enum |
| `claimed_status` | → `claim_status` (renamed for clarity) |
| `row_status` (complete/partial/needs_review) | → `data_completeness` |
| Day hours (e.g., `monday_hours: "10:00 AM–1:00 PM"`) | Split into `hours_monday_open` + `hours_monday_close` (24h format) |
| `amenity_chips`, `feature_chips` | **Dropped** — site builds chips from individual `amenity_*` booleans + facility specs |
| `price_from_amount` + `price_type` ("Per Player" / "Per Hour" / "Free" / "Private / Membership" / "One-Time Fee" / "Pay to Play") | **Split into `venue_pricing.csv` rows** + `venues.primary_pricing_model` enum. The normaliser deterministically maps the unambiguous ~70% (e.g. `price_type="Per Player"` → one `session_per_player` row). Ambiguous rows (`price_type="Pay to Play"`, multi-tier `price_notes` like "Morning ₱150 / Afternoon ₱170 / Evening ₱200") flagged as `data_completeness = needs_review` and queued for AI scraper pass. |
| `open_play_price_amount`, `court_rental_price_amount`, `membership_fee_amount` | Folded into `venue_pricing.csv` rows with appropriate `pricing_model` |
| `price_notes` | Editorial overflow kept on `venues.csv`; structured tiers extracted into `venue_pricing.csv` |
