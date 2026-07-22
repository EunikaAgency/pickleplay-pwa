# User-Facing Reliability Audit — Task Board

_Companion to the live HTML board at `https://pickleballer.eunika.xyz/plan/ivan/project-gap-prevention-user-facing-reliability-audit.html`. Full-project scan of `app/` (player PWA), `api/` (Hono + MongoDB), and `web/` (owner dashboard + booking). Scan date **21 Jul 2026** — every audit finding is resolved; new client tasks are tracked below by status._

**Totals:** 55 findings resolved · 3 launch-critical · 17 high · 1 open task

**Status legend:** ✅ Done · ◐ Ongoing · ○ Pending

---

## 📅 Jul 21, 2026 — 25 resolved

**web/ — Owner dashboard + public booking** — _React + react-router · all findings resolved_

- **L1** · UX polish · ✅ Fixed — “Sign In” opened the website's own login instead of the app
  - The website Sign In routed to web's own login rather than where accounts actually live.
  - **Fixed:** Now sends users to the mobile-app (PWA) login where accounts live.
- **W1** · Critical · ✅ Fixed — Public booking dead-ended on “Venue not found” for every real venue
  - The “Book a court” CTA linked to /venues/:slug/book, but BookingPage resolved the venue from dummy JSON while the detail page used the real API. Any real venue whose slug wasn't in the dummy file showed “😕 Venue not found”; on a slug collision the courts/prices were fake.
  - **Fixed:** BookingPage is backed by the real fetchVenueBySlug + fetchCourts, with proper loading / error / “no courts yet” states; the shared/data dummy dependency was dropped.
  - Refs: `web · BookingPage.jsx:17` · `web · shared/data/index.js:17` · `web · VenueDetailPage.jsx:224`
- **W2** · Critical · ✅ Fixed — Checkout always showed “Payment confirmed” but never created a booking
  - handlePay did setTimeout(… setStep(2)) — it never called the API in test or live mode. The user always reached “Payment confirmed! View bookings”, but nothing was persisted, and there was no failure branch at all.
  - **Fixed:** Checkout now really creates the booking and records the payment via the documented seam (apiPost('/api/v1/payments/checkout', …)), advances to success only on a real success, and shows an error state on failure.
  - Refs: `web · CheckoutPage.jsx:54-58` · `web · CheckoutPage.jsx:197-217`
- **W3** · High · ✅ Fixed — No error boundaries anywhere
  - No route declared errorElement; any render throw fell to react-router's bare “Unexpected Application Error”. A post-redeploy lazy-chunk 404 hit the same generic page instead of a reload prompt.
  - **Fixed:** Added a top-level errorElement (+ per-layout) with a branded retry/reload; chunk-load errors force a reload.
  - Refs: `web · main.jsx` · `web · App.jsx` · `web · router.jsx`
- **W4** · High · ✅ Fixed — Owner overview/insights white-screened if a venue's analytics lacked kpis
  - The reducer/memos dereferenced a.kpis.revenue.month with no optional chaining, during render for every venue. One venue missing a full kpis shape crashed all of /owner and /owner/insights.
  - **Fixed:** Optional-chained with numeric defaults — a?.kpis?.revenue?.month ?? 0 — so missing data reads as 0 instead of crashing.
  - Refs: `web · useOwnerData.js:121-131` · `web · OwnerInsightsPage.jsx:32-44`
- **W5** · High · ✅ Fixed — RequirePermission re-fetched /auth/me and flashed full-screen “Loading…” on every nav
  - Effect deps included location.pathname/search and it setChecked(false) before each refreshMe(); since /owner, /admin, /coach, /organizer were each wrapped, every tab click blanked the whole layout and fired a redundant /auth/me.
  - **Fixed:** refreshMe() now runs once on mount; checked is no longer reset on path change — no more flashing on every tab click.
  - Refs: `web · RequirePermission.jsx:13-39`
- **W6** · Medium · ✅ Fixed — No 404/catch-all inside authenticated consoles → blank content pane
  - A mistyped /owner/bogus rendered the layout with an empty <Outlet>.
  - **Fixed:** Added { path: '*', element: <NotFoundPage/> } to each console block.
  - Refs: `web · router.jsx:198-294`
- **W7** · Medium · ✅ Fixed — Chat send failures silently swallowed
  - catch { /* ignore */ } — the message vanished with no retry.
  - **Fixed:** Sets an error state + “tap to retry”, keeping the typed text.
  - Refs: `web · ChatPage.jsx:50-55`
- **W8** · Medium · ✅ Fixed — money() threw on explicit null currency
  - The default only covered undefined; a null currency → “Cannot read properties of null”.
  - **Fixed:** Coerced to String(currency || 'PHP').
  - Refs: `web · format.js:9-10`
- **W9** · Medium · ✅ Fixed — BookingPage showed “$undefined” / passed an undefined amount
  - A court missing pricePerHour rendered “$undefined/hr” and a $0 “payment”.
  - **Fixed:** Missing prices default cleanly and the amount is validated before checkout.
  - Refs: `web · BookingPage.jsx:42` · `web · BookingPage.jsx:92-105`
- **W10** · Medium · ✅ Fixed — Optimistic conversation delete could resurrect a stale row
  - Concurrent deletes raced on the captured prev.
  - **Fixed:** Rollback is keyed off a functional update so a failed delete only restores that one row.
  - Refs: `web · MessagesPage.jsx:43-48`
- **W11** · Medium · ✅ Fixed — Currency symbol mismatch ($ vs ₱)
  - The same booking showed $15 at checkout but ₱15 at refund.
  - **Fixed:** All booking pages now use one shared money format (₱) from a single currency source.
  - Refs: `web · BookingRefundPage.jsx:6-9` · `web · CheckoutPage.jsx:20`
- **W12** · Already safe · ✓ No change — Demand heatmap NaN alpha on zero demand
  - Reported: v/max with max===0 → NaN alpha.
  - **Verified:** Already safe — the guard already exists (degrades to transparent, no crash). No change needed.
  - Refs: `web · DemandTab.jsx:42-43`

**api/ — Hono + MongoDB backend** — _global onError already prevents crashes/stack-leaks; these returned wrong statuses or races — all resolved_

- **A1** · High · ✅ Fixed — Double-booking race — venue could oversell the last court
  - findSlotConflict (read) then Booking.create (write) with no txn/lock — two near-simultaneous bookings for the last court both passed and both persisted. (The code comment already conceded the window.)
  - **Fixed:** Added a hard database rule (unique partial index on {venueId,courtId,date,startTime}) so only one confirmed booking can exist per court + time slot; the second gets a clean “just taken” 409.
  - Refs: `api · bookings.controller.ts:649-654` · `api · bookings.controller.ts:778`
- **A2** · High · ✅ Fixed — Same race on coach bookings
  - findOne clash check then create → the coach could be double-booked.
  - **Fixed:** Same hard rule per coach + time slot (unique partial index over blocking statuses).
  - Refs: `api · coach-bookings.controller.ts:98-105`
- **A3** · High · ✅ Fixed — Unvalidated startTime/endTime → NaN bypassed price validation
  - startTime was a bare z.string().optional(). A malformed time made expectedTotal NaN; the Math.abs(clientAmount − expectedTotal) > 1 check is NaN > 1 === false, so the booking was created at any client-chosen amount.
  - **Fixed:** Times are strictly validated (^\d{2}:\d{2}$ + Number.isFinite guard); a bad time is rejected before payment.
  - Refs: `api · bookings.controller.ts:320-321` · `api · bookings.controller.ts:682-684`
- **A4** · High · ✅ Fixed — Search built new RegExp(userInput) — invalid-regex 500 + ReDoS
  - An unbalanced ( / [ threw → 500; a crafted input like (a+)+$ pinned the event loop for all users.
  - **Fixed:** Search input is now treated as plain text (escaped) — no crash, no freeze.
  - Refs: `api · search.controller.ts:41` · `api · search.controller.ts:62-139`
- **A5** · High · ✅ Fixed — Coaches could self-publish an unverified profile (moderation bypass)
  - isListed was settable via PATCH /coaches/me; listCoaches filtered only {isListed:true} and never checked isVerified. A never-verified coach could appear in the public directory instantly.
  - **Fixed:** Unverified coaches can no longer self-list; listCoaches is gated on isVerified:true.
  - Refs: `api · coaches.controller.ts:54` · `api · coaches.controller.ts:289-290`
- **A6** · High · ✅ Fixed — Game join was non-atomic → over-capacity / double-join
  - if (participantIds.length >= seats)…; push; save() — two players on the last seat both read pre-full and both saved; a double-tap could list the same user twice.
  - **Fixed:** The join is now atomic via findOneAndUpdate with a $size guard + $addToSet — exactly one seat per slot, no duplicates (409 on null).
  - Refs: `api · games.controller.ts:564-584`
- **A7** · Medium · ✅ Fixed — Roster add/remove lost updates
  - Full-array read-modify-save() clobbered a concurrent add.
  - **Fixed:** Roster add/remove are now atomic $push/$pull via findOneAndUpdate — no lost updates.
  - Refs: `api · rosters.controller.ts:95-112`
- **A8** · Medium · ✅ Fixed — Waitlist claim non-atomic + booked ₱0
  - Re-check then create over-capacity; created a confirmed, amount:0 booking holding a court unpaid forever.
  - **Fixed:** Claim is now atomic and creates an unpaid hold with a pay window that auto-expires.
  - Refs: `api · waitlist.controller.ts:121-146`
- **A9** · Medium · ✅ Fixed — Malformed/empty JSON body → 500 (systemic, ~111 sites)
  - c.req.json() threw SyntaxError before Zod on empty/non-JSON body.
  - **Fixed:** Central fix: a shared readJson(c) makes bad JSON return a clean 400 everywhere.
  - Refs: `api · check-ins.controller.ts:51 (reference)`
- **A10** · Medium · ✅ Fixed — Invalid ObjectId → CastError 500 (systemic, ~265 sites)
  - isValidObjectId appeared nowhere. Stale/mistyped links 500'd instead of 404.
  - **Fixed:** Central fix: a shared asObjectId() guard makes an invalid ID return a clean 400 everywhere.
  - Refs: `api · check-ins.controller.ts:15-19 (reference)`
- **A11** · Medium · ✅ Fixed — Deleted-user reference crashed the “who's here now” list
  - A checked-in user who deleted their account populated null; toPlayer(null) threw → the venue check-in panel 500'd for everyone.
  - **Fixed:** The list now filters out deleted users and null-guards toPlayer before mapping.
  - Refs: `api · check-ins.controller.ts:22-86`
- **A12** · Medium · ✅ Fixed — E11000 surfaced as 500 instead of 409
  - No 11000 handling anywhere. Expected “already exists” races (applications, conversation keys, registration slots) confused users.
  - **Fixed:** Central fix: code===11000 now maps to a clear 409 “already exists / just taken”.
  - Refs: `api · shared/middleware/error-handler.ts`

---

## 📅 Jul 22, 2026 — 30 done · 1 open

### ◐ Ongoing

**app/ — requested tasks** — _new work items from the client_

- **APP-T1** · Task · ◐ In progress — Splash screen: auto-dismiss like web — no button tap needed
  - The app's launch SplashScreen waits for a “Let's Play” CTA tap before it hands off to the app, while the web build auto-dismisses a beat after the intro settles. Make the app match web: play the intro, then reveal the page automatically with no click (the CTA can still skip ahead).
  - **Doing:** Pass the SplashScreen's existing `auto` prop where the app mounts it (App.tsx) — the same prop web already uses. Respects prefers-reduced-motion; the once-per-session guard is unchanged. Built — awaiting on-device verification.
  - Refs: `app · App.tsx:872` · `app · features/auth/SplashScreen.tsx:26`

### ✅ Done

**app/ — Player PWA (React 19)** — _defensive throughout; these were the real gaps — all resolved_

- **P1** · Critical · ✅ Fixed — No React error boundary anywhere in the app
  - <StrictMode><App/></StrictMode> with zero boundaries. Any single screen render throw unmounted the entire app to a permanent blank white screen, recoverable only by manual reload.
  - **Fixed:** Wrapped the app in an ErrorBoundary with a “Something went wrong — Reload” card; new-version (chunk-load) errors show a “Reload to update” card. The single highest-leverage fix.
  - Refs: `app · main.tsx:7-11` · `app · App.tsx:569-836`
- **P2** · High · ✅ Fixed — Failed owner-dashboard secondary fetches rendered a false “empty” with no retry
  - withBookings/withGames/withReviews used Promise.allSettled and dropped rejected results, setting no error flag. If bookings fetches failed, a busy venue showed “No bookings yet” with no retry.
  - **Fixed:** Now tracks per-list error flags so the screen can tell “genuinely empty” from “failed to load”, and renders ErrorState + retry.
  - Refs: `app · features/owner/hooks/useOwnerDashboard.ts:85-137`
- **P3** · High · ✅ Fixed — EditClubScreen retry dead-ended on a permanent skeleton
  - Retry did setStatus('loading') but the load effect depended only on [clubId] (no reloadKey), so the fetch never refired — stuck on the skeleton forever.
  - **Fixed:** Added a reloadKey, bumped on retry and included in effect deps — retry now re-fetches the club.
  - Refs: `app · features/clubs/EditClubScreen.tsx:106`
- **P4** · High · ✅ Fixed — Feed load failure rendered a misleading “No posts yet” with no retry
  - Initial listFeed() used .catch(() => {}) then setLoading(false); a failed load silently showed the empty state on the default Social landing.
  - **Fixed:** Now sets an error state in .catch and renders ErrorState / retry.
  - Refs: `app · features/social/FeedPanel.tsx:68-75`
- **P5** · High · ✅ Fixed — Match score sheet showed/submitted a stale or blank scoreline across matches
  - BottomSheet keeps children mounted; one persistent MatchScoreSheet was rendered with no key and rows was initialized once, never re-synced. After entering “11-5” for match A, opening match B pre-filled B with A's “11-5”. The organizer could silently record the wrong result.
  - **Fixed:** The score grid now re-seeds every time you open a different match (useEffect on [match?.id, open]).
  - Refs: `app · features/organizer/tournaments/bracket/MatchScoreSheet.tsx:21`
- **P6** · Medium · ✅ Fixed — Leaflet markers loaded from unpkg.com CDN on all 6 map screens
  - The SW cached OSM tiles but not these icons → broken pins offline / when the CDN is blocked.
  - **Fixed:** Pins are now imported from bundled leaflet/dist/images/* — they work offline.
  - Refs: `app · FullMapScreen.tsx:11-13` · `app · NearbyScreen.tsx:65-67` · `app · ui/MapPinPicker.tsx:15-17`
- **P7** · Already safe · ✓ No change — Chart primitives divide by zero on sparse data
  - Reported: sparkline single point → NaN path; donut total===0 → NaN dasharray.
  - **Verified:** Already safe — the guards already exist. No change needed.
  - Refs: `app · ui/Chart.tsx:134` · `app · ui/Chart.tsx:219-229`
- **P8** · Medium · ✅ Fixed — Clubs directory failure silently showed “No clubs found”
  - .catch(() => ({items:[],cursor:null})) rendered the empty state on a failed load.
  - **Fixed:** Now tracks a load error and renders a real error + Retry.
  - Refs: `app · features/social/ClubsPanel.tsx:41-53`
- **P9** · Already safe · ✓ No change — Admin “Pricing mode” segmented control (undefined option ids)
  - Reported: passes {value,label} where Segmented expects {id,label}; never highlights and writes pricingMode: undefined.
  - **Verified:** Already correct — the control already uses the right values. No change needed.
  - Refs: `app · profile/v2/SettingsScreenV2.tsx:364-375`
- **P10** · Medium · ✅ Fixed — Feed hide / not-interested / delete optimistic with no rollback
  - Content stayed hidden/“deleted” on failure until reload.
  - **Fixed:** On failure the post now comes back and a toast explains it didn't save (prior posts restored in .catch).
  - Refs: `app · features/social/FeedPanel.tsx:137-176`
- **P11** · Medium · ✅ Fixed — Chat conversation-load error was a dead-end (no retry)
  - <ErrorState> with no onRetry, unlike ConversationsScreen.
  - **Fixed:** Added a Retry button via a reload key.
  - Refs: `app · messages/ChatScreen.tsx:399`
- **P12** · Medium · ✅ Fixed — Roster/organizer manage actions failed with zero feedback
  - Approve/check-in/cancel/remove rejected unhandled → the button re-enabled, nothing changed, no error.
  - **Fixed:** Failures are now caught and the list refreshes to show the real state (+ toast).
  - Refs: `app · organizer/tournaments/TournamentDetailScreen.tsx:64` · `app · organizer/openplay/SessionRosterScreen.tsx:40` · `app · organizer/venues/VenueRequestsScreen.tsx:81`
- **P13** · Already safe · ✓ No change — coachDisplay.money() missing a null guard its siblings have
  - Reported: amount.toLocaleString() with no coercion could throw on a null b.amount/s.price inside .map.
  - **Verified:** Already safe — type safety + caller guard cover it. No change needed.
  - Refs: `app · coaches/coachDisplay.ts:13`
- **P14** · Low · ✅ Fixed — VenueOverviewTab swallowed sub-fetch failures into zeros
  - Failed analytics/bookings/reviews rendered ₱0 / 0 courts as if empty.
  - **Fixed:** Now shows a “couldn't load X” warning so zeros aren't mistaken for real data.
  - Refs: `app · owner/tabs/VenueOverviewTab.tsx:50-72`
- **P15** · Low · ✅ Fixed — OwnerProfileScreen had no loading/error state
  - Showed “0 venues · 0 courts” on a failed load.
  - **Fixed:** Added loading + error states with a Retry.
  - Refs: `app · owner/OwnerProfileScreen.tsx:87-100`
- **P16** · Low · ✅ Fixed — OwnerVenueScreen.reload() swallowed refresh errors
  - After an edit-save, a failed refetch kept stale data with no feedback.
  - **Fixed:** A failed refresh now surfaces an error toast instead of hiding it.
  - Refs: `app · owner/OwnerVenueScreen.tsx:105-107`

**app/ — games / venues / booking sweep** — _the player-facing cluster the original scan didn't reach — swept, all fixed_

- **P17** · High · ✅ Fixed — Creating a game could double-charge the card on retry
  - Creating a game charged the card, then if the last step failed it reported an error — and tapping retry charged the card again.
  - **Fixed:** The flow now remembers each step that succeeded: the card is charged at most once, and a retry resumes from where it failed instead of re-booking/re-charging.
- **P18** · High · ✅ Fixed — Membership join showed “You're in!” even when it failed
  - Joining a venue membership showed success even when the payment/join actually failed.
  - **Fixed:** Success only shows after the server confirms; a failure now shows an error and rolls back.
- **Booking-stuck** · High · ✅ Fixed — Booking link spun forever when the venue failed to load
  - Opening a booking link when the venue failed to load spun forever on a skeleton.
  - **Fixed:** Now shows an error with a Retry.
- **OpenPlay** · High · ✅ Fixed — Open Play detail looked deleted on any load failure
  - A failed load said the play “may have been removed” (looked deleted) with no retry.
  - **Fixed:** Real errors now show a Retry, separate from genuine 404s.
- **P19** · Medium · ✅ Fixed — Cancelling a booking in My Bookings failed silently
  - The booking reappeared with no reason given.
  - **Fixed:** Cancel failures now show a clear message.
- **G1** · Medium · ✅ Fixed — Same silent cancel on the Games/Bookings tab
  - A failed cancel gave no feedback.
  - **Fixed:** Same clear error message.
- **P20** · Medium · ✅ Fixed — Claiming a waitlist slot (time-critical) failed silently
  - The user couldn't tell if the claim worked.
  - **Fixed:** Claim failures now show a message.
- **No-courts** · Medium · ✅ Fixed — “No courts” shown when the courts list failed to load (2 screens)
  - A failed courts load read as “No courts” as if none existed.
  - **Fixed:** Now shows “couldn't load — retry” instead of a fake empty.
- **Map-avail** · Medium · ✅ Fixed — Map showed every court as free when the availability check failed
  - A failed availability check silently painted every court free at the chosen time.
  - **Fixed:** Now warns that times may not be accurate.
- **Msg-venue** · Medium · ✅ Fixed — “Message venue” failure just re-enabled the button
  - A failed “Message venue” gave no explanation.
  - **Fixed:** Now shows an error toast.
- **Become** · Medium · ✅ Fixed — “Become a coach/organizer” application failed silently
  - A failed application (network/500) silently did nothing.
  - **Fixed:** Now shows an error toast.
- **CG-courts** · Medium · ✅ Fixed — Create Game hard-blocked on a failed court load
  - A failed court load hard-blocked game creation with a fake “no courts”.
  - **Fixed:** Now shows “couldn't load — retry”.
- **Joined** · Low · ✅ Fixed — Games “Joined/Invites” tabs silently showed empty on failure
  - A load failure looked like an empty tab.
  - **Fixed:** Now show a retry line.
- **Invite** · Low · ✅ Fixed — Invite player search looked like nothing happened on failure
  - A failed player search gave no feedback.
  - **Fixed:** Now says “couldn't search — try again”.

---

_Generated from the audit source (`plan/project-gap-prevention-user-facing-reliability-audit.md`) — kept in sync with the HTML board._
