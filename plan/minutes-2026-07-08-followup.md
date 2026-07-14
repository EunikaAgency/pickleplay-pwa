# Plan — Follow-up work from the Updated Minutes (8 July 2026)

## Context

Source: `PickleBallers_Updated_Minutes_July_8_2026_-with-Visuals.pdf` (34 pages, status reviewed
12 July 2026). Sections 1–15 are the meeting record plus what shipped in the two days after it.
Section 16 is separate: product directions now **live in the app** that were never part of the
meeting agenda.

The key finding is that **most of the remaining work is blocked on six product decisions, not on
engineering**. Only a handful of items are "just build it". This plan separates the two so the
buildable work can start immediately while the decisions are chased in parallel.

### Verified against the code (not taken from the PDF on faith)

The PDF's status table is two days stale in places. Checked before writing this plan:

| PDF claim | Reality |
| --- | --- |
| §6 / §13.7 — staff still see revenue tiles on the console home | **Already fixed.** `dfb2d18` hid owner revenue from the staff home; `746f812`–`7042520` also locked down Pricing Override, the Social tab and the Create-game CTA for staff. |
| §3.4 — Events is reached through a dropdown | **Still true.** `SECTION_LABELS` + `sectionOpen` dropdown in [`app/src/features/games/v2/GamesScreenV2.tsx`](../app/src/features/games/v2/GamesScreenV2.tsx) (L45, L140). |
| §4.5 — eligibility does not exist | **Confirmed.** No gender/eligibility field on the games model anywhere in `api/src/features/games/`. |
| §7 — Open Play is interest-only, no roster | **Confirmed.** [`OpenPlayDetailScreen.tsx`](../app/src/features/games/v2/OpenPlayDetailScreen.tsx) L137–140: `interestedUsers` / `interestedCount`, no roster, no lobby. |

---

## Phase 0 — Decisions to extract from the team (blocking)

Not engineering tasks. These are the answers we need before the expensive work can start, ordered
by how much they unblock.

1. **Does Open Play get a lobby?** (§7) — Keep the lightweight "I'm Interested" flow, or grow into a
   managed lobby with confirmed / invited / pending states and group chat. Biggest fork; decides
   whether Phase 2B exists at all.
2. **Open Play payment rules by host type** (§10) — Who may charge, who collects, does the platform
   take a fee, what happens on cancellation.
3. **Eligibility rules** (§4.5) — women-only / men-only / open-to-all / skill-banded. And the load-
   bearing sub-question: are ineligible sessions **hidden entirely** or **shown as unavailable**?
   That one answer shapes Discover, the filters, the ranking and the join button *together*.
4. **Coach session payments and commission** (§9.3) — The booking flow currently promises the player
   "Nothing is charged now — you pay the coach once they accept."
5. **Like vs Interested** (§8) — One reaction system or two. Must be settled before a global feed.
6. **Homepage wording** (§3.2) — Ship "Play / Book Court / Find Coach" or the meeting's "Open Play /
   Book a Court / Get a Coach". Trivial to apply once someone picks.

### Section 16 questions — urgent, because each already ships behaviour nobody approved

- **16.1** Is the ₱499 / 30-day coach subscription the platform's *official* revenue model, or interim?
- **16.2** What is "partner revenue ₱229,000" meant to represent, when coach sessions are paid
  off-platform today? Is venue approval the official coach↔venue link, and does the venue take a cut?
- **16.3** With time-based pricing rules live, should listings show a **price range** or a **live
  price**? Do surge/discount rules need platform-level limits?
- **16.4** Rental inventory exists with no player-facing rent flow. Who owns deposits, damage and
  late returns?
- **16.5** **"Events" does not contain events.** The Play section's Events list holds player-hosted
  games; real structured competition (brackets, divisions, ₱450–₱1,200 entry fees) lives in a
  separate Tournaments area outside Play. Merge, or rename?
- **16.6** May a court **awaiting booking approval** host a public Open Play session? What happens to
  players who joined a session whose underlying booking is later rejected or expires unpaid?

---

## Status at a glance (14 July 2026)

| | Item | Status |
|---|---|---|
| **Phase 1** | 1 — Events + Open Play as visible tabs (§3.4) | ✅ **DONE** |
| | 2 — Server-side Discover ranking (§4.2) | ✅ **DONE** |
| | 3 — Recurring Open Play for owners + series editing (§5.3) | ✅ **DONE** |
| | 4 — Decision-free Discover filters (§4.3) | ✅ **DONE** |
| | 5 — Staff can't see owner revenue (§13.7) | ✅ **DONE** (was already fixed by `dfb2d18`) |
| **Phase 2** | 2A — Eligibility (§4.5) | 🟡 **PART DONE** — gender on player-hosted games only |
| | 2B — Open Play lobby (§7) | ❌ Not started — needs decision 1 |
| | 2C — Payments (§10, §9.3) | ❌ Not started — needs decisions 2 and 4 |
| **Phase 3** | Social feed, cart, rental, staff levels, weight tuning | ❌ Deferred by design |
| **Phase 0** | The six decisions + the six §16 questions | ❌ **Still unanswered** |

Report for the client: [`reports/2026-07-14-Ivan-phase-1-play-and-open-play.md`](../reports/2026-07-14-Ivan-phase-1-play-and-open-play.md)

---

## Phase 1 — ✅ DONE (14 July 2026)

All five closed. Verified with 72 unit checks (39 server / 33 app), 15 API checks and 13 browser
checks — 100 passing.

Two bugs surfaced only by *running* the code, not by types:

- **Recurring Open Play was booking the wrong weekday.** `generateSessionDates` picked
  the right local day and then serialised it with `toISOString()` — which is UTC, and
  local midnight in Manila is 16:00 the previous day. Ask for Tuesday, get a series of
  Mondays. Every recurring session ever created was one day early. Fixed via a local
  `ymd()`; three call sites in `content.controller.ts` had the same fault.
- **The Play card shows a price you don't pay.** On a GAME, `priceLabel` is the
  *venue's hourly rate* — the host paid it, and the app has no way to charge a joiner.
  A Free/Paid filter built on that label would have hidden games that are free to join.
  The filter keys off a new `joinFee` instead (`null` = no join fee exists).

Two PDF claims were also wrong: §13.7 (staff revenue) was **already fixed** by `dfb2d18`,
and §3.3's "tapping Play lands on Open Play — this works today" was **false** — it landed
on Events.

## Phase 1 — the original plan

### Task 1 — Surface Events alongside Open Play as visible tabs (§3.4) — ✅ **DONE**

The meeting asked for Open Play and Events side by side; today they hide behind a dropdown, so a
player who never opens it does not know Events exists.

- Replace the section dropdown in
  [`app/src/features/games/v2/GamesScreenV2.tsx`](../app/src/features/games/v2/GamesScreenV2.tsx)
  with a visible two-tab control (`SECTION_LABELS`, `section`, `sectionOpen`, `sectionRef`).
- Keep the existing Discover / Joined / Manage row beneath it as the **view** switch — the two
  controls are different axes and must stay visually distinct.
- Preserve the empty-tab-hiding behaviour that already works (L265–L285).

> ⛔ **Gate: do not ship before §16.5 is answered.** Promoting Events from a hidden dropdown to a
> prominent tab makes the mislabel *more* visible, not less — a headline tab called "Events" that
> contains no events. Merge Tournaments into it, or rename the tab, as part of the same change.

### Task 2 — Centralise the Discover relevance ranking (§4.2) — ✅ **DONE**

Ranking (time 30% / proximity 25% / skill 20% / spots 15% / friends 10%) currently runs on-device in
[`app/src/features/games/playRanking.ts`](../app/src/features/games/playRanking.ts). Devices can
disagree, and tuning the weights needs an app release.

- Port the scoring to the API so every device receives the same ordering.
- Keep the incomplete-profile rebalancing behaviour (drop unknown location/skill factors and
  renormalise, rather than producing a misleading order).
- The 45 existing passing checks are the port's safety net — keep them green.

### Task 3 — Extend recurring Open Play to venue owners (§5.3) — ✅ **DONE**

"Recurring sessions" / "New series" is organizer-console only today.

- Grant venue **owners** the same series creation.
- Add the editing controls that do not exist yet: edit **this occurrence**, **this and future**, or
  the **whole series**.

### Task 4 — Add the decision-free Discover filters (§4.3) — ✅ **DONE**

Live today: date, skill level, play type, openings, distance. Buildable now without any decision:

- free vs paid
- public vs invitation-only
- recurring vs one-time
- venue / location

> **Gender eligibility is the one filter that must wait** for Phase 0 decision 3.

### Task 5 — Close out the staff-permissions item (§6, §13.7) — ✅ **DONE**

Already implemented (`dfb2d18` and friends). Confirm the staff dashboard now matches the owner-only
Reports rule, then mark §13.7 closed in the next status note so the PDF's open item does not get
re-worked.

---

## Phase 2 — Unblocked the moment the decisions land

### 2A — Eligibility (§4.5) — 🟡 PART DONE

Built, for **player-hosted games only**:

- ✅ `genderPolicy` (all / men / women) on the Game model + the create/edit form.
- ✅ `gender` on the user profile + sign-up.
- ✅ **Enforced server-side on join** (`genderBlock`) — a greyed-out button is not enforcement, and
  this one is real. `GENDER_REQUIRED` steers a player with no gender set to their profile rather
  than dead-ending them.
- ✅ Shown on the Discover card + a "Who can play" filter.

Still missing:

- ❌ **Venue-run Open Play sessions carry no eligibility at all.** `OpenPlaySession` has no
  `genderPolicy` field, so a venue cannot run a women-only session — only a *player* can. That is
  backwards from the meeting, where §4.5's examples were venue/organizer sessions.
- ❌ **Skill-band eligibility** ("beginner-only", "3.0–3.5 only") does not exist. Today a skill band
  is a *hint* used for ranking, not a rule that stops you joining.
- ⚠️ **Decision 3 was made by implementation, not by the team.** The build chose *"show it, marked
  not eligible"* (Option B). Nobody signed that off — it just happened. If the team wanted
  ineligible sessions **hidden**, this has to be revisited across the listing, the filters, the
  ranking and the join button together.

### 2B — Open Play lobby (§7) — ❌ NOT STARTED (needs decision 1)

The good news from §7.2: **the components already exist.** Games already have a working roster and a
Messenger-style group chat. The work is not building a chat.

1. Membership states: invited / pending / confirmed / host approval.
2. Wire the existing Games group chat to Open Play sessions.
3. Decide the fate of the existing "I'm Interested" signal — replaced, or kept as a soft pre-join?

### 2C — Payments (§10, §9.3) — ❌ NOT STARTED (needs decisions 2 and 4)

Collection, refunds, commission, payout — for both Open Play and coach sessions.

> **Precedent to extend, not invent:** tournament entry fees (₱450–₱1,200) are *real payments the
> platform already handles*. Start from that mechanism.

---

## Phase 3 — Explicitly deferred

- Global platform-wide social feed (club feeds are the working foundation).
- Cart-style checkout — court + coach + equipment in one basket (§11, ties into 16.4).
- Player-facing equipment rental flow (the owner-side inventory already exists).
- Multiple staff permission levels beyond the current single operational role.
- Re-tuning the relevance weights after observing real player behaviour — not before.

---

## What's left, and what it's waiting on

Phase 1 is closed. **Everything remaining is waiting on the team, not on engineering.** There is no
buildable work left that doesn't first need an answer.

### The two loose ends Phase 1 created

1. **§16.5 — the "Events" tab has no events in it.** Making it a visible tab (as the meeting asked)
   made this *more* obvious, not less. Real structured competition lives in a separate Tournaments
   area outside Play; the Play tab's "Events" is a list of player-hosted games. **Merge Tournaments
   in, or rename the tab.**
2. **§10 — a game's card still shows a price you don't pay.** It shows the venue's hourly court
   rate, which the *host* paid. The Free/Paid filter now handles this correctly (`joinFee`), but the
   card still reads as though joining costs ₱350. What the card *should* say depends on the payment
   rules, so it was left alone rather than guessed at.

### Finish what 2A started

3. **Venue-run sessions can't be women-only** — only player-hosted games can. That's backwards from
   the meeting's own examples. Add `genderPolicy` to `OpenPlaySession`.
4. **Skill-band eligibility doesn't exist** — a skill band is still only a ranking hint, not a rule.
5. **Confirm decision 3 retroactively** — the build picked "show it, marked not eligible". If the
   team wanted ineligible sessions *hidden*, that's a rework across four surfaces.

### Then, in order

6. Get decisions **1, 2 and 4** (lobby, Open Play payments, coach payments) in one short session.
   Everything expensive hangs off them, and nothing else can start until they land.
7. Build 2C (payments) by **extending the tournament entry-fee flow**, which already handles real
   money — not by inventing a new mechanism.
8. Leave Phase 3 alone until the core Play and payment rules are settled.
