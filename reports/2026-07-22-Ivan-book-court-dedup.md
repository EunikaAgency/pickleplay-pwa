# Ivan — Duplicate "Book Court" navigation routed to one canonical screen (22 July 2026)
**Task C, Item 2 of 7: "Duplicate 'Book Court' navigation"**
**Status: ✅ DONE (Book Court entries) — booking-screen consolidation left out of scope, see below**

## What was wrong
Every button literally labelled **"Book Court"** navigated to `nearby` (the map/browse
tab), **not** to a booking screen. So a user tapping "Book Court" had to walk three
screens to actually book: Nearby → Court Details → the `book-court` wizard. The report
called this out as *"Home & Nearby land on the same one."*

Meanwhile `BookCourtScreen` (`book-court`) already stands on its own — with no `venueId`
it renders a venue picker (`picking = !venueId`), so it is a complete booking entry point
by itself. The "Book Court" buttons just weren't pointed at it.

## What was done
Routed every "Book Court" entry straight to the one canonical booking screen, `book-court`
(passing `{}` — all its params are optional, so the venue picker shows).

| Location | Before | After |
|----------|--------|-------|
| Home — "Book Court" quick action (`HomeScreenV2.tsx:265`) | `onNavigate('nearby')` | `onNavigate('book-court', {})` |
| Games/Play — 4 empty-state "Book Court" buttons (`GamesScreenV2.tsx:767, 788, 801, 1161`) | `onNavigate('nearby')` | `onNavigate('book-court', {})` |

## Files changed
- `app/src/features/home/v2/HomeScreenV2.tsx` — Book Court quick-action target
- `app/src/features/games/v2/GamesScreenV2.tsx` — 4 empty-state Book Court actions

Logic-only retargeting: no new screen, permission, API/route, or `/lists` change.
FILEMAP unchanged (no responsibility shift).

## Verification
- `npx tsc --noEmit`: **0 errors** (clean)
- `npm run lint`: pre-existing errors only (`selectView` no-use-before-define at :457,
  `TournamentList` unused at :870, exhaustive-deps warnings) — **0 new**, none on the
  edited lines

## Left out of scope (deliberate)
The report card also mentions *"Four map/venue screens, two booking screens."* This fix
consolidates the **"Book Court" navigation** only. The deeper de-dup was NOT done:
- **`open-play-book` (2nd booking screen)** — the "Join open play" drop-in flow still has
  its own screen. `BookCourtScreen` already has an `open_play` mode, so it *could* be
  retired, but that's a separate flow (not a "Book Court" entry) with its own risk.
- **Four map/venue screens** — not consolidated here.

Both are bigger decisions; flag if they should be folded in.

## Related
- Task C, Item 1 done ([2026-07-22-Ivan-map-clustering.md](2026-07-22-Ivan-map-clustering.md)); Items 3–7 still open
- Kenneth's team-split.html lane C reference
