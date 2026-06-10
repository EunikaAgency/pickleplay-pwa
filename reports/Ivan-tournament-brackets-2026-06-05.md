# Task Report — Organizer Tournament Brackets

- **Author:** Ivan
- **Date:** 2026-06-05
- **Area:** `api/` (backend) + `web/` (organizer console); `app/` permission sync only
- **Status:** ✅ Implemented & verified (backend end-to-end; web builds + flows verified via API)

---

## 1. Goal

Let organizers run a tournament's competition from start to finish: take the
registered players, build a seeded **bracket**, and play it out to a champion —
supporting the standard pickleball formats and both singles and doubles.

## 2. Scope decisions (from the requester)

- **Frontend:** web organizer console only. (`app/` PWA gets the synced
  permission string, no UI.)
- **Formats:** all four standard formats — single elimination, double
  elimination, round robin, pool play → single-elim playoff.
- **Entrants:** singles (1 player) and doubles (2-player pair) as one seedable unit.
- **Scoring:** per-game scores honouring the tournament's `bo1/bo3/bo5` +
  points-per-game; winner derived and auto-advanced.

## 3. What already existed (reused, not rebuilt)

- Tournament CRUD + registration + venue-approval workflow already lived in the
  API `content` feature (`Tournament`, `TournamentRegistration`).
- A production-ready web organizer console at `/organizer/*` (layout, sidebar,
  overview, tournament create/edit/detail). The bracket grafts into the existing
  tournament **detail** view as a new tab — no new route.

The genuinely missing piece (and the work here) was the **bracket engine,
models, API, and UI** — none existed before.

## 4. What was built

### Backend — new `api/src/features/brackets/` slice
- **`bracketEngine.ts`** — pure, DB-free engine: standard seeding (byes to top
  seeds), generation for all four formats, double-elim loser-drop + grand-final
  reset, result validation (best-of + win-by-2), winner/loser advancement with
  bye auto-resolution, and standings with tie-breakers.
- **`bracketEngine.test.ts`** — 34 unit tests (odd counts, byes, no-early-rematch
  invariant, grand-final reset, **match-key uniqueness**, score validation,
  champion detection).
- **`brackets.model.ts`** — `TournamentEntrant`, `Bracket` (one per tournament,
  `locked`/champion/pools snapshot), `BracketMatch` (one doc per match with
  advancement pointers).
- **`brackets.controller.ts` + `brackets.routes.ts`** — entrants build/seed/CRUD,
  bracket generate/get/clear, match result submit/clear, standings — all under
  `/api/v1/tournaments/:id/…`, gated by `organizer.brackets.manage`. Mounted in
  `routes/index.ts`; catalogued at `/lists`.

### Web — new `web/src/features/organizer/bracket/`
- **`bracketApi.js`** — thin wrappers over the new endpoints.
- **`BracketTab.jsx`** — orchestrator (no entrants → build/seed → generate →
  view + score).
- **`EntrantsManager.jsx`** — build from registrations (singles) / manual add
  (doubles pairs) + per-row seeds + auto-seed.
- **`BracketGenerator.jsx`** — pick format (defaults from the tournament) + pool
  options.
- **`BracketView.jsx`** — elimination trees with **real connector lines**,
  round-robin/pool standings tables + match lists, champion banner.
- **`MatchScoreDialog.jsx`** — per-game score entry / walkover.
- Wired an **Overview | Bracket** tab into `OrganizerTournament.jsx`.

### Permission + docs
- New `organizer.brackets.manage` synced across the three permission files +
  `PERMISSION_CATALOGUE` + role defaults + `SYSTEM_PERMISSION_BACKFILLS`.
- Updated `/lists`, `api/FILEMAP.md`, `web/FILEMAP.md`, `web/DONE.md`, and the
  public `RoadmapPage.jsx`.

## 5. Verification

- **Engine:** 34/34 unit tests pass; `tsc --noEmit` clean.
- **Live API smoke test** (against the dev API on :9002, as the tournament owner)
  drove all four formats: generate → play out → champion → tournament
  `completed`. Guards confirmed: regenerate-while-exists `409`, locked-after-score
  `409`, score-pending-match `409`, bad-score (no win-by-2) `400`,
  `<2`-entrants `409`.
- **Edit/undo flow** verified: score a match → clear it (next round not yet
  played) → slot un-advances, match back to `ready` → re-score; and the guard —
  clearing a match whose next round was already played returns `409`.
- **Web:** `npm run build` clean; the components call the exact endpoints/shapes
  proven server-side.

## 6. Post-build UX iterations (requester feedback)

1. **Bracket borders too faint** → crisp 2px state-coloured card borders
   (blue = ready, solid = completed, dashed = TBD).
2. **No vertical connector lines** → real elbow connectors (two feeders →
   vertical joiner → output) using a `flex-1` equal-height layout so geometry
   aligns; straight lines for double-elim "play-down" rounds.
3. **"hanggang game 3?" confusion** → dialog now reads "first to N games" and
   labels the conditional game "if needed"; once a side clinches it, the extra
   game auto-blanks/disables and is never submitted (kills the "too many games"
   error).
4. **Can't fix an accidental result** → completed matches are now clickable
   ("✎ Edit"); **Save changes** (clear + re-submit) or **Clear result** — allowed
   only while the next round is unplayed; clearing the sole result also unlocks
   the bracket.

## 7. Operational notes

- **Organizer** accounts receive `organizer.brackets.manage` automatically via
  the role backfill on API restart. The seeded **admin** role was frozen at
  first seed, so it needed a one-time manual grant on the live DB (done) — the
  documented "grant on live DB" step for any new permission.
- The Bracket tab only renders for a logged-in user holding the permission **and**
  owning the tournament; a token issued before the grant must re-login to pick
  it up.
- **Test data:** seeded 8 dummy singles entrants (Alex Rivera … Kai Mendoza) into
  the "Test" tournament (`id 6a2113967f547e006cc7cc8f`, owner
  `556b9e79.matthews@example.com` / `password123`) so the bracket flow can be
  tried hands-on.

## 8. Key files

| Layer | Path |
|---|---|
| Engine (pure, tested) | `api/src/features/brackets/bracketEngine.ts` (+ `.test.ts`) |
| Models | `api/src/features/brackets/brackets.model.ts` |
| API | `api/src/features/brackets/brackets.controller.ts` · `brackets.routes.ts` |
| Mount + catalogue | `api/src/routes/index.ts` · `api/src/features/root/root.controller.ts` |
| Permission (source) | `api/src/shared/lib/permissions.ts` (+ web/app copies, roles backfill) |
| Web UI | `web/src/features/organizer/bracket/*` · `bracketApi.js` · `OrganizerTournament.jsx` |

---

## 9. Follow-up session — canvas UX + match length + first-round re-seeding (2026-06-05, later)

Continuation of the same day's work, driven by hands-on feedback on the bracket
viewer. All changes are **web/** (organizer console) plus a small **api/**
addition; no new permission (reuses `organizer.brackets.manage`).

### 9.1 Bracket viewer → Figma-style pan/zoom canvas (`web/.../bracket/BracketView.jsx`)
The elimination trees no longer use a horizontal scrollbar. A new in-file
`PanCanvas` wraps every tree (single-elim, double-elim winners/losers/grand-final,
pool playoff):
- **Drag to pan**, **scroll to zoom** (cursor-anchored, 30–200%) or `+`/`−`
  buttons, and a **Fit-to-canvas** button.
- **Auto-fits the canvas by default** on open and on orientation change — scaled
  to show the whole draw, centered (so you no longer land zoomed-in on the top-left).
- Canvas height = **95vh**, on a **gray dotted background** so it reads as a board.
- **Even card spacing** — reserves ~140px per match in the busiest round so the
  first round never touches (cards were butting together before).
- **Horizontal / Vertical layout toggle** in the header, persisted to
  `localStorage`. Vertical builds **bottom-to-top** (first round at the bottom,
  final on top) via `flex-col-reverse` + a mirrored connector elbow.
- The **Bracket tab now uses full content width** (`OrganizerTournament.jsx`
  drops the `max-w-4xl` cap on the bracket tab only; the text-heavy Overview tab
  stays capped).
- **Regression fixed:** the first pan implementation grabbed the pointer on
  `pointerdown`, which stole the click from match cards and **broke scoring**.
  Capture is now deferred until the pointer actually moves (>4px), so a plain tap
  still opens the score dialog; a drag never accidentally scores.

### 9.2 Match length — "Games to win", default Best of 3
- `BracketGenerator.jsx` gains a **Games to win** selector (1 game / Best of 3 /
  Best of 5), defaulting to **Best of 3** so one fluke game doesn't decide who
  advances. Snapshotted onto the bracket; drives `MatchScoreDialog`.
- **API:** `POST /tournaments/:id/bracket` now accepts an optional `matchFormat`
  (`bo1|bo3|bo5`), overriding the tournament default, else falls back to `bo3`.

### 9.3 First-round re-seeding — "Swap players" mode
- A **Swap players** toggle in the bracket header. Tap one first-round player,
  then another, to **switch their matchup** (re-seed the draw). Two-click by
  design — drag would conflict with the pan canvas.
- **Locked after advance:** only first-round matches that haven't been decided are
  swappable; once a player wins and moves on, they can't be moved.
- **API:** new `POST /tournaments/:id/bracket/swap` — body
  `{ a:{matchId,slot}, b:{matchId,slot} }`; enforces same-section + first-round +
  not-completed/bye server-side; gated by `organizer.brackets.manage`. Added to
  `/lists`.

### 9.4 Verification
- `web` eslint + `npm run build` clean; `api` `tsc --noEmit` clean.
- **Live API end-to-end** (dev API on :9002, organizer token): generate with
  `matchFormat: bo3` → bracket reports `bo3` ✅; swap two un-played first-round
  players → exchanged correctly ✅; score a match then swap it → **`409` "Only
  first-round players who have not advanced can be swapped."** ✅; swapping other
  un-played matches still allowed ✅. Test bracket then removed (entrants kept).

### 9.5 Files touched (this session)

| Layer | Path |
|---|---|
| Bracket canvas + edit/swap UI | `web/src/features/organizer/bracket/BracketView.jsx` |
| Match-length selector | `web/src/features/organizer/bracket/BracketGenerator.jsx` |
| API wrappers (`swapEntrants`) | `web/src/features/organizer/bracketApi.js` |
| Full-width bracket tab | `web/src/features/organizer/OrganizerTournament.jsx` |
| API: `matchFormat` + swap endpoint | `api/src/features/brackets/brackets.controller.ts` · `brackets.routes.ts` |
| `/lists` catalogue | `api/src/features/root/root.controller.ts` |
| Logs | `web/DONE.md` · `web/src/features/marketing/RoadmapPage.jsx` |

### 9.6 Test data
- Seeded **16 dummy singles entrants** into the **"Dylan Chavez"** tournament
  (`id 6a2280dcdcf9d968a19d6916`, owner Brad Matthews
  `556b9e79.matthews@example.com`) for hands-on testing of the canvas + swap. The
  verification bracket created during testing was cleared afterward — the
  tournament is left with its 16 entrants, no bracket, status `draft`.

