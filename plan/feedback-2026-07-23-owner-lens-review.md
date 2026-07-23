# Plan — Team feedback on the owner lens (WhatsApp, 22–23 July 2026)

## Context

Source: the team WhatsApp thread, night of 22 July → morning of 23 July 2026. Four voices:

- **Andrew** — described the organizer's business model (context, not a request).
- **Cris** — did a click-through QA pass of the **owner console** and raised three items.
- **Marvin** — answered the money-flow question and the account-model question.
- **John Kenneth Tan** — asked how a user becomes an organizer.

Cris flagged that they only had the *What Changed & Why* doc, no access to the blueprint spec or
the other repo docs, so some of this may already be answered elsewhere.

Two of the five items are **product decisions**, not engineering — and one of them
(**organizer/open-play payment rules**) is the same decision already sitting unanswered as Phase 0
item #2 in [`minutes-2026-07-08-followup.md`](./minutes-2026-07-08-followup.md). It has now been
asked twice by two different people. That is the thing to chase.

### The business model being described (Andrew, 22 July 23:41)

> Organiser books a venue for 3 hours from venue owner, costs him 3k. He then creates an open play
> on reclub, invites the players, then gets paid 4k. He earns 1k profit.
>
> Often its multiple organisers renting the venue for entire day.

Two money legs — organizer→owner (court rent) and players→organizer (seat fee) — and the platform
currently models neither leg as a settlement with terms. That is what items 4 and 5 are really about.

---

## Verified against the code (not taken from the thread on faith)

| Claim from the thread | Reality in the repo |
| --- | --- |
| Reports have no per-sport breakdown | **Confirmed.** `sport` exists per court ([`venues.model.ts:316`](../api/src/features/venues/venues.model.ts#L316)) so the data is there, but no owner reporting surface reads it — `ownerMetrics.js`, `OwnerCharts.jsx` and `OwnerInsightsPage.jsx` have no `sport` reference at all, and there is no `reports` feature under `api/src/features/`. Aggregation is venue-level only. |
| Open play shows only "Check in", no way to record payment | **Partly reproduced.** The pay action is [`OwnerBookingRow.tsx:154-156`](../app/src/features/owner/components/OwnerBookingRow.tsx#L154-L156), gated on `st === 'awaiting_payment' && booking.paymentId && booking.paymentStatus === 'pending'`. Anything showing "Unpaid" *without* that exact triple shows no pay button — a plausible mechanism for exactly what Cris saw. **But** the labels Cris quoted ("Record Payment", "Chase") do not exist anywhere in `app/src` or `web/src`; the button reads "Mark GCash paid". Needs a screenshot to pin the surface. |
| Booking calendar capped 6am–9pm | **Not reproduced in code.** The owner calendar renders all 24 hours ([`OwnerCalendarScreen.tsx:40`](../app/src/features/owner/OwnerCalendarScreen.tsx#L40)) and the player booking screen filters hours against *the venue's own operating window* ([`BookCourtScreen.tsx:388`](../app/src/features/bookings/BookCourtScreen.tsx#L388)). No 6/21 constant exists. Most likely a **data mismatch** on that venue: structured `VenueHour` rows seeded 06:00–21:00 while the free-text hours string on Venue Overview says 11pm/midnight. |
| Organizer should be a normal player account, upgraded — not a separate account | **Already true.** [`auth.controller.ts:91-96`](../api/src/features/auth/auth.controller.ts#L91-L96): *"`coach` and `organizer` are no longer account roles — a partner is a player who holds a live PAID subscription."* |
| Organizer status should be **per venue** | **Diverges from what is built.** Venue-scoped grants exist (`UserRole` with `scopeType: 'venue'`) but they are **cosmetic** — they render the "Coach at &lt;venue&gt;" badge and nothing more. The actual permission comes from a platform-wide subscription. |
| "they can apply to upgrade to an organiser account" | **Exists.** `api/src/features/organizer-applications/` (controller + model + routes). |

---

## The five items

### 1. Reports — no per-sport revenue breakdown  *(buildable now)*

Cris, 01:56:

> i cudn't find a breakdown by sport, the docs mention comparing pickleball vs. badminton, but what
> I saw was venue-level reporting. For a multi-sport venue owner, I think it'd be useful to see
> which sport is generating more revenue.

The join already exists: booking → `courtId` → `court.sport`. The work is an aggregation and a
dimension toggle, not a schema change.

- Add a `groupBy=sport` dimension to the owner metrics aggregation.
- Surface it on the insights page as a split on the existing revenue chart, not a new page.
- Courts with a blank `sport` need a bucket — decide "Unspecified" vs. inheriting a venue default.

**Size:** small. **Blocked on:** nothing.

### 2. Open Play payment actions at the front desk  *(needs repro, then decide)*

Cris, 01:56:

> in bookings there r two open play bookings on Court 1, one "Paid · Maya" and one "Unpaid", but
> both only show "Check in," no "Record Payment" unlike Private "Held · Unpaid" w/c has record
> payment + Chase. […] Is that the setup? just curious how the "Unpaid" one ended up there nd
> whether the desk still needs a way to mark it paid if someone shows up unpaid.

Two separate questions, and they should not be merged:

- **(a) Design:** if open play has a pay-before-you-join gate, is check-in genuinely the only action
  the desk needs? Probably not — walk-ins and failed-payment retries both land at the desk.
- **(b) Bug:** how did an `Unpaid` open-play booking come to exist at all? Either the gate has a
  hole, or "Unpaid" is a display state that outlives its payment record and the button gating
  (`paymentId` + `paymentStatus === 'pending'`) then silently drops the action.

**First step:** get the screenshot / venue + date from Cris to identify the surface, since the
quoted button labels don't match the code. **Then:** answer (a) before patching (b), because the
answer decides whether the fix is "show the button" or "close the gate."

**Size:** small once reproduced. **Blocked on:** repro + one design answer.

### 3. Booking calendar stops at 9pm  *(likely data, verify per venue)*

Cris, 08:58:

> the calendar only runs 6am to 9pm but Venue overview says eg. bgc is open until 11pm on weekdays
> nd midnight on fri-sat. […] 9pm to midnight is usually when after-work players come in. Is the cap
> intentional or shud the calendar follow the venues opening hrs?

The answer to their question is **yes, it should follow venue hours — and the code already intends
to.** So this is a mismatch between the two places hours live: the structured `VenueHour` rows that
drive bookability, and the free-text hours string rendered on Venue Overview.

- Pull the `VenueHour` rows for the BGC venue and compare against the displayed string.
- If they disagree, the real bug is that **two sources of truth for opening hours can drift**, and
  the fix is to derive the overview string from the structured rows (or validate on save).
- Related and already shipped: `1806791` *fix(bookings): label unopen hours 'Closed', not 'Booked'* —
  same area, same confusion.

**Size:** small if data, medium if we unify the two sources. **Blocked on:** nothing.

### 4. Organizer → owner payment terms  *(DECISION — already blocking, asked twice)*

Marvin, 09:50, quoting Andrew:

> So he pays owner, players pay him directly. He pays in advance or has a pending period?
>
> I suppose could be rule based set by venues. Open play slot rules.

Marvin's instinct — **per-venue rules** — is the right shape and matches how pricing and hours
already work. The open questions:

- Does the organizer pay the owner **upfront**, or is there a **hold/settlement window**?
- Is there a deposit, and what happens to it on cancellation or no-show?
- Who eats the loss when the organizer under-fills the session?
- Does the platform take a cut of either leg?

This is the **same decision** as Phase 0 item #2 in the 8 July follow-up plan
(*"Open Play payment rules by host type — who may charge, who collects, does the platform take a
fee, what happens on cancellation"*). It has been open since 8 July and has now been re-raised
independently. Nothing downstream — settlements, organizer payouts, cancellation policy — can be
built until it is answered.

**Size:** large once decided. **Blocked on:** a product decision, not engineering.

### 5. How a user becomes an organizer  *(mostly built — one decision left)*

John Kenneth Tan, 10:00:

> how about user applying as an organizer, should it be a player subscribe to app as organizer or
> the user create organizer account separate from their player account?

Marvin, 10:01–10:04:

> Player/standard user can be organiser.
>
> So it's like wordpress. All users are just users but the default sign up user is subscriber. They
> can be upgraded to editor, admin even. So player can be upgraded to owner. Or sign up as owner. I
> think organiser has to sign up as a player/user first then his organiser status is only per venue,
> like user A is an organiser for venue X otherwise just a regular user/player account. If not with a
> venue I think they can apply to upgrade to an organiser account.

**Marvin's model is already what the code does** — one account, additive roles, no separate
organizer account, and an application path for the unattached case. So John Kenneth's question is
answered: **subscribe/upgrade the player account, never a second account.**

The one genuine open point is **where the permission lives**:

| | Today | Marvin's model |
| --- | --- | --- |
| What grants organizer rights | A platform-wide **paid subscription** | A **per-venue grant** from that venue |
| What the venue-scoped grant does | Renders a badge only | Carries the actual permission |
| Unattached user | Buys a subscription | Applies to upgrade |

Commit `1877fc6` (*allow entrance fee for owner-approved organizers, not just subscribers*) has
already started moving toward Marvin's model — owner approval now grants something a subscription
used to gate exclusively. That drift should be made deliberate rather than accumulating case by case.

**Decision needed:** do venue-scoped grants become permission-bearing (and if so, does the
subscription still mean anything), or does the subscription stay the gate with owner approval as a
per-venue exception?

**Size:** medium. **Blocked on:** the decision above — which pairs naturally with item 4, since both
answers are "the venue sets the rule."

---

## Suggested order

1. **Chase the two decisions together** (items 4 + 5) — same owner, same "venue sets the rule"
   shape, and item 4 has been blocking since 8 July.
2. **Ship item 1** (per-sport reports) — no blockers, data already exists, directly answers the
   feedback.
3. **Repro item 2** with Cris, then decide (a) before fixing (b).
4. **Check item 3's venue data**, then decide whether to unify the two opening-hours sources.

## Loose ends

- Cris only had the *What Changed & Why* doc. Give them access to the blueprint spec / repo docs so
  the next pass doesn't spend cycles on already-answered questions.
- The "Record Payment" / "Chase" labels don't exist in the codebase — confirm which build or surface
  Cris was on before treating item 2's description as literal.
