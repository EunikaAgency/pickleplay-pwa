# Ivan Report — 2026-07-23: Nearby tab rebuilt around venues (+ free-time filter)

- **Author:** Ivan (drafted with Claude Code)
- **Date:** 2026-07-23 (Thursday)
- **Area:** Player PWA — `Nearby` / Map tab (`features/venues/v2/`)
- **Try it:** https://pickleballer-pwa.eunika.xyz/nearby — ⚠️ **not deployed yet**, see [Status](#status)
- **Same day:** [verification audit](2026-07-23-verification-audit.md)
- **Preceding day:** [2026-07-22](2026-07-22-Ivan-report.md)

The Nearby tab was rebuilt from a plain court list into a venue-first grid, from a
supplied design. A free-time-range filter was added on top of it. Along the way two
real bugs and one bad assumption were found in existing code — those are written up
in full below, because two of them affect more than this screen.

| Part | Workstream | Result |
|------|-----------|--------|
| **A** | Nearby → venue-first grid (from design) | ✅ built + verified locally |
| **B** | "Free between" time-range filter | ✅ built + verified locally |
| **C** | Bugs found in existing code | 3 found, 2 fixed here, 1 reported |

---

## Status

**Everything below is uncommitted and undeployed.** The live PWA is running older
code. Ivan asked at the start of the session not to commit or push, and that has
been honoured. Nothing here is on `pickleballer-pwa.eunika.xyz` yet.

---
---

# Part A — Nearby rebuilt as a venue-first grid

## What was there before

A single-column list: a "⭐ Top Pick" featured card, then thin rows with a small
thumbnail, name, distance and a couple of attribute pills. Pricing was a single
free-text badge ("Pay to Play", "Per Player", sometimes literally "unknown"), and
there was no indication of whether a court was actually free, or whether booking
was instant or needed owner approval.

## What it is now

Each venue is a card carrying the things a player actually decides on:

| On the card | Where the data comes from |
|---|---|
| Photo, or a "No photo yet" court mark | `venueImage()`; most seeded venues have no photo |
| `Indoor / Aircon` · `Outdoor` · `Mixed` pill | `indoorOutdoor` + `hasAc` |
| `⚡ Instant book` vs `Request to book` | `requireBookingApproval` |
| `✓ N slots open` | `batchVenueAvailability` for the chosen date |
| `Member ₱525/hr` / `Guest ₱700/hr` | `priceFrom` × `memberDiscountPercent` |
| Rating + review count | `googleRating` / `googleReviewCount` |
| Amenity chips | `venueAmenities()` |
| `View Courts →` | → `court-details` |

Above the list, signed-in players get **"Venues you've played at recently"** —
rolled up from their own bookings (`listBookings`), showing play count, when they
last played, and the rate they'd pay next time. Past, non-cancelled bookings only:
a court booked for next Tuesday isn't somewhere you've *played*.

Grid is one-up on a phone, two-up once the frame is wide enough (`@container app`,
matching the rest of the frame-capped responsive rules).

## New files

```
features/venues/v2/
  nearbyDisplay.ts        formatters — venueRates, venueTypeBadge, openSlotCount,
                          venueArea, hourLabel, freeAcrossWindow, deriveRecentVenues
  NearbyFilterRow.tsx     date · free-between · area · type  (+ AnchoredPanel)
  RecentVenuesSection.tsx "played at recently" rail
  VenueGridCard.tsx       the venue card
```

`NearbyScreenV2.tsx` and `shared/styles/v2.css` were modified. **FILEMAP.md** and the
public **roadmap** were updated in the same change, per the standing rules.

## Two explicit calls from Ivan during the build

1. **"wag mo sundin yung color palette nung design"** — the supplied design used a
   warm/orange palette. Only the *layout* was taken; colours stay on this screen's
   existing `--blue` / `--lime` / `--navy` tokens, so the sheet still themes
   correctly in dark mode. The only fixed colours are badges that sit *on a photo*
   (the photo is their background, not the themed surface, so they must not flip).

2. **"card border gawin mong visible, di masyadong halata pag Mac Chrome"** — the
   cause was concrete: **Chrome rounds a `1.5px` border down to 1 device pixel at
   DPR 1**, so on a non-retina display the edge nearly vanished. Cards are now a
   full `2px` on a dedicated `--nv-edge` tone, a step darker than the shared
   `--border` token.

---
---

# Part B — "Free between" time-range filter

## The control

One field reading `Any time` / `6 PM – 9 PM`, which opens a **two-thumb
`<input type="range">`** spanning the whole day (12 MN → 12 MN). Both thumbs back
at the extremes means "any time" — the filter has a real off position rather than
a separate mode. The thumbs are kept at least an hour apart in JS, so an invalid
window is *unreachable* rather than merely rejected.

This went through three iterations at Ivan's direction — two dropdowns → a single
range field → an inline slider → back into a dropdown. Final: dropdown containing
the slider.

## The honest-filtering problem — worth reading

The first working version collapsed the list from 30 cards to **1**. That looked
like a filter bug. It wasn't. Probing the API directly:

```
directory venues        : 104
availability rows       : 2      ← only 2 venues return anything
free ALL of 07:00-19:00 : 2      → Actifit Sports Center, The Dink Lab
venues with NO row      : 102
```

**102 of 104 venues have no published courts/opening hours**, so
`batchVenueAvailability` returns nothing for them — we can neither confirm nor deny
they're free. The filter was excluding everything it couldn't verify, which is
technically correct and practically useless.

An intermediate version listed the unverifiable venues below a divider. Ivan's
call was clear — **"kung ano lang yung na filter yung lang dapat ang makikita"** —
so the list now shows **only** confirmed-free venues. One line of text remains
below the results: *"102 venues hidden — they haven't published opening hours, so
we can't check this time range."* No cards, just the explanation, so a 104 → 2
drop doesn't read as the directory breaking.

> **This is a data problem, not a UI one.** The filter will stay near-useless until
> venues get courts + opening hours seeded. Worth deciding whether that's a seeding
> gap or genuinely unconfigured venues.

## Area dropdown search

The area list runs to **94 entries**. It now has a type-to-filter box, auto-focused
on open, with Enter selecting when one match remains and a "No area matches …"
state. The blank "All areas" reset stays visible while filtering.

---
---

# Part C — Bugs found in existing code

## C1 — `npx tsc --noEmit` checks nothing in this repo ⚠️ affects everyone

Root `tsconfig.json` is:

```json
{ "files": [], "references": [{ "path": "./tsconfig.app.json" }, ...] }
```

With `files: []` and no `-b`, **`npx tsc --noEmit` compiles zero files and always
prints 0 errors.** Any "typecheck clean" claim made with that command — in this
report's workstream or elsewhere — established nothing.

The real command is:

```sh
npx tsc -p tsconfig.app.json --noEmit     # 64 errors repo-wide as of today
```

Re-checked properly: **0 of those 64 are in the new/changed Nearby files.** The
conclusion held, but the check being quoted was empty. Recommend the team stop
using bare `npx tsc --noEmit` in verification notes.

## C2 — `api.ts` had a duplicated block that killed the whole app bundle

A block was pasted twice into `shared/lib/api.ts` (from the parallel no-show
attendance / refund settlement work):

```
markBookingAttendance · PendingRefund · listPendingRefunds · settleRefund   (×2)
```

Vite: `SyntaxError: Identifier 'markBookingAttendance' has already been declared`
— a hard parse error, so the **entire app failed to boot**, white screen. Both
copies were functionally identical; only the doc comments differed.

Not touched from this workstream (another session was mid-edit on that file); it
was reported and **has since been resolved**. Flagged here because it's the second
time a duplicated paste has reached `api.ts`, and it fails loudly and totally.

## C3 — Dropdowns clipped, then forced upward on desktop

Two compounding faults, both fixed:

1. **Clipping.** `.nearby-sheet` has `overflow: hidden` and is only **188px tall
   when collapsed**, so any dropdown inside it was cut off. Additionally the sheet
   is a stacking context (`z-index: 30`), so *no* z-index inside it can beat the
   tab bar (`z-index: 45`) — panel bottoms slid under the nav.

   Fixed with the pattern already in this codebase (`HourSelect`): a local
   `AnchoredPanel` that switches the panel to `position: fixed` with measured
   coords, escaping the clip, flipping above the trigger when there's no room, and
   treating the tab bar's top as the floor. Fixed coords resolve against the
   transformed `.app` frame, so the frame origin is subtracted.

2. **Desktop regression from that fix.** The v2 tab bar is `display: none` on
   desktop, and **`getBoundingClientRect()` on a hidden element returns all
   zeros** — so the floor collapsed to `0`, there was never room below, and every
   panel opened upward over the map even with 687px free beneath it. The tab bar's
   rect is now only used when it has real height.

Verified across four states:

| | tab bar | room below | panel | opens | correct |
|---|---|---|---|---|---|
| Desktop, sheet open | hidden | 687px | 292px | down | ✅ |
| Desktop, collapsed | hidden | 98px | 292px | up | ✅ |
| Phone, sheet open | shown | 491px | 292px | down | ✅ |
| Phone, collapsed | shown | 54px | 292px | up | ✅ |

## C4 — Counts disagreed with the list (found by Ivan)

Ivan spotted the chip reading "1 confirmed free" while the header still read
"104 courts near you". Two separate faults:

- The header read `sorted.length`, which never had the time filter applied.
- Worse: the time partition ran over the **top-30 slice**, not the full list. So
  "1 confirmed free" actually meant *"1 among the nearest 30"*, and a venue free at
  your time ranked 31st or lower **was silently never found**.

Now partitions the whole sorted list, then caps rendered cards at 30. After the
fix the same query returns **2**, not 1 — the second venue was outside the top 30,
exactly the case the old code missed. Header, chip and rendered cards all agree,
cross-checked against the API.

---
---

# Verification

Local dev server (`:9000`) against the live API (`:9002`), Playwright, at 390 /
520 / 820 / 1680px:

- Venue grid renders 30 cards, 1-up phone / 2-up tablet+; recent-venues rail live
  on an authed session (`The Dink Lab · PLAYED 3× · JUL 16 · ₱185/hr`).
- Slider: thumbs never cross (start shoved to 23 against end 21 → clamps to 20/21);
  both extremes → "Any time" + filter off; `12 MN` renders correctly at hour 24.
- Time filter: only matches listed, 0 muted groups; a venue that *has* a schedule
  but is busy is dropped (10 PM–11 PM → The Dink Lab correctly disappears).
- Counts cross-checked against `POST /venues/availability/batch` — UI "2 free"
  matches the server's 2 exactly.
- Area search: 94 options → `"Abra"` → `[All areas, Abra de Ilog]` → Enter applies.
- **0 console errors** in every run.
- `tsc -p tsconfig.app.json`: 0 errors in changed files (64 pre-existing elsewhere).
- ESLint: no new errors; 2 pre-existing remain (`NearbyScreenV2` venue-load effect,
  and the now-dead `DateTimeFilterBar`).

**No API, route, `/lists`, model or permission change.** Everything is read-only
use of endpoints that already existed.

---

# Open items

| # | Item | Note |
|---|---|---|
| 1 | **Uncommitted** | Nothing committed or pushed, per instruction. Not deployed. |
| 2 | **`DateTimeFilterBar.tsx` is dead** | Nothing imports it; the range slider restored its function. ~420 lines + 67 CSS lines. Left in place — not deleted unasked. |
| 3 | **Availability data gap** | 102/104 venues have no courts/hours. The time filter can't be genuinely useful until that's seeded. |
| 4 | **Area filter vs card location** | Areas are built from `city \|\| region`. A card reading "Kawit · Cavite" is filterable as *Cavite*, not *Kawit*; searching "Makati" finds nothing (those venues carry "Metro Manila"). Mismatch between what's shown and what's filterable. |
| 5 | **Vite watcher `ENOSPC`** | The dev server crashed on inotify limits mid-session and pm2 restarted it 5×. Worth watching on this host. |
