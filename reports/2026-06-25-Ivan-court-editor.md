# Task Report — Court editor tabs, gallery preview & hours-pricing layout

- **Author:** Ivan
- **Date:** 2026-06-25
- **Area:** `app/` (PWA) — Venue Owner experience (Courts editor)
- **Status:** ✅ Built. UI refinements to the per-court editor; type-check + scoped lint clean, running live via the dev server (HMR). **QA pending** — not yet committed.

---

## 1. Goal

Make the per-court setup (from the 2026-06-24 owner-venue batch) easier to use: split the
crowded single-scroll court form into clear tabs, turn the photo strip into a real gallery
with image preview, and fix the cramped hours-pricing layout on mobile.

## 2. What changed

### Court editor split into 3 tabs — `tabs/CourtsEditorTab.tsx`
- Each expanded court row now uses the shared `Segmented` control with three tabs:
  - **Court Info** — thumbnail, name, rate, surface, description, and the Indoor / Active flags.
  - **Gallery** — the photo grid.
  - **Hours** — the per-court `WeeklyHoursEditor`, **lazy-mounted** (only fetches when the Hours tab is opened).
- Replaced the old "Set hours" collapsible (`hoursOpen` state removed) with a `tab` state.
- **Save / Delete** moved to a persistent footer under the tab content, so they're reachable from any tab (Save still writes name/description/rate/surface/flags/thumbnail/gallery in one `updateCourt` call; hours save through the hours editor's own button).

### Court Info thumbnail
- Fixed **112px square** (`h-28 w-28`) with a visible `--muted` border and an 8px corner radius — sized to sit alongside the Name + Rate/Surface fields without dead space, but a fixed size so it can't blow up.

### Gallery redesigned into a real gallery — `tabs/CourtsEditorTab.tsx`
- **Square grid**, **4 columns on mobile / 6 on tablet** (`grid-cols-4 sm:grid-cols-6`), uniform `aspect-square` rounded tiles (`object-cover`).
- **Tap to preview** — tapping any photo opens it **full-screen** in a lightbox (reused the club-feed `fixed inset-0 bg-black/90` pattern; tap backdrop or ✕ to close). New `lightbox` state on the court row.
- **Remove ✕** is now a ringed badge just *outside* the top-right corner, so it's never clipped by the tile's rounded corners (the earlier bug) and doesn't cover the image; scaled down to suit the smaller tiles.
- **Empty state** — a single inviting dashed "Add photos" drop-zone (camera icon) instead of a lone "+" square; the in-grid "+" add tile remains, capped at `MAX_GALLERY` (8).

### Hours-pricing layout fixed — `components/WeeklyHoursEditor.tsx`
- **"Add hour pricing"** is now a single full-width button **anchored at the bottom** of the Hours pricing card (was attached to the first row).
- Each priced window is a **no-wrap row**: the two time inputs `flex-1 min-w-0` to fill the width while the ₱rate and **✕ stay pinned inline** at the end — so on the narrow frame the ✕ no longer wraps onto its own line.
- Validation message moved to its own line **below** the row (replaces the old `basis-full` wrap trick).
- The first (base) window mirrors the day's hours and stays non-removable; it gets an invisible spacer the width of the ✕ so all rows' columns stay aligned.

## 3. Permissions / `/lists` / FILEMAP
- **None.** All changes are presentational reorganisation within files that already own these responsibilities — no new screen, permission, API route, `/lists`, or FILEMAP change. Reuses the existing `owner.venues.manage` gate.

## 4. Verification
- `npx tsc --noEmit` and scoped ESLint (`CourtsEditorTab.tsx`, `WeeklyHoursEditor.tsx`) both clean.
- Iterated live against the dev server (HMR) with the owner editor open on a venue's Courts tab.
- **QA pending:** not yet browser-clicked end-to-end (lightbox open/close, gallery add/remove, hours-pricing add/remove across breakpoints).

## 5. Commit status
- **In working tree (pending commit):** `app/src/features/owner/tabs/CourtsEditorTab.tsx`, `app/src/features/owner/components/WeeklyHoursEditor.tsx`. Continues the uncommitted owner-venue work noted in `2026-06-24-Ivan-owner-venue-tools.md` §5.
