# PB-04 — Bookings can get stuck forever, blocking a court
### Implementation summary · 21 July 2026

This is the record of what was built for audit item #4, checked against what actually
runs. The design rationale lives beside it in
[`PB-04-stuck-bookings-proposal.md`](./PB-04-stuck-bookings-proposal.md); this is the
"what shipped" companion.

---

## What was broken

Two defects, the second worse than the audit stated.

1. **A request-to-book had no deadline of any kind.** On a court set to require the
   owner's approval, a booking was created as `pending_approval` and there it stayed. The
   only expiry logic in the codebase looked at *unpaid* bookings, never *unanswered* ones.
   Every "is this slot taken?" check counted any non-cancelled booking, so a pending
   request held its court — and no code path ever ended that state except the owner
   acting. An owner who ignored a request removed that slot from sale permanently.

2. **Expiry only ran when a player opened their own bookings list.** There was no
   scheduler. So even for the unpaid-booking case the code *did* handle, a lapsed slot
   stayed unavailable to everyone else until the one player who owned it happened to open
   the app.

---

## What was built

**The load-bearing idea:** whether a slot is free is now decided by comparing a stored
deadline against the clock *at the moment of the query* — not by waiting for a background
job to rewrite a status column. Get that right and a lapsed request frees its court
instantly and correctly for every other player, whether or not any sweeper ever runs. The
sweeper became cleanup, not correctness.

Concretely:

- **A deadline on every request** (`approvalDeadline`), set once at creation.
- **A deadline formula** — the owner gets a *share* of the time until the game, and that
  share shrinks as the game approaches:
  `min(the venue's window, share × time-until-play, 30 min before play)`, floored at 15
  minutes and never later than play start. Share = 50% beyond 48h, 25% from 12–48h,
  **10% under 12h**. So a booking two weeks out gives the owner a full day; ten hours out,
  one hour; three hours out, ~18 minutes. The player always keeps most of a short runway
  to find another court.
- **Deadline-aware availability** — the three occupancy checks now treat a past-deadline
  request as not blocking, computed in the query itself. This is the crux.
- **An auto-cancel sweep** every two minutes that cancels lapsed requests, plus the
  same lazy-on-read path as before. Whichever fires first wins exactly once (a
  status-guarded update, no lock).
- **Owner reminders** at the halfway and near-final marks, each sent at most once.
- **Notifications + emails** to both sides on expiry, and — closing the related audit
  item #5 — to the player on rejection, which previously said nothing.
- **A payment-window fix** carried along: approving used to set "pay within 24h" with no
  cap, so a booking approved the evening before a morning game got a deadline *after* the
  court time had passed. It's now clamped to before play starts.

**Player-facing warning**, staged across the flow so nobody is surprised: a "Needs
approval" chip in the court picker; a plain-language block on the review step with a real
clock time ("owner has until 6:00 PM today"), not a vague "24 hours"; "Request booking"
rather than "Pay" at checkout; the real deadline on the confirmation; and a live countdown
in My Bookings that flips to "Expired — you have not been charged" when it lapses.

**Owner-facing**, in the bookings inbox: a countdown chip that shifts green → amber → red,
the most *urgent* request sorted to the top (not the soonest to play), and real settings
for the response and payment windows — which had no controls at all before.

### Adjacent bugs fixed in the same change

- **A live money bug:** approving a booking from the owner *home* screen sent it straight
  to "confirmed", skipping the pay window entirely — court marked booked, nothing
  collected. (It also would have dodged the new expiry logic.)
- The venue-level "require approval" setting was **dead code** — documented as driving the
  per-court default, never actually read. Now wired.
- Booking notifications to a player **led nowhere when tapped**; now routed.
- Several stale "auto-confirmed, no approval step" code comments that contradicted the
  actual flow.

---

## How it was verified

| Check | Result |
|---|---|
| Deadline-formula unit tests (every row of the agreed table + band edges) | **30 pass** |
| Occupancy against a real database (incl. "a legacy row with no deadline still blocks") | **11 pass** |
| Client/server formula mirror (drift alarm) | **19 pass** |
| Full player→owner flow over the real HTTP API | **23 / 23 pass** |
| API typecheck | at the pre-existing baseline — **0 new errors** |
| App typecheck | **clean** |

The 23-check run exercised the whole story end to end against a throwaway database, with
no changes to the live system: player books → owner notified with the deadline → the slot
is held → the deadline passes → the sweep auto-cancels it → both sides told, player told
they weren't charged → the freed slot is immediately bookable again → approving a lapsed
request is refused → approving in time works with a clamped pay deadline → declining
notifies the player → the owner is nudged at the halfway mark without the live request
being cancelled.

Two of my own mistakes were caught by the tests and fixed rather than shipped (a date
parser that accepted garbage, and a countdown timer that never stopped).

---

## Live status

The change was deployed to the live site during review and confirmed working — the
approval warning renders on a real booking with a real deadline. One spacing fix followed
(the warning block was missing the standard horizontal inset every other review block
has); that fix is in source and needs the next PWA rebuild to appear.

---

## What remains

- **Turn it on per venue.** Right now **no venue in the database requires approval** — the
  feature works but is switched off everywhere, so it's only visible where an owner (or an
  admin) sets a venue or court to require it.
- **A one-off cleanup hasn't been run.** Any requests stranded before this change existed
  have no deadline and would keep blocking their courts. A script cancels them silently;
  it has a preview mode to show what it would touch first. Run the preview before the real
  thing.
- **Committing.** The working tree also contains unrelated changes from another session,
  and one shared file was touched by both — that needs sorting before anything is staged.
- **Deferred, by agreement:** a per-court "auto-accept bookings under N hours" option (the
  clean answer to "18 minutes is too short for a same-day request"), a public
  response-rate figure per venue, and a "soft hold" model where several players can request
  the same slot and the first approval wins. None are blocked by what shipped.
- **A follow-up that got more urgent:** the court-editor screen quietly discards a court's
  "inherit" setting on every save. It was already a latent bug; wiring the venue-level flag
  made that setting meaningful, so it now matters. Worth fixing soon.

## Two things found on the way, out of scope

- The **nightly automatic-pricing job is dead** — it calls a function that doesn't exist
  and has been failing silently into a warning every run.
- The API half of the project **has no lint configuration**, so its "lint" step has never
  actually linted anything.
