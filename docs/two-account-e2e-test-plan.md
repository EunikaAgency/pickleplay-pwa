# Two-account E2E test plan — booking, games, clubs (app/ PWA)

Cross-account end-to-end test cases for the PickleBallers PWA (`app/`), exercising
the flows where **two players interact through shared state**: court booking,
venue-first game creation, joining each other's games, and clubs. Written to be
executed by an AI automation agent (e.g. Claude + playwright-mcp) — the
ready-to-use prompt is at the bottom of this file.

---

## 1. Environment

| Thing | Value |
|---|---|
| App (PWA) | `http://localhost:9000` (Vite dev / pm2 `pickleplay-pwa`) |
| API | `http://localhost:9002` (pm2 `pickleballer-api`; app proxies `/api/*` to it) |
| Payments | **Test mode** (`GET /api/v1/settings` → `testMode: true`): checkout pre-fills the demo card, shows a TEST banner, and `POST /api/v1/payments/checkout` confirms the booking with no real charge. **Abort the run if `testMode` is false.** |
| Session storage | Tokens live in `localStorage` (`pb-access-token` / `pb-refresh-token`) — two accounts logged in at once **require two isolated browser contexts/profiles**. Two tabs in one context share one session. |

### Test accounts

Register two fresh accounts through the app's own register form (LoginScreen has
a sign-in / register toggle). Use `@example.com` emails — the API's dummy-user
seeder deletes all `@example.com` users on re-run, so cleanup is free:

| Account | Email pattern | Password | Role |
|---|---|---|---|
| **A** | `e2e.alice.<run-id>@example.com` | `Password123` | player (default) |
| **B** | `e2e.bob.<run-id>@example.com` | `Password123` | player (default) |

`<run-id>` = any unique short string per run (e.g. date + counter). New players
get the default `player` role, which carries `player.games.create`,
`player.bookings.create`, `player.clubs.*` — everything this plan needs.

---

## 2. Test cases

Conventions: **A** / **B** = the two accounts above. Every case implicitly ends
with: *no console errors, no failed (4xx/5xx) API calls other than those a step
expects, and the asserted state survives a page reload.*

### S0 — Registration & onboarding

| ID | Account | Steps | Expected |
|---|---|---|---|
| S0.1 | guest | Cold-start the app. | Lands on the **home tab as a guest** (not a landing page). Browsing Games/Nearby works; the profile tab shows "Login". |
| S0.2 | A | Profile tab → register with A's email/password/display name. | Registration succeeds → **onboarding** runs (first login only). Pick a skill tier, finish. |
| S0.3 | A | Reload the page. | Session restores via `/me`; onboarding does **not** re-run (`hasOnboarded` persisted); greeting/profile show A's name. |
| S0.4 | B | Same as S0.2–S0.3 in the **second browser context**. | Same results for B. |

### S1 — Court booking (A books, B sees availability)

| ID | Account | Steps | Expected |
|---|---|---|---|
| S1.1 | A | Nearby tab → open a venue **with a price** → "Book this court" → pick a court → pick a date a few days out → pick a whole-hour start/end (e.g. 2 hours). | Hour picker offers whole hours only; already-taken hours for that court are greyed out; cost shows `rate × hours` live. |
| S1.2 | A | Proceed to checkout. | TEST banner visible; demo card pre-filled; pay completes; booking **confirmed**. |
| S1.3 | A | Games tab → **Booking** top tab (list and calendar views) and Profile → "My bookings". | The booking appears in both; the calendar dots the booked day; details (venue/court/date/hours/price) match what was chosen. |
| S1.4 | B | Start booking the **same court, same date** as S1.1. | The hours A booked are **greyed out / unselectable** for B. |
| S1.5 | B | Book a **different** hour on the same court (test-checkout). | Succeeds; both bookings coexist; each account sees only its own in My bookings. |
| S1.6 | A | Cancel the S1.1 booking from My bookings. | Booking gone/cancelled; **B retries S1.4**: the freed hours are selectable again. |

### S2 — A creates a game, B joins (the core cross-account loop)

| ID | Account | Steps | Expected |
|---|---|---|---|
| S2.1 | A | Home → "Create match" quick-action → 3-step wizard: pick a **priced** court (search box works) → date ~1 week out + start/end time (live `rate × hours` cost) → details: name, type, skill, **2 spots**, visibility published. | Wizard advances only with valid input; cost matches the court's rate. |
| S2.2 | A | Pay (test checkout). | Payment books the court **and** posts the game. A lands on/can open the game; Games tab → My Games shows it as **HOSTING**. |
| S2.3 | A | Games tab → **Booking** sub-tab. | The court booking created by the game exists too (the game flow goes `createBooking → checkout → createGame`). |
| S2.4 | B | Games tab → Games → **Browse**. | A's game appears under the right date section with correct venue, time, skill, and open-spot count. |
| S2.5 | B | Open the game → **Join**. | Join succeeds; roster shows A (host) + B; spots decrease; B's **My Games** shows it as **GOING**. With 2 spots the lobby is now **full**: the game shows a "ready to play" state. |
| S2.6 | A | Profile → notifications bell. | A has a **`game_full`** notification; tapping it opens the game details. |
| S2.7 | B | Open the game → **Leave game**. Game is full but **> 3 days out** (grace window is `LOBBY_LEAVE_GRACE_PERIOD_DAYS = 3`). | Leave is allowed; roster/spots update for **both** accounts (reload A's view). |
| S2.8 | B | Re-join the game. | Succeeds; full lobby again. |
| S2.9 | A | My Games → manage the game: edit name/skill/spots, then **kick B**. | Edits save (venue + schedule are read-only in manage mode); after the kick, B's My Games no longer lists the game; the spot re-opens in Browse. |
| S2.10 | A | Delete the game. | Gone from A's My Games and from B's Browse. |

### S3 — Vice versa: B creates, A joins (+ lock-window negatives)

| ID | Account | Steps | Expected |
|---|---|---|---|
| S3.1 | B | Repeat S2.1–S2.2 but schedule the game **within 3 days** (e.g. day after tomorrow), 2 spots. | Game posts; B is HOSTING. |
| S3.2 | A | Browse → open B's game → Join. | Because the game is **inside the grace window**, joining the last spot shows the **no-refund confirmation modal** first; confirming joins. |
| S3.3 | A | Try to **leave** the now-full game. | Blocked: full lobby inside the 3-day window is locked. UI prevents it and/or the API returns **409 `LOBBY_LOCKED`** — no orphaned state either way. |
| S3.4 | B (host) | Open the same game. | Host is **not** offered "Leave game" (hosts manage/delete instead). |
| S3.5 | A | Try to join the same game again (re-open details). | No double-join: button reflects joined state; roster lists A once. |

### S4 — Clubs

| ID | Account | Steps | Expected |
|---|---|---|---|
| S4.1 | A | Clubs tab → create a club (unique name). | Club created and opened; A is the **host**; it appears under A's "my clubs". |
| S4.2 | B | Clubs tab → **Discover** (search by name). | A's club is listed (and **not** duplicated under B's "my clubs"). |
| S4.3 | B | Open the club → **Join**. | B becomes a member; members list shows A + B; club moves to B's "my clubs" and out of Discover. |
| S4.4 | both | A posts on the feed; B likes it; B posts; A likes; one of them unlikes. | Posts/likes render for both accounts with correct authors and counts; unlike decrements. |
| S4.5 | A (host) | Look for a leave action on the club. | The **host cannot leave** — no leave affordance (or it's blocked server-side). |
| S4.6 | B | Leave the club. | B removed from members; club returns to B's Discover; the feed still shows the history. |

### S5 — Guest gating & permission checks

| ID | Account | Steps | Expected |
|---|---|---|---|
| S5.1 | guest | In a fresh context, open a game → Join. | **AuthPromptSheet** opens (soft gate) instead of joining; logging in from it completes the intent. |
| S5.2 | guest | Try "Create match" and the Clubs create action. | Both soft-gated the same way (`player.games.create` / `player.clubs.create` behind login). |
| S5.3 | guest | Browse Nearby + a court detail page. | Fully browsable as guest (read surfaces are open). |

---

## 3. Cross-cutting anomaly checklist

Things to watch **throughout every case**, not as separate steps:

- **Cross-account consistency** — any state change by one account (join, leave,
  kick, cancel, post) is visible to the other after a reload/refetch. Stale
  rosters, spot counts, or availability grids are anomalies even if "your own"
  view looks right.
- **Money/state coupling** — every paid step (booking checkout, create-game
  payment) must leave a *consistent pair*: payment confirmed ⇔ booking
  confirmed ⇔ (for games) game posted. A charge with no booking, a booking with
  no game, or a deleted game whose court booking silently lingers — flag it and
  note what the UI says about it.
- **Console & network hygiene** — capture browser console errors/warnings and
  any non-2xx API response not explicitly expected by the step.
- **Reload survival** — re-assert the key state of each suite after a hard
  reload (tokens restore via `/me`; lists refetch).
- **Empty/loading/error states** — note any spinner that never resolves, layout
  jump, raw error text, or untranslated error code shown to the user.
- **Double-submit** — fast double-clicks on Join / Pay / Create should not
  create duplicates.
- **Clock edges** — booked hours greyed out should match the court and date
  actually selected (off-by-one hour/timezone bugs love this surface).

---

## 4. Ready-to-use prompt for the automation AI

Copy everything in the block below into the AI agent that will run the tests
(it assumes a browser-automation tool such as playwright-mcp and shell access
to this repo).

```text
You are a senior QA automation engineer testing PickleBallers, a mobile-first
pickleball PWA (React 19), against its live local dev stack.

GOAL
Execute the two-account end-to-end test plan in
docs/two-account-e2e-test-plan.md (sections 1–3) against the running app,
then deliver a written QA report. You are testing for three things:
(1) pass/fail of each case, (2) anomalies — any behavior that is buggy,
inconsistent, or surprising even if no case explicitly asserts it, and
(3) concrete UX/product improvement suggestions based on what you experienced.

ENVIRONMENT
- App: http://localhost:9000  ·  API: http://localhost:9002 (proxied at /api/*)
- Before anything else, verify both are up and that GET /api/v1/settings
  returns testMode: true. If testMode is false, STOP — never run a checkout
  against live payments.
- Auth tokens live in localStorage, so the two accounts MUST run in two
  isolated browser contexts/profiles. If your tooling only gives you one
  context, run the accounts interleaved by logging out and back in at each
  account switch, and say so in the report (it weakens the concurrency checks).

ACCOUNTS
Register two fresh accounts via the app's own register form:
  A: e2e.alice.<run-id>@example.com / Password123
  B: e2e.bob.<run-id>@example.com  / Password123
(@example.com accounts are auto-cleaned by the API's seeder, so they're safe
to leave behind.) Complete onboarding for both.

EXECUTION RULES
- Drive the real UI like a user (tap/scroll/type); use the mobile viewport
  (~390×844). Only fall back to direct API calls to VERIFY state (e.g. confirm
  a booking exists server-side), never to perform a user action a case
  describes as a UI step.
- Run the suites in order S0 → S5; within a suite, cases assume the prior
  case's state. If a case fails, capture evidence, recover as best you can
  (e.g. recreate the entity), mark dependent cases blocked rather than
  silently skipping them, and continue.
- For every case record: status (pass / fail / blocked), what you observed vs
  expected, and a screenshot at the key assertion point. Save screenshots to
  docs/screenshots/e2e-<run-id>/ with the case ID in the filename.
- Continuously apply the cross-cutting anomaly checklist (section 3 of the
  plan): console errors, non-2xx API calls, cross-account staleness,
  payment/booking/game consistency, reload survival, double-submit, hour-grid
  off-by-ones. Log every anomaly the moment you see it, with the case you were
  in and reproduction steps.
- Do NOT modify any application code, seed data, or other users' data. Only
  touch entities your two test accounts created. At the end, clean up where
  the UI allows: delete created games, cancel bookings, leave/ignore clubs.

DELIVERABLE
Write the report to docs/e2e-report-<run-id>.md with these sections:
1. Run summary — date, app/api versions or git SHA, account emails, totals
   (passed/failed/blocked), and a one-paragraph verdict.
2. Results table — every case ID with status and a one-line note; link each
   to its screenshot.
3. Anomalies — each with: severity (critical / major / minor / cosmetic),
   where found, reproduction steps, observed vs expected, evidence link, and
   your hypothesis of the cause if you have one. An anomaly that risks money
   or data integrity (payment/booking/game mismatch) is automatically
   critical.
4. UX & product suggestions — ranked, each tied to a concrete moment you hit
   while testing ("as account B, when X, I expected Y"), not generic advice.
   Include friction notes: steps that took too many taps, unclear copy,
   missing feedback after actions.
5. Coverage gaps — what this plan does NOT cover that you noticed matters
   (e.g. concurrency races you couldn't simulate, push notifications,
   offline mode), as suggestions for the next test plan revision.
Report facts faithfully: if something failed, say so plainly with the
evidence — do not soften failures into "minor issues".
```

---

## 5. Known out-of-scope (for the next revision)

- **Web Push** (OS-level notifications) — needs real browser permission grants;
  only the in-app inbox is asserted here.
- **Game chat** and **invite-send** — still demo in the app (no endpoints).
- **True concurrency races** (two accounts paying for the same court-hour in
  the same second) — needs API-level harnessing, not UI automation.
- **Owner/organizer flows** — covered by their own consoles; this plan is
  player-vs-player only.
