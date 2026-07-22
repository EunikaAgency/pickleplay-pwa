# Ivan — Player-created game no longer shows a price the joiner doesn't pay (22 July 2026)
**Task C, Item 5 of 7: "Player-created game shows a price the joiner doesn't pay"**
**Status: ✅ DONE (hidden) — a game's court-cost label is gone from the Play-feed card; only a venue session shows a price**

## What was wrong
On the **Discover / Play feed** (`features/games/v2/GamesScreenV2.tsx` →
`PlayCard`), every card's meta line was built by joining `item.priceLabel`
**unconditionally for both kinds**:

```
const meta = [item.skillLabel, item.priceLabel, item.host ? `Hosted by ${item.host}` : null]…
```

But `PlayItem.priceLabel` (from `shared/lib/api.ts`) is a true per-player price
**only on a venue session**. On a **player-hosted game**, the server
(`api/.../play/playRanking.ts:228`) sets it to `₱${joinFee}` only when there's a
real entry fee — otherwise it falls back to the venue's `priceFromLabel`, i.e.
the host's **court cost**, which the host already paid. So a **free** game
rendered a price the joiner never pays. Report wording: *"Reads like ₱350 to
join — live-demo hazard."*

`joinFee` is the field that actually answers "what does the viewer pay":
`0` / absent = free, `> 0` = a real entry fee. `priceLabel` cannot answer it.

### The real-data twist (why the plan changed)
The first instinct was the report's second option — **relabel** it as the
host's court cost, e.g. `Court ₱350`. But checking the live API
(`GET /api/v1/play/discover`) showed the venue `priceFromLabel` in real/seeded
data is **free-text owner copy**, not a clean amount:

```
priceLabel = 'Pay to Play'    'Per Player'    'One-Time Fee'
             'Per Session'     'Private / Membership'    'unknown'
```

So relabelling would produce nonsense like **"Court unknown"** / **"Court Pay
to Play"** — and "Pay to Play" on a *free* game is itself the most misleading
string. **Hiding** it is the clean fix.

## What was done
A single new `priceMeta` gates the price by kind — a price shows in the meta
**only for a venue session**; a game shows none:

```
const priceMeta = item.kind === 'session' ? item.priceLabel : null;
const meta = [item.skillLabel, priceMeta, item.host ? `Hosted by ${item.host}` : null]…
```

No information is lost for joiners: a real host **entry fee** already surfaces
as its own chip on the card, gated on `joinFee > 0` (unchanged):

```
₱{entryFee} entry fee
```

This is the **only** joiner-facing render site of a game's `priceLabel`:
- `GameDetailsScreen.tsx` was **already correct** — its price block gates on
  `joinFee` ("Open spots" when free, `₱{fee}` + a fee-confirm sheet when set).
- `gameFilters.ts` already documents that a game's `priceLabel` is the venue
  rate and never filters on it.
- Venue **sessions** are untouched — `OpenPlayDetailScreen` and the session
  subtitle still show the real `price`.

## Files changed
- `app/src/features/games/v2/GamesScreenV2.tsx` — `PlayCard` meta now shows a
  price only for a session (commits `74a6a40`, superseding the earlier
  relabel attempt `93ac191`)

Logic-only: no new screen, permission, API/route, `/lists`, or model change;
server untouched. FILEMAP unchanged.

## Verification
- `npx tsc --noEmit`: **0 errors** in the file
- **Running PWA** (Vite dev / HMR on :9000), driven by Playwright against the
  live `/games?section=open-play&view=discover` feed: all **48** game/session
  cards render clean meta (skill + "Hosted by …"), **zero** court-cost labels
  ("Pay to Play", "Per Player", "unknown", etc.), **0** console errors
- The file's lint errors (`TournamentList` unused, `exhaustive-deps` warnings)
  are pre-existing and unrelated

## Related
- Task C now **6 of 7 done**; only "Filters don't persist across Open Play /
  Events" remains
- Kenneth's `team-split.html` lane C — marked Done in the same pass
