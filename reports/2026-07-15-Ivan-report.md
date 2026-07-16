# Daily build report — July 15, 2026

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
[`feed.model.ts`](../api/src/features/feed/feed.model.ts),
[`feed.controller.ts`](../api/src/features/feed/feed.controller.ts),
[`feed.routes.ts`](../api/src/features/feed/feed.routes.ts)

**Frontend — `app/src/features/social/`:**
`FeedPanel.tsx`, `FeedPostCard.tsx`, `FeedComposerSheet.tsx`,
`FeedPostScreen.tsx`, `FeedShareCard.tsx`, `RepostQuote.tsx`, `feedTime.tsx`

Also touched: `shared/lib/api.ts`, `shared/lib/navigation.ts`, `App.tsx`,
`GameDetailsScreen.tsx`, `ClubDetailsScreen.tsx`, `shared/styles/v2.css`.

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
- App lint: 0 errors in feed files

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
- **Tab strip** (coaches only): About · Sessions · Venues — tabs with content only
- **Sticky bottom bar**: two action buttons (Book + Message / Message + Share)

### Screenshots

| Screen | Image |
|---|---|
| Coach Mari | ![](2026-07-15-coach-mari.png) |
| Coach Leander | ![](2026-07-15-coach-leander.png) |
| Coach Leander — Sessions | ![](2026-07-15-coach-leander-sessions.png) |
| Player (Mari Sullivan) | ![](2026-07-15-player-mari.png) |
| Friends → tap → profile | ![](2026-07-15-friends-tap.png) |

### API changes (`coaches.controller.ts`)

- `coachPayload`/`listCoaches` now fall back to the linked user's `avatarUrl` when the coach has no profile photo
- Surfaces `skillLevel`/`skillLevelLabel` from the user account
- Adds `studentCount` (unique players with completed sessions) and `completedSessionCount` from `CoachBooking`

### Files changed

| File | Change |
|---|---|
| `app/src/shared/components/ui/PublicProfileHero.tsx` | **New** — reusable Threads-style header |
| `app/src/shared/styles/v2.css` | ~200 lines: topbar, hero, avatar, grid cards, tabs, body, sticky CTA |
| `app/src/features/coaches/CoachDetailScreen.tsx` | Rewrote render: 2×2 grid, info chips, sticky bar |
| `app/src/features/profile/PlayerProfileScreen.tsx` | Rewrote render: same layout + grid, sticky bar |
| `app/src/features/social/FriendsPanel.tsx` | Rows now tappable → opens `player-profile` |
| `app/src/shared/lib/api.ts` | Skill + student fields on `ApiCoach` |
| `api/src/features/coaches/coaches.controller.ts` | User avatar fallback, skill, student/session counts |

---

## Organizer subscription (₱999) — the licence to charge

**Status:** Live foundation; join-fee gate shipped; admin-dashboard UI pending (`web/` follow-up)
**Built:** July 10 (partner-subscriptions slice); extended July 15 (joinFee gate)

### What it is

A **PAID, PLATFORM-LEVEL** subscription (`PartnerPlan = 'organizer'`) that a
**player** buys — not a venue, not a staff role. One term: ₱999 / 30 days
(admin-configurable). It grants the global `organizer` role; a live subscription
is what lets its holder **charge a join fee** for Open Play.

### Revenue model

> **The subscription is the licence to charge.** PickleBallers takes **7% on
> court bookings and nothing else.** The organizer keeps 100% of the join fee.

Worked example: an organizer books a ₱800 court and charges ₱150/head. 6 joiners.
→ Organizer keeps **₱900**, in full. PickleBallers earns **7% of ₱800 ≈ ₱56**.
Nothing else.

### Where it lives — file index

**API — the subscription itself (`partner-subscriptions/`):**

- [partner-subscriptions.model.ts](../api/src/features/partner-subscriptions/partner-subscriptions.model.ts) — `PartnerSubscription` schema, `PartnerPlan = 'coach' | 'organizer'`, `hasActivePartnerSubscription(userId, plan)`, `activeSubscriberIds(userIds, plan)`, `expireLapsedSubscriptions(userId)` — **lazy expiry** (no cron)
- [partner-subscriptions.controller.ts](../api/src/features/partner-subscriptions/partner-subscriptions.controller.ts) — `getMySubscriptions`, `createSubscription` (purchase; `ADDRESS_REQUIRED` gate), `cancelSubscription` (cancel at period end — role survives until `expiresAt`), `resumeSubscription`
- [partner-subscriptions.routes.ts](../api/src/features/partner-subscriptions/partner-subscriptions.routes.ts) — `GET/POST /partner-subscriptions`, `DELETE /:id`, `POST /:id/resume`

**API — pricing + config (`settings/`):**

- [settings.model.ts](../api/src/features/settings/settings.model.ts) — `organizerSubscriptionPrice` (default 999) + `partnerSubscriptionDays` (default 30) — canonical source of the price; `transactionFeePercent` (default 0, added July 15)
- [settings.controller.ts](../api/src/features/settings/settings.controller.ts) — `getPartnerSubscriptionPricing()` (server-side — the subscribe handler reads this, never a hardcoded constant), `updateSettings` (admin-gated — price + duration editable via `PATCH /settings`), `publicShape()` (exposes price publicly)

**API — joinFee gate (added July 15):**

- [games.model.ts:40](../api/src/features/games/games.model.ts#L40) — `Game.joinFee` (Number, default 0)
- [games.controller.ts:356-358](../api/src/features/games/games.controller.ts#L356-L358) — `createGame`: only a subscribed organizer can set `joinFee > 0`; anyone else → forced 0
- [games.controller.ts:879-884](../api/src/features/games/games.controller.ts#L879-L884) — `updateGame`: same gate on edit

**App — the subscribe screen + promo sheet:**

- [CoachSubscribeScreen.tsx](../app/src/features/coaches/CoachSubscribeScreen.tsx) — **one screen sells both plans** (coach + organizer), parameterised by `plan?: PartnerPlan`. The `organizer` block carries its own copy, benefits, and pitch ("the subscription is the licence to charge"). Flow = address gate → payment → cancel/resume.
- [OrganizerPromoSheet.tsx](../app/src/features/profile/OrganizerPromoSheet.tsx) — promo bottom-sheet (Profile entry point), links into `CoachSubscribeScreen` with `plan:'organizer'`
- [permissions.ts](../app/src/shared/lib/permissions.ts) — `AppUser.organizerSubscriptionActive` (derived on `/me` — **not** `roles.includes('organizer')`, because a venue-owner-approved role row survives a lapsed subscription)

### Shared "subscribe first" red note on venue detail

Both the **coach** and **organiser** "Become a …" cards on the venue detail screen
share **one gate**: `coachSubscriptionActive` / `organizerSubscriptionActive` from `/me`.

At [CourtDetailsScreen.tsx:1114-1203](../app/src/features/venues/CourtDetailsScreen.tsx#L1114-L1203):

1. **Card is disabled** — `disabled={… || needsSub}`, no `onClick`.
2. **Lock icon** replaces the chevron on the card.
3. **Red coral "Subscribe first" note** appears below (tappable, navigates to subscribe):
   - Coach: `"Subscribe as a coach first to apply here"`
   - Organiser: `"Subscribe as an organizer first to apply here"`

The server-side `402 SUBSCRIPTION_REQUIRED` on `POST /coach-applications` /
`POST /venues/:id/organizer-applications` is the second guard (crafted-client).

### Lifecycle

1. **Subscribe** — `POST /partner-subscriptions { plan: 'organizer' }`. Requires a complete postal address (`400 ADDRESS_REQUIRED`). An `active` row is stored with `expiresAt = now + partnerSubscriptionDays`; the global `organizer` role is granted.
2. **While active** — `joinFee > 0` sticks. Host tournaments. Organizer console access.
3. **Cancel** — `DELETE /partner-subscriptions/:id` sets `cancelAtPeriodEnd = true`, disables auto-renew. Role survives until `expiresAt`. No refund.
4. **Expire (lazy)** — on the next authenticated read, `expireLapsedSubscriptions()` sweeps any past-due active row → `expired`, then revokes the global grant (unless another live term exists). No cron.

### /lists endpoints

- `GET /partner-subscriptions/me` — current subscriptions + pricing
- `POST /partner-subscriptions` — buy a term
- `DELETE /partner-subscriptions/:id` — cancel at period end
- `POST /partner-subscriptions/:id/resume` — undo scheduled cancel

### What's still to do

1. **Admin dashboard UI (`web/`)** — surface `organizerSubscriptionPrice` / `partnerSubscriptionDays` / `transactionFeePercent` on the Payment Settings page.
2. **Join-fee payment flow** — a player joining a paid Open Play must pay the join fee at checkout (demo test_card; 0% platform cut). Pairs with the lobby cutover.
3. **Organizer payout tracking** — a dashboard/report of join-fee earnings.
