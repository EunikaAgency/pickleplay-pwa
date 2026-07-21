# PickleBallers — what's left, in plain words

**From:** the meeting on **16 July 2026**
**Written:** 17 July 2026
**Aiming for:** the main journeys working **20–22 July** · launch **end of July**

This is the same list as `2026-07-17-open-tasks.md`, written without the technical words.
Nothing here is guessed — every "done" was checked by actually using the app, and every
"not done" was checked the same way.

| mark | means |
|---|---|
| ✅ | done and checked |
| ❌ | not started |
| 🟡 | half there |
| ⚠️ | it exists, but something's wrong with it |
| ⛔ | we can't move until someone else does something |
| ❓ | nobody has checked yet |

---

## The big one from the meeting — now done ✅

**"A player should have to ask before joining, and the host decides."**

This was the number one gap in the meeting notes, and it's built. A host can now switch their
play to *"approve players before they join"*. People ask, wait, and only the ones the host
approves get a slot and can see who else is playing.

Two things worth knowing:

**It's the host's choice, every time.** The setting starts **off**. If a host does nothing,
their play works exactly like it always has — tap Join, you're in. Nothing that already
existed was changed.

**Underneath it, something bigger was broken.** Open Play had no proper lobby at all, and it
never asked the server whether someone was allowed in. That means the rules the app advertises
— *men only*, *women only*, skill levels, player limits — **had never actually stopped
anyone**. A play marked "men only" let anybody in. That's fixed too, and it had to be fixed
first, because there was no point adding a doorman to a door nobody walked through.

---

## Other things we fixed along the way ✅

**Plays were lying about how many people fit.** A host would say "8 players", the app would
show "8", and then the 5th person to try was told *"This game is full"* — because the app was
only ever holding 4 slots no matter what the host picked. Seven real plays had this. All
repaired, and the size picker no longer offers numbers the system would reject anyway.

**The old Open Play listings had no owner and earned nothing.** There were 92 of them —
nobody could host, edit, or be paid for any one of them, and PickleBallers took no cut because
no court was ever booked. Rather than delete them and leave the app looking empty, we turned
the 55 upcoming ones into **real plays with real hosts on real booked courts**, and removed
the 37 that had already happened. The Open Play list ended up **fuller than before**, and
plays with a genuinely booked court went from **5 to 78**.

**There's now one page to switch the new things off.** In the admin site under **Feature
flags**, with a single button that turns off everything added this week — and *only* that.
We checked it doesn't touch payments, fees, or email.

---

## Still to do — the development side

- ❌ **Discounts for senior citizens and PWDs.**
  Right now there is nowhere to record a senior or PWD rate — not for any of the 107 prices in
  the system. Staff also have no way to say "this customer is a senior" when taking a booking.
  The meeting was right that this was never considered before. This is genuinely new work.

- 🟡 **Letting an owner claim a venue that's already listed.**
  Further along than the meeting thought. Owners *can* already claim a venue and upload proof —
  **29 claims are sitting there waiting to be reviewed**. What still needs checking is whether
  a new owner is shown *"this venue already exists, is it yours?"* before they create a
  duplicate. Worth doing: **all 101 venues currently have no owner attached.**

- ❓ **The map being unusable on a phone.**
  Pins pile on top of each other into one blob. The meeting asked for a clear List/Map switch,
  a full-screen map, and pins that group tidily as you zoom. Nobody has looked yet.

- ❓ **A filter menu that disappears on a phone.**
  Someone was already part-way into fixing this before we started — there's unfinished work
  sitting in the filter bar and the styling file. Needs finishing and testing on a real phone.

- ❓ **Two different routes to "Book a court".**
  The meeting noticed you can reach similar booking screens more than one way, which is
  confusing. Not yet mapped out.

- ⛔ **Loading the latest venue and court list.**
  The tool to do this already exists and works — there are 101 venues and 874 courts loaded
  now. **We just need the up-to-date spreadsheet from the client.**

- 🟡 **Finishing the website.**
  Most of it is built — the public pages, the admin area, and the owner, organizer and coach
  areas all exist. Still unfinished: creating a game from the website doesn't save yet, joining
  and leaving doesn't work there, the city pages are placeholders, and the pricing and
  membership pages still show made-up sample content.

- ⛔ **Marvin's new look.**
  Waiting on Marvin. The app is already set up so colours and fonts can be changed in one place
  and apply everywhere, so this should be quick once the direction arrives.

- ⚠️ **Testing all five kinds of account.**
  Player, owner, coach and organizer have all been used. **The venue staff account never has —
  there isn't a single one in the system.** So nobody has confirmed staff see the right things
  and are blocked from the rest.

- ❓ **Checking every dashboard shows real numbers**, not leftover sample data.

- ❌ **A tidy-up pass** for speed and duplicated screens. Not started.

- ⚠️ **A small thing we found and left alone.** On the screen where a host edits their play,
  the approval tick box sits behind the "Save changes" bar at the bottom, so it's half-hidden
  until you scroll. It's the same kind of problem we fixed elsewhere in this feature. Ten
  minutes to fix; we left it because that screen wasn't part of this job.

---

## Still to do — the client and business side

- ⛔ **Bank, merchant and compliance paperwork.**

- **Decide how people actually pay.** GCash is the plan. Be aware: **there is no working GCash
  connection yet.** The word "GCash" appears in the sample data, but the only payments that
  really go through are the fake test-card ones. Treat this as not built until someone connects
  it for real.

- **Send the latest venue and court spreadsheet** — the loading job above is waiting on this.

- **Send the earlier competitor research and product documents.**

- **Do the manual walkthrough** of the player journey.

- **Confirm the commission and revenue split.**

- **Confirm how coaches and organizers make money** and what the platform takes.

- **Finalise Marvin's design direction** — the design work is waiting on this.

---

## Shared

- Keep talking in the group chat rather than saving everything for the weekly meeting.
- Send short progress updates with screenshots more often.
- Sign up to the competing apps as realistic fake users and write down what they do better —
  **including working out which app "360" actually refers to.**
- **Agree what absolutely must be in for launch**, and what can wait until after.
- One full end-to-end test with real accounts before going live.

---

## Decisions only you can make

### 1. Can venue staff see money? *(needs an answer)*

The meeting notes say staff must **not** see financial reports or revenue.

Right now they partly can. Staff are correctly blocked from the overall money report and from
changing prices — but they **can** open the per-venue statistics, which include revenue.

Here's the thing: **that was a deliberate decision by whoever built it**, written down at the
time — the thinking was that staff run the front desk, so they need to see how their venue is
doing. It isn't a mistake someone can quietly patch.

So it's a real choice: *do staff see their own venue's takings, or nothing at all?* Somebody
needs to decide.

### 2. Two of our own documents disagree

An earlier plan (15 July) lists staff permissions under **"leave for later, on purpose"**. The
16 July meeting treats them as needed for launch. Worth settling which is right.

### 3. The 17 open questions from the meeting are still open

Who collects the money, when the platform takes its cut, what coaches and venues agree between
themselves, what checks someone passes before becoming a coach or organizer, what happens on a
cancellation or a no-show, and how senior/PWD rates should be set up.

---

## What was decided on 17 July

From the group chat — John Kenneth asked whether players who *aren't* organizers could also
create events, and whether players could make their own Open Play approval-based.

**Emman's answer: "oo lahat"** — yes to both — *"mas madaling nao-off lang yan via admin switch
later kesa mahabang discussion sa meeting."*

Both were built exactly that way: **on by default, with a switch to turn them off.**

One nice surprise: **players who aren't organizers could already create events.** There was
never anything stopping them. The only organizer-only part is *charging a fee* to join. So
nothing had to be built there — we just added the off switch.

---

## Where to find things

- **The admin site** (feature flags, settings, approvals): **pickleballer.eunika.xyz**
- **The player app**: **pickleballer-pwa.eunika.xyz** — this one has no admin pages at all, so
  if you try an admin address here it just shows nothing rather than telling you you're in the
  wrong place.
- **A picture walkthrough of the new approval feature**, written for players:
  `reports/approval-to-join.html`
- **The fuller written reports** are in `reports/` — one page, a longer version, and a
  technical one.
