# api/ — pickleballers-api (read this first)

Hono + MongoDB/Mongoose REST API for PickleBallers. **This file is the map.**
Skim it before grepping/scanning `src/` — it points you straight at the right
file. Deep architecture, the add-a-feature checklist, the `/lists` rule, and
data-model conventions live in [CLAUDE.md](CLAUDE.md); repo-wide conventions for
all agents live in [../AGENTS.md](../AGENTS.md).

## Commands

```sh
npm run dev          # tsx watch src/index.ts
npm run typecheck    # tsc --noEmit
npm run lint         # typecheck + eslint
npm test             # vitest run
npm run db:import    # load real-data/handoff CSVs into MongoDB
npm run pm2:restart  # restart the running PM2 process (do this after deploy)
```

## Stack

Node 20+ · TypeScript via `tsx` (ESM, `"type": "module"`, **`.js` extensions in
imports**) · Hono · Mongoose · MongoDB `localhost:27017/pickleballers` ·
port **9002** (PM2 app `pickleballer-api`, host `pickleballer-api.eunika.xyz`).

## Entry points & composition root

- `src/index.ts` — Hono app + global middleware (boot).
- **`src/routes/index.ts`** — composition root: mounts every feature under
  `/api/v1`. **← start here to see the route surface.**
- `/lists` (the live endpoint catalogue) is generated from
  `features/root/root.controller.ts` → `listEndpoints()` — keep it in sync (see CLAUDE.md).

## Directory map

```
src/
  index.ts                  # entry: Hono app + global middleware
  routes/
    index.ts                # composition root — mounts all feature routes  ← start here
    health.test.ts
  test-setup.ts             # vitest setup

  features/<feature>/        # vertical slice: <f>.controller.ts (Hono handlers)
                             #                + <f>.routes.ts (router + middleware)
                             #                + <f>.model.ts (Mongoose schemas)
    admin/                   # admin operations (controller + routes, no model).
                             #   Moderation queues: reviews, review-reports, and
                             #   feed-reports (reported PickleFeed posts →
                             #   GET/PATCH /admin/feed-reports, backed by feed's
                             #   FeedReport). Dashboard rolls up pending counts.
    auth/                    # login/register/tokens; auth.model.ts = users
    bookings/                # court bookings; create-time guard (per-user overlap +
                             #   per-court / venue-pool double-booking, honoring a
                             #   court's turnoverMinutes buffer) + the shared
                             #   slot-availability model (hoursTouched/freeCourtsByHour/
                             #   courtFreeHoursWithTurnover/resolveVenueCapacity, reused
                             #   by the venue availability endpoint, which also serves
                             #   per-court via ?courtId — buffer-aware).
                             #   Request-to-book lifecycle: a booking at a venue with
                             #   requireBookingApproval (or on a court whose approvalMode
                             #   = 'manual') lands 'pending_approval' (card saved, no
                             #   charge) → owner approves → 'awaiting_payment'
                             #   (+ paymentDueAt) → player pays → 'confirmed'; a court's
                             #   approvalMode 'auto'/'manual' overrides the venue policy
                             #   ('inherit' follows the venue's requireBookingApproval).
                             #   bookingDeadlines.ts = PURE deadline math + the occupancy
                             #   predicate (unit-tested in bookingDeadlines.test.ts, and
                             #   against real Mongo in bookingOccupancy.test.ts). A request
                             #   carries an approvalDeadline set at creation — min(venue
                             #   approvalWindowHours, a share of the time until play that
                             #   shrinks as the game nears, playStart−30m). Occupancy is
                             #   settled by comparing that deadline at QUERY time via
                             #   blockingFilter(), NOT by a sweeper rewriting status, so a
                             #   lapsed request frees its court immediately; rows with no
                             #   deadline (pre-feature) never expire. sweepExpiredBookings()
                             #   is scheduled cleanup + owner nudges at 50%/80% of the
                             #   window, and expireOverdueBookings() still runs on read.
                             #   Booking model also carries the payment breakdown
                             #   (serviceFeeAmount + paymentOption full|deposit|pay_at_venue +
                             #   amountPaid + balanceDue) and owner-entered fields
                             #   (createdByUserId, customerName/phone, bookingSource, blockReason);
                             #   findSlotConflict is exported (optional userId) so the owner
                             #   manual-booking endpoint reuses the same clash guard
    check-ins/               # live presence: a player marks themselves "here now"
                             #   at a venue (time-bounded ~3h). Powers the home
                             #   who-is-playing banner (GET /check-ins/hotspot) +
                             #   the court page (POST/DELETE /check-ins, GET /check-ins?venueId)
    brackets/                # tournament brackets: entrants + bracket + matches.
                             #   bracketEngine.ts = PURE seeding/generation/advancement/
                             #   standings (single+double elim, round robin, pool play),
                             #   unit-tested in bracketEngine.test.ts. Routes live under
                             #   /tournaments/:id/{entrants,bracket,matches,standings}
    cities/                  # city directory
    coaches/                 # coaches + coach-reviews.* (reviews sub-resource).
                             #   Coach is its own doc, linked to a User by `userId`
                             #   (imported directory rows have none). CoachService =
                             #   a bookable session type. GET /coaches?subscribed=true
                             #   returns ONLY coaches with a live coach subscription
                             #   (powers Find Coach); POST /coaches (createMyCoach)
                             #   requires one (402 SUBSCRIPTION_REQUIRED).
                             #   Rates: pricePrivatePerHour/priceGroupPerPlayer are
                             #   the standard ones; Coach.venueRates[] pins a rate to
                             #   a venue and wins for sessions booked there (see
                             #   coach-bookings). PATCH /coaches/me takes venueRates
                             #   whole (omitted venue = back to standard) and 403s
                             #   VENUE_NOT_APPROVED for a venue the coach doesn't
                             #   work at — approvedVenueIds() is the shared gate.
    coach-applications/      # coaches apply to venues; owners approve/reject.
                             #   Submitting now requires a live coach subscription
                             #   (402) — the paid plan is what buys "become a coach
                             #   at this venue". Approval still mints the venue-scoped
                             #   UserRole grant (the profile badge).
    coach-bookings/          # a player books a coaching session with a coach.
                             #   CoachBooking model (deliberately NOT the court
                             #   `Booking` — a session is a claim on a person's time,
                             #   not a court). pending → coach accepts (confirmed) /
                             #   declines; either party cancels. Price is server-
                             #   derived, never trusted from the client, in this order:
                             #   the CoachService → the coach's venueRates[] entry for
                             #   the booked venueId → their global hourly rate. Guards:
                             #   COACH_NOT_SUBSCRIBED / SLOT_TAKEN / SELF_BOOKING.
    partner-subscriptions/   # the PAID, PLATFORM-level coach/organizer plan.
                             #   PartnerSubscription model + hasActivePartnerSubscription
                             #   / activeSubscriberIds (batched) / expireLapsedSubscriptions
                             #   (lazy expiry on read — no cron). Subscribing requires a
                             #   complete postal address (400 ADDRESS_REQUIRED) and grants
                             #   the GLOBAL coach/organizer role. CANCEL IS SCHEDULED, not
                             #   immediate: DELETE sets cancelAtPeriodEnd + stops auto-renew,
                             #   access runs to expiresAt, and expireLapsedSubscriptions()
                             #   revokes the role on the first read past the deadline
                             #   (POST /:id/resume undoes it mid-term). Venue-scoped grants
                             #   are never touched. Price + term live in AppSettings.
                             #   NOTE: unrelated to `subscriptions/` (a newsletter list).
    partners/                # GET /partners/owner — the owner's Partners screen: coach +
                             #   organizer applications across their venues, each tagged
                             #   with `kind`, + KPI counts and a REAL per-partner stats
                             #   rollup (`stats`) — specialty/certification/rating from the
                             #   Coach profile, sessions + revenue from COMPLETED
                             #   CoachBookings, eventCount + revenue from PAID
                             #   TournamentRegistrations. Batched (never per-partner).
                             #   ⚠️ Never fabricate a stat here: until 2026-07-14 the APP
                             #   invented revenue, star ratings and even "PPR Certified"
                             #   from a hash of the partner's NAME and showed them to the
                             #   owner approving that partner. No data → null → the client
                             #   renders nothing.
    users/                   # GET /users/:id — another player's PUBLIC profile card
                             #   (roles, per-venue partner badges, live isCoach/isOrganizer).
                             #   Never exposes email/phone/postal address.
    tournament-applications/ # organizers request a venue+slot for a tournament; owners approve/reject
    content/                 # editorial / CMS content + organizer tournaments AND open play
                             #   RECURRING open play is no longer organizer-only (§5.3): a venue
                             #   OWNER/staff can run a series at a venue they MANAGE (canRunSeriesAt
                             #   = organizer.events.manage OR managedVenueIds contains it) — an owner
                             #   needs that one capability, not the whole organizer role. Create,
                             #   list (/mine), cancel and the new EDIT endpoints all share that gate;
                             #   widening create but not /mine greeted owners with a 403 on load.
                             #   PATCH /open-play/:id edits ONE occurrence ('just this week',
                             #   notifies whoever joined); PATCH /open-play/series/:id?scope=future|all
                             #   edits the template + its occurrences (future = today on, so a price
                             #   rise never rewrites what last week's players paid).
                             #   ⚠ Dates are built with ymd(), never toISOString(): local midnight in
                             #   Manila is 16:00 the PREVIOUS day in UTC, and the generator was
                             #   writing every recurring session one day early — ask for Tuesday, get
                             #   a series of Mondays.
                             #   Tournaments: create/edit/cancel/mine, open-registration,
                             #     register/withdraw/participants, registration mgmt
                             #     (check-in/approve/decline/paid), announcements (broadcast
                             #     to registrants → notifications), participant GROUP CHAT
                             #     (TournamentMessage model; GET/POST /:id/messages, roster =
                             #     organizer + registrants, gated by player.tournaments.chat;
                             #     POST realtime-fans-out tournament.message.created via userEvents).
                             #   Open play: OpenPlaySeries + OpenPlaySession + OpenPlayRegistration —
                             #     create recurring series (generates instances)/mine/cancel
                             #     series|instance + INTEREST toggle (join/leave = "I'm Interested",
                             #     no capacity/waitlist; getOpenPlaySession returns interestedUsers
                             #     + viewerIsOrganizer) + roster + reg mgmt.
                             #   Session GROUP CHAT (OpenPlayMessage model; GET/POST
                             #     /open-play/:id/messages, roster = organizer + everyone who joined;
                             #     post gated by player.games.chat — Open Play is part of the games
                             #     family, so no near-duplicate permission; POST realtime-fans-out
                             #     openplay.message.created via userEvents + a collapsed notification).
    games/                   # player games: gameType open=INTEREST-only Open Play (interestedUserIds
                             #   + POST /:id/interest toggle, no roster/capacity; join/leave rejected;
                             #   targetPlayers = soft headcount goal), public=format-driven capped game
                             #   (format bracketing|round_robin|mini_tournament + roster),
                             #   singles/doubles=classic lobby; vibe casual|competitive on any type.
                             #   Lobby leave/join policy: not-full = free leave w/ 1h re-join cooldown
                             #   after a 2nd leave (leaveLog); full = fullAt starts a 1h free-leave
                             #   window, after it POST /:id/request-leave → host POST /:id/approve-leave
                             #   (pendingLeaveUserIds). Per-game GROUP CHAT
                             #   (GameMessage model; GET/POST /:id/messages, gated by
                             #   player.games.chat; POST realtime-fans-out game.message.created via
                             #   shared/lib/userEvents.ts). The chat roster (chatRoster/isOnRoster) is
                             #   host + participantIds + interestedUserIds — the last one is what gives
                             #   gameType 'open' Open Play a chat, since it has no participantIds.
                             #   create (POST takes
                             #   venueId + the host's bookingId — the court is booked + paid first
                             #   via the bookings flow; createGame tags that booking bookingType:
                             #   'game' so it's hidden from "My bookings" and shows only as a game)
                             #   / list / get / join / leave / kick (host removes a player) + host
                             #   edit PATCH (details only) / delete DELETE (player.games.manage) +
                             #   invite POST (host invites players by id → notify each, records
                             #   invitedUserIds; player.games.invite).
                             #   join emits a `game_full` Notification to the host on the join that
                             #   fills the lobby (best-effort; via interactions' Notification model).
                             #   leave enforces the LOBBY_LEAVE_GRACE_PERIOD_DAYS rule: a non-host
                             #   can't leave a FULL lobby within the window (409 LOBBY_LOCKED).
                             #   No vote/lobby flow — games are joinable on creation.
    play/                    # THE PLAY TAB'S DISCOVER FEED — no model of its own; it ranks the
                             #   rows `games/` and `content/` already own. GET /play/discover
                             #   merges public games + venue Open Play sessions into ONE
                             #   relevance-ordered list. playRanking.ts is the scorer (pure, no
                             #   Hono/Mongoose): time fit 30% / proximity 25% / skill fit 20% /
                             #   spots left 15% / friends 10%, and a signal whose INPUT is missing
                             #   is dropped and the rest renormalised (so a signed-out user with no
                             #   location or rating still gets a sane order, not a flat one).
                             #   ?section=open-play|events, ?lat=&lng= (only the browser knows the
                             #   viewer's coords; skill + friends come from the token).
                             #   It scores the whole upcoming catalogue (CANDIDATE_CAP) and
                             #   truncates AFTER — the app used to rank the ~50 rows the server had
                             #   already picked BY DATE, so "nearest" meant "nearest among the
                             #   soonest". Excludes listings the viewer already hosts/joined.
                             #   Two wire hazards it handles, both found by running it: `id` comes
                             #   off the session serializer as a raw ObjectId (the sort's
                             #   localeCompare throws on one), and an open-ended '4.0+' band is
                             #   [4, Infinity] — which JSON silently turns into null.
                             #   Moved here from the app (app/src/features/games/playRanking.ts),
                             #   which now only re-sorts what this returns.
    clubs/                   # Discord-style clubs + Facebook-style realtime feed. 6 models
                             #   (Club/ClubMembership/ClubPost[recursive]/ClubPostReaction/
                             #   ClubJoinRequest/ClubMessage); CRUD + join/leave + private
                             #   request-approve + recursive posts/replies/like + notification
                             #   fan-out + member group chat (ClubMessage; GET/POST /:id/messages,
                             #   members only, fans club.message.created to the per-user stream).
                             #   clubs.events.ts = in-process SSE bus; GET /:id/stream (streamSSE,
                             #   ?token= auth)
    geo/                     # geocoding proxy (OSM Nominatim): forward (/geocode) + type-ahead
                             #   suggestions (/geocode/suggest, ranked list w/ city/region/area/
                             #   street line1/postcode) + reverse (/geocode/reverse, coords→
                             #   city+street+postcode) — controller + routes, no model
    interactions/            # likes / follows / saves + Notification model & inbox; also owns the
                             #   per-user realtime SSE stream GET /me/stream (streamUserEvents,
                             #   ?token= auth) that forwards shared/lib/userEvents.ts events
                             #   (notification.created + message.created) to the user's open app
    media/                   # venue media; derives each venue's `image` field
    messages/                # direct 1:1 chat (Conversation + Message models). find-or-create a
                             #   thread by user pair, list threads (other participant + last msg +
                             #   unread), get a thread (marks read), send (notifies recipient via
                             #   notify.ts → inbox+push, AND publishes message.created to
                             #   userEvents.ts for realtime chat), unread-count. Gated by
                             #   user.messages.send.
    payments/                # payments.model.ts = Payment + VenuePricing; POST /checkout (test-mode pay)
    rental-inventory/        # owner-only equipment rental inventory (Shop):
                             #   RentalInventoryItem model (venueId?/ownerId/name/
                             #   brand/sku/category/rentalPricePerHour/stock counts/
                             #   condition/status/isArchived + ecommerce-ready fields),
                             #   CRUD + soft-delete (archive) + stats + CSV export,
                             #   all scoped by ownerId; mounted at /api/v1/rental-inventory
    push/                    # Web Push (OS notifications): PushSubscription model + GET /push/public-key
                             #   (VAPID) + POST /push/{subscribe,unsubscribe}. Low-level send lives in
                             #   shared/lib/push.ts (sendPushToUser, VAPID via VAPID_* env); most callers
                             #   go through shared/lib/notify.ts (in-app row + push together) — fired by
                             #   games (join/leave/kick/edit/cancel/full/invite), clubs feed, content
                             #   (tournament announcements + cancel + registration approve/decline,
                             #   open-play cancel, waitlist promotions), and brackets (bracket live /
                             #   match result / champion).
    roles/                   # RBAC roles (controller + routes + roles.model.ts)
    rosters/                 # organizer reusable player lists (OrganizerRoster);
                             #   CRUD + add/remove members (organizer.events.manage)
    root/                    # root.controller.ts only: / , /health, /lists (catalogue)
    search/                  # cross-entity search (controller + routes, no model);
                             #   ?type=venues|coaches|players|games|clubs, ?type=all = full set
                             #   for the app global search; no type = legacy venues+coaches
    settings/                # AppSettings singleton: GET (public) / PATCH (admin) payment test mode
    staff/                   # org-level owner staff sub-accounts (controller + routes, no
                             #   model — reuses the User model). An owner (or admin) CREATES a
                             #   login (roleDefault:'staff' + parentOwnerUserId) that runs the
                             #   owner console for ALL of that owner's venues, bookings, and
                             #   clubs — scoped everywhere via effectiveOwnerId() (shared/lib/
                             #   permissions.ts). Distinct from venues' per-venue VenueStaff.
                             #   create/list/update(rename|reset-pw)/remove (DELETE = hard
                             #   delete the login); owner+admin only (owner.staff.manage).
    subscriptions/           # newsletter mailing list (email opt-in) + AuditLog.
                             #   NOT a paid plan — see partner-subscriptions/ for that.
    tables/                  # generic table/list endpoints (controller + routes)
    tags/                    # tag taxonomy
    venues/                  # venues.* + venue-management.* (owner-side editing;
                             #   claims, suggested-edits, admin venue-approvals queue;
                             #   owner bookings inbox (GET/PATCH /:id/bookings) +
                             #   owner/staff manual booking + slot-block (POST
                             #   /:id/bookings — bookingType manual|blocked, off-platform
                             #   customer or block reason; reuses bookings' findSlotConflict
                             #   double-booking guard, no payment) +
                             #   owner analytics (GET /:id/analytics) + public
                             #   per-hour court availability (GET /:id/availability;
                             #   add ?courtId for a single court's free hours);
                             #   auto-generated booking link: getVenue/resolveVenueId
                             #   resolve a venue by custom bookingSlug too, updateVenue
                             #   normalizes+uniqueness-checks it, and GET
                             #   /:id/booking-slug-available is the live typing check;
                             #   DELETE /:id soft-deletes (sets deletedAt — hidden
                             #   everywhere but admins; listVenues/getVenue filter it out);
                             #   operating hours are PER-COURT: VenueHour rows carry a
                             #   courtId (null = venue-wide default a court inherits);
                             #   GET/PUT /courts/:id/hours edit one court's schedule,
                             #   getVenue returns each court's effective `hours` +
                             #   venue.hours as the union, availability windows fold
                             #   per-court (courts also carry courtName/description/
                             #   galleryImageUrls + a per-court booking policy:
                             #   approvalMode 'inherit'|'auto'|'manual' and a
                             #   turnoverMinutes buffer enforced by the bookings guard);
                             #   venue MEMBERS = VenueMember rows (member pricing); SUBSCRIPTION
                             #   PLANS = SubscriptionPlan + SubscriptionPlanVersion
                             #   (versioned — editing creates new version, existing
                             #   subscribers stay on their version until renewal) +
                             #   VenueSubscription (links member to plan version);
                             #   CRUD + duplicate + toggle + public list + subscribe;
                             #   managed /:id/members (GET/POST/DELETE) + self-service
                             #   /:id/membership (POST join/switch/renew, DELETE cancel — a player
                             #   joins their OWN; getVenue returns viewerIsMember +
                             #   viewerMembershipTier + viewerMembershipExpiresAt; expiry
                             #   computed from plan cadence via computeMembershipExpiresAt,
                             #   isActive gates on expiresAt > now));

  shared/
    db/                      # connect + seeders + importers:
                             #   import-real-data.ts  (npm run db:import — drops & reloads CSVs)
                             #   seed.ts, seed-dummy-data.ts, seed-dummy-users.ts,
                             #   seed-coach-subscribers.ts (npm run db:seed:coach-subs
                             #     — N=12 player accounts w/ address + active coach
                             #     partner-subscription; idempotent by
                             #     @coachseed.pickleballers.local),
                             #   generate-courts.ts, assign-venue-owners.ts,
                             #   assign-two-owners-test-venues.ts (Garrido+Walker
                             #     each get 20 NCR/CALABARZON venues, 6-12 courts),
                             #   seed-owner-pricing-overrides.ts (Dink-Lab-style
                             #     SlotPriceOverrides for those owners' 40 venues),
                             #   seed-owner-shop-partners.ts (rental inventory +
                             #     coach/organizer applications for those owners),
                             #   backfill-user-location-avatars.ts (player lat/lng
                             #     in Cavite→Manila box + randomuser.me avatars),
                             #   fix-avatar-gender.ts (match avatar gender to name),
                             #   backfill-venue-court-images.ts (stock photos for
                             #     venues/courts missing a mainImageUrl),
                             #   link-owner-venues.ts, download-images.ts, index.ts,
                             #   expire-legacy-pending-bookings.ts (one-off: silently
                             #     cancels request-to-book rows stranded before
                             #     approvalDeadline existed, which would otherwise block
                             #     their courts forever; --dry-run supported),
                             #   backfill-cancellation-type.ts (one-off: infers
                             #     Booking.cancellationType on legacy cancelled rows
                             #     from their fixed cancellationReason strings, so
                             #     reports can tell an owner rejection from a player
                             #     cancellation; idempotent, --dry-run/--leave-unmatched)
    lib/                     # framework-agnostic helpers: jwt.ts, permissions.ts,
                             #   geo.ts (haversineKm — the Play feed's proximity signal),
                             #   cursor.ts (compound createdAt|_id keyset pagination),
                             #   push.ts (Web Push send/VAPID), notify.ts (in-app
                             #   Notification + push together — the usual notify entry point;
                             #   also publishes notification.created to userEvents.ts),
                             #   userEvents.ts (in-process per-user realtime bus, channel
                             #   user:${id} — mirrors clubs.events.ts; drives GET /me/stream),
                             #   scheduler.ts (everyMinutes(name, fn, mins) — the only job
                             #   runner; in-process, runs once at boot, survives a throwing
                             #   job, unref'd. Multi-instance safe only if the job itself is
                             #   idempotent — the booking sweep uses status-guarded
                             #   findOneAndUpdate rather than a lock),
                             #   client-ip.ts (trusted-proxy-aware caller IP: X-Forwarded-For
                             #   is honoured ONLY when the socket peer is in TRUSTED_PROXIES,
                             #   else the header is a free rate-limit bypass)
    middleware/              # auth.ts (requireAuth / optionalAuth), error-handler.ts,
                             # request-id.ts,
                             # client-identity.ts (resolves clientId/clientUser BEFORE routing
                             #   so the two meters below can key per-user, not per-IP),
                             # rate-limiter.ts (per-identity sliding window; abuse backstop),
                             # queue.ts (concurrency gate + fair queue; overload backstop)
```

## Key shared modules (know these before touching behavior)

- **`src/routes/index.ts`** — where every feature is mounted; the whole API surface.
- **`features/root/root.controller.ts`** — `/lists` source of truth (must stay in sync with routes).
- **`shared/middleware/auth.ts`** — `requireAuth` (hard fail) / `optionalAuth` (attach if present).
- **`shared/middleware/client-identity.ts`** — runs before the limiter/queue and sets `clientId`
  (`user:<id>` when a valid token is present, else `ip:<addr>`). It intentionally does *not* set
  `user` — that key stays the contract of `requireAuth`/`optionalAuth`.
- **`shared/middleware/queue.ts`** — bounds in-flight requests (`API_MAX_CONCURRENT`) and makes the
  excess **wait** instead of failing; sheds `503 SERVER_BUSY` only when the queue or the timeout is
  exhausted. `maxConcurrentPerClient` is the fairness lever: one client can never occupy every slot,
  so a flood degrades only the flooder. Bypasses `OPTIONS`, `/health`, and `*/stream` (SSE) — that
  exempts them from the queue, not from a saturated event loop. Don't raise `API_MAX_QUEUED` to cure
  503s: measured, a deeper queue traded fast failures for slow ones and made `/health` far worse.
- **`shared/lib/jwt.ts`** — sign/verify; secret in `JWT_SECRET`.
- **`shared/lib/permissions.ts`** — roles → permissions; the canonical `ALL_PERMISSIONS` /
  `PERMISSION_CATALOGUE` / `ROLE_PERMISSIONS` (source of truth synced to web + app — see `../AGENTS.md`).
  Also `effectiveOwnerId(user)` — the creating owner's id for a staff sub-account (from the JWT's
  `parentOwnerId`), else the user's own id; every venue/club ownership check uses it so staff inherit
  their owner's resources.
- **`shared/db/import-real-data.ts`** — drops + reloads `real-data/handoff/` CSVs.

## Where to look first, by task

| Task | Open first |
|---|---|
| Add / change an endpoint | `features/<f>/<f>.routes.ts` + `<f>.controller.ts`, then `/lists` in `features/root/root.controller.ts` |
| Mount a new feature | `routes/index.ts` |
| Data shape / schema | `features/<f>/<f>.model.ts` |
| Clubs / club feed / SSE realtime | `features/clubs/` (`clubs.controller.ts`, `clubs.model.ts`, `clubs.events.ts` = SSE bus); cursor in `shared/lib/cursor.ts` |
| PickleFeed (global player newsfeed) | `features/feed/` (`feed.controller.ts`, `feed.model.ts`, `feed.routes.ts`) — Threads/Facebook-style global feed, cursor-paginated; post/like/comment/repost + photos (per-photo caption) + share cards (game/open-play/club, enriched server-side); **per-viewer personalization** via `FeedSignal` (interested→float+de-cluster / not_interested→mute), `FeedHiddenPost` (24h hide), `FeedReport` (moderation), `FeedNotifySub` (comment-notify subscribe); no SSE yet (MVP refreshes on action); e2e in `e2e/feed.sh` |
| Per-user realtime (chat + notifs) | `shared/lib/userEvents.ts` (bus) + `GET /me/stream` in `features/interactions/`; published by `shared/lib/notify.ts` + `features/messages/` |
| Booking expiry / "is this slot free?" | `features/bookings/bookingDeadlines.ts` (pure) — `blockingFilter()` is the single occupancy predicate, spread into the 3 conflict queries in `bookings.controller.ts`; change the windows in `approvalShare()`. The sweeper + reminders are `sweepExpiredBookings()`, scheduled from `index.ts` via `shared/lib/scheduler.ts` |
| Bracket / seeding / advancement logic | `features/brackets/bracketEngine.ts` (pure, tested), then `brackets.controller.ts` |
| Play tab Discover ranking / relevance weights | `features/play/playRanking.ts` (pure, 39 tests) — retune `RANK_WEIGHTS` here and every device picks it up with no app release; the feed itself is `play.controller.ts` |
| Auth / tokens / gating | `shared/middleware/auth.ts`, `shared/lib/jwt.ts`, `features/auth/*` |
| Roles & permissions | `shared/lib/permissions.ts`, `features/roles/*` |
| Owner staff sub-accounts (delegation) | `features/staff/*`, `shared/lib/permissions.ts` (`effectiveOwnerId`); scope honored in `features/venues/venues.controller.ts` + `features/clubs/clubs.controller.ts` |
| Seed / import data | `shared/db/import-real-data.ts`, `seed*.ts` |
| Cross-feature helper | `shared/lib/` |

> Keep this file current when structure or core flow changes — it's only useful if it's true.
