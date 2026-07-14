# Ivan Report — 2026-07-14: Phase 1 from the 8 July minutes (client / WhatsApp version)

- **Author:** Ivan
- **Date:** 2026-07-14
- **Area:** Play tab (Open Play / Events, ranking, filters) + Recurring Open Play for venue owners
- **Audience:** Client (non-technical)
- **Source:** `PickleBallers_Updated_Minutes_July_8_2026_-with-Visuals.pdf` — Phase 1 of the follow-up plan
- **Try it:** https://pickleballer-pwa.eunika.xyz/games

---

## WhatsApp message (copy-paste ready, no icons)

PickleBallers — Update

We've finished the first batch of work from the 8 July meeting. Five items, all live.

Open Play and Events are side by side now. They used to sit behind a dropdown that only said "Open Play" — so if you never thought to open that menu, you had no way of knowing Events even existed. They're both visible tabs now.

Tapping Play opens on Open Play. It used to open on Events, which meant the thing most people are actually looking for was one hidden menu away, while tournaments greeted you instead.

The Discover list is now ranked on our servers instead of on your phone. The rules haven't changed — how soon it starts, how close it is, how well it matches your level, whether there's still room, whether a friend is going. But two things were wrong before: two players could open the same list and see it in a different order, and changing the balance between those five things meant releasing a new version of the app to everyone. Both are fixed. It also fixes a real gap: your phone could only rank the sessions it had already been handed, and it was handed the soonest ones — so "nearest" quietly meant "nearest among the soonest", and a session close to you but a few weeks out simply never showed up. It now considers the whole upcoming list.

Four new filters. Free or paid to join, open to anyone or invite-only, weekly or one-off, and which venue.

Venue owners can now run a weekly Open Play session on their own courts. Before, only event organizers could set up a recurring session — so an owner running the same session every Tuesday had to re-create it by hand, week after week. They can now do it from the owner console, and they can edit it: change just this week's start time, or change the price for this week and every week after, or end the series altogether. Past sessions are left as they happened, so raising the price never changes what last week's players were charged.

Two real bugs turned up while we were doing this, and both are fixed.

Every recurring Open Play session was being saved on the wrong day of the week. Ask for Tuesday, and the app quietly booked you a series of Mondays. Every recurring session ever created was one day early. It came from a timezone conversion that pushed midnight in Manila back into the previous day.

The Free/Paid filter would have lied to you. A game hosted by another player shows the court's hourly rate on its card — but that is what the HOST paid to book the court. Joining it costs you nothing. If we'd built the filter on the number shown on the card, filtering for "Free" would have hidden the games that are actually free. "Free" now means free to you, which is the only thing you wanted to know.

You can try it here: https://pickleballer-pwa.eunika.xyz/games

---

## What's included (feature list)

1. **Open Play and Events as visible tabs** (§3.4) — the section dropdown is gone. The two tabs pick the *product*; the row beneath them (Discover / Joined / Manage) picks the *view* of it, and they're deliberately styled differently so they don't read as one control.
2. **Play opens on Open Play** (§3.3) — a bare tap on Play lands on Open Play, not Events. The chosen tab also survives a page reload.
3. **Server-side Discover ranking** (§4.2) — the relevance scoring (time fit 30% / distance 25% / skill fit 20% / spots left 15% / friends 10%) moved from the phone to the API. Every device now gets the same order, and the weights can be retuned without an app release.
4. **Ranking now sees the whole list** — it scores every upcoming session and *then* picks the top ones, instead of ranking only the handful the server had already picked by date.
5. **Four new Discover filters** (§4.3) — cost to join (free / paid), who can join (open / invite-only), how often (weekly / one-off), and venue.
6. **Recurring Open Play for venue owners** (§5.3) — owners and their staff can create a weekly series at a venue they manage. Deliberately scoped: an owner gets that one capability, not the whole organizer role, and only at their own venues.
7. **Series editing** — three scopes, as the meeting asked: *just this occurrence* ("the court's double-booked this Tuesday, so we start an hour later"), *this and every future one* (the default), and *end the series*. Anyone who already said they're coming to a changed session is notified.
8. **Past sessions are left alone** — a price rise applies from today forward, never retroactively to what last week's players were charged.
9. **Staff can't see the owner's revenue** (§13.7) — this one was already fixed before the meeting notes were written; we verified it and closed the item so it doesn't get re-done.

## Fixes along the way

- **Recurring sessions were landing on the wrong weekday.** The date generator picked the right day of the week and then wrote it out in UTC — and midnight in Manila is 4pm the *previous* day in UTC. So every generated date was one day early: ask for Tuesday, get a series of Mondays. Every recurring Open Play session ever created was affected. Fixed, and every date the API writes now follows the same rule.
- **Owners were locked out of the screen they'd just been given.** We opened up *creating* a series for owners but not the *list* endpoint, so an owner opening the page was greeted with "Organizer events permission required". Caught by running it in a browser, not by the code checks.
- **The Free/Paid filter would have hidden free games.** A game's card shows the venue's hourly court rate — the host's cost, not yours. The filter is now built on what it actually costs *you* to join.

## Two things that could not be built, and why

Both are waiting on a decision from the team, not on us.

- **The "Events" tab has no events in it.** The meeting described Events as structured, organizer-run competition — brackets, divisions, entry fees. In the app, that already exists, but it lives in a separate Tournaments area *outside* the Play section. What the Play tab calls "Events" is actually a list of player-hosted games. Making Events a visible tab (as asked) makes this more obvious, not less. **The team needs to decide: merge Tournaments into the Play tab as the Events tab, or rename the tab to something honest.**
- **A player-hosted game's card still shows a price you don't pay.** It shows the venue's hourly court rate, which the host already paid. The filter now handles this correctly, but the *card* still reads as though joining costs ₱350. We did not change it, because what the card *should* say depends on the Open Play payment rules — who may charge, who collects, whether the platform takes a fee — and those are still undecided.

## Status

Built, running on the dev/preview server, and pushed.

Verified end to end, not just type-checked:

- **72 automated checks** on the ranking and filter logic (39 on the server, 33 in the app).
- **15 API checks** on recurring Open Play — an owner can run a series at their own venue; a player still can't; an owner still can't at someone else's venue; all three edit scopes behave; a cancelled session can't be edited.
- **13 browser checks** driving the real app — the tabs render, Play opens on Open Play, the section survives a reload, each tab fetches its own ranked feed, the filters narrow the list and can be cleared, and an owner can open the recurring-sessions screen and only sees their own venues in the picker.

All 100 passing.
