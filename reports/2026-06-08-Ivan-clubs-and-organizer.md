# Ivan Report — 2026-06-08: Clubs & Organizer Toolkit


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
---

- **Author:** Ivan
- **Date:** 2026-06-08
- **Area:** `api/` (backend) + `web/` (organizer console + admin settings); `app/` untouched
- **Status:** ✅ Implemented & verified (api typecheck + web build clean; API restarted; write flows verified end-to-end via API)

---

## 1. Goal

Give the **organizer** role a practical toolkit beyond one-off tournaments —
the everyday work of running games and communicating with players. Five features
were selected from a full ~120-item catalogue (see
`docs/organizer-feature-catalogue.md`); the rest stay as the backlog.

## 2. Scope decisions (from the requester)

- **Frontend:** web organizer console only ("sa web lang muna"). `app/` PWA not touched.
- **5 features chosen:** (1) tournament announcements/messaging, (2) recurring
  open-play sessions, (3) reusable player rosters + invite links,
  (4) attendance + waitlist auto-promotion + join approval, (5) payment tracking
  driven by the admin test-mode setting.
- **Dropped from the 5:** automated reminders (needs a scheduler/cron) — deferred.
- **Permissions:** reused already-granted `organizer.tournaments.manage` and
  `organizer.events.manage` rather than minting new ones (new perms seed
  insert-only and wouldn't reach existing organizer users without a manual admin
  grant). This feature set lit up the previously **dormant** `organizer.events.manage`.

## 3. What already existed (reused, not rebuilt)

- API `content` feature: `Tournament` + `TournamentRegistration`, organizer CRUD,
  open-registration, register/withdraw/participants.
- `OpenPlaySession` model existed but was **read-only** (only `GET /open-play`),
  with no `organizerUserId` — no way to create/manage.
- `Notification` model + endpoints existed but **nothing generated notifications**.
- `AppSettings.paymentTestMode` + `isPaymentTestMode()` + `GET/PATCH /api/v1/settings`
  existed and payments/bookings already branched on it — but the **web admin
  toggle only wrote `localStorage`**, never the API.
- Web organizer console at `/organizer/*` (layout, sidebar, overview, tournaments, venues).

## 4. What was built

### Feature 1 — Tournament announcements & messaging
- **api:** new `TournamentAnnouncement` model (`content.model.ts`); `POST
  /tournaments/:id/announcements` (organizer-only) saves an entry **and** fans
  out a `Notification` to every registered/waitlisted player; `GET
  .../announcements` feed. First generator of notifications in the app.
- **web:** Announcements section in the tournament detail
  (`OrganizerTournament.jsx`) — title + message, kind selector
  (general / schedule / venue) with quick-fill templates, send + history.

### Feature 2 — Recurring open-play sessions
- **api:** added `organizerUserId`/`seriesId` to `OpenPlaySession`; new
  `OpenPlaySeries` (recurring template) and `OpenPlayRegistration` (roster)
  models. Endpoints: `POST /open-play` (create series → stamps out instances over
  a horizon), `GET /open-play/mine`, `PATCH /open-play/series/:id/cancel`,
  `PATCH /open-play/:id/cancel` (+ notify joiners), `POST .../join|leave`,
  `GET .../registrations`. Gated by `organizer.events.manage`.
- **web:** new `OrganizerSessions.jsx` at `/organizer/sessions` — series cards
  with upcoming instances, roster expander, cancel-one / cancel-series, and a
  create-series form (venue, days-of-week chips, time, capacity, price, horizon).
  New "Open play" sidebar item.

### Feature 3 — Reusable player rosters + invite link
- **api:** new `rosters` feature slice (`OrganizerRoster`) — list/create/rename/
  delete + add/remove members (by name/email, optional userId). Gated by
  `organizer.events.manage`. Mounted at `/api/v1/rosters`.
- **web:** new `OrganizerRosters.jsx` at `/organizer/players` (master/detail).
  "Copy invite link" button on tournaments (copies the public event URL).

### Feature 4 — Attendance + waitlist auto-promotion + join approval
- **api:** added `attended` to registrations; `PATCH .../registrations/:regId`
  for both tournaments and sessions → `{ attended }` (check-in) or
  `{ action: approve|decline }`. Withdraw/leave now **auto-promote** the oldest
  waitlisted player and notify them. Invite-only tournaments hold joins as
  `pending` for organizer approval.
- **web:** participant rows + session roster rows became interactive — Present
  check-in toggle, Approve/Decline for pending/waitlisted, Promote on sessions.

### Feature 5 — Payment tracking (admin test-mode driven)
- **api:** added `paid` + `paymentNote` to registrations; the manage endpoints
  accept `{ paid, paymentNote }`; roster outputs include them.
- **web:** the admin Settings test-mode toggle now persists to the API
  (`paymentMode.js` gained `loadMode()` + async `setMode()` →
  `GET/PATCH /api/v1/settings`; `AdminSettingsPage.jsx` loads + saves). Organizer
  ledger: Paid/Owe toggle per confirmed player, "₱X collected · N/M paid"
  summary, and a "Test mode — no real charges" banner driven by the global flag.

## 5. Files touched

**api/** `features/content/{content.model,content.controller,content.routes}.ts`,
new `features/rosters/{rosters.model,rosters.controller,rosters.routes}.ts`,
`routes/index.ts` (mount), `features/root/root.controller.ts` (`/lists`),
`FILEMAP.md`.

**web/** `features/organizer/{OrganizerTournament.jsx, OrganizerSidebar.jsx, api.js}`,
new `features/organizer/{OrganizerSessions.jsx, OrganizerRosters.jsx}`,
`router.jsx`, `features/admin/AdminSettingsPage.jsx`, `shared/paymentMode.js`,
`features/marketing/RoadmapPage.jsx`, `FILEMAP.md`, `DONE.md`, `TASKS.md`.

## 6. Verification

- `api`: `npm run typecheck` clean. PM2 `pickleballer-api` restarted; `/lists`
  shows every new route; `GET /api/v1/settings` and `GET /api/v1/open-play` OK.
- `web`: `npm run build` clean (lint noise is pre-existing `react-refresh` on
  `router.jsx`/`db.js`, not new files).
- **End-to-end as a real organizer** (registered test org account): created a
  roster + added a member; created a series → **5 instances generated**;
  `GET /open-play/mine` returned 1 series + 5 sessions; cancelled one instance;
  created a tournament, sent a venue-change announcement (feed entry created);
  cleaned up (roster delete, series + tournament cancel) — all succeeded.

## 7. Conventions kept

`/lists` catalogue, `api/FILEMAP.md` + `web/FILEMAP.md`, public roadmap
(`RoadmapPage.jsx`, 5 change-log entries + date bump), and `web/DONE.md` /
`web/TASKS.md` all updated in the same change.

## 8. Notes / follow-ons (backlog)

- "Invite link" copies the public event URL; a dedicated public per-event detail
  page is a separate item.
- Roster members are contacts (name/email); bulk auto-register-from-roster and a
  player directory are follow-ons.
- Automated reminders (day-before / hour-before) deferred — needs a scheduler;
  builds on feature 1's notification plumbing.

## 9. Follow-up — full-width dashboards (same day)

Per request, every authenticated **dashboard/console** page was switched to full
content width. The caps were per-page wrappers (`mx-auto max-w-Nxl`), plus a
layout-level cap on the user dashboard.

- Swept page-root caps `mx-auto max-w-Nxl` → `w-full` across all console pages:
  **organizer** (5), **owner** (5), **admin** (14), and the **coach console**
  (CoachOverview, CoachProfilePage, CoachVenue, CoachVenueDetails, CoachApplications).
- **User dashboard (`/my/*`)**: removed the `max-w-7xl` cap on the tab bar and
  `<main>` in `dashboard/UserLayout.jsx` — widens every `/my` page at once.
- **OrganizerTournament** detail: dropped the old `wide`/`max-w-4xl` ternary so the
  detail view is full width like the rest.
- **Left alone (not dashboards):** the public `/coaches` directory and coach
  detail page keep their reading-width caps.
- ~30 files, all in `web/`; `npm run build` clean. Console layouts
  (organizer/owner/admin/coach `<main>`) were already full-width — only the page
  wrappers capped.

## 10. Status

Not yet committed (all work is on `main`); commit/push pending requester
go-ahead. Covers the 5 features + the full-width dashboard sweep.

