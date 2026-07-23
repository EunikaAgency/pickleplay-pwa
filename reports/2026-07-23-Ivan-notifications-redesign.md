# Ivan Report — 2026-07-23: Notifications list rebuilt around the sentence

- **Author:** Ivan (drafted with Claude Code)
- **Date:** 2026-07-23 (Thursday)
- **Area:** Player PWA — Notifications (`features/profile/NotificationsScreen.tsx`, `shared/styles/index.css`)
- **Try it:** https://pickleballer-pwa.eunika.xyz/notifications — ✅ **live** (Vite dev server, just refresh)
- **Commits:** `038150f` (redesign), `38e9490` (roadmap entry) — both pushed
- **Same day:** [Nearby redesign](2026-07-23-Ivan-nearby-redesign.md) · [verification audit](2026-07-23-verification-audit.md)

The trigger was blunt: *"yung atin parang school project lang yung pagkaka design."*
The comparison offered was Facebook's notification list. That comparison turned out
to be useful, because the gap wasn't taste — it was three specific structural
decisions, plus three real bugs sitting underneath them.

| Part | Workstream | Result |
|------|-----------|--------|
| **A** | Row content model — sentence-first instead of label + restatement | ✅ built + verified |
| **B** | Visual system — rows, discs, unread signal, day grouping | ✅ built + verified |
| **C** | Bugs found in existing code | 3 found, 3 fixed |
| **D** | Not done — needs a decision | 2 items, see [Open](#open--needs-a-decision) |

---

## Status

Committed and pushed. The PWA is served by a Vite dev server under pm2
(`pickleballer-pwa`, `npm run dev --port 9000`), so the change is already live —
no deploy step. The public roadmap was updated in the same push, as the project
rules require.

---
---

# Part A — The row content model was the real problem

## What was there before

Each row printed a machine-generated title, then the human sentence that already
said the same thing, joined into one run-on line:

> **Payment received — booking confirmed** — Your booking at The Dink Lab on Friday, July 24, 2026 at 4:00 AM is confirmed.

Three things compound there:

1. **The title is a system label, not language.** Nobody says "payment received —
   booking confirmed."
2. **The body restates it in full.** So the label costs a line and adds nothing.
3. **The server writes dates long-hand.** `api/src/features/bookings/bookings.controller.ts:15`
   formats with `{ weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }`,
   so a single date phrase is ~35 characters before the sentence even gets going.

Result: a wall of text where every row looks the same length and nothing is
scannable. Facebook has no title at all — one sentence per row.

## What it is now

| Line | Content | Rule |
|---|---|---|
| Primary | The body sentence | Title only stands in when there's no body |
| Meta | `2h ago · Bookings` | Category derived from `type` |

Dates are compressed **for display only** — the stored text is untouched:

```
Friday, July 24, 2026 at 4:00 AM   →   Fri Jul 24 · 4:00 AM
```

The year is dropped when it's the current year, the way a chat timestamp behaves.
The regex is deliberately narrow (full weekday + full month + 4-digit year), so it
only fires on the server's exact `fmtDate` output and leaves anything else alone.

**Why the category line matters.** Dropping the title created a risk: two
notifications about the same booking could end up with identical text. The
`time · category` line keeps them tellable apart — and, more usefully, it made an
existing data problem visible rather than hiding it (see [Open](#open--needs-a-decision)).

---
---

# Part B — The visual system

## Rows, not cards

The first attempt used cards. It was wrong, and the screenshot showed why: fifteen
stacked cards is fifteen competing shadows, and the eye gets no rest. Reverted to
flat rows with generous padding and a press state — the structure comes from the
icon column, not from borders.

## The disc

A 12px-radius pastel square is the single biggest "template" tell. Replaced with a
46px saturated circle carrying a white glyph. A circle at avatar size reads as an
*identity*, which is what a notification is fundamentally about.

## Unread — and one thing that had to be undone

First attempt: tint unread rows blue, plus a leading accent rail. The screenshot
killed it immediately. With a full inbox **every row is unread**, so the list became
one solid blue slab with scalloped white gaps where adjacent rounded corners met.
The tint stopped carrying any information at all.

Facebook doesn't tint. Unread is now:

- a trailing blue dot,
- heavier text (600 vs 500),
- a full-strength icon (read rows drop to 55% opacity).

This is a case where the design only failed once it met real data volume. Worth
remembering: **fifteen unread rows behave differently from one.**

## Day grouping

Sections under `Today` / `Yesterday` / `Earlier this week` / `Earlier`, as real
17px headings rather than tiny uppercase eyebrows — they have to hold their own
against a page of body copy. Buckets are calendar-day based, not elapsed-hours, so
a 2 AM notification still reads as "Today."

## Smaller things

- Filter chips carry counts: `Unread · 50`, `Friend Request · 1`.
- "Mark all read" was a solid black slab competing with the screen title; it's now
  a quiet tinted pill. It's a secondary action.
- Accept / Decline / Confirm went from black rounded-rect to brand-blue pills with
  a neutral secondary.

---
---

# Part C — Three bugs found underneath

## C1 — Notification colours: 12 types handled, ~60 emitted

`bgForType()` was a 12-case switch. The API emits roughly sixty types
(`grep -rhoP "type:\s*'\K[a-z_]+" src/features/*/[a-z]*.controller.ts | sort -u`).

Everything unlisted fell through to `default: 'blue'` — which meant **every**
`feed_*`, `club_*`, `game_join_*`, `coach_booking_*`, `claim_*`, refund and
no-show notification rendered identically. That's what made the list look monotone;
it read as a design choice but it was a coverage gap.

Rewritten to match on **outcome stems** rather than enumerating types:

| Colour | Meaning | Matches |
|---|---|---|
| Lime | It went through | `approved`, `confirmed`, `completed`, `accepted`, `joined`, `full` |
| Coral | It needs you / it went wrong | `cancel`, `reject`, `declin`, `deni`, `remov`, `expired`, `kick`, `no_show`, `refund` |
| Gold | Someone appreciated you | `like`, `_like`, `repost` |
| Blue | Conversational / informational | everything else |

Order matters and is commented in code: `booking_no_show_cleared` contains
`no_show` but is positive, so positives are tested first. New server types now get
a sensible colour without anyone remembering to come back to this file.

## C2 — Active chips were white-on-white in dark mode, app-wide

```css
.chip.active { background: var(--ink); color: white; }
```

`--ink` flips to `#f3f5f9` (near-white) in dark mode. So a selected chip was a
white pill with white text — **invisible on every screen using a v1 chip**, not
just this one. Confirmed in the dark screenshot: the "All" chip was a blank pill.

Fixed with `color: var(--bg)`, which is the inverse of `--ink` in both themes.
One line, no new token.

## C3 — The push banner's icon had no styling

The banner renders `<div className="ic blue">`, but `.ic` was only ever defined
under `.notif`. Outside that scope it matched nothing, so the bell rendered as a
bare glyph on no background. Now scoped to `.push-banner` too, at 40px.

---
---

# Verification

Screenshotted the running PWA via Playwright against a signed-in account with 50
notifications, at 390×900 @2x, in **both** light and dark:

| Check | Result |
|---|---|
| Rows rendered | 50 |
| Day-group headers | present |
| Unread dots | 50 / 50 |
| Icon shape / size | `border-radius: 50%`, `46px` |
| Leftover `.msg` nodes from the old markup | 0 |
| Console errors | 0 |
| Horizontal overflow (`scrollWidth > clientWidth`) | none |
| Dark mode | verified separately (`localStorage['pickleballers:theme']`) |

Build and static checks:

- `npx tsc --noEmit` → **52 errors, identical to the pre-change baseline**
  (verified by stashing). All 52 are pre-existing, in `features/social/`,
  `MembersScreen`, `CourtDetailsScreen`, `SettingsScreenV2` — untouched here.
- `npx eslint` on the changed file → clean.
- `npx vite build` → clean, both `app/` and `web/`.

---

# Open — needs a decision

## 1. Duplicate notifications for one booking (server-side)

The original screenshot shows two notifications arriving together for the **same**
booking at the same timestamp:

- "Payment received — booking confirmed"
- "Booking confirmed"

This is a data problem, not a display one. It was partly camouflaged before because
the two titles differed slightly; with the label dropped, the bodies are very close
and the duplication is obvious. **This was deliberately not papered over** — hiding
it client-side would have buried a real bug.

Fix belongs in `api/` — collapse the two emits into one. Not started.

## 2. Real avatars — the last gap to Facebook

Facebook shows the actual **person's photo**, with a small coloured type badge
overlaid at the bottom-right. That's what makes their list feel human; ours shows a
category icon.

The `Notification` model (`api/src/features/interactions/interactions.model.ts:50`)
carries no actor:

```js
{ userId, type, title, body, icon, linkUrl, tag, isRead }
```

So this needs an API change, not a CSS one:

1. Add `actorId` (ref `User`) to the schema, set at each emit site.
2. Populate it in the notifications list response; expose avatar + name on `ApiNotification`.
3. Client: disc → avatar image, with the current coloured disc shrunk to a badge
   at bottom-right — exactly Facebook's composition, and a graceful fallback for
   system notifications that have no actor.

Estimated as the last ~20% of "parang Facebook." Not started — needs sign-off
because it touches the notification model and every emit site.
