# Ivan — Filters now persist across Open Play / Events tabs (22 July 2026)
**Task C, Item 6 of 7: "Filters don't persist across Open Play / Events"**
**Status: ✅ DONE (persisted) — switching tabs no longer resets filters**

## What was wrong
`GamesScreenV2.tsx` `selectSection()` (the handler for the Open Play / Events tab
switch) explicitly called `setFilters(makeDefaultGameFilters())` — wiping every
filter the moment the user tapped the other tab. The comment in the code gave
the rationale: *"The two sections offer different play types (Events has no open
play), so a carried-over type filter could strand the user on a guaranteed-empty
list. Distance is cleared too."* The search query was already deliberately
preserved (line 445-446), so search survived a switch — but filters did not.

Report wording: *"Switching tabs wipes them; filters themselves work."*

## What was done
Removed the `setFilters(makeDefaultGameFilters())` call from `selectSection()`:

```
- setFilters(makeDefaultGameFilters());
```

The comment was updated to explain that the empty state already handles the
carried-over edge case: `DiscoverFeed` renders `"No plays match your search and
filters."` with a **"Clear search & filters"** button when `narrowedByControls`
is true and the filtered list is empty — so a filter that yields nothing in the
other section can't strand the user. The filter button simultaneously badges the
active filter count, so the cause is visible.

The search query (`q`/`setSearch`) was already preserved — no change needed there.

## Files changed
- `app/src/features/games/v2/GamesScreenV2.tsx` — `selectSection()` no longer
  resets filters on tab switch

Logic-only: no new screen, permission, API/route, or model change. FILEMAP
unchanged.

## Verification
- `npx tsc --noEmit`: **0 errors** in the file
- In the running PWA (Vite dev / HMR): picking "Open Play", setting filters,
  tapping "Events" → filters carry over intact; tapping back → still set
- The file's lint errors are pre-existing and unrelated

## Related
- Task C is now **7 of 7 done** — all Ivan items complete
- Kenneth's `team-split.html` lane C — marked Done in the same pass
