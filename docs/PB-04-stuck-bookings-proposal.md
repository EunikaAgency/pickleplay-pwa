# PB-04 — Bookings stuck in `pending_approval`

### Investigation + design proposal · 20 July 2026
**No code changed.** This documents what the code does today and proposes a fix.

---

## Part 1 — What's actually broken

### The core defect

A booking on a court set to `approvalMode: 'manual'` is created as `pending_approval`
(`api/src/features/bookings/bookings.controller.ts:480`, `:592`). From that moment:

- It has **no deadline field of any kind.** The Booking schema has `paymentDueAt`,
  `cancelledAt`, `createdAt`/`updatedAt` — and nothing else
  (`api/src/features/bookings/bookings.model.ts:28,35,80`). There is no `expiresAt`,
  no `approvalDeadline`.
- The only expiry function in the codebase, `expireOverdueBookings`
  (`bookings.controller.ts:345`), filters on `status === 'awaiting_payment'`.
  `pending_approval` is never considered by it.
- It blocks the court. Every occupancy check filters `status: { $ne: 'cancelled' }`
  (`bookings.controller.ts:154`, `:172`, `:216`) — so any non-cancelled status holds
  the slot, `pending_approval` included.

Net effect: **an owner who ignores a request removes that slot from sale permanently.**
There is no path in the code that ever ends that state except the owner acting.

### The second defect — expiry only runs on reads, and never on the reads that matter

`expireOverdueBookings` is called from three places, all of them reads of a
*booking list*:

| Call site | Who triggers it |
|---|---|
| `bookings.controller.ts:369` (`listBookings`) | Player opens My Bookings |
| `bookings.controller.ts:682` (`getBooking`) | Player opens one booking |
| `venues.controller.ts:1547` (`getVenueBookings`) | Owner opens the venue inbox |

The function's own docstring is candid about it (`bookings.controller.ts:340`):

> *"Run on read so an unpaid request doesn't linger as a hold forever — there's no
> scheduler, so 'expiry' happens the next time anyone lists those bookings."*

The problem is that **availability queries never call it.** `findSlotConflict` and
`activeBookingsForDate` read raw booking rows. So even for `awaiting_payment` — the one
status expiry *does* handle — a slot whose payment window lapsed keeps showing as
unavailable to every other player until someone who owns that booking happens to open
their bookings screen. The court is blocked by a booking the system already considers
dead.

This is the part worth internalising: **the bug is not really "no cron." It's that
liveness is decided by a status column that a background action has to rewrite, instead
of by a deadline the availability query can read directly.**

### No scheduler exists

`node-cron`, `agenda`, `bull`, `bree`, `node-schedule` — none are in
`api/package.json`. The only background timer in the whole API is an in-process
`setTimeout`/`setInterval` for nightly dynamic pricing (`api/src/index.ts:180-203`).
If you copy that pattern, inherit its weaknesses knowingly: in-process only (two
instances = double runs, no locking), state lost on restart, and a restart at 2am means
no run until 3am *the next day*.

Lazy-expiry-on-read is already an established workaround here — the same admission
appears at `partner-subscriptions.model.ts:62`: *"Called on read (there is no cron)."*

### Four adjacent problems found while tracing this

These are not PB-04 but they sit directly in the path and will bite during the fix:

1. **`paymentDueAt` can land after the game has already been played.**
   `venues.controller.ts:2143` sets `paymentDueAt = now + 24h` with no clamp to the
   booking's start time. Approve a booking at 5pm today for a 9am slot tomorrow, and the
   player's payment deadline is 5pm tomorrow — eight hours after the court time passed.
   Any deadline you add needs clamping to play start; the existing one needs it too.

2. **The venue-level `requireBookingApproval` flag is dead code.**
   `venues.model.ts:225` defines it, and `venues.model.ts:315` documents `'inherit'` as
   "follows the venue's `requireBookingApproval`" — but `bookings.controller.ts:480`
   only reads `court.approvalMode === 'manual'` and never consults the venue. A venue
   that switches approval on at venue level silently gets instant-book on every
   `inherit` court. Worth deciding: wire it, or delete it and the misleading comment.

3. **`status` is an unconstrained `String`, not an enum** (`bookings.model.ts:23`), and
   `updateBookingStatus` (`venues.controller.ts:2127`) does no transition validation —
   an owner can push `pending_approval` straight to `paid`, skipping payment entirely.

4. **Rejection is silent** (this is PB-05). The `notifyUser` call at
   `venues.controller.ts:2164` is gated on `status === 'awaiting_payment'`, so approval
   notifies and rejection does not. Note the *coach* booking flow already has a
   `coach_booking_declined` notification — the venue flow just never got the equivalent.

---

## Part 2 — Proposed fix

### 2.1 The structural change: make the deadline the source of truth

Add one field, `approvalDeadline: Date`, set at creation time for any
`pending_approval` booking. Then change the occupancy checks so a booking stops
blocking the moment its deadline passes — **without waiting for any job to run**:

```
// conceptually, in findSlotConflict / activeBookingsForDate
status !== 'cancelled'
AND NOT (status === 'pending_approval' AND approvalDeadline < now)
AND NOT (status === 'awaiting_payment'  AND paymentDueAt     < now)
```

This is the single highest-value line in the proposal. It means a lapsed request frees
the court **instantly and correctly for every other player**, whether or not a sweeper
ever runs. The background job then becomes a tidy-up that writes the final `cancelled`
status and sends notifications — not the thing correctness depends on.

Do this and the fix is robust even if the scheduler dies. Skip it and you've rebuilt the
same fragility with an extra field.

### 2.2 The deadline formula

You asked for something like *"book a week ahead → owner has a day."* That's the right
instinct, but a single fixed window breaks at short lead times: a booking made at 7pm
for 8pm tonight cannot give the owner 24 hours. The deadline has to be the tightest of
several constraints:

```
approvalDeadline = min(
    now + venue.approvalWindowHours,   // the venue's own policy, default 24h
    now + (leadTime × share),          // the owner's slice of the runway
    playStart − 30 minutes             // must resolve before the court time
)
floored at 15 minutes from now
```

…where `share` tightens as the game gets closer:

| Lead time | Owner's share | Why |
|---|---|---|
| More than 48 h | 50% | Venue window binds anyway — effectively a flat 24 h |
| 12 – 48 h | 25% | Same-day-tomorrow; owner still gets hours, player keeps most of the runway |
| Under 12 h | **10%** | Urgent — the player keeps 90% of the time to rebook elsewhere |

What that produces end to end:

| Player books… | Lead time | Owner gets | Which rule bound it |
|---|---|---|---|
| 2 weeks out | 14 days | 24 h | venue window |
| 3 days out | 72 h | 24 h | venue window |
| Tomorrow 9am (booked 9pm) | 36 h | 9 h | 25% band |
| Tomorrow, 14 h out | 14 h | 3 h 30 m | 25% band |
| Later today (10 h out) | 10 h | **1 h** | 10% band |
| In 3 hours | 3 h | **18 m** | 10% band |
| In 45 minutes | 45 m | 15 m | floor + play-start cap |

The principle underneath: **the owner's window is their slice of the player's runway,
and it shrinks fast as the game approaches.** A player booking 10 hours out learns
within the hour and still has 9 hours to find another court. A player booking 2 weeks
out has no urgency, so the owner gets a full day and a once-a-day check-in still catches
it.

Two notes on the shape of this:

- **The band edges are deliberate steps, not a smooth curve.** Each boundary is about a
  2–2.5× change (24h→12h at 48h; 3h→1.2h at 12h) rather than the 5× cliff you'd get
  jumping straight from 50% to 10%. That's small enough not to feel arbitrary to an
  owner watching two similar bookings, and it keeps the rule explainable in one table —
  which matters more than mathematical elegance, because owners have to be able to
  predict it.
- **The 50% band is nearly always redundant** at the default 24h venue window, since 50%
  of anything over 48h exceeds it. Keep the term anyway: it does real work for a venue
  that sets a longer window (at 72h, a 3-day booking is held to 36h rather than 72h).

**A related setting worth offering:** several venues will find 18 minutes on a
3-hour-out booking unworkable — not because the rule is wrong, but because manual
approval itself is wrong for same-day bookings at a venue with no one watching the
inbox. Rather than loosening the formula for everyone, let a court set *"auto-accept
bookings under N hours out"* so short-lead requests skip approval entirely. That fixes
the mismatch at its source and keeps the urgent-lead rule tight for the venues that do
staff their inbox.

`venue.approvalWindowHours` should be a real venue setting with a default of 24, sitting
next to the existing `bookingPayWindowHours` (`venues.model.ts:227`). Let owners tighten
it — a busy venue may want 6 hours — but cap it so it can't be set absurdly long.

**Apply the same clamping to the pay window**, which currently has none (defect 1
above): `paymentDueAt = min(now + payWindowHours, playStart − 15min)`.

### 2.3 The sweeper

With 2.1 in place, this is cleanup rather than correctness, so the simplest thing that
works is fine:

- Extend `expireOverdueBookings` to handle both statuses, keyed off each row's own
  deadline field. It's already the shared helper — also fold in the duplicated copy at
  `payments.controller.ts:116-119` so the logic lives in one place.
- Run it on an interval (every 5 minutes) from the boot sequence, following the existing
  `index.ts:180` precedent. Guard against multi-instance double-runs with a
  `findOneAndUpdate` lease on a small `jobs` collection.
- **Also call it from the availability endpoints**, not just the booking lists. That
  closes the "slot falsely blocked" hole even if the interval is down.

An external system cron hitting an authed `/internal/sweep` endpoint is the more robust
option if you'd rather not hold state in-process. Either is acceptable; the in-process
interval is less deployment work and 2.1 covers you if it fails.

---

## Part 3 — Player-side warning

### Recommendation: don't lead with an "I understand" modal

You suggested a popup with an "I understand" button. That will work, but on its own it's
the weakest version of this — a confirmation modal is the thing users click through
fastest, and it fires at the one moment they're most committed to finishing. It protects
you legally and teaches almost nothing.

Stronger approach, in order of how much each actually prevents a confused, angry player:

**1. Label the difference before they ever tap.** The court card and the booking button
should not say "Book" for both kinds of court. Approval courts say **"Request to
book"**; instant courts say **"Book instantly."** One word change, applied at the point
of choice, does more than any modal — the player self-selects with the constraint
already known. Pair it with a small `⏳ Owner approval` chip on the court card.

**2. Put the real explanation on the confirmation step, not in a dismissable overlay.**
Where the player reviews price and time, show a short block that states the three things
they need:

> **This court needs owner approval**
> Your card won't be charged yet — we'll only hold your slot.
> **The owner has until 6:00 PM today** to accept. If they don't respond by then, your
> request is cancelled automatically and you'll be notified straight away.

The deadline must be **a real timestamp computed from the formula**, not a generic "24
hours." Showing "until 6:00 PM today" is what makes this concrete enough to be
remembered.

**3. Then the modal — but make the button carry the meaning.** If you keep a
confirmation step, don't label it "I understand" (agreeing to nothing in particular).
Label it what it does:

> **Send request** — cancel if no reply by 6:00 PM

**4. Where the effort actually pays off: the post-booking status screen.** This is the
screen the player returns to while anxious, and it's where a live countdown belongs:

> ⏳ **Waiting for owner** · 5h 22m left
> If Sunrise Courts doesn't respond by 6:00 PM, this request cancels automatically and
> nothing will be charged.

**5. Give them an exit.** A player stuck waiting is a player who might book elsewhere.
"Show me instant-book courts at this time" as a secondary link on that status screen
converts a dead wait into a booking.

If you only do one of these five, do #1. If you do two, add #4.

**One product decision this raises:** should a `pending_approval` booking block the court
at all? Today it does (hard hold). The alternative is a **soft hold** — let several
players request the same slot, first approval wins, the rest auto-decline with a
notification. That converts far better on popular courts and makes a slow owner cost
*them* rather than everyone. It's more work and needs care around the payment step, so
I'd ship the hard hold with deadlines first — but it's worth knowing the option exists
before the schema settles.

---

## Part 4 — Owner-side notifications and warnings

The infrastructure is already there and is genuinely good: `notifyUser`
(`api/src/shared/lib/notify.ts:30`) persists a notification, pushes an SSE event, and
fires Web Push, all best-effort and non-throwing. `booking_pending_approval` is already
wired at `bookings.controller.ts:618`. What's missing is urgency and escalation.

### At request time
Existing notification stays, but the body must carry the deadline:

> **New booking request** — Court 2, Sat 3:00 PM
> Respond by **6:00 PM today** or it cancels automatically.

### Escalating reminders
Fire off the same sweeper that handles expiry, at fractions of the window rather than
fixed hours — so it scales with short-lead bookings:

| When | Channel | Tone |
|---|---|---|
| 50% of window elapsed | Push + in-app | "3 hours left to respond to Maria's request" |
| 80% elapsed | Push + in-app + **email** | "Final reminder — expires at 6:00 PM" |
| Deadline passed | Push + in-app + email, **to both sides** | "Request expired — the slot has been released" |

Track a `remindersSent` array on the booking so restarts don't re-send.

### In the owner's booking inbox
Every pending row gets a live countdown chip, colour-shifting as it runs down:

```
🟢 5h 22m left     — comfortable
🟡 1h 40m left     — under 25% remaining
🔴 12m left        — under 10%, row pinned to top
```

Plus a persistent banner when anything is pending:
**"2 requests awaiting your response. The oldest expires in 1h 40m."**

Sort pending requests by deadline ascending by default — the most urgent thing should
never be below the fold.

### Closing the loop on expiry (and on rejection — PB-05)
When the sweeper cancels, both parties get told. Use `cancellationReason:
'Owner did not respond in time'` so it's distinguishable in reports from a player
cancellation. New notification types needed: `booking_request_expired` and
`booking_rejected`. Note that `type` is an unconstrained string
(`interactions.model.ts:52`) — adding these needs no schema change, but also gets you no
compile-time safety, and the PWA's icon/routing switch must be updated in the same
change or the notification renders as a fallback.

### Optional, and worth considering: make ignoring requests cost something
Track response rate per venue and surface it — **"Responds within 2 hours · 94% of
requests"** on the venue listing. Owners optimise for what players can see. A venue that
routinely lets requests expire either improves or stops being chosen, and either outcome
is better than the status quo. If response rate falls below a threshold, offer to switch
their courts to instant-book.

---

## Suggested order of work

1. `approvalDeadline` field + the formula + clamp the existing `paymentDueAt` *(§2.1–2.2)*
2. Deadline-aware occupancy checks — **the fix that makes courts free themselves** *(§2.1)*
3. Extend + schedule the sweeper, dedupe the `payments.controller.ts` copy *(§2.3)*
4. Expiry + rejection notifications, both sides — also closes PB-05 *(§4)*
5. Owner inbox countdown, banner, deadline-sorted list *(§4)*
6. Player-side: "Request to book" labelling, confirmation copy, status countdown *(§3)*

Steps 1–3 are the actual bug and are small. Steps 4–6 are what stop it feeling broken to
the people involved.

## Decisions needed from you

- **Default `approvalWindowHours`** — 24 assumed. Confirm.
- **The 10% band floor** — a 3-hour-out booking gives the owner 18 minutes. Right call,
  or should the urgent band have a 30-minute floor instead of 15?
- **Per-court "auto-accept under N hours"** *(§2.2)* — worth building alongside, or leave
  it until a venue complains?
- **Hard hold vs soft hold** on `pending_approval` *(§3)* — affects the schema, so worth
  settling before step 1.
- **`requireBookingApproval`** — wire it up to `'inherit'`, or delete the flag and its
  comment?
- **Response-rate metric** *(§4)* — in scope for launch, or later?
