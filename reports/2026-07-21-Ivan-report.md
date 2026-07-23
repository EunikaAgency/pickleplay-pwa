# Ivan Report — 2026-07-21: Gaps Audit Update (client / WhatsApp version)

- **Author:** Ivan
- **Date:** 2026-07-21 (Tuesday)
- **Area:** Full-project reliability & gaps audit — `web/` (dashboard + booking site), `app/` (player PWA), `api/` (backend)
- **Audience:** Client (non-technical)
- **Task board:** [gap-prevention-user-facing-reliability-audit-tasks.md](gap-prevention-user-facing-reliability-audit-tasks.md) · live HTML: `https://pickleballer.eunika.xyz/plan/ivan/project-gap-prevention-user-facing-reliability-audit.html`

---

## Client message (copy-paste ready)

**PickleBallers Gaps Audit Update 07/21/26**

**Dashboard & Booking Website:**

- The "Book a Court" page now sends users to the mobile app. Even typing the booking URL directly redirects to the app.
- Login and Register pages now send users straight to the mobile app login instead of the website's download page.
- All "Sign in to join," "Sign in to register," and similar buttons across the site now go directly to the mobile app login. No more chain of redirects.
- The "Inquire about booking" button on venue pages now reads "Book a court" and opens the mobile app.
- The "Create" button for clubs sends non-logged-in users straight to the mobile app.
- The "Create a Game" page now shows a prompt to open the mobile app instead of a dead form.
- Coach profile pages now have a green "Hire Coach" button that opens the mobile app.
- Open Play detail pages now say "Join Game."
- The Compete menu in the header now has five entries: Open Play, Leagues, Quick Game, Round Robin, and Mini Tournament. The last three open the mobile app.
- Every "Host," "Create," "Join," and "Book" button on the site now consistently goes to the mobile app login.
- A broken page no longer takes down the whole website — shows a friendly error card instead.
- The owner dashboard no longer crashes if one venue has incomplete stats.
- No more full-screen "Loading..." flash when clicking between owner or admin tabs.
- Mistyped URLs inside owner, admin, organizer, or coach consoles now show a proper "not found" page.
- Chat now shows an error and a retry button when a message fails to send.
- All prices now display in pesos consistently.
- Deleting a conversation no longer accidentally brings it back if two actions overlap.

**Player Mobile App:**

- If one screen hits an error, it no longer whitescreens the entire app. A friendly card with a reload button appears.
- The owner dashboard now tells apart "truly empty" from "failed to load" for bookings, games, and reviews.
- The Edit Club retry button actually works now instead of being stuck forever.
- The social feed no longer falsely says "No posts yet" when it simply failed to load. Now has a retry.
- Tournament score sheets now properly reset between matches. Scores no longer leak from one match to another.
- Map marker pins now work even offline.
- The clubs directory no longer shows "No clubs found" when it just couldn't load. Now has a retry.
- Hiding or deleting a feed post now properly brings it back if the action failed.
- Failed chat loads now have a retry button.
- Organizer approve, check-in, cancel, and remove actions no longer fail silently.
- The venue overview now warns if some data couldn't load instead of showing zeros that look real.
- The owner profile now shows loading and error states instead of "0 venues, 0 courts" on a failed load.
- Editing and saving a venue now surfaces an error if the refresh fails.
- Joining a venue membership now only shows success after the server confirms it. Failed joins show an error.
- Cancelling a booking now tells you why it didn't work instead of silently doing nothing.
- Claiming a waitlist slot now tells you if it failed.
- A booking link that can't load the venue now shows an error and retry instead of spinning forever.
- When the courts list fails to load, the app now says "couldn't load, retry" instead of "No courts."
- If the availability check fails, the map now warns that times may not be accurate instead of showing every court as free.
- Messaging a venue or applying as a coach now shows an error when it fails.
- Open Play detail now has a retry button instead of saying it "may have been removed."
- Creating a game now remembers which steps already succeeded. Card is never charged twice on retry.

**Server & Backend:**

- Two people booking the last court at once can no longer both get it. Only one confirmed booking per slot.
- Same protection applied to coach session bookings. No more double-booking.
- Malformed booking times are now rejected. No more bypassing the price check.
- Search queries with unusual characters no longer crash the search or freeze the server.
- Unverified coaches can no longer publish themselves to the public directory. Verification required first.
- Game joins are now atomic. No more over-capacity or duplicate entries.
- Adding and removing roster members at the same time no longer loses changes.
- Waitlist claims now create a proper unpaid hold with a payment window instead of a free confirmed booking holding a court forever.
- Broken or empty request bodies now return a clean error instead of a server crash. Covers about 127 endpoints.
- Mistyped or stale links with bad IDs now return a clean error instead of a server crash. Covers about 267 endpoints.
- Deleted users no longer crash the "who's here now" venue check-in panel.
- "Already exists" collisions now return a clear message instead of a confusing server error.
- Venue deletion is now an archive instead of a hard delete. Past bookings, analytics, and reports remain intact. A venue with upcoming bookings cannot be deleted until those are resolved.

---

## Cross-reference to the audit task board

Every bullet above maps to a tracked finding on
[the task board](gap-prevention-user-facing-reliability-audit-tasks.md). IDs for traceability:

### Dashboard & Booking Website (`web/`)

| Client bullet | Board ID |
|---|---|
| Login / Register / all "Sign in to…" buttons → mobile app login | **L1** + the deep-link sweep |
| "Book a Court" page & direct booking URL → mobile app | **W1** (public booking dead-ended on "Venue not found") |
| Broken page shows an error card instead of taking the site down | **W3** (no error boundaries anywhere) |
| Owner dashboard no longer crashes on incomplete venue stats | **W4** (`a.kpis.revenue.month` with no optional chaining) |
| No full-screen "Loading…" flash between owner/admin tabs | **W5** (`RequirePermission` re-fetched `/auth/me` on every nav) |
| Mistyped console URLs show a proper "not found" page | **W6** (no 404 catch-all inside consoles) |
| Chat shows an error + retry when a send fails | **W7** (send failures silently swallowed) |
| All prices display in pesos consistently | **W8**, **W9**, **W11** (null currency, `$undefined`, `$`/`₱` mismatch) |
| Deleting a conversation no longer resurrects it | **W10** (optimistic delete race) |

Deep-link/CTA items — "Inquire about booking" → "Book a court", clubs **Create**,
the **Create a Game** prompt, the green **Hire Coach** button, **Join Game** on Open Play
detail, and the five-entry **Compete** menu — were done as a single sweep to make every
Host / Create / Join / Book CTA land on the app login rather than the web download page.

### Player Mobile App (`app/`)

| Client bullet | Board ID |
|---|---|
| No more whitescreen — friendly card with reload | **P1** (no React error boundary) |
| Owner dashboard: "truly empty" vs "failed to load" | **P2** |
| Edit Club retry actually works | **P3** |
| Social feed retry instead of false "No posts yet" | **P4** |
| Tournament score sheets reset between matches | **P5** |
| Map pins work offline | **P6** (were loading from the unpkg CDN) |
| Clubs directory retry instead of "No clubs found" | **P8** |
| Hide/delete a feed post rolls back on failure | **P10** |
| Chat load retry | **P11** |
| Organizer approve / check-in / cancel / remove feedback | **P12** |
| Venue overview warns instead of showing fake zeros | **P14** |
| Owner profile loading + error states | **P15** |
| Venue edit-save surfaces a failed refresh | **P16** |
| Create game never double-charges on retry | **P17** |
| Membership join confirms with the server first | **P18** |
| Cancel booking explains the failure | **P19**, **G1** |
| Waitlist claim reports failure | **P20** |
| Booking link error + retry instead of spinning | **Booking-stuck** |
| Courts list "couldn't load — retry" | **No-courts**, **CG-courts** |
| Map warns when the availability check fails | **Map-avail** |
| Message venue / apply as coach show an error | **Msg-venue**, **Become** |
| Open Play detail retry instead of "may have been removed" | **OpenPlay** |

### Server & Backend (`api/`)

| Client bullet | Board ID |
|---|---|
| No double-booking the last court | **A1** (unique partial index per court + slot) |
| Same for coach session bookings | **A2** |
| Malformed booking times rejected | **A3** (NaN bypassed the price check) |
| Unusual search characters no longer crash/freeze | **A4** (invalid-regex 500 + ReDoS) |
| Unverified coaches can't self-publish | **A5** |
| Game joins are atomic | **A6** |
| Roster add/remove no longer loses changes | **A7** |
| Waitlist claim creates a paid-hold with a window | **A8** (was a free confirmed ₱0 booking) |
| Broken/empty request bodies → clean error | **A9** (shared `readJson(c)`) |
| Bad IDs → clean error | **A10** (shared `asObjectId()`) |
| Deleted users no longer crash venue check-in | **A11** |
| "Already exists" returns a clear 409 | **A12** |
| Venue deletion is an archive, blocked by upcoming bookings | Shipped as `feat(venues): block deletion when venue has upcoming bookings` |

---

## Notes

- **Scope of this update.** The bullets cover the whole audit sweep as delivered to the
  client on 07/21. On the internal task board the `web/` + `api/` findings (L1, W1–W12,
  A1–A12 — 25 items) are dated **Jul 21**, and the `app/` findings (P1–P20 and the
  games/venues/booking cluster — 30 items) are dated **Jul 22**, since the app sweep
  finished the following morning. Both are included here because the client update was
  sent as one message.
- **Endpoint counts.** The client message quotes ~127 and ~267 endpoints; the board's
  code scan recorded ~111 (`readJson`) and ~265 (`asObjectId`) call sites. Both fixes
  are central, so the protection applies repo-wide either way.
- **Totals.** 55 findings resolved · 3 launch-critical · 17 high. Four reported items
  (**W12**, **P7**, **P9**, **P13**) were verified as already safe — no change needed.
- **Preceding days.** 07-17 and 07-20 went to PickleDen (https://pickleden.club/, a
  separate site on another server) — see the combined
  [07-17 & 07-20 entry](2026-07-17_20-Ivan-report.md). No work on 07-18/07-19.
