# Task Report — Clubs (Discord-style communities + realtime Facebook-style feed)

- **Author:** Ivan
- **Date:** 2026-06-08
- **Area:** `api/` (backend, shared) + `web/` (website) + the 3-copy permission catalogue (`app/` perms synced only)
- **Status:** ✅ Implemented & verified — api typecheck clean, web build + lint clean, API restarted; full flow (CRUD, membership, private request→approve, likes, **live SSE feed**, notifications, media upload) verified end-to-end via curl. Browser click-through pending (no headless browser in env).

---

## 1. Goal

Give every user **Clubs**: a browseable directory of joinable communities where
anyone can create their own club (cover photo, name, description, optional join
limit, public/private). A club's detail page is a **Facebook-style newsfeed that
is also chat-like and realtime** — any member can post (text + images + emoji),
**like / comment**, and the twist: **a reply is itself a full post** (it can
carry media, be liked, and be replied to). Posting/commenting is **realtime**,
and **all club members are notified** of activity (posts, replies, likes, joins).

## 2. Scope decisions (from the requester)

- **Frontend: web only** ("sa web lang muna"). `app/` PWA not touched except the
  sanctioned permission-catalogue sync.
- **Realtime transport: "do what's best"** → **SSE** (Server-Sent Events, Hono
  `streamSSE`, in-process event bus). No new dependencies; durable notifications
  fan out alongside.
- **Feed model:** one **recursive `ClubPost`** entity (a reply = a full post),
  text + images + emoji + GIF (via image upload), like / comment. Share, GIF-by-URL,
  and threading deeper than one level were **deferred** (schema fields kept).
- **Notifications:** all activity incl. joins, surfaced by a new header bell.
- **"My Groups" = joined clubs**; the legacy `groups.json` / `CommunityPage` were
  retired (`/community` → redirects to `/clubs`).
- **All roles** can browse/create/join; later requested: a **Clubs tab in the
  dashboards** → mounted inside the player/coach dashboard (`/dashboard/clubs`).

## 3. What already existed (reused, not rebuilt)

- **API patterns:** the `games` feature slice (controller/routes/model), the
  `venues` cursor-pagination shape, the `content` tournament-announcement
  `Notification.insertMany` fan-out, the `media` upload endpoint, and the
  `interactions` `Notification` model + list/mark-read endpoints.
- **Web patterns:** the organizer/owner API-wired feature pattern (`api.js`
  wrapping `shared/api/client.js`), `PhotosEditor` multipart upload, the shared
  form primitives, `RequirePermission`, and the dummy `clubs/` slice (rebuilt).
- **Permissions:** `player.clubs.create` + `player.clubs.manage` already existed
  (unused) — extended, not reinvented.

## 4. What was built

### API — new `api/src/features/clubs/` slice (mounted `/api/v1/clubs`, on `/lists`)

- **5 Mongoose models** (`clubs.model.ts`): `Club`, `ClubMembership`,
  `ClubPost` (recursive via `parentPostId`/`rootPostId`), `ClubPostReaction`,
  `ClubJoinRequest` — separate collections with the indexes the feed/membership
  queries need.
- **REST surface** (`clubs.controller.ts` + `clubs.routes.ts`): list (cursor +
  `?search` + `?mine`), create (+cover), get (private→404 leak-proof), patch/
  delete (host, hard cascade), members, join/leave, private request +
  approve/deny + queue, remove member, feed (cursor), post + replies (cursor),
  create/edit/soft-delete post, like/unlike toggle.
- **SSE realtime** (`clubs.events.ts` in-process `EventEmitter` bus +
  `GET /:id/stream`): emits `post.created/updated/deleted`, `reaction.changed`,
  `member.joined`. Auth via **`?token=` query param** (native `EventSource`
  can't send headers; the route verifies the JWT inline, no `requireAuth`).
  Heartbeat, listener cleanup on abort, `X-Accel-Buffering:no`, and **excluded
  from `compress()`** so the stream flushes. (Redis pub/sub is the documented
  multi-instance upgrade.)
- **Notification fan-out:** post → all other members (capped at 500), reply →
  parent author, like → post author, join/approve → host/requester; self-skipped.

### API — shared edits

- `routes/index.ts` mount; `root.controller.ts` new **Clubs** `/lists` group;
  `media.controller.ts` `ownerType` += `'club'`.
- **`index.ts` latent-bug fix:** the global 1 MB body-guard was 413-ing **all**
  `/api/v1/media/upload` requests over 1 MB (also broke venue photos) — now
  exempts that path (the 10 MB cap still applies inside the media handler).
- `shared/lib/cursor.ts` (new): **compound `createdAt|_id` keyset cursor** —
  the single-key `listVenues` cursor is unsafe for a `createdAt`-DESC feed
  (skips/dupes on tied timestamps).

### Web — `web/src/features/clubs/`

- `api.js` (new): full wrapper matching the frozen contract; raw-fetch uploads;
  `EventSource` stream; notifications passthrough.
- Rebuilt `ClubsPage` (live, search, infinite scroll, gated Create),
  `CreateClubPage` (shared form primitives + two-phase cover upload), and a
  realtime `ClubDetailPage` (header, join/request/pending, members, host
  moderation, feed). New `PostCard` (recursive, one level deep + flat below),
  `FeedComposer` (text+image+emoji), `useClubStream` (SSE + reconnect + de-dupe +
  absolute reaction counts).
- New shared primitives: `Avatar`, `PhotoUpload`, `EmojiPicker`,
  `useInfiniteScroll`, `lib/relativeTime`, and a header **`NotificationsBell`**
  (polls 60 s, paused on tab-hidden).

### Web — navigation / placement

- **Clubs is a top-level Header tab** (was buried in the Community mega-menu).
- **Console sidebars** (owner/organizer/coach/admin) each got a Clubs link.
- **Clubs mounted inside the player/coach dashboard** (`/dashboard/clubs`,
  `/dashboard/clubs/:slug`, `/dashboard/clubs/create`) — the clubs pages are now
  **base-path aware** (a `basePath` prop) so they render correctly both publicly
  (`/clubs`) and in-dashboard. New dashboard tabs: **Clubs** (browse) +
  **My Clubs** (joined). *Note:* `/dashboard` is players/coaches only (owners→
  /owner, admins→/admin, organizers→denied), so owner/organizer/admin consoles
  link to the public `/clubs` shell; embedding a Clubs page inside each console
  is a possible follow-up.
- `MyGroupsPage` now lists joined/created clubs; `/community` → `/clubs`;
  `CommunityPage` + `groups.json` + dead accessors removed.

### Permissions (synced across api / web / app)

Added `player.clubs.join`, `player.clubs.post`, `player.clubs.react`,
`player.clubs.moderate`; join/post/react put in `PLAYER_BASE_PERMISSIONS` so
player/coach/owner/organizer inherit them; **moderator** also granted the base
club perms (admin already has all via `ALL_PERMISSIONS`). `SYSTEM_PERMISSION_BACKFILLS`
updated for all relevant role keys so already-seeded roles get them on restart.

## 5. Verification

- **API (curl):** create public+private clubs; public join + atomic **join-limit
  `409 FULL`** under the cap; private **request → host approve → membership**;
  private club is **404 to non-members**; **idempotent like** (1→1 on double-tap);
  notification fan-out (`club_member_joined` / `club_join_request` / `club_like`);
  **live SSE** — opened a stream as member B and observed `post.created` +
  `reaction.changed` the instant member A posted/liked; >1 MB media upload now
  `201` (control: >1 MB JSON still `413`); `/lists` shows every clubs route.
- **Web:** `npm run build` + `npm run lint` clean (only the pre-existing
  `react-refresh` noise in `router.jsx`). Live domain serves the new bundle.
- Seeded 3 public demo clubs (Manila Dinkers, Sunset Picklers, Beginner
  Bootcamp) + 1 private, with posts/members, so the directory shows content.

## 6. Deferred / known gaps

- **Share/repost**, **GIF-by-URL**, **reply depth > 1**, **SSE polling fallback**,
  **per-club mute**, **multi-emoji reactions**, **host-transfer** — schema is
  future-proofed (e.g. `sharedPostId`, reaction `type` enum) but UI/endpoints not
  built in V1.
- **Clubs inside owner/organizer/admin consoles:** they currently link to the
  public `/clubs` (those consoles gate out the player dashboard). Embedding a
  Clubs page per console is a follow-up if desired.
- **SSE bus is single-instance** (correct for one PM2 process; Redis pub/sub is
  the documented scale-out path).
- **`app/` build is currently red** due to unrelated in-progress edits in
  `HomeScreenRefined.tsx` (not part of this task; only the app permission sync
  was touched here, which compiles).

## 7. How to test locally

API runs on `:9002` (PM2 `pickleballer-api`). For the web to hit the **local**
API, run it with `VITE_API_URL=http://localhost:9002 npm run dev` (the prod build
points at `pickleballer-api.eunika.xyz`, which proxies to the same process).
Log in (seeded admin `info@eunika.agency` / `justinianthegreat!`, or any dummy
player / `password123`). New club permissions take effect on **next login**
(baked into the 15-min access token).

## 8. Not committed

All changes are uncommitted across the web monorepo + the nested `api/` repo,
pending review.
