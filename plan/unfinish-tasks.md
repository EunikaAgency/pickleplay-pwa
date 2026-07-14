# Unfinished — everything still open after Phase 1 (14 July 2026)

Phase 1 of the 8 July minutes is closed (5/5). This file is the honest list of what is **not**
done, and what each item is waiting on.

**The short version: nothing left is waiting on engineering. It is all waiting on a decision.**

Full plan + Phase 1 detail: [`minutes-2026-07-08-followup.md`](minutes-2026-07-08-followup.md)
Client-facing report: [`../reports/2026-07-14-Ivan-phase-1-play-and-open-play.md`](../reports/2026-07-14-Ivan-phase-1-play-and-open-play.md)

---

## 0. An open question that has to be settled first

**Does the team actually want venue-hosted Open Play?**

This was disputed on 14 July. The position raised was: *"a venue is just the building where the
courts are — players book them, venues don't host games."*

The minutes say otherwise, twice, and put the two cases side by side:

> **"Organizer- or venue-hosted Open Play may charge each joiner a participation fee."** (§10)
>
> **"An ordinary player who has already booked and paid for a court may open the session publicly
> without charging joiners through the app."** (§10)
>
> **"The meeting added recurring Open Play as a requirement because many venues and organizers run
> the same session every week or on selected days."** (§5.3)

The app currently reflects the minutes. Of the ~39 Open Play listings live today, **32 are
venue/organizer-hosted** (no booking behind them; a per-player fee of ₱300–₱500; capacity 15–21) and
**7 are player-hosted** (a court the player booked and paid for; free to join). **Phase 1 Task 3 —
"recurring Open Play for venue owners" — built more of the venue-hosted kind, at the team's
instruction.**

**This has to be resolved before item 1 below means anything.** Two ways out:

- **Confirm it** — venues run their own sessions and sell seats. Then item 1 is a real gap and the
  biggest one on this list.
- **Reject it** — only players host, by booking a court. Then Task 3 was built on a false premise
  and should be removed, along with the venue-run session type.

Do not build item 1 until this is answered.

---

## 1. Eligibility is only half built

**Done, and done properly — for anything a PLAYER hosts (including player-hosted open play):**

- A host can set men-only / women-only / open-to-all.
- It is genuinely enforced on the server, on **both** joining and expressing interest. (That second
  one is what makes it real for open play, which joins by interest, not by a join button.)
- Someone with no gender on their profile is steered to set one, not dead-ended.
- It shows on the listing, and there is a filter for it.

**Not done:**

- **Venue-hosted sessions carry no eligibility at all, and no check.** A venue cannot mark its
  Tuesday night women-only — there is no setting. And even if there were, **nothing on the server
  would stop an ineligible player joining.** This is the case §4.5's own examples described.
- **No skill-band eligibility.** "Beginner only", "3.0–3.5 only" does not exist. A skill band still
  only nudges the ranking; it never stops anyone.

**⚠️ A decision was made by implementation, not by the team.** When you are not eligible, you
**still see the listing** — it just tells you that you cannot join. The alternative was to **hide it
from you entirely**. The build picked the first. Nobody signed that off. If the team wanted it
hidden, it is a rework across the listing, the filters, the ranking and the join button together.

*Blocked on: decision 3 — and on item 0 above.*

---

## 2. Open Play has no lobby

Today it is one tap ("I'm Interested") and a count. No confirmed roster, no invited/pending states,
no group chat for the session.

The meeting described something much richer. It has not been built, because the two are genuinely
different products and the wrong guess is expensive.

**Good news: this would not start from nothing.** Organizer-run games already have a working roster
and a working Messenger-style group chat. The work is the membership states (invited / pending /
confirmed / host approval) and connecting what already exists — not building a chat.

*Blocked on: decision 1.*

---

## 3. There are no rules for money

Who may charge, where the money goes, whether PickleBallers takes a cut, what happens on a refund or
a cancellation. Same question again for coaching — the app currently tells the player, in plain
words, *"Nothing is charged now — you pay the coach once they accept."*

This is **not hard to build. We do not know the rules.**

**Worth knowing: real money already moves through the app.** Tournament entry fees (₱450–₱1,200) are
handled today. When the rules land, that is the mechanism to extend — not a new one to invent.

*Blocked on: decisions 2 and 4.*

---

## 4. Two things Phase 1 exposed

**The "Events" tab has no events in it.** Making it a visible tab (as the meeting asked) made this
*more* obvious, not less. What is inside it is ordinary players' games. The real competition —
brackets, divisions, ₱450–₱1,200 entry fees — lives in a separate Tournaments area outside Play.

> **Merge Tournaments into the Play tab as Events, or rename the tab to something honest.** (§16.5)

**A price shows on games that costs you nothing.** When a player publishes a game, the card shows the
venue's hourly court rate — **which the host already paid. Joining is free.** The filter now handles
this correctly ("Free" shows you the right things), but the card still misleads. It was left alone
deliberately: what the card *should* say depends on who is meant to be charging whom.

*Blocked on: §16.5, and decision 2.*

---

## 5. Deferred by design

Not started, and correctly so — these should wait until the core Play and payment rules are settled.

- A platform-wide social feed (club feeds are the working foundation).
- Cart-style checkout — court + coach + equipment in one basket.
- A player-facing way to rent equipment (the owner-side inventory already exists and is unused).
- More than one level of staff permission.
- Re-tuning the ranking weights — only after watching real players use it, not before.

---

## 6. The decisions, all still unanswered

**The three that unblock the most:**

1. **Does Open Play get a lobby?**
2. **Who charges for Open Play, and does PickleBallers take a cut?**
3. **Should a session you cannot join be hidden from you, or shown and marked?**

**The other three:**

4. How are coach sessions paid — when, to whom, with what commission and refund rules?
5. Are "Like" (on posts) and "Interested" (on Open Play) meant to be different things?
6. Final homepage wording — "Play / Book Court / Find Coach", or the meeting's "Open Play / Book a
   Court / Get a Coach"?

**Plus six things already live in the app that nobody approved** (§16 of the minutes):

- The **₱499 / 30-day coach subscription** — currently the platform's only working revenue stream.
  Is that the official model, or a stopgap?
- A **"partner revenue ₱229,000"** figure on the owner console. What is it supposed to represent,
  when coach sessions are paid off-platform?
- A full **time-based pricing engine** (peak / weekend / holiday / early-bird). Should listings show
  a price range or a live price? Do surge rules need a platform-level cap?
- A complete **equipment rental inventory** with no player-facing way to rent. Who owns deposits,
  damage, late returns?
- **Tournaments living outside Play** (see item 4).
- **Request-to-book** — may a court still awaiting the owner's approval host a public Open Play
  session? What happens to players who joined a session whose booking is later rejected?

---

## What to do next

1. **Answer item 0.** Everything about eligibility hangs off it, and it may mean deleting work.
2. **Get decisions 1, 2 and 3 in one short meeting.** Nothing substantial can start until they land.
3. Then build payments by **extending the tournament entry-fee flow**, which already handles real
   money.
4. Leave section 5 alone until the above is settled.
