# Report Verification Audit — 2026-07-23

Verifying the 07-17 → 07-21 status reports from Kenneth, Vic/Jambik, Edu and Ivan
against the code that is actually running.

**Method.** Code read against `/var/public/pickleballer.eunika.xyz` (api + app + web),
live HTTP probes of the running API's error paths, `pm2` service state, build-artifact
freshness, `vitest` suites, and `tsc --noEmit`. **Not** done: click-through E2E of every
screen. Where a claim is UI-only and I did not exercise it, it is marked as such.

**Snapshot.** Branch `lc-staff-revenue` @ `e3d361f`, taken 2026-07-23 ~10:50 Asia/Manila.
The working tree was being edited by someone else *during* the audit (see Health §H3).

## Verdict at a glance

| Report | Claims | True | Partial / overstated | Not shipped | Unchecked |
|---|---|---|---|---|---|
| Kenneth 07-17 | 2 | 2 | — | — | — |
| Vic/Jambik 07-20 | 12 | 11 | 1 | — | — |
| Edu 07-20 | 5 | 4 | 1 | — | — |
| Ivan 07-21 — Web | 17 | 17 | — | — | — |
| Ivan 07-21 — Mobile | 24 | 22 | 1 | — | 1 |
| Ivan 07-21 — Backend | 13 | 13 | — | — | — |
| Edu 07-21 | 7 | 6 | 1 | — | — |
| Kenneth 07-21 (Done) | 4 | 3 | 1 | — | — |
| **Total** | **84** | **78** | **5** | **0** | **1** |

Nothing in these reports is fabricated. Every claim traces to real code. Five are
stated more broadly than what shipped, and those five are the whole finding list.

## Deployment state

All three services are online and serving the code these reports describe:

| Service | How it runs | Source of truth |
|---|---|---|
| `pickleballer-api` :9002 | `tsx src/index.ts` (pm2) | **working tree**, no build step |
| `pickleballer-pwa` :9000 | `vite dev` (pm2) | **working tree**, no build step |
| `pickleballer-web` :9001 | `vite preview` from `dist/` | `dist/` rebuilt 2026-07-23 09:43 |

`https://pickleballer.eunika.xyz` and `https://pickleballer-pwa.eunika.xyz` both return 200.
`web/dist/assets/` contains the strings from Ivan's changes (`"Court booking is available
in the PickleBallers mobile app"`, `"Hire Coach"`, `"Mini Tournament"`), so the marketing
site build is current — the web claims are live, not just committed.

---

## Kenneth — 07-17 · 2/2 true

| Claim | Verdict | Evidence |
|---|---|---|
| Players can create events | ✅ | `api/src/features/games/games.controller.ts:408` — `gameType:'public'` is an event; gated by `AppSettings.allowNonOrganizerEvents`, default `true` (`settings.model.ts`), so players can create them until an admin flips the kill switch |
| Players can require approval to join their lobby | ✅ | `Game.requiresApproval` (`games.model.ts:60`), gated by `allowPlayerApprovalLobbies` default `true`; full flow exists — `POST /:id/join` branches into a request, `approve-join` / `reject-join` / `DELETE /:id/join` |

---

## Vic / Jambik — 07-20 · 11/12 true, 1 partial

The approval-deadline work is the strongest-engineered item in this batch.
`api/src/features/bookings/bookingDeadlines.ts` is a pure module with unit tests
(`bookingDeadlines.test.ts`, `bookingOccupancy.test.ts`) — both pass.

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 1 | Every approval request gets an automatic expiry | ✅ | `Booking.approvalDeadline` + index `{status, approvalDeadline}` (`bookings.model.ts:37,125`); set at creation (`bookings.controller.ts:854`) |
| 2 | Expired requests self-cancel, release court, notify both, never charge | ✅ | `cancelExpired()` claims each row with a status-guarded `findOneAndUpdate` (so exactly one notify fires across restarts/instances) → `notifyBookingExpired` pushes to player + emails; approval bookings are created with `amountPaid: 0` |
| 3 | Availability updates *at* the deadline, not when a job runs | ✅ | `blockingFilter(now)` is spread into the occupancy queries (`bookings.controller.ts:158,207,227`, `activeBookingsForDate`). The 2-min sweeper is explicitly cleanup, not correctness — a lapsed request frees its court even if the job never runs |
| 4 | Dynamic deadline: ≤24h early, shorter last-minute, always before play | ✅ | `computeApprovalDeadline` — `approvalShare` bands 0.5 / 0.25 / 0.1 by lead time, floored at `MIN_APPROVAL_WINDOW_MS` 15 min, clamped to `playStart − 30 min`, then hard-clamped to `playStart` |
| 5 | Approval indicators in the court picker | ⚠️ **Partial** | See F1 below |
| 6 | Player sees deadline, live countdown, "no payment taken" on expiry | ✅ | `MyBookingsScreen.tsx:27-40` `ApprovalCountdown` + `useCountdown`; `BookCourtScreen.tsx:803` spells out "it cancels automatically and you won't be charged" |
| 7 | Owner sees deadlines, countdowns, 50%/80% reminders, urgency sort | ✅ | `OwnerBookingRow.tsx:40,145`; `sendApprovalReminders()` claims each nudge with `$addToSet` so restarts can't double-send, and reuses the booking id as the push `tag` so the 80% nudge *replaces* the 50% one; sort at `useOwnerDashboard.ts:210-213` |
| 8 | Settings for owner-response + payment deadlines now reachable | ✅ | `ListingEditorTab.tsx:178-179,283-284` — `approvalWindowHours`, `bookingPayWindowHours` |
| 9 | Payment deadline can no longer land after play | ✅ | `computePaymentDueAt` clamps to `playStart − 15 min` |
| 10 | Venue-level **Require Owner Approval** works | ✅ | `venues.model.ts:242` read server-side at `bookings.controller.ts:847-848` |
| 11 | Player notification + email when a request is declined | ✅ | `venues.controller.ts:2426` (`booking_rejected` push) and `:2462` (email) |
| 12 | Booking notifications no longer open to nowhere | ✅ | `NotificationsScreen.tsx:99-130` `navigateFromLink` maps every stored `linkUrl` shape. Nit at F5 |

### F1 — court-picker approval badge misses the inherit case

`CourtPicker.tsx:74` shows **Needs approval** only when `court.approvalMode === 'manual'`.
But the actual rule, in both client and server, is:

```
manual  ||  (approvalMode !== 'auto' && venue.requireBookingApproval)
```

(`BookCourtScreen.tsx:328-329`, `bookings.controller.ts:847-848`)

So on a venue with **Require Owner Approval** on, every court left at `inherit` really
does need approval and shows **no badge** — exactly the "discover it two steps later"
problem the badge's own code comment says it exists to prevent. The claim holds for
per-court manual venues, not venue-level ones.

**Fix:** pass the venue flag into `CourtPicker` and badge on the same predicate.

---

## Edu — 07-20 · 4/5 true, 1 partial

| Claim | Verdict | Evidence |
|---|---|---|
| Organizer **profiles** display "Organizer" after subscribing | ✅ | `PlayerProfileScreen.tsx:88` `roleWord`; `ProfileScreenV2.tsx:155` reads `organizerSubscriptionActive`, served by `auth.controller.ts:174` from live subscriptions |
| Organizer **sidebar labels** display "Organizer" | ⚠️ **Not what shipped** | See F2 |
| Optional entrance fee when creating Open Play | ✅ | `BookCourtScreen.tsx:1267-1295` → `joinFee` (`:581`); server re-checks with `canChargeEntranceFee` so a forged client can't set one |
| Players see the fee before joining | ✅ | `GamesScreenV2.tsx:1119` feed chip; `GameDetailsScreen.tsx:721,948` |
| Players must confirm the fee before entering | ✅ | `GameDetailsScreen.tsx:215` — join intercepts into `setFeeConfirmOpen(true)` |
| Birthday on Edit Profile, date picker, validation, saved securely | ✅ | `EditProfileScreen.tsx:327-330` + validators `:104-113`; `auth.controller.ts:58` zod `YYYY-MM-DD`, and `:361-363` uses `$unset` so blanking actually clears rather than storing `''` |

### F2 — the organizer sidebar variant is deliberately unreachable

`app/src/App.tsx:547`:

```ts
const isOrganizer = false;
```

Hardcoded, with a comment explaining the product decision: organizing is a *player-plus
subscription*, so an organizer keeps player chrome and reaches the Organizer Console from
the Profile tab. `Sidebar.tsx` still carries an `isOrganizer` prop and an `organizerTabs`
set, but nothing ever passes `true`.

This landed **2026-07-16** (`21c9501`) — four days *before* the report. So this isn't a
regression; the report describes a design that had already been superseded. The profile
half of the claim is genuinely shipped.

**Action:** correct the report line, and either delete `organizerTabs` or leave a note on
it, since it currently reads as live code.

---

## Ivan — 07-21 Gaps Audit

### Dashboard & Booking Website · 17/17 true

Verified in `web/src` **and** confirmed present in the served `web/dist` build.

- Book-a-Court, Login, Register all redirect to the PWA — `BookingPage.jsx:10`,
  `LoginPage.jsx:9`, `RegisterPage.jsx`, via one shared `shared/lib/appUrls.js`
  (`PWA_LOGIN_URL`), so there is a single door, not per-page copies. ✅
- Venue CTA reads **Book a court** (`VenueDetailPage.jsx:226`). ✅
- Clubs Create, Create-a-Game prompt, Coach **Hire Coach** in brand green `#C1F100`
  (`CoachDetailPage.jsx:129-131`), Open Play **Join Game**
  (`OpenPlayDetailPage.jsx:59`). ✅
- Compete menu has exactly 5 entries; the last 3 (Quick Game, Round Robin, Mini
  Tournament) point at the PWA (`Header.jsx:13-19`). ✅
- Broken page no longer kills the site — `errorElement: <RouteError />` on every route
  group + `shared/components/RouteError.jsx`. ✅
- Owner dashboard survives incomplete stats — `statsReady` gate
  (`useOwnerData.js:133`) renders `—` instead of throwing on a missing analytics row. ✅
- No full-screen Loading flash — `PageFallback` is `min-h-[40vh]` *inside* the layout, so
  the console shell stays put (`router.jsx:127-139`). ✅
- Mistyped console URLs → `NotFoundPage` on `path: '*'` in 6 route groups. ✅
- Chat send failure shows error + Retry (`ChatPage.jsx:57,119`). ✅
- Prices in pesos — `shared/lib/money.js` defaults `PHP`/`₱`. ✅
- Conversation delete race fixed — marks `_deleting` and rolls back **that row only**,
  rather than replacing the list (`MessagesPage.jsx:43-53`). ✅

### Player Mobile App · 22/24 true, 1 partial, 1 unchecked

Broad `Retry`/error-state coverage confirmed across `social`, `clubs`, `messages`,
`venues`, `owner`, `organizer` and `games`. Spot-checked in depth:

- App-wide `ErrorBoundary` (`shared/components/ui/ErrorBoundary.tsx`, mounted in
  `main.tsx` + `App.tsx`). ✅
- Map pins work offline — `L.divIcon` (HTML markers), no remote image fetch
  (`NearbyScreenV2.tsx:50,65`). ✅
- Failed availability check warns instead of showing everything free —
  `NearbyScreenV2.tsx:673` "Couldn't check availability — open-slot counts are hidden",
  `:757` "availability below isn't confirmed". ✅
- Feed hide/delete and membership actions roll back on failure with a toast
  (`FeedPanel.tsx:175,184`; `CourtDetailsScreen.tsx:377,399,406`). ✅
- Organizer roster actions surface errors (`SessionRosterScreen.tsx:35`). ✅
- ⚠️ **Partial** — "Creating a game remembers which steps succeeded; card never charged
  twice on retry". See F3.
- ⏳ **Unchecked** — tournament score sheets resetting between matches
  (`organizer/tournaments/bracket/MatchScoreSheet.tsx`). Not exercised; no verdict.

#### F3 — retry-safety exists on one create path, not the other

`CreateGameScreen.tsx:333-375` does exactly what the report says, and says so
("P17"): `bookingRef` / `paidRef` survive the throw, so a retry skips the steps that
already succeeded, and the error copy even reads *"Your court is booked & paid — tap
Create again to finish setting up the game."*

`BookCourtScreen.tsx:630-700` — the V2 flow that also creates games
(`bookingMode === 'public_game'` / open play) — has **no such refs**. Its `submit()` runs
`createBooking → checkout → createGameForMode` with no memo. If `createGameForMode`
throws after `checkout()` succeeded, tapping again runs `createBooking` **and**
`checkout` a second time.

Server-side there is no idempotency key either: `payments.controller.ts:105-140` guards
booking *lifecycle* (awaiting-approval, expired window, server-side amount) but nothing
stops a second `Payment` row for a fresh booking id.

**Fix:** lift the `bookingRef`/`paidRef` pattern into `BookCourtScreen.submit()`.
Real exposure is small in test mode; it matters once GCash is live.

### Server & Backend · 13/13 true

Three of these I probed live against the running API rather than only reading:

```
POST /api/v1/auth/login  -d '{bad json'  → 400 INVALID_JSON
POST /api/v1/auth/login  -d ''           → 400 INVALID_JSON
GET  /api/v1/venues/notanid              → 404 (clean, not 500)
GET  /api/v1/search?q=(*\[               → 200 (no crash, no hang)
```

| Claim | Verdict | Evidence |
|---|---|---|
| No double-booking the last court | ✅ | Unique partial index on `{status:'confirmed', courtId:objectId}` — `bookings.model.ts:134`. The loser hits E11000 → 409 |
| Same for coach sessions | ✅ | `coach-bookings.model.ts:69` |
| Malformed booking times rejected | ✅ | `startTime`/`endTime` zod `^\d{2}:\d{2}$` (`bookings.controller.ts:320-321`) — closes the price-check bypass |
| Search metacharacters can't crash/hang | ✅ | `escapeRegex` at all 5 regex sites (`search.controller.ts:11-146`); live-probed |
| Unverified coaches can't self-publish | ✅ | `coaches.controller.ts:249` — `isListed:true` without `isVerified` → 403 |
| Game joins atomic | ✅ | `Game.findOneAndUpdate` with `$expr:{$lt:[{$size:'$participantIds'}, seatCount]}` + `participantIds:{$ne:user}`; the follow-up write is a targeted `$set`, not a full-doc save that could clobber a concurrent join |
| Roster add/remove concurrent-safe | ✅ | `$push` / `$pull` instead of read-modify-save (`rosters` controller, "A7") |
| Waitlist claim → unpaid hold with a pay window | ✅ | `waitlist.controller.ts:136-159` — atomic promoted→claimed flip, then `status:'awaiting_payment'` + 1h `paymentDueAt`, replacing the old free confirmed booking |
| Broken bodies → clean error, ~127 endpoints | ✅ | `error-handler.ts:43-48`. Actual count **130** `c.req.json()` sites |
| Bad IDs → clean error, ~267 endpoints | ✅ | `error-handler.ts:53-58` CastError → `INVALID_ID`. Actual **244** `findById` / **289** incl. `findByIdAndUpdate`/`Delete` — the stated 267 sits inside that range |
| Deleted users don't crash check-in | ✅ | `check-ins.controller.ts:22-27` — `toPlayer()` returns null for a dangling populate ref |
| "Already exists" → clear message | ✅ | `error-handler.ts:63-68` E11000 → 409 |
| Venue deletion is an archive | ✅ | `venues.controller.ts:1010-1037` — soft `deletedAt` + `deletedByUserId`; upcoming confirmed/pending/awaiting-payment bookings return 409 `HAS_UPCOMING_BOOKINGS`; list queries filter `deletedAt: null` |

---

## Edu — 07-21 · 6/7 true, 1 overstated

| Claim | Verdict | Evidence |
|---|---|---|
| No false "Court already booked" on dates without pricing | ✅ | `OwnerManualReservationScreen.tsx:344-347` — the comment names this exact false-positive |
| Time picker shows booked + maintenance with status labels | ✅ | `:84-108` marks hours **Booked** / **Maint.**; `:228` greys and tags them |
| Fully booked courts disabled and marked | ✅ | `fullyBookedCourtIds` (`:260`) → `CourtPicker disabledCourtIds` (`:440`); label renders "Fully booked" |
| Owners assign individual permissions per staff member | ✅ | `staff.controller.ts:25-30` `STAFF_GRANTABLE_PERMISSIONS`, `PATCH /staff/:id` with an allow-list filter (`:158`) — an unknown key is dropped, not stored |
| Access panel with controls for Pricing, Analytics, Bookings, Venue Management | ⚠️ **Overstated** | See F4 |
| Changes apply after the staff member logs in again | ✅ | `auth.controller.ts:137-141` merges `grantedPermissions` into the token at login — so yes, re-login required |
| Backend permission checks on pricing | ✅ | `venues.controller.ts:1509,1531` gate on `owner.pricing.manage`; not client-side only |

### F4 — only 2 of the 4 listed permissions are actually controls

`OwnerStaffScreen.tsx:339`:

```ts
const isDefault = !['owner.pricing.manage', 'owner.analytics.view'].includes(perm.key);
```

`isDefault` items render as a read-only **Included** chip. So **Bookings** and **Venue
Management** are always-on and not toggleable; only **Pricing** and **Analytics** are
checkboxes. The panel is also headed *"Access (all venues)"* — it is not per-venue,
though per-venue staff assignment does exist separately via `VenueStaff` rows.

Backend-wise all four are grantable, so this is a UI gap, not a data-model one.
Either surface all four as toggles or reword the report to "Pricing and Analytics".

---

## Kenneth — 07-21 · 3/4 done-items true, 1 needs qualifying

| Claim | Verdict | Evidence |
|---|---|---|
| Asking to join a play persists across leaving the screen | ✅ | Request stored as `Game.pendingJoinUserIds`, serialized back as `viewerPendingJoin` (`GameDetailsScreen.tsx:130`); a repeat tap now gets a clear 409 *"You already asked to join — the host will review it"* instead of a generic error |
| You can cancel a join request | ✅ | `DELETE /games/:id/join` → `cancelJoinRequest`; UI at `GameDetailsScreen.tsx:154,839` |
| Hosts can edit their play after posting | ✅ | `GameDetailsScreen.tsx:183-193` patches title, description, `skillLabel`, `capacity`, visibility, `requiresApproval` — matches "name, player limit, skill, and the approve-people-first switch" exactly. Deliberately excludes gameType/format/vibe/gender |
| Staff can no longer see the money — revenue hidden from staff everywhere | ⚠️ **Needs qualifying** | See F5 |

### F5 — "hidden from staff everywhere" is really "hidden by default, grantable"

Revenue is gated on `owner.analytics.view` (`OwnerHomeScreen.tsx:163,396`,
`VenueOverviewTab.tsx:122`, `useOwnerDashboard.ts:46`). That permission is in
`STAFF_GRANTABLE_PERMISSIONS` — it is one of the two checkboxes in Edu's Access panel,
and the commit `5a5284f feat(staff): show This month revenue KPIs to staff granted
owner.analytics.view` exists specifically to show it.

So the two 07-21 reports describe opposite behaviour for the same feature on the same
branch. **The code implements Edu's version**: staff see no revenue until an owner ticks
Analytics, then they do. Kenneth's absolute wording ("everywhere", "can no longer") would
misrepresent the build to the client if it went out as-is.

**Fix:** reword to "Revenue is hidden from staff by default — owners can grant Analytics
access per staff member."

### Ongoing items — all accurate for 07-21, three have since landed

| Ongoing item | Status now |
|---|---|
| Owner payouts (GCash/bank + balance owed) | **Landed 07-22** — `9a26d7f`, `653b584`; `payments.model.ts:104-145` settlement ledger + payout methods, `GET/POST /owner/payout-methods`, `GET /owner/settlements/balance` |
| Free paid coach/organizer accounts | Guarded by `hasActivePartnerSubscription`; `1877fc6` extends entrance fees to owner-approved organizers |
| Senior/PWD 20% discount | **Landed 07-22/23** — `e859ae3`, `ab7d9fa`, `32f10c4`; `statutoryDiscount.test.ts` passes |
| Verify last week's booking fixes are live | This document |
| Waiting on client (GCash setup, venue/court list) | External — not verifiable here |

---

## Health issues found outside the reports

These aren't claims anyone made; they're things the audit surfaced.

### H1 — `npm test` in `api/` cannot run as documented

`npm test` → **25 of 37 test files fail to collect**. Two independent causes:

1. `src/test-setup.ts` sets `NODE_ENV=test` and a test `JWT_SECRET`, but there is **no
   `vitest.config.ts`**, so nothing ever wires it as `setupFiles`. Files importing
   `jwt.ts` throw *"JWT_SECRET must be set to a strong, unique value in production"* at
   import time.
2. With no config there is no `include`/`exclude`, so vitest also tries to collect the
   Playwright `e2e/*.spec.ts` files.

Forcing the env and excluding e2e by hand: **189 pass, 2 fail** — the 2 are
`routes/health.test.ts` receiving HTML instead of JSON. So the *product* tests are
healthy; the harness is not. Nobody can run the suite the documented way, which means
in practice nobody is running it.

**Fix:** add `vitest.config.ts` with `setupFiles: ['src/test-setup.ts']` and
`exclude: ['e2e/**', 'node_modules/**']`.

### H2 — `app/` does not typecheck

`npx tsc -b --noEmit` → **79 error lines across 15+ files**. Concentrated in
`ListingEditorTab.tsx`, `GamesScreenV2.tsx`, `MembersScreen.tsx`, `SlotPricingTab.tsx`,
`ResetPasswordScreen.tsx`. Mostly `null`-vs-`string` mismatches, an `Icon` prop
(`filled`) that doesn't exist on `IconProps` (7 occurrences), one undefined identifier
(`pickPhoto` vs `pickPhotos`, `FeedComposerSheet.tsx:222`) and dead-variable errors.

Vite/esbuild strip types without checking them, so this ships. `pickPhoto` is a runtime
`ReferenceError` waiting on whichever code path calls it.

**Fix:** get to zero, then gate the PWA on `tsc --noEmit` before deploy. (`app/`'s own
vitest suite is fine: 59 tests, all pass.)

### H3 — production runs the working tree, and the working tree moves under you

The API runs `tsx src/index.ts` and the PWA runs `vite dev`, both directly off the
checked-out tree. There is no build, no artifact, no staging gate — an editor save is a
production deploy.

Observed live during this audit: `app/src/shared/lib/api.ts` had **duplicate
implementations** of `markBookingAttendance`, `listPendingRefunds` and `settleRefund`
(TS2393/TS2323 — silently, last-one-wins). Ten minutes later a concurrent edit had
removed them. That is uncommitted WIP from `a4883d1` being edited *in production*.

**Fix:** even a minimal `git pull && npm run build && pm2 reload` boundary would help.

### H4 — `api/dist/` is stale and unused

Last built **2026-06-30**; pm2 correctly runs from `src` via tsx, so it is inert today —
but it is a loaded gun if anyone ever points a process at it. Delete it or rebuild it in
CI.

---

## Recommended actions

**Before this goes to the client — reword 3 report lines**

1. Edu 07-20: drop "and sidebar labels" (F2).
2. Edu 07-21: "Access panel with controls for **Pricing and Analytics**" (F4).
3. Kenneth 07-21: "Revenue is hidden from staff **by default; owners can grant Analytics
   access per staff member**" (F5).

**Code fixes, in priority order**

1. **F3** — retry-safety in `BookCourtScreen.submit()`. Double-charge risk once GCash is
   live. Pattern already exists in `CreateGameScreen`.
2. **H2** — `pickPhoto` is a live `ReferenceError`; then clear the other 78.
3. **F1** — court-picker badge should use the venue-inherit predicate.
4. **H1** — add `vitest.config.ts` so the API suite is runnable.
5. **F4** — surface Bookings + Venue Management as real toggles, or leave them Included
   deliberately and document it.
6. **H3/H4** — a build boundary before production; delete `api/dist`.

**Still unverified**

- Tournament score-sheet reset between matches (Ivan, mobile). Needs a click-through.
