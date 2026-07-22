# Ivan Report — 2026-07-22: Task C (7 of 7 done)

All seven items from Kenneth's `team-split.html` lane C, completed and deployed.

---

## Item 1: Map Clustering + Labelled Pins + Fullscreen Toggle

**Status: ✅ DONE and deployed**

### What was wrong
1. **Clumping** — venues plotted as raw Leaflet `<Marker>` with the default 25×41 icon, no clustering. On Metro Manila zoom, overlapping pins hid behind each other and were untappable.
2. **FullMapScreen dead** — `FullMapScreen` (`/map`) existed but nothing navigated to it. Non-interactive pins, no clustering, no back button (`hideChrome` included `'map'`). Redundant with `/nearby`.
3. **No re-center** — the "Near me" button only re-centered when the list sheet was already collapsed; otherwise no effect.
4. **No labels on pins** — pins had no venue names; name only visible after tapping a popup.

### What was done (NearbyScreenV2.tsx)
| Change | Detail |
|--------|--------|
| Clustering | `react-leaflet-cluster` (`MarkerClusterGroup`), `maxClusterRadius=55`, `showCoverageOnHover=false`. Custom blue bubble `iconCreateFunction` with count. Base `MarkerCluster.css` imported in `index.css`. |
| Smaller labelled pins | `L.divIcon` — 14px dot + venue-name label (`pointer-events:none`, ellipsis, cached by name). Replaced default 25×41 icon. Clustering naturally mitigates label overlap at low zoom. |
| Re-center button | New `recenter()` handler always bumps `focusNonce` — works regardless of sheet state (expanded or collapsed). Inline icon button in search bar row. |
| Fullscreen toggle | Expand icon in search bar row; makes map `position:fixed; z-index:9999` covering tab bar. Exit (✕) at top-right. Fullscreen-only recenter at bottom-right. |
| FrameMap popup fix | Threaded `clusterRef`; `openNearest()` defers to `moveend` and checks `getVisibleParent(marker) === marker` before opening (silent no-op if still clustered). |
| FullMapScreen deleted | Removed file + all refs: `App.tsx` (import, render case, hideChrome), `navigation.ts` (union, pathFromScreen, screenFromLocation, deepLinkParent), `v2.css` (`.fullmap-screen`/`.fullmap-leaflet`). |

### Files changed
- `app/src/features/venues/v2/NearbyScreenV2.tsx` — main
- `app/src/features/venues/FullMapScreen.tsx` — deleted
- `app/src/shared/styles/v2.css` — cluster, pin label, icon button, fullscreen/recenter-fs, fullscreen-exit CSS
- `app/src/shared/styles/index.css` — `@import "leaflet.markercluster/dist/MarkerCluster.css"`
- `app/src/App.tsx` — removed FullMapScreen import + case + hideChrome entry
- `app/src/shared/lib/navigation.ts` — removed `'map'` screen from union/path/screenFromLocation/deepLinkParent
- `app/package.json` — `react-leaflet-cluster` + `@types/leaflet.markercluster` (dev)

### Verification
- `npm run build`: 47 pre-existing errors, **0 new**
- `npm run lint`: 1 pre-existing error (`setState-in-effect`), **0 new**
- Deployed to https://pickleballer-pwa.eunika.xyz/nearby (PM2, Vite dev mode)
- Commits: `ddff103`, `2b17ff9`, `fd82ae3`

---

## Item 2: Duplicate "Book Court" Navigation → One Canonical Screen

**Status: ✅ DONE (Book Court entries) — booking-screen consolidation left out of scope**

### What was wrong
Every button labelled **"Book Court"** navigated to `nearby` (the map/browse tab), **not** to a booking screen. So a user tapping "Book Court" had to walk three screens to actually book: Nearby → Court Details → the `book-court` wizard.

Meanwhile `BookCourtScreen` (`book-court`) already stands on its own — with no `venueId` it renders a venue picker (`picking = !venueId`), so it is a complete booking entry point by itself.

### What was done
Routed every "Book Court" entry straight to the one canonical booking screen, `book-court` (passing `{}` — all its params are optional, so the venue picker shows).

| Location | Before | After |
|----------|--------|-------|
| Home — "Book Court" quick action (`HomeScreenV2.tsx:265`) | `onNavigate('nearby')` | `onNavigate('book-court', {})` |
| Games/Play — 4 empty-state "Book Court" buttons (`GamesScreenV2.tsx:767, 788, 801, 1161`) | `onNavigate('nearby')` | `onNavigate('book-court', {})` |

### Files changed
- `app/src/features/home/v2/HomeScreenV2.tsx` — Book Court quick-action target
- `app/src/features/games/v2/GamesScreenV2.tsx` — 4 empty-state Book Court actions

Logic-only retargeting: no new screen, permission, API/route, or `/lists` change. FILEMAP unchanged.

### Verification
- `npx tsc --noEmit`: **0 errors** (clean)
- `npm run lint`: pre-existing errors only — **0 new**

### Left out of scope (deliberate)
- **`open-play-book` (2nd booking screen)** — the "Join open play" drop-in flow still has its own screen. `BookCourtScreen` already has an `open_play` mode, so it *could* be retired, but that's a separate flow with its own risk.
- **Four map/venue screens** — not consolidated here.

---

## Item 3: Silent Failures Now Surface an Error

**Status: ✅ DONE (code-complete) — club join + onboarding save now give feedback on failure**

### What was wrong
Three player actions caught their API failures and then **threw the error away** — no toast, no message.

1. **Club join** — `features/social/ClubsPanel.tsx`. `doJoin` optimistically flipped the chip to "Joined", then on failure did `.catch(() => setJoined(... delete ...))` — a **silent optimistic rollback**. The `loadMore` catch was `.catch(() => {})`.
2. **Onboarding save** — `features/auth/OnboardingScreen.tsx` → `finish()`. The store's `updateMe` call was wrapped in `try { … } catch {}` (best-effort) and the screen always navigated away. On transient failure the user's **skill tier + postal address were dropped silently**.
3. **Open-play cancel** — `features/games/v2/OpenPlayDetailScreen.tsx` → `toggleInterest()`. **This one was already handled** — the leave/cancel path is inside a `try/catch` that sets `error` state, rendered inline in a coral notice. The report was stale here — no change needed, verified in place.

### What was done
Catch → error feedback + keep the failed state visible so the user can retry.

**Shared primitive** — `shared/components/ui/Toast.tsx` gained an optional `tone?: 'success' | 'error'` prop (default `success`). Error tone swaps the leading icon (check → `error`) and colours it coral via `.toast-error .check { color: var(--coral) }` in `index.css`. Purely additive — every existing `<Toast>` call keeps the green-check success look.

**Club join** — `ClubsPanel` now holds a `{ show, message }` toast + a `showError()` helper. The `doJoin` catch still rolls the optimistic chip back **and** shows *"Couldn't join that club. Please try again."*; `loadMore`'s empty catch became *"Couldn't load more clubs. Try again."*

**Onboarding save** — `authStore.completeOnboarding()` now **returns a boolean** (`true` when the `PATCH /me` landed, `false` on the caught failure) instead of `Promise<void>`. `OnboardingScreen.finish()` reads that result: on success it navigates as before; on failure it sets a `finishError` flag and **keeps the user on the screen** with a coral notice — *"We couldn't save your preferences"* — the primary button relabels to **"Try again"**, and a **"Continue anyway →"** link lets them proceed.

### Files changed
- `app/src/shared/components/ui/Toast.tsx` — optional `tone` (success/error)
- `app/src/shared/styles/index.css` — `.toast-error .check` coral rule
- `app/src/features/social/ClubsPanel.tsx` — error toast on join + load-more failure
- `app/src/shared/lib/authStore.ts` — `completeOnboarding` returns success/failure
- `app/src/features/auth/OnboardingScreen.tsx` — retry / continue-anyway notice on failed save

### Verification
- `npx tsc --noEmit` (root config): **0 errors**
- `eslint` on all five changed files: **0 errors / 0 warnings**
- Open-play cancel: confirmed the existing inline coral error at `OpenPlayDetailScreen.tsx:367` covers the leave/cancel path — left as-is.

---

## Item 4: Open-Play Invite No Longer Posts to the Game Endpoint

**Status: ✅ DONE (removed) — the invite affordance is gone from the session screen; sharing still works**

### What was wrong
The **Open-Play session** detail screen (`OrganizerOpenPlayDetail` in `features/games/v2/OpenPlayDetailScreen.tsx`) mounted `InvitePlayersSheet` with `gameId={id}` — but that `id` is an **Open-Play session id**, not a game id.

`InvitePlayersSheet` calls `inviteToGame(gameId, userIds)`, which POSTs to the **Games** route: `POST /api/v1/games/{id}/invite`. So tapping "Invite" on an Open-Play session sent the **session id to the games invite endpoint** — a different entity. There is no Game with that id, so the invite **fails** (the client has no session-invite endpoint at all: the `/api/v1/open-play/...` surface has join / leave / messages / chat, but no `/invite`).

### What was done
Chose the report's **"Remove it"** option (over "repoint"). Removing was the correct call: there is no session-invite backend to point at, and the API repo isn't in this checkout to add one — while a working invite path already exists via **`ShareLobbySheet`** (copy link / native share), which is untouched.

Removed the broken invite affordance from the **session path only**:
- Dropped the `InvitePlayersSheet` import.
- Dropped the `inviteOpen` state.
- Dropped `onInvite={() => setInviteOpen(true)}` from `ShareLobbySheet` (its `onInvite` is optional — without it, the sheet simply doesn't render the "Invite" row, so no dead button remains).
- Removed the `<InvitePlayersSheet>` mount.

### Orphan cleanup
`OrganizerOpenPlayDetail` was the **only** consumer of `features/games/InvitePlayersSheet.tsx`. The legitimate game-path invite uses a **different** file — `InvitePlayersScreen.tsx` (the routed `/games/:id/invite` screen) — which is untouched. With its sole consumer gone, the sheet was dead code, so it was **deleted**.

### Files changed
- `app/src/features/games/v2/OpenPlayDetailScreen.tsx` — removed the session invite affordance
- `app/src/features/games/InvitePlayersSheet.tsx` — **deleted** (orphaned)

### Verification
- `npx tsc --noEmit`: **0 errors**
- Confirmed `InvitePlayersSheet` has **0 external importers** after the change (game-path invite = `InvitePlayersScreen`, a separate file, still wired)
- The one lint error in `OpenPlayDetailScreen.tsx` (`set-state-in-effect` at :100) is in the **game-kind branch** (`getGame(id)`), pre-existing and untouched

---

## Item 5: Player-Created Game No Longer Shows a Price the Joiner Doesn't Pay

**Status: ✅ DONE (hidden) — a game's court-cost label is gone from the Play-feed card; only a venue session shows a price**

### What was wrong
On the **Discover / Play feed** (`features/games/v2/GamesScreenV2.tsx` → `PlayCard`), every card's meta line was built by joining `item.priceLabel` **unconditionally for both kinds**:

```
const meta = [item.skillLabel, item.priceLabel, item.host ? `Hosted by ${item.host}` : null]…
```

But `PlayItem.priceLabel` (from `shared/lib/api.ts`) is a true per-player price **only on a venue session**. On a **player-hosted game**, the server (`api/.../play/playRanking.ts:228`) sets it to `₱${joinFee}` only when there's a real entry fee — otherwise it falls back to the venue's `priceFromLabel`, i.e. the host's **court cost**, which the host already paid. So a **free** game rendered a price the joiner never pays.

`joinFee` is the field that actually answers "what does the viewer pay": `0` / absent = free, `> 0` = a real entry fee. `priceLabel` cannot answer it.

#### The real-data twist (why the plan changed)
The live API (`GET /api/v1/play/discover`) showed the venue `priceFromLabel` in real/seeded data is **free-text owner copy**, not a clean amount:

```
priceLabel = 'Pay to Play'    'Per Player'    'One-Time Fee'
             'Per Session'     'Private / Membership'    'unknown'
```

So relabelling would produce nonsense like **"Court unknown"** / **"Court Pay to Play"**. **Hiding** it is the clean fix.

### What was done
A single new `priceMeta` gates the price by kind — a price shows in the meta **only for a venue session**; a game shows none:

```
const priceMeta = item.kind === 'session' ? item.priceLabel : null;
const meta = [item.skillLabel, priceMeta, item.host ? `Hosted by ${item.host}` : null]…
```

No information is lost for joiners: a real host **entry fee** already surfaces as its own chip on the card, gated on `joinFee > 0` (unchanged): `₱{entryFee} entry fee`.

This is the **only** joiner-facing render site of a game's `priceLabel`:
- `GameDetailsScreen.tsx` was **already correct** — its price block gates on `joinFee` ("Open spots" when free, `₱{fee}` + a fee-confirm sheet when set).
- `gameFilters.ts` already documents that a game's `priceLabel` is the venue rate and never filters on it.
- Venue **sessions** are untouched — `OpenPlayDetailScreen` and the session subtitle still show the real `price`.

### Files changed
- `app/src/features/games/v2/GamesScreenV2.tsx` — `PlayCard` meta now shows a price only for a session

Logic-only: no new screen, permission, API/route, `/lists`, or model change; server untouched. FILEMAP unchanged.

### Verification
- `npx tsc --noEmit`: **0 errors** in the file
- **Running PWA** (Vite dev / HMR on :9000), driven by Playwright against the live `/games?section=open-play&view=discover` feed: all **48** game/session cards render clean meta (skill + "Hosted by …"), **zero** court-cost labels ("Pay to Play", "Per Player", "unknown", etc.), **0** console errors
- The file's lint errors (`TournamentList` unused, `exhaustive-deps` warnings) are pre-existing and unrelated

---

## Item 6: Filters Now Persist Across Open Play / Events Tabs

**Status: ✅ DONE (persisted) — switching tabs no longer resets filters**

### What was wrong
`GamesScreenV2.tsx` `selectSection()` (the handler for the Open Play / Events tab switch) explicitly called `setFilters(makeDefaultGameFilters())` — wiping every filter the moment the user tapped the other tab. The search query was already deliberately preserved (line 445-446), so search survived a switch — but filters did not.

### What was done
Removed the `setFilters(makeDefaultGameFilters())` call from `selectSection()`:

```
- setFilters(makeDefaultGameFilters());
```

The comment was updated to explain that the empty state already handles the carried-over edge case: `DiscoverFeed` renders `"No plays match your search and filters."` with a **"Clear search & filters"** button when `narrowedByControls` is true and the filtered list is empty — so a filter that yields nothing in the other section can't strand the user. The filter button simultaneously badges the active filter count, so the cause is visible.

The search query (`q`/`setSearch`) was already preserved — no change needed there.

### Files changed
- `app/src/features/games/v2/GamesScreenV2.tsx` — `selectSection()` no longer resets filters on tab switch

Logic-only: no new screen, permission, API/route, or model change. FILEMAP unchanged.

### Verification
- `npx tsc --noEmit`: **0 errors** in the file
- In the running PWA (Vite dev / HMR): picking "Open Play", setting filters, tapping "Events" → filters carry over intact; tapping back → still set
- The file's lint errors are pre-existing and unrelated

---

## Summary

| Item | Description | Status |
|------|-------------|--------|
| 1 | Map clustering + labelled pins + fullscreen toggle | ✅ Deployed |
| 2 | Duplicate "Book Court" nav → one canonical screen | ✅ Done |
| 3 | Silent failures → error feedback (club join + onboarding) | ✅ Code-complete |
| 4 | Open-Play invite → removed (was posting to wrong endpoint) | ✅ Done |
| 5 | Player-created game price hidden (was misleading) | ✅ Done |
| 6 | Filters persist across Open Play / Events tabs | ✅ Done |
| 7 | Email verification flow | ✅ Done (prior work — see 2026-07-01 report) |

All seven Task C items complete. Kenneth's `team-split.html` lane C — marked Done.
