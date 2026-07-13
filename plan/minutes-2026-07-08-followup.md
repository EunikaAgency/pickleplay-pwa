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

## Phase 1 — Buildable now, no decision needed

### Task 1 — Surface Events alongside Open Play as visible tabs (§3.4, §13.7) — **S**

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

### Task 2 — Centralise the Discover relevance ranking (§4.2) — **M**

Ranking (time 30% / proximity 25% / skill 20% / spots 15% / friends 10%) currently runs on-device in
[`app/src/features/games/playRanking.ts`](../app/src/features/games/playRanking.ts). Devices can
disagree, and tuning the weights needs an app release.

- Port the scoring to the API so every device receives the same ordering.
- Keep the incomplete-profile rebalancing behaviour (drop unknown location/skill factors and
  renormalise, rather than producing a misleading order).
- The 45 existing passing checks are the port's safety net — keep them green.

### Task 3 — Extend recurring Open Play to venue owners (§5.3) — **M**

"Recurring sessions" / "New series" is organizer-console only today.

- Grant venue **owners** the same series creation.
- Add the editing controls that do not exist yet: edit **this occurrence**, **this and future**, or
  the **whole series**.

### Task 4 — Add the decision-free Discover filters (§4.3) — **S/M**

Live today: date, skill level, play type, openings, distance. Buildable now without any decision:

- free vs paid
- public vs invitation-only
- recurring vs one-time
- venue / location

> **Gender eligibility is the one filter that must wait** for Phase 0 decision 3.

### Task 5 — Close out the staff-permissions item (§6, §13.7) — **XS**

Already implemented (`dfb2d18` and friends). Confirm the staff dashboard now matches the owner-only
Reports rule, then mark §13.7 closed in the next status note so the PDF's open item does not get
re-worked.

---

## Phase 2 — Unblocked the moment the decisions land

### 2A — Eligibility (needs decision 3)

One coherent change set. Building it piecemeal will hurt, because eligibility touches four surfaces
at once:

1. Add an eligibility rule to the session model (gender + skill band).
2. Surface it on the Discover cards.
3. Add the eligibility filter to the filter sheet.
4. **Enforce it on join server-side** — a hidden button is not enforcement.
5. Apply the hide-vs-mark-unavailable choice consistently across listing, filters *and* ranking.

### 2B — Open Play lobby (needs decision 1)

The good news from §7.2: **the components already exist.** Games already have a working roster and a
Messenger-style group chat. The work is not building a chat.

1. Membership states: invited / pending / confirmed / host approval.
2. Wire the existing Games group chat to Open Play sessions.
3. Decide the fate of the existing "I'm Interested" signal — replaced, or kept as a soft pre-join?

### 2C — Payments (needs decisions 2 and 4)

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

## Recommended order

1. Get decisions **1, 2 and 3** in a single short session. Everything expensive hangs off them.
2. Run Phase 1 **Tasks 2, 3 and 4** in parallel while waiting — none of them need an answer.
3. Answer **§16.5**, then ship Task 1 (tabs) with the Events/Tournaments question already resolved.
4. Start Phase 2A (eligibility) as the first decision-gated build — it is the highest-value item in
   the next phase per §4.5.
