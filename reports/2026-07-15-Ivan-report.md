# Daily Build Report — July 15, 2026

## PickleFeed — Global Player Newsfeed

**Status:** ✅ Shipped

A Threads/Facebook-style global newsfeed on the Social tab. Players post text, like,
comment, repost each other's posts, and share public games, open-play sessions, and
clubs into the feed as tappable cards.

The Social tab now has three sections: **PickleFeed · Clubs · Friends** — PickleFeed
is the default landing.

### Features shipped

| Feature | Details |
|---|---|
| Text posts | Compose popup (Facebook-style), body up to 8000 chars |
| Like / Unlike | Optimistic toggle, idempotent per-post per-user |
| Comments | Full comment thread on permalink page, sticky composer |
| Repost | Quote another player's post with optional caption |
| Share cards | Game, Open Play, Club — server-enriched snapshots, tappable |
| Auto-linkify | URLs in post bodies become clickable blue links |
| Share to feed | Buttons on GameDetailsScreen + ClubDetailsScreen hero |
| Author edit/delete | ⋯ menu → edit inline / delete with confirm |

### Files changed

**Backend — new `api/src/features/feed/`:**

| File | Role |
|---|---|
| `feed.model.ts` | `FeedPost` (recursive post+reply), `FeedPostReaction`, attachment schema (game / open_play / club) |
| `feed.controller.ts` | 8 handlers — listFeed (cursor), getPost, listReplies, createPost (enriches cards server-side), edit/delete/reaction |
| `feed.routes.ts` | `/api/v1/feed` — public read, auth-gated write (no new permission needed) |

Registered in `routes/index.ts` + `/lists` catalogue updated.

**Frontend — `app/src/features/social/`:**

| File | Role |
|---|---|
| `SocialScreen.tsx` | 3-tab segmented: PickleFeed · Clubs · Friends, feed default |
| `FeedPanel.tsx` | Cursor-paginated post list + "What's new?" / Create New Post trigger |
| `FeedPostCard.tsx` | Post card — avatar, author, body, like/comment/repost/share row |
| `FeedComposerSheet.tsx` | Compose popup with Game/OpenPlay/Club attachment pickers |
| `FeedPostScreen.tsx` | Permalink — post + comments + sticky composer |
| `FeedShareCard.tsx` | Rich tappable card for shared game/open-play/club |
| `RepostQuote.tsx` | Quoted original inside a repost |
| `feedTime.tsx` | `relTime()` + `linkifyBody()` (auto-detects URLs → clickable) |

Also touched:
- `shared/lib/api.ts` — `FEED_PREFIX`, `ApiFeedPost`, `FeedAttachment`, 8 client functions
- `shared/lib/navigation.ts` — `feed-post` screen + `?tab=feed` URL param
- `App.tsx` — render + tab wiring
- `games/GameDetailsScreen.tsx` — "Share to PickleFeed" button
- `clubs/ClubDetailsScreen.tsx` — "Share to PickleFeed" button
- `shared/styles/v2.css` — `.feed-composer-trigger` styles

### API Endpoints

```
GET    /api/v1/feed                         optionalAuth   listFeed (cursor)
POST   /api/v1/feed/posts                   requireAuth    createPost
GET    /api/v1/feed/posts/:postId           optionalAuth   getPost + replies
GET    /api/v1/feed/posts/:postId/replies   optionalAuth   listReplies (cursor)
POST   /api/v1/feed/posts/:postId/react     requireAuth    like (idempotent)
DELETE /api/v1/feed/posts/:postId/react     requireAuth    unlike
PATCH  /api/v1/feed/posts/:postId           requireAuth    editPost (author-only)
DELETE /api/v1/feed/posts/:postId           requireAuth    deletePost (author-only, soft-delete)
```

### Verification

- `api/e2e/feed.sh` — 28/28 passing
- App typecheck: 0 errors in feed files
- App lint: 0 errors in feed files (3 pre-existing in FriendsPanel)

---

## Public Profile Redesign (Coach & Player)

**Status:** ✅ Shipped

Coach detail (`/coaches/:slug`) and player profile (`/players/:id`) now share one
Threads-style layout via a new `shared/components/ui/PublicProfileHero` component.

### Layout

- Sticky top bar: back arrow (left) + section label + share button (right)
- **Header**: bold name + verified check on the left, round avatar top-right
- Handle line under name (e.g. "Third-shot drops" or "Coach · Solid")
- Bio paragraph
- **2×2 stat card grid**: Skill level, Students, Rate per hour, Venues
- **Tab strip** (coaches only): About · Sessions · Venues — only tabs with content render
- **Sticky bottom bar**: two action buttons pinned at the bottom (Book + Message / Message + Share)

### Screenshots

| Screen | Image |
|---|---|
| Coach Mari | ![coach-mari](2026-07-15-coach-mari.png) |
| Coach Leander (with tabs) | ![leander](2026-07-15-coach-leander.png) |
| Coach Leander — Sessions tab | ![leander-sessions](2026-07-15-coach-leander-sessions.png) |
| Player (Mari Sullivan) | ![player](2026-07-15-player-mari.png) |
| Friends → tap row → player profile | ![friends](2026-07-15-friends-tap.png) |

### API changes (`api/src/features/coaches/coaches.controller.ts`)

- `coachPayload` and `listCoaches` now fall back to the linked user's `avatarUrl` when the coach has no profile photo
- Also surfaces `skillLevel` / `skillLevelLabel` from the user account
- Adds `studentCount` (unique players with completed sessions) and `completedSessionCount` from `CoachBooking`

### Friends list

In `FriendsPanel`, tapping a friend/request/suggestion row now navigates to that player's profile. The right-side action buttons (Message, Confirm, Add friend, etc.) still work independently.

### Files changed

| File | Change |
|---|---|
| `app/src/shared/components/ui/PublicProfileHero.tsx` | **New** — reusable Threads-style profile header |
| `app/src/shared/styles/v2.css` | Added `.px-*` rules (~200 lines): topbar, hero, avatar, grid cards, tabs, body, sticky CTA |
| `app/src/features/coaches/CoachDetailScreen.tsx` | Rewrote render with new layout, 2×2 grid, info chips, sticky bottom bar |
| `app/src/features/profile/PlayerProfileScreen.tsx` | Rewrote render with same layout + grid, sticky bottom bar |
| `app/src/features/social/FriendsPanel.tsx` | Rows now tappable → opens `player-profile` |
| `app/src/shared/lib/api.ts` | Added `skillLevel`, `skillLevelLabel`, `studentCount`, `completedSessionCount` to `ApiCoach` |
| `api/src/features/coaches/coaches.controller.ts` | User avatar fallback, skill level, student/session counts in `coachPayload` and `listCoaches` |

---

## Organizer Subscription (₱999) — the Licence to Charge

**Status:** Live foundation; join-fee gate shipped; admin-dashboard UI pending (`web/` follow-up)
**Built:** July 10 (partner-subscriptions slice); extended July 15 (joinFee gate)

### What it is

A **PAID, PLATFORM-LEVEL** subscription (`PartnerPlan = 'organizer'`) that a
**player** buys — **not a venue, not a staff role**. One term costs **₱999**
(admin-configurable) and lasts 30 days (configurable). It grants the global
`organizer` role; a live subscription is what lets its holder **charge a join fee**
for Open Play and **run events** from the organizer console.

The product's revenue model, stated in [`plan/unfinish-tasks.md`](../plan/unfinish-tasks.md):

> **The subscription is the licence to charge.** The platform does not cut into what
> a partner earns. PickleBallers takes **7% on court bookings and nothing else.**

So a subscribed organizer booking a ₱800 court and charging ₱150/head to 6 joiners
keeps **all ₱900** (0% platform cut). PickleBallers earns **7% of ₱800 ≈ ₱56**
on the booking only — the same cut as any player's court booking.

### Where it lives — file index

#### API — the subscription itself (`partner-subscriptions/`)

| File | Role |
|------|------|
| [api/src/features/partner-subscriptions/partner-subscriptions.model.ts](../api/src/features/partner-subscriptions/partner-subscriptions.model.ts) | `PartnerSubscription` Mongoose schema, `PartnerPlan` type (`'coach' \| 'organizer'`), `hasActivePartnerSubscription(userId, plan)`, `activeSubscriberIds(userIds, plan)`, `expireLapsedSubscriptions(userId)` — **lazy expiry** (no cron; expiring rows are swept + roles revoked on the next read) |
| [api/src/features/partner-subscriptions/partner-subscriptions.controller.ts](../api/src/features/partner-subscriptions/partner-subscriptions.controller.ts) | `getMySubscriptions`, `createSubscription` (the purchase — gates on `ADDRESS_REQUIRED`), `cancelSubscription` (cancel at period end — role survives until `expiresAt`), `resumeSubscription` |
| [api/src/features/partner-subscriptions/partner-subscriptions.routes.ts](../api/src/features/partner-subscriptions/partner-subscriptions.routes.ts) | `GET /partner-subscriptions/me`, `POST /partner-subscriptions`, `DELETE /partner-subscriptions/:id`, `POST /partner-subscriptions/:id/resume` |

#### API — pricing + config ([`settings/`](../api/src/features/settings/))

| File | Role |
|------|------|
| [api/src/features/settings/settings.model.ts](../api/src/features/settings/settings.model.ts) | `organizerSubscriptionPrice` (default 999) + `partnerSubscriptionDays` (default 30) — **the canonical source of the price** |
| [api/src/features/settings/settings.controller.ts](../api/src/features/settings/settings.controller.ts) | `getPartnerSubscriptionPricing()` (server-side import — the subscribe handler reads the price, never a hardcoded constant), `updateSettings` (admin-gated — price + duration are editable via `PATCH /settings`), `publicShape()` (exposes the price publicly so the subscribe screen renders it before committing) |

#### API — joinFee gate (my work, 15 July)

| File | Role |
|------|------|
| [api/src/features/games/games.model.ts:40](../api/src/features/games/games.model.ts#L40) | `Game.joinFee` field (Number, default 0) — the per-head cost to join an Open Play, in pesos. 0 = free. |
| [api/src/features/games/games.controller.ts:356-358](../api/src/features/games/games.controller.ts#L356-L358) | `createGame`: a `joinFee > 0` is **only honoured for a subscribed organizer** (checked via `hasActivePartnerSubscription(user.sub, 'organizer')`). Any other host — or a lapsed/never-subscribed one — creates free Open Play regardless of what the client sent. |
| [api/src/features/games/games.controller.ts:879-884](../api/src/features/games/games.controller.ts#L879-L884) | `updateGame`: same gate. A host whose subscription lapsed can't start charging via edit — their fee is forced to 0. |
| [api/src/features/games/games.controller.ts:249-250](../api/src/features/games/games.controller.ts#L249-L250) | `serialize`: exposes `joinFee` on every game (the app reads it for "Free" / "₱150/head"). |

#### App — the subscribe screen + promo sheet

| File | Role |
|------|------|
| [app/src/features/coaches/CoachSubscribeScreen.tsx](../app/src/features/coaches/CoachSubscribeScreen.tsx) | **One screen sells both plans** (coach + organizer). Parameterised by `plan?: PartnerPlan` — the `organizer` block (line ~61) carries its own copy, benefits list, pitch ("the subscription is the licence to charge"), and post-subscribe tools. The flow (address gate, payment, cancel/resume) is identical. |
| [app/src/features/profile/OrganizerPromoSheet.tsx](../app/src/features/profile/OrganizerPromoSheet.tsx) | A promo bottom-sheet (entry point from Profile) that explains the organizer subscription and links into `CoachSubscribeScreen` with `plan='organizer'`. |
| [app/src/shared/lib/api.ts](../app/src/shared/lib/api.ts) | `PartnerSubscription` / `PartnerSubscriptionState` types, `getMyPartnerSubscriptions()`, `subscribeToPartnerPlan(plan, autoRenew?)`, `cancelPartnerSubscription(id)`, `resumePartnerSubscription(id)`. |
| [app/src/shared/lib/permissions.ts](../app/src/shared/lib/permissions.ts) | `AppUser.organizerSubscriptionActive` (derived on `/me` — **the UI gates on this boolean, not on `roles.includes('organizer')`**, because a venue owner who once approved an organizer-applicant still has the role row, and the boolean correctly reads the live term). |
| [app/src/features/venues/CourtDetailsScreen.tsx:1114-1203](../app/src/features/venues/CourtDetailsScreen.tsx#L1114-L1203) | **"Subscribe first" note on venue detail** — the "Become a coach" / "Become an organiser" cards are **disabled with a red coral note** (`Subscribe as a coach/organizer first to apply here`) when `!coachSubscriptionActive` / `!organizerSubscriptionActive`. Tapping the red note navigates to the subscribe screen. The same gate (the boolean from `/me`, not the role) drives `needsSub`, `disabled`, and the `subNote` copy — one block, shared by both coach and organiser cards. |

### Shared "subscribe first" gate on venue detail (coach + organizer)

Both the **coach** and **organizer** "Become a …" cards on the venue detail screen
share the **same gate architecture** — one boolean per plan from `/me`, one
disabled-lock pattern, one red coral note:

```
needsSub = !coachSubscriptionActive     (for coach)
needsSub = !organizerSubscriptionActive (for organizer)
```

When `needsSub` is true at [CourtDetailsScreen.tsx:1118-1122](../app/src/features/venues/CourtDetailsScreen.tsx#L1118-L1122):

1. **The card is disabled** — `disabled={… || needsSub}`, no `onClick` fires.
2. **A lock icon** replaces the chevron on the card (line 1191).
3. **A red coral "Subscribe first" note** appears below the card (lines 1195-1203):
   - Coach: `"Subscribe as a coach first to apply here"`
   - Organiser: `"Subscribe as an organizer first to apply here"`
   - The entire note is a **tappable `<button>`** that navigates to `coach-subscribe` / `organizer-subscribe`.

This is the **same gate the plan records** — checking the live term boolean
(`coachSubscriptionActive` / `organizerSubscriptionActive`), NOT the role list
(`roles.includes('coach')`). The reason (from the July 10 build) is that a venue
owner approving a coach application grants the `coach` role row regardless of
subscription state, and that row survives a lapsed subscription — so the
role list can be stale. The subscription boolean, derived from the live
`PartnerSubscription` with lazy expiry, is the authoritative signal.

A player who sees the red note and taps through to subscribe lands on
[CoachSubscribeScreen](../app/src/features/coaches/CoachSubscribeScreen.tsx) with
`plan='organizer'` (or `plan='coach'`). After subscribing, returning to the venue
detail re-fetches `/me` and the cards re-render as tappable — now gated only by
the server's `402 SUBSCRIPTION_REQUIRED` fallback (`submitCoachApplication` /
`submitOrganizerApplication`), which is the second guard (a crafted client).

### Lifecycle

1. **Subscribe** — player buys a term (`POST /partner-subscriptions { plan: 'organizer' }`). The handler calls `getPartnerSubscriptionPricing()` (which reads `AppSettings`) for the price — never a hardcoded constant. Requires a complete postal address (`400 ADDRESS_REQUIRED`). An `active` row is stored with `expiresAt = now + partnerSubscriptionDays`; the global `organizer` role is granted.

2. **While active** — the player can charge a join fee (`Game.joinFee > 0`), host tournaments, and access the organizer console. The `/me` response carries `organizerSubscriptionActive: true`.

3. **Cancel** — `DELETE /partner-subscriptions/:id` sets `cancelAtPeriodEnd = true` and disables auto-renew. The role **survives** until `expiresAt` — the player keeps everything through the end of the paid term. No refund.

4. **Expire (lazy)** — on the **next authenticated read** for that user (profile fetch, /me, a `hasActivePartnerSubscription` call), `expireLapsedSubscriptions()` sweeps any `active` row whose `expiresAt` has passed → `expired`, then checks if another live term of the same plan exists; if not, the global role grant is revoked. No cron — the "next read" is the sweep.

5. **Resume** — `POST /partner-subscriptions/:id/resume` clears `cancelAtPeriodEnd` during the still-live term.

### How the join fee works (the licence to charge, in code)

```
Player creates Open Play (app)
  → POST /games { gameType: 'open', joinFee: 150, bookingId, … }

Server (createGame):
  1. Reads the linked booking
  2. Reads body.joinFee → 150
  3. Calls hasActivePartnerSubscription(user.sub, 'organizer')
     - true  → joinFee = 150   (organizer keeps every peso)
     - false → joinFee = 0     (even if the client sent 150 — forced free)
  4. Stores Game { joinFee, … }

App displays:
  joinFee > 0 → "₱150/head" (the organizer's price)
  joinFee = 0 → "Free"
```

The platform's only earning on an organizer's Open Play is **7% on the court
booking** — the exact same rate as any player booking a court. The organizer's
join fee passes through untouched; PickleBallers takes 0% of it.

### /lists — endpoint catalogue

- `GET /partner-subscriptions/me` — current subscriptions + pricing
- `POST /partner-subscriptions` — buy a term (`ADDRESS_REQUIRED` gate)
- `DELETE /partner-subscriptions/:id` — cancel at period end (no refund)
- `POST /partner-subscriptions/:id/resume` — undo a scheduled cancel

### What's still to do

1. **Admin dashboard UI (`web/`)** — the `PATCH /settings` endpoint and the model both accept `organizerSubscriptionPrice` / `partnerSubscriptionDays`, but no admin-facing settings form renders them yet. This is a `web/` task — surface the two fields under the existing Payment Settings page.

2. **Join-fee payment flow** — a player joining a paid Open Play must **pay the join fee at checkout** (demo card → test_card; 0% platform cut). This pairs with the lobby cutover (see [`plan/unfinish-tasks.md`](../plan/unfinish-tasks.md) — "Money flows").

3. **Organizer payout tracking** — a dashboard/report that shows an organizer what they've earned from join fees. No build yet.

### Change history

| Date | Change |
|------|--------|
| 2026-07-10 | `partner-subscriptions/` slice built: model, controller, routes. Coach + organizer plans, lazy expiry, address gate, cancel-at-period-end. `GET /me` returns `coachSubscriptionActive` / `organizerSubscriptionActive`. **Zero subscribers at launch.** |
| 2026-07-14 | Plan decision (agreed with Ivan): the subscription is the **licence to charge**. Organizer keeps 100% of the join fee. PickleBallers' only earning on Open Play is the 7% court-booking cut. |
| 2026-07-15 | Plan decision (this session): **keep** the subscription; make the ₱999 price **admin-configurable** (no hardcode). Added `Game.joinFee` + `createGame`/`updateGame` gate on `hasActivePartnerSubscription(user.sub, 'organizer')` — a non-organizer's join fee is always 0, server-side. |
