# Create Game → Lobby → Venue Vote Flow

Status: **built (2026-06-05)** — see "What shipped" at the bottom. This is the
*players-first, then vote-on-a-venue*
variant of creating a game. It is **distinct from** [`book-court-flow.md`](book-court-flow.md),
which is *venue-first* (host picks a court, then opens a lobby on that fixed slot).
Here the host does **not** pick a venue up front — the group fills first, the
system suggests venues, and the lobby **votes**. Both can coexist as two ways to
start a game; this doc only covers the vote variant.

Source: hand-drawn flow on paper (2026-06-05) + follow-up clarifications.

## The flow (as designed)

```
Create game
   ↓
Choose schedule + location range          ← host sets WHEN + a geographic RANGE
   ↓                                          (not a specific venue)
Game created
   ↓
Wait for other players within range        ← players inside the range can join
   ↓
Lobby full                                  ← capacity reached
   ↓
Host searches venue → system displays a    ← suggestions computed from
  SUGGESTION LIST                              schedule + range (+ lobby size)
   ↓
Host creates the joiners / voters pool      ← the lobby members become voters
   ↓
Joiners VOTE for venue                       ← ★ lobby is FROZEN here ★
   ↓                                            no payment until a MAJORITY
   (majority reached)                           agrees on one venue
   ↓
Payment
   ↓
Venue / court booked
```

### Clarified rules

- **The lobby blocks before payment.** Nothing is charged and no court is held
  until the joiners reach a **majority vote** on a single venue. The freeze is
  intentional — it is the heart of this flow.
- The hand-drawn "Choose Court / Schedule … create game → if …" side-branch and
  the "No → refund" branch are **out of scope for this doc** (handled elsewhere;
  refunds belong with the payment/cancellation design in `book-court-flow.md`).

### Stage → state mapping

| Stage | Game status | What's locked |
|---|---|---|
| Game created, filling | `published` | nothing — players join/leave freely |
| Lobby full | `full` | joining closed; venue not chosen |
| Voting | `voting` | **frozen**: no payment, awaiting majority |
| Majority reached | `vote_won` | the winning venue is selected |
| Paying | `paying` | (live-payment mode) booking pending payment |
| Booked | `booked` | court reserved; game confirmed |

(The filling state reuses the existing `published` status so the classic
browse/list filters keep working unchanged.)

## Holes in the plan (must be resolved before/while building)

These are the gaps found when stress-testing the flow. Ordered by how early they
bite.

1. **The vote can deadlock — "majority" is not guaranteed.** With 4 players and
   3+ suggestions, votes can split 1/1/1/1 or 2/2 with **no majority ever**. The
   lobby would freeze forever — the exact failure this design risks. Needs a
   resolution rule:
   - a **vote deadline / timer** ("closes in N min, highest count wins"), and
   - a **tie-breaker** (host's vote breaks ties, or cheapest / earliest-available
     venue wins), and
   - a precise definition of *majority* — of **joined** players or of **those who
     voted**? A non-voter must not be able to block the threshold indefinitely.

2. **The lobby may never fill.** The whole flow is gated on "lobby full." If too
   few players join within range, the game is a dead end. Needs: a **min-players**
   threshold, plus a **"start anyway / cancel / expire"** path (and who can
   trigger it — host? auto-expire at the schedule time?).

3. **Venue availability is live, but suggestions/vote happen later.** Time passes
   between "lobby full → suggest → vote → pay." A suggested court can be **booked
   by someone else** during the freeze, so the voted-on venue may be **gone at
   payment time**. Needs either a **tentative hold** on top candidates during
   voting, or **re-validation at payment** with a graceful fall-back to the next
   option. (This is the same "bump" problem `book-court-flow.md` solves with a
   tentative-hold → divisor-lock ladder — reuse that thinking.)

4. **Group payment is not one step.** "Vote → payment → booked" hides a fan-out:
   does **everyone pay a split**, or does the **host pay** and reconcile? If
   splitting, **what if 3 of 4 pay and one ghosts?** Needs **all-or-nothing
   escrow** (collect all shares → only then book → otherwise release everything)
   and a **pay deadline**. (`book-court-flow.md` already specifies this; this flow
   should reuse the same payment/escrow model.)

5. **The host is a single point of failure.** "Host searches venue," "host
   creates pool" are host-only. If the **host leaves / goes offline** mid-flow the
   lobby stalls. Needs host-reassignment or auto-cancel.

6. **Can players leave once frozen?** If a player leaves during voting, the lobby
   drops below full. Do we reopen joining, recompute the majority threshold, and
   restart/continue the vote? Either answer is acceptable but must be decided —
   otherwise the majority math is undefined mid-vote.

7. **Suggestions can go stale.** The list is generated once when the host
   searches. If voting drags on, an option may already be gone (see #3). Decide:
   refresh suggestions live, or lock the candidate set at generation time.

**The single most important hole:** #1 combined with the intentional freeze.
"Stuck until majority" becomes "stuck forever" without a timeout + tie-breaker +
a precise majority definition. Nail this down first.

---

# Implementation plan — app/ (Create Game from the tab bar)

This is the **Create Game** action wired to the tab bar (`TabBar.onCreate` →
`navigate('create-game')`, see [app/src/App.tsx](../app/src/App.tsx) and
[CreateGameScreen.tsx](../app/src/features/games/CreateGameScreen.tsx)).

> ⚠️ This flow **changes** what "create a game" means today. The current
> [CreateGameScreen](../app/src/features/games/CreateGameScreen.tsx) makes the
> host pick a **specific venue** at creation (step 3 court picker). In the vote
> flow the venue is chosen **later, by vote** — so creation collects a
> **location range** instead. Plan for a deliberate rework, not an add-on.

## What already exists (reuse, don't rebuild)

- **CreateGameScreen** — a 3-step wizard (type/skill/name · when/time/duration ·
  court+spots+visibility) that already does geolocation, a venue map/list picker,
  and `createGame()`. The when/time/duration + spots + visibility steps carry over
  almost unchanged; the **court picker step is replaced by a location-range step**.
- **api `games` slice** — `games.model.ts` / `.controller.ts` / `.routes.ts` with
  `create/list/get/join/leave`, capacity + `participantIds`, and a
  `published|full|cancelled` status. Extend this; don't fork it.
- **Booking + payment** — `api` `bookings/` + `payments/` (Payment, VenuePricing,
  `POST /payments/checkout`, server `paymentTestMode`) and the app
  `features/bookings/` slice. The vote flow's **payment + booking step reuses
  these** rather than inventing a new path.
- **Venue suggestion inputs** — `listAllVenues()` + `shared/lib/geo.ts`
  (`haversineKm`, `getCurrentLocation`) + `venueCoords` already power
  nearest-venue ranking in CreateGame. The suggestion list is the same math
  filtered by the game's range (and, later, availability).

## Backend changes (api/ — shared, in-scope)

1. **Extend `games.model.ts`** with the lobby + vote fields:
   - `locationCenter: { lat, lng }` and `rangeKm` (the host's chosen range).
   - `minPlayers` (for hole #2) alongside existing `capacity`.
   - status ladder: extend the `status` enum to
     `open | full | voting | vote_won | paying | booked | cancelled`.
   - `candidateVenueIds: ObjectId[]` (the suggestion list snapshot — hole #7).
   - `votes: [{ userId, venueId }]` (one current vote per user).
   - `voteDeadline: Date` and `winningVenueId` (holes #1).
   - `bookingId` (link to the `bookings` doc once booked).
2. **New routes** (update `listEndpoints()` in `root.controller.ts` + restart PM2):
   - `GET  /games/:id/venue-suggestions` — compute venues within range + schedule,
     return ranked candidates (snapshot into `candidateVenueIds` when the host
     opens voting).
   - `POST /games/:id/open-vote` (host only) — `full → voting`, set
     `candidateVenueIds` + `voteDeadline`.
   - `POST /games/:id/vote` — `{ venueId }`; upsert the caller's vote; if a
     **majority** (define: > half of `participantIds`) is reached, set
     `winningVenueId` + move to `vote_won`.
   - `POST /games/:id/resolve-vote` — tie-breaker / deadline resolution (highest
     count, host vote breaks ties) — callable by host or by a scheduled check.
   - Payment: reuse `POST /payments/checkout` against the winning venue to create
     the `booking` and flip `vote_won → paying → booked`.
3. **Resolve the holes in code**, not just docs: enforce `minPlayers` before
   `open-vote`; compute majority over joined players; honor `voteDeadline`;
   re-validate venue availability at checkout (hole #3) and fall back to the next
   candidate or reopen the vote.

## App changes (app/)

1. **Rework `CreateGameScreen`** — replace the step-3 court picker with a
   **"Schedule + location range"** step: keep the existing map + `getCurrentLocation`,
   but the host drops a **center pin + radius** (reuse the radius-slider pattern
   from `features/venues/NearbyFilterSheet` / `venueFilters.ts`) instead of
   selecting one venue. `createGame()` now sends `locationCenter` + `rangeKm`
   (+ `minPlayers`) and **no `venueId`**. Update `api.ts` `createGame` types.
2. **New `GameLobbyScreen`** (`features/games/GameLobbyScreen.tsx`) — the
   state-machine surface the host and joiners share after creation. Renders by
   status:
   - `open` — roster + "waiting for players within range" + spots-left.
   - `full` — host sees a **"Find venues"** CTA (calls `venue-suggestions` then
     `open-vote`); joiners see "host is picking venues."
   - `voting` — the **suggestion list with vote controls** + a live tally + the
     countdown to `voteDeadline` (★ the frozen state). Reuse the venue
     card/map presentation from CreateGame's picker.
   - `vote_won` → `paying` — the **payment step**, reusing the
     `features/bookings/` checkout (split-aware; see hole #4) — or, for v1, host
     pays via the existing `BookCourtScreen` path against `winningVenueId`.
   - `booked` — confirmation (reuse `CompletionScreen`) + link to the booking.
3. **Navigation** — add `{ id: 'game-lobby'; params: { id: string } }` to the
   `Screen` union in [navigation.ts](../app/src/shared/lib/navigation.ts) and a
   `case` in `App.tsx`'s `renderScreen()`. After `createGame()` succeeds, route to
   `game-lobby` (today it goes to a "Game posted!" `CompletionScreen` →
   `game-details`; keep `game-details` for browsing, use `game-lobby` for the
   active flow). The Games tab's "my games" entries deep-link into `game-lobby`
   when a game is in an active lobby state.
4. **Display helpers** — extend `features/games/gameDisplay.ts` for the new
   statuses (label, vote tally, time-left), keeping formatters next to the screens
   per the FILEMAP convention.

## Permissions (per AGENTS.md — gate every new feature)

Add and sync across the three copies (`api/src/shared/lib/permissions.ts`,
`web/src/features/auth/permissions.js`, `app/src/shared/lib/permissions.ts`),
plus `PERMISSION_CATALOGUE` + `ROLE_PERMISSIONS` defaults, then grant on the live
DB via the admin Roles & permissions page:

- `player.games.vote` — cast a venue vote in a lobby (granted to `player`).
- Creating still uses the existing `player.games.create`. Opening the vote is a
  host capability covered by `create` (the creator) — no new owner perm needed.
- Gate the vote route with `hasPermission(user, 'player.games.vote')` and the
  vote UI with `userHasPermission`.

## Required doc/catalogue updates (don't skip — treated like tests)

- **`app/FILEMAP.md`** — add `GameLobbyScreen` to the `games/` slice line.
- **`api/FILEMAP.md`** — note the games slice now owns the lobby/vote/booking
  lifecycle.
- **`/lists`** — add every new `games` route in `listEndpoints()`, restart
  `pickleballer-api` (PM2).
- **Roadmap** — `web/src/features/marketing/RoadmapPage.jsx`: bump `Last updated`
  + prepend a Change Log entry.

## Suggested build order

1. api model + `venue-suggestions` + `open-vote` + `vote` + `resolve-vote`
   (with majority/deadline/tie-breaker — holes #1, #2, #6).
2. app: rework CreateGame to range-based; wire `createGame` payload.
3. app: `GameLobbyScreen` states `published` → `full` → `voting` (the vote UX).
4. Payment + booking reusing `bookings`/`payments` (holes #3, #4); `booked`
   confirmation.
5. Permissions, FILEMAP×2, `/lists`, roadmap.

---

# What shipped (2026-06-05)

End-to-end vote flow is live and smoke-tested (create → suggestions → open-vote
→ vote×N → majority → book → booked, plus the guards).

**api/** — extended the `games` slice (no new feature dir):
- `games.model.ts`: `locationCenter`/`rangeKm`/`minPlayers`, the status ladder
  (`published|full|voting|vote_won|paying|booked|cancelled`), `candidateVenueIds`,
  `votes[]`, `voteDeadline`, `winningVenueId`, `bookingId`.
- `games.controller.ts` + `.routes.ts`: `GET :id/venue-suggestions`,
  `POST :id/open-vote`, `POST :id/vote`, `POST :id/resolve-vote`,
  `POST :id/book`. `book` mirrors `payments/checkout` test-mode (creates a
  completed Payment + confirmed Booking, flips to `booked`; live mode → `paying`).
- `/lists` updated; `pickleballer-api` restarted.

**app/** — `CreateGameScreen` step 3 reworked to a center-pin + range UI (no
fixed venue); new `GameLobbyScreen` (status-driven lobby with the frozen vote +
countdown + tally); `gameDisplay.ts` vote helpers; `navigation.ts` + `App.tsx`
`game-lobby` route; `GamesScreen` deep-links vote-flow games to the lobby.

**Permission** — `player.games.vote` added to all three synced copies +
`PERMISSION_CATALOGUE` + role defaults, **and granted on the live DB** (login
computes the JWT permissions from code `ROLE_PERMISSIONS`, so an API restart is
what actually activates it; the Mongo `roles` update keeps the DB in sync too).

### Decisions taken on the open holes

- **#1 deadlock** — majority = `floor(players/2)+1`. An outright majority
  resolves immediately; otherwise the **30-min default deadline** (host can pass
  `deadlineMinutes`) forces resolution, with the **host's vote → cheapest →
  ballot order** breaking ties. Host can also **close the vote early**.
- **#2 never fills** — `minPlayers` (default 2) gates `open-vote` (`TOO_FEW`).
  Full auto-expire/cancel is still TODO.
- **#6 leave mid-vote** — leaving drops the voter's ballot; if the lobby falls
  below `minPlayers` during `voting` it reverts to `published` (vote reset).
- **#4 group payment** — v1 is **host-pays** through the **full book-a-court
  flow**: the lobby's "Book" CTA opens `BookCourtScreen` for the winning venue
  (court locked), **pre-filled with the game's date + time**, and runs the normal
  pick → review → checkout. The resulting booking is attached back to the game
  (`POST /games/:id/book { bookingId }`), flipping it to `booked` (or `paying` if
  the gateway leaves it pending). Per-player split escrow is still TODO and shares
  the model in `book-court-flow.md`.

### Host edit / delete (shipped 2026-06-05)

The host can **edit** a game (reusing the create wizard, pre-filled — `PATCH
/games/:id`, editable only while `published`/`full`, capacity can't drop below
current players) and **delete** it (`DELETE /games/:id`, blocked once a court is
booked so the Booking + Payment aren't orphaned). Both are host-only +
`player.games.manage`. A **My games** screen (Profile → "My games") lists the
games you created with status + edit/delete actions.

### Still TODO

- Tentative venue **holds during voting** + availability re-validation at book
  time (hole #3); suggestion **staleness refresh** (hole #7).
- **Split-payment escrow** across all joiners (hole #4).
- Host **reassignment / auto-cancel** if the host goes offline (hole #5).
- Server-side **range gate on join** (today range only drives suggestions; the
  app filters discovery).
- **Venue coordinates**: only ~1 of 180 seeded venues has lat/lng, so distance
  ranking is mostly moot — `suggestVenues` therefore includes all venues (in-range
  by distance first, then priced) so the ballot always has real choices. Backfill
  venue lat/lng to make range-based ranking meaningful.
- **Cancel** (soft) for booked games, so a host can withdraw a game that already
  reserved a court (currently delete is blocked for those).
</content>
</invoke>
