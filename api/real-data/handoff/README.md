# Pickleballers — Data Handoff (2026-05-18)

This bundle contains the complete scraped venue + coach dataset for the
Pickleballers PH directory, packaged for direct database ingestion.

---

## What's in the box

| File | Rows | Purpose |
| --- | ---: | --- |
| `venues.csv` | 181 | Primary venue table. 97 columns. **PK: `venue_id`**. Each row is one playable site. |
| `venue_pricing.csv` | 195 | Pricing rows (one row per price tier per venue). **FK: `venue_id` → venues**. A venue can have many rows. |
| `venue_courts.csv` | 0 | Per-court overrides (mostly empty; only seeded for venues that price courts individually). **FK: `venue_id` → venues**. |
| `coaches.csv` | 32 | Coach directory. **PK: `coach_id`** (or fall back to `slug`). Standalone table — no FK to venues. |
| `venue_images.csv` | 250 | Generated manifest. Every file in `images/` paired with its venue + role (hero / gallery). |
| `proposed_pricing_review.csv` | 92 | AI-extracted pricing **not yet merged** into `venue_pricing.csv`. See "Proposed pricing" section below before importing. |
| `SCHEMA.md` | — | Full column-by-column schema with type hints, examples, and the 3-state widget model. |
| `images/venues/{slug}/...` | ~250 files | Actual hero + gallery JPEGs. Web paths are `/images/venues/{slug}/{filename}` (the `web_path` column in `venue_images.csv` already includes the leading `images/`). |

---

## Import order (respecting foreign keys)

1. `venues` — must load first; everything FKs to it.
2. `coaches` — independent; can load any time.
3. `venue_pricing` — requires `venues.venue_id` to exist.
4. `venue_courts` — requires `venues.venue_id` (mostly empty; safe to import last or skip if you don't need per-court price overrides yet).
5. `venue_images` — this is a *manifest*, not a database table. Use it to:
   - Decide which image is the venue's hero (`role = 'hero'`, `position = 0`).
   - Order the gallery deterministically (`role = 'gallery'` sorted by `position`).
   - Upload images to your CDN/bucket. The `web_path` column is the path used on the current static site; remap to your own storage as needed.

---

## Primary keys & identifiers

- **`venues.venue_id`** — stable kebab-case ID, format `ph-{venue-name}-{city}`. Already used everywhere as the FK target. **Use this as your DB primary key.**
- **`venues.slug`** — URL slug; should also be unique. Used to look up image folders (`site/images/venues/{slug}/`).
- **`coaches.coach_id`** — same kebab-case format.
- **`venue_images`** has no primary key; treat (`venue_slug`, `filename`) as a composite unique key.

---

## Data verification status

- ✅ **Verified** — venue names, addresses, city/region, coordinates, court counts, indoor/outdoor flags, amenities, photo URLs, and the rows currently in `venue_pricing.csv`. All went through the normaliser + human review.
- ⚠️ **Mixed reliability** — coordinates are mostly from Google Places lookups; a small number are approximated from city centroids. The `coordinate_source` column on `venues.csv` flags which is which.
- 🔬 **Proposed, not verified** — every row in `proposed_pricing_review.csv`. These come from the AI scraper and **must be human-reviewed before merging into `venue_pricing.csv`**. See next section.

---

## Proposed pricing — how to think about it

The AI scraper (`scripts/scrape-venue.mjs` in the source repo) reads each venue's
public sources (their website, Facebook page, Reclub/Sparrk/Pickleheads listings,
PDFs) and proposes structured pricing rows. Output goes to
`data/scrape-output/proposed/{venue_id}.json` and is **never automatically merged**
into `venue_pricing.csv` — a human approves each row first.

`proposed_pricing_review.csv` flattens those JSONs into one CSV for easier review.
Columns:

- `venue_id` — which venue this row belongs to.
- `pricing_model` — one of `court_hour`, `session_per_player`, `entry_fee`, `membership`, `free`, `mixed`, `unknown`.
- `label` — human-readable tier name (e.g. "Peak", "Off-peak", "Open Play · Walk-in").
- `price`, `currency` — the headline numeric price (currency defaults to `PHP`).
- `tier_audience` — who the price applies to: `walk_in`, `member`, `non_member`, etc.
- `days` — pipe-separated weekday codes (e.g. `mon|wed|fri`) when the price is day-specific.
- `time_start`, `time_end` — 24h time bounds when the price is time-specific.
- `duration_minutes`, `group_size_min`, `group_size_max` — additional structured qualifiers.
- `venue_confidence` — `high` / `medium` / `low` — the AI's overall confidence in this venue's extraction (not the row).
- `notes` — anything extra the AI surfaced (e.g. "2 Indoor Courts").
- `source_quote` — the exact text the AI pulled the price from. **The fastest way to verify a row is to read this quote and decide if the price looks right in context.**
- `data_quality_notes` — the AI's caveats about this venue's data (e.g. "Reclub mentions 'Per Session' but no amount given").

**Recommended workflow:** filter to `venue_confidence = high` and `price` is non-empty, eyeball the `source_quote` for each row, merge approved rows into your DB's pricing table. Anything with `venue_confidence = low` or empty `price` should stay out until a human verifies the venue directly.

---

## Caveats & known data quirks

- **Hours data is sparse.** Most venues show "Closed" Mon–Sun in `venues.csv` — the legacy normaliser didn't import hours strings reliably. Treat missing hours as "unknown," not "closed."
- **Pricing model "mixed" or "unknown"** — about 50 venues either use multiple pricing structures (e.g. court_hour for some courts + session_per_player for others) or we couldn't determine pricing. These are flagged so you can surface "Contact venue" UX instead of bad prices.
- **`is_verified` ≠ "we called them"** — it currently means "we have at least one strong source (booking platform or official website) corroborating the listing." Treat it as confidence, not ground truth.
- **`claim_status`** — currently mostly `unclaimed`. When a venue owner claims their listing in your product, set this to `claimed` or `active`.
- **Image alt text isn't in the CSV.** It's generated at render time as `"{venue_name} pickleball court in {area}, {city}"` — easy to recreate from venues.csv columns.

---

## Image folder structure

```
images/venues/
  athlete-central/
    athlete-central-pickleball-court-cainta.jpg       ← hero (no trailing -N)
    athlete-central-pickleball-court-cainta-2.jpg     ← gallery position 1
    athlete-central-pickleball-court-cainta-3.jpg     ← gallery position 2
  dragonsmash/
    dragonsmash-pickleball-court-taguig.jpg
    dragonsmash-pickleball-court-taguig-2.jpg
    ...
```

Filename pattern: `{slug}-pickleball-{citySlug}[-{N}].{ext}` — the `-{N}` suffix is the gallery position (hero has none). All resolved at scrape time from venues' published Google Drive photos via `scripts/download-venue-images.mjs`.

Source resolution caps at 2000px width for most venues; a small number are smaller (original uploads were already thumbnails). For higher-res, you'd need to re-source from the venue directly.

---

## Schema docs

See `SCHEMA.md` (23 KB) — full column-by-column documentation including the 3-state booking widget model, pricing model enum, and amenity flag list.

---

## Source code

This bundle was generated by `scripts/build-dev-handoff.mjs` in the
`magusara/pickleballers-web` GitHub repo. If anything looks off, the source
repo has the full build pipeline (CSV → static site renderer) for reference.

Generated: 2026-05-18.
