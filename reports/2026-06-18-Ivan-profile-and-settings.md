# Ivan Report — 2026-06-18: V2 Profile, Settings & Chat


- **Author:** Ivan
- **Date:** 2026-06-18
- **Area:** `api/` (backend search slice) + `app/` (PWA Search screen) + the 3-copy permission catalogue (`web/` perms synced + roadmap)
- **Status:** ✅ Implemented. Search endpoint **verified end-to-end via curl** (authed + unauthenticated). App + web builds and API typecheck all clean. App UI is **compiled-only** (not runtime-clicked — no headless browser in env).

---

## 1. Goal

Close the roadmap gap *"Wire the cross-entity search screen to live results
(courts, games, players, clubs)"*. The app's global **Search** screen still
rendered a hardcoded demo list; only invite-player search was live. Make the
real screen return live results across all four entity types in one place.

## 2. What already existed (reused, not rebuilt)

- **`/api/v1/search`** controller — already searched **venues**, **coaches**,
  and **players** (`?type=players` for people/invite search). This task extended
  it with games + clubs and a full-set mode.
- **`searchPlayers`** client + the people-search shape in the PWA.
- The **Search screen shell** (search bar, recent list, grouped sections,
  loading/error/empty `DemoBranch`) — kept the layout, swapped demo data for live.
- **`startConversation` → chat** flow (from direct messaging) — reused so a
  player result opens a DM.

---

## Task 1 — Backend: games + clubs in search
- Added **`searchGames`** — public, non-cancelled games matched by title or
  free-text venue name; returns a lean card shape with **derived spots-left**.
- Added **`searchClubs`** — public, non-deleted clubs matched by name or
  description; keyed by slug (so the app/web club routes resolve it).
- Added a **`type=all`** mode that returns the full cross-entity set
  (courts/games/players/clubs/coaches) in one request, for the global search screen.
- **Left the legacy no-`type` response untouched** (still venues+coaches) so the
  existing **web SearchPage** is unaffected.
- Updated **`/lists`** with the new `type` values.

## Task 2 — App: live global search screen
- Added **`crossSearch(q)`** to the PWA api client — one `?type=all` call,
  normalized into `{ courts, games, clubs, players }` render-ready hits.
- **Rewrote `SearchScreen`** to use it: **debounced** live search (300 ms) with
  stale-response guarding (monotonic request id), real **loading / error / empty**
  states, and grouped result sections.
- **Recent searches now persist** in `localStorage` (replaced the hardcoded demo
  recents list) — populated when you open a result, with a **Clear** action.
- **Result navigation:** courts → court details, games → game details, clubs →
  club details, and **players → open a direct chat** (`startConversation`).

## Task 3 — Permission
- Added **`player.search.use`** — gates global search.
- **Synced** across **API, web, and app** (`ALL_PERMISSIONS` + player base set);
  added the **catalogue** entry (admin Roles & permissions matrix) + role defaults.
- **Granted on the live DB** to player / coach / owner / organizer / admin
  (moderator excluded by design — it carries no player base perms), then
  **rehydrated the role cache** (API restart) so fresh logins carry it.
- Gated the **"browse-aid" way** (like Nearby): search stays **open to guests**;
  the permission only governs signed-in users.

## Task 4 — Testing & verification
- Verified **`type=all`** returns all five sections; **no-`type`** stays
  venues+coaches (web safe).
- Verified games + clubs come back with correct card shapes.
- Verified **people-search excludes the signed-in user**: authed query for the
  admin's own name → `[]`; the same query **unauthenticated** → self appears.
- Confirmed `player.search.use` **lands on a fresh admin + player login**.
- Confirmed **API typecheck**, **PWA build**, and **web build** all pass.
- **Restarted** the API to pick up the new route + role cache.
- Updated the public **roadmap + changelog** (Core Features row `Partial → Live`,
  Phase 2 prose/badges, Phases 3–4 summary, next-actions, "Last updated").

## Task 5 — Known gaps / not fully tested
- The **app Search UI builds cleanly** but was **not manually clicked through** in
  a browser (no headless browser in env).
- The `/search` route is intentionally **public** (optionalAuth discovery, like
  the venues list) — the `player.search.use` gate is applied **in the app for
  signed-in users**, not as an API hard-gate (a hard-gate would break guest
  browse + the public web SearchPage).
- Player results open a DM only when messaging is available (signed-in +
  `user.messages.send`); otherwise the row is inert (guests).
- One pre-existing repo-wide **lint** baseline still fails across many untouched
  files; the new `api.ts` additions are lint-clean, and the one `SearchScreen`
  effect warning matches the established `ConversationsScreen` debounced-search
  pattern.

---

## How to test locally
- **PWA:** `http://localhost:9000` (PM2 `pickleplay-pwa`) / `pickleballer-pwa.eunika.xyz`.
- **Logins:** any seeded dummy player (e.g. `password123`); new permission takes
  effect on **next login** (baked into the access token).
- **Try:** open Search (home → "Find players", or the search bar) → type a few
  letters → results group into **Courts / Games / Clubs / Players**; tap a court /
  game / club to open it, tap a player to start a chat. Re-open Search to see your
  **recent searches**.
- **API:** `curl "http://localhost:9002/api/v1/search?q=zone&type=all"` — returns
  all sections. `/lists` (`pickleballer-api.eunika.xyz/lists`) documents the
  `type` values.

## Not committed
All changes are uncommitted across the monorepo (`app/`, roadmap, this report) +
the nested `api/` repo, pending review.
---

- **Author:** Ivan
- **Date:** 2026-06-18
- **Area:** `app/` (PWA — new Profile screen + entry points) + the 3-copy permission catalogue (`api/` source of truth, `web/` + `app/` synced) + roadmap
- **Status:** ✅ Implemented. Payments endpoint **verified end-to-end via curl** with a real seeded user token. App + web builds and API typecheck all clean. App UI is **compiled-only** (not runtime-clicked — no headless browser in env).

---

## 1. Goal

A player asks: *"create me a report history with graph of payment for players."*
Give a player a **payment history / spend report** inside the app — a graph of
what they've paid over time plus an itemised receipt list — reachable from the
Profile (both the current design and the v2.1 design they were viewing).

## 2. What already existed (reused, not rebuilt)

- **`GET /api/v1/payments`** (`payments` slice) — already **self-scoped**:
  `listPayments` filters by `userId: user.sub` and returns the caller's own
  payments (newest first, capped 50). **No API change was needed** — the data was
  already there; every checkout (court bookings + the court a game host pays for)
  writes a `Payment` row.
- **`shared/components/ui/Chart.tsx`** — the dependency-free `BarChart` /
  `ChartLegend` primitives built for owner analytics; reused for the spend graph.
- The **web already has** a `/dashboard/payments` page — this brings the **app to
  parity**.
- **`MyBookingsScreen`** patterns (header, loading/error/empty states, money
  formatter) — matched for consistency.

---

## Task 1 — App: payments client
- Added **`ApiPayment`** type + **`listPayments({status?})`** to the PWA api
  client — one `GET /api/v1/payments` call, self-scoped server-side.

## Task 2 — App: the report screen
- New **`features/profile/PaymentHistoryScreen.tsx`**:
  - **KPI cards** — Total spent (+ paid-payment count) and This month (+ pending).
  - **6-month spend bar graph** (`BarChart`) — **paid vs pending** segments, with a
    legend when there's pending spend.
  - **Receipts list** — date, method, amount, and a **Paid / Pending / Refunded**
    status chip; court-booking payments get a calendar icon.
  - Owns its **loading / error / empty** states (empty → "Find a court" CTA).
- **Status handling:** checkout writes `'completed'`; older/seeded rows use
  `'paid'`. **Both count as paid spend** (caught this from the live data — the DB
  had 38 `paid` + 58 `completed` rows; counting only `completed` would have
  under-reported every spend total).
- **Slice hygiene:** money/status/date formatters are **inlined** in the screen —
  the profile slice must not import the bookings slice's `bookingDisplay` (same
  rule `home/` and `ProfileScreenV2` already follow).

## Task 3 — Entry points (both designs)
- **`ProfileScreen.tsx`** (New/Classic) — a "Payment history" row in the Activity menu.
- **`v2/ProfileScreenV2.tsx`** (v2.1) — a "Payment History" item in the Account
  settings list, under "My Bookings".
- Both rows are **permission-gated** (hidden when the user lacks the perm).

## Task 4 — Permission
- Added **`player.payments.view`** — gates the spend report.
- **Synced** across **API, web, and app** (`ALL_PERMISSIONS` + player base set);
  added the **catalogue** entry (admin Roles & permissions matrix) + the **player
  role default**.
- Resolves **client-side** from roles (`resolveRolePermissions`), so existing
  players get it on **next login** — no DB role toggle needed for the app.
- Gated the **screen** via `SCREEN_PERMISSIONS` in `App.tsx` (+ a guest auth
  intent). The pre-existing `GET /payments` route stays `requireAuth` + self-scoped
  (no route-surface change → **no `/lists` edit**).

## Task 5 — Wiring
- Registered `payment-history` in **`navigation.ts`** (Screen union) and
  **`App.tsx`** (`renderScreen` case, `SCREEN_PERMISSIONS`, `SCREEN_AUTH_INTENT`).

## Task 6 — Testing & verification
- **End-to-end:** found the seeded user with the most payments
  (`84a3be4a.hernandez@example.com` — the *Kenneth Hernandez* profile in the
  request screenshot), logged in via curl, hit `GET /api/v1/payments` → **32 rows,
  ₱18,842.50 paid**. The report renders populated for that account.
- Confirmed **API typecheck**, **PWA build**, and **web build** all pass.
- **Restarted** the API to pick up the `permissions.ts` catalogue change.
- Updated the public **roadmap + changelog** + **`app/CLAUDE.md`** change history +
  **`app/FILEMAP.md`** (profile slice + "Where to look first" row).

## Task 7 — Known gaps / not fully tested
- The **app UI builds cleanly** but was **not manually clicked through** in a
  browser (no headless browser in env) — verification is endpoint-level + build.
- The `/payments` route is **self-scoped `requireAuth`** (not a hard permission
  gate) — the `player.payments.view` gate is applied **in the app**, consistent
  with how `listBookings` is treated. A user can only ever read their own rows.
- **No time-range toggle / no booking-vs-game breakdown** yet — fixed 6-month
  window, paid-vs-pending split only. Easy follow-ups if wanted.
- One pre-existing repo-wide **lint** baseline (`react-hooks/set-state-in-effect`)
  fires on the new screen's fetch effect — it **matches the shipped
  `MyBookingsScreen`** pattern exactly; build stays clean.

---

## How to test locally
- **PWA:** `http://localhost:9000` (PM2 `pickleplay-pwa`) / `pickleballer-pwa.eunika.xyz`.
- **Login:** `84a3be4a.hernandez@example.com` / `password123` (the screenshot user,
  most payments) — or any seeded player. The new permission takes effect on **next
  login** (resolved from roles client-side).
- **Try:** Profile → **Payment history** (Activity menu in New/Classic; Account
  list in v2.1) → see Total/This-month KPIs, the 6-month spend bar graph, and the
  receipts list (Paid / Pending / Refunded).
- **API:** `curl http://localhost:9002/api/v1/payments -H "Authorization: Bearer <token>"`
  — returns the caller's own payments.

## Roadmap
Change Log entry added to `web/src/features/marketing/RoadmapPage.jsx` (top of the
list, dated 2026-06-18, tagged `app` + `api`); hero "Last updated" already on
2026-06-18.

## Not committed
All changes are uncommitted across the monorepo (`app/`, roadmap, this report) +
the nested `api/` repo, pending review.
---

- **Author:** Ivan
- **Date:** 2026-06-18
- **Area:** `api/` (backend, shared) + `app/` (PWA) + `web/` (public roadmap only) + the 3-copy permission catalogue
- **Status:** ✅ Implemented. Realtime DM + game chat, deletes, mark-read fix, avatar upload, and the new `player.games.chat` permission **verified end-to-end via curl** (seeded accounts). UI flows compiled clean (`npm run build` green) and smoke-tested in-browser by the reviewer. All changes **uncommitted** pending review.

---

## 1. Goal

Make chat feel truly live and complete the messaging surface that the
2026-06-17 task left at "30s polling + Web Push, no stream." Plus a batch of
UX fixes the reviewer surfaced while testing, and an accuracy pass on the public
roadmap (which had fallen ~1.5 months behind the codebase).

## 2. What already existed (reused, not rebuilt)

- **`shared/lib/notify.ts`** — single choke point for in-app `Notification` + Web Push.
- **`features/clubs/clubs.events.ts`** — the in-process SSE bus pattern (per-club). This task mirrors it per-user.
- 1:1 messaging (`features/messages`), the notification inbox + unread badge, Web Push (VAPID), and `searchPlayers` (people search) — all from the prior task.

---

## Task 1 — Realtime transport (SSE, per user)

- New **`api/src/shared/lib/userEvents.ts`** — in-process per-user event bus (channel `user:${id}`), mirroring `clubs.events.ts`. `publishUserEvent` / `subscribeUser`.
- New endpoint **`GET /api/v1/me/stream`** (in `features/interactions`) — one SSE stream per user; token via `?token=` (EventSource can't set headers), verified inline like `streamClub`. Forwards `notification.created`, `message.created`, `message.deleted`, `game.message.created`.
- App: **`shared/lib/realtimeBus.ts`** (tiny in-app pub/sub) + **`shared/hooks/useRealtimeStream.ts`** (one app-wide `EventSource`, mounted in `App.tsx`, auto-reconnects with a fresh token; the 30s poll stays as a fallback).

## Task 2 — Realtime 1:1 chat + notifications

- `notify.ts` now publishes `notification.created` on every notify → **every** notification type is live (badge + inbox) without per-feature work.
- `messages.controller.sendMessage` publishes `message.created` to the recipient → open chat appends instantly.
- `ChatScreen` subscribes to the realtime bus (append on `message.created`, remove on `message.deleted`); `ConversationsScreen` reloads on new activity.

## Task 3 — Message anyone + Messages in the nav

- `ConversationsScreen` gained a **"New message"** flow: search any player (`searchPlayers`) → `startConversation` → chat. You no longer need a shared game to DM someone.
- Added **"Messages"** to the desktop `Sidebar` (was only under Profile).

## Task 4 — Delete conversation + delete message

- API: `Conversation.hiddenFor[]` (per-user soft delete) + `DELETE /messages/conversations/:id` (hide for me; a new message un-hides for everyone). `DELETE /messages/conversations/:id/messages/:msgId` (sender-only hard delete; recipient gets realtime `message.deleted`; thread preview recomputed).
- `listConversations` / `unreadMessageCount` filter out `hiddenFor: me`; `sendMessage` clears `hiddenFor`.
- App: ✕ per conversation row (confirm), tap-your-own-bubble to delete a message (confirm), both optimistic + realtime.

## Task 5 — In-game group chat (NEW)

- New permission **`player.games.chat`** — synced across `api`/`web`/`app` copies + `PERMISSION_CATALOGUE` + role defaults + `SYSTEM_PERMISSION_BACKFILLS` (player/owner/coach/organizer), so existing users get it on restart + next login.
- API: new **`GameMessage`** model in `games.model.ts`; `GET/POST /api/v1/games/:id/messages` (roster-only read; post gated by `player.games.chat`). POST realtime-fans-out `game.message.created` to other roster members **and** notifies them (badge/push/inbox, collapsed per game).
- App: new **`GameChatScreen`** (group chat — sender name/avatar per message, realtime append). Entry: a prominent **"Group chat"** button on `GameDetailsScreen` for roster members (host or joined).
- Notification deep link: game-chat messages link to **`/games/:id/chat`** → opens the chat directly (not the lobby). Wired in `navigateFromLink` (in-app) and `screenFromPath` (push/URL).

## Task 6 — Profile photo upload + circular crop

- API: `PATCH /me` now accepts `avatarUrl` (added to the update zod schema). `/uploads/*` static serving already existed.
- App: **`AvatarCropper`** (new shared UI) wraps **croppie** (added dep) for a true circular crop. `EditProfileScreen`'s "Change photo" / camera button now pick → crop → `uploadAvatar` (media upload, `ownerType: 'user'`) → `updateProfile({ avatarUrl })`. (Both buttons previously had no handler.)

## Task 7 — Fixes & polish surfaced during testing

- **Mark-all-read bug:** `PATCH /notifications/:id` was registered before `/notifications/mark-all-read`, so the literal route was captured as `:id` → ObjectId cast → 500; unread "came back" on reload. Reordered the literal route first. (Verified 7 → 0.)
- **Reload lost your screen:** the in-memory screen stack now persists to `sessionStorage` (`App.tsx`), so a refresh restores the current screen instead of dropping to Home. Cleared on logout; deep links still win on first load.
- **Chat composer off-screen on desktop:** `ChatScreen` switched from `h-[100dvh]` to `absolute inset-0` (anchors to `.app-main` like `.scroll`), so the input bar is always visible.
- **Chat header** got a clear bottom border + shadow + solid bg so it reads as chrome, not message content; the game-chat header shows the game name (was the doubled "GAME CHAT / Game chat").
- **Bottom nav** is now solid (`var(--surface)`), no more see-through (`rgba(...,0.85)` + blur removed).
- **Design switcher** (New/Classic/v2.1) is now a collapsible handle (persists open/closed) so it stops blocking content.
- **Phantom red dot** on the Classic home bell: it was a hardcoded `<span>`; replaced with the real `NotificationBadge` (renders only when unread > 0).

## Task 8 — Roadmap accuracy pass (web)

- Audited `app/` and `web/` against the public roadmap; it badly understated reality. Updated `web/.../RoadmapPage.jsx`: status cards (PWA "Live — mostly", website "Live" not "Scaffolded"), Core Features statuses (demo → Live/realtime), screen inventory, phase timeline (Phase 2 → done; 3–4 → in progress), Next Actions, and prepended dated changelog entries for everything above.

---

## Permissions & route updates

- New `player.games.chat` (3 synced copies + catalogue + role defaults + backfills).
- `/lists` updated: `/me/stream`, `DELETE` on conversations + per-message, `GET/POST /games/:id/messages`, and the `DELETE` on the single-notification + mark-all routes were reordered.

## Testing & verification (curl, seeded accounts)

- SSE delivers `message.created` + `notification.created` to the recipient in realtime; cleaned up after.
- Game chat: host posts → roster member reads (`GET`) + receives realtime `game.message.created`; `player.games.chat` present in the token after restart+login.
- Delete message (sender-only) and delete conversation (per-user hide) both work; list reflects it.
- `mark-all-read` now persists (7 → 0).
- `PATCH /me { avatarUrl }` persists; game-chat notif `linkUrl` is `/games/:id/chat`.
- `npm run build` (app) is green (tsc + vite). Web roadmap builds clean.

## Known gaps / not done

- **In-game chat notifications create one inbox row per message** (collapsed for push via tag, but inbox can accumulate on a chatty game) — tune later (e.g. one row per burst).
- **Group chat is game-roster only**; no leave-chat / mute.
- **A single game join still doesn't notify the host** (only a lobby-fill does) — unchanged by design; revisit if desired.
- **v2.1 redesign** only covers the player tab screens; "apply the UI switcher to all screens" needs v2 versions of details/chat/owner/organizer (not built).
- Realtime is still **single-process in-memory** (per the userEvents/clubs note) — swap to Redis pub/sub if the API is ever clustered.

## How to test locally

- **PWA:** `http://localhost:9000`. Two accounts in separate browser sessions (localStorage is per-profile). Seeded players use `password123`; **re-login** to pick up `player.games.chat`.
- DM: Profile/Sidebar → Messages → ✏️ New message → search → chat. Or a game's "Message organizer".
- Game chat: both join a game → open it → "Group chat" → type (realtime). Notif from a closed chat deep-links into the chat.
- Photo: Profile → Edit profile → Change photo → crop → save.

## Not committed

All changes are uncommitted across the monorepo (`app/`, `web/` roadmap) and the
nested `api/` repo, pending review. (The `api/` repo is gitignored from the
parent — commit it from `/var/public/pickleplay/api/`.)
---

- **Author:** Ivan
- **Date:** 2026-06-18
- **Area:** `app/` (PWA, v2.1 player redesign) + `api/` (user model + `/me`) + `web/` roadmap (sanctioned cross-frontend doc edit)
- **Status:** ✅ Implemented & build-clean (`app` + `api` typecheck + `web`). Backend round-trip verified via curl against the live local API. Not browser-clicked (no headless browser in env) — see "How to test".

---

## 1. Goal

Close the known gap from [2026-06-18-Ivan-v2-settings-shell-logout.md](2026-06-18-Ivan-v2-settings-shell-logout.md):
the v2.1 Settings screen was a **shell + logout** — only theme persisted (client-side
localStorage), real preferences had nowhere to be stored. Make the feature **Full** by
giving the user model a `preferences` blob and wiring real, saved toggles.

This was prompted by the roadmap line reading *"Partial — theme persists; prefs do not yet"*.

## 2. The gap (before)

`PATCH /me` (`updateProfileSchema`) only accepted identity fields
(`displayName/firstName/lastName/bio/skillLevel/…/hasOnboarded`). There was no
`preferences` field on the user model and no endpoint to read/write one, so any
non-theme setting could not survive a reload, let alone sync across devices.

## 3. What changed

### API (`api/`)
- **`features/auth/auth.model.ts`** — new embedded `userPreferencesSchema` + `IUserPreferences`:
  - `notifications: { gameReminders, chatMessages, announcements }` (booleans, default `true`)
  - `units: 'km' | 'mi'` (default `'km'`)
  - added `preferences` to the `userSchema` with `default: () => ({})`.
- **`features/auth/auth.controller.ts`**:
  - `authUserPayload()` now returns `preferences`, **defaults filled in** (so the client
    always gets a complete object even for users seeded before this change).
  - `updateProfileSchema` accepts an optional partial `preferences` object.
  - `updateMe()` flattens `preferences` to **dot-paths** (`preferences.notifications.<k>`,
    `preferences.units`) before `findByIdAndUpdate`, so a partial update **merges** into the
    existing sub-document instead of replacing it — toggling one setting never wipes siblings.

### App (`app/`)
- **`shared/lib/permissions.ts`** — new exported `UserPreferences` type + `DEFAULT_PREFERENCES`,
  placed next to `AppUser` (which now carries `preferences`). Living here avoids a circular
  import: `api.ts` already imports from `permissions.ts`, so `permissions.ts` must not import
  back from `api.ts`.
- **`shared/lib/api.ts`** — `ApiUser` + `ProfileUpdate` gained `preferences`; `toAppUser()`
  maps it through, falling back to `DEFAULT_PREFERENCES`.
- **`features/profile/v2/SettingsScreenV2.tsx`** — added two persisted sections:
  - **"Notify me about"** — 3 toggles (game reminders / chat messages / announcements).
  - **"Distance units"** — km / mi segmented control.
  - Reads the current user from `authStore`; keeps a local mirror so toggles feel instant;
    persists via `authStore.updateProfile()` → `PATCH /me { preferences }`, sending only the
    changed slice. **Optimistic with rollback**: on failure it reverts the mirror and shows an
    inline error. Theme stays client-side (`useTheme` → localStorage) as before.

### Web (`web/`) — roadmap only (the one sanctioned cross-frontend edit)
- `RoadmapPage.jsx` — Core Features status flipped from *"Partial — theme persists; prefs do
  not yet"* → *"Live API — theme + notification & units prefs persist"*; hero "Last updated"
  refreshed; new Change Log entry.

### Permissions
- **No new permission.** `settings` is already gated by `player.profile.manage`; `PATCH /me`
  stays `requireAuth` + self-scoped. This task only adds saved fields to an already-gated
  surface.

### /lists & FILEMAP
- **No `/lists` edit** — `PATCH /me`'s route surface (path/method/auth) is unchanged; only
  request-body fields were added.
- **No FILEMAP edits** — no files added/moved/renamed and no responsibility shifts at the
  map level (`SettingsScreenV2` + the `auth` feature were already mapped).

## 4. Verification

- `api/`: `npm run typecheck` clean.
- `app/`: `npm run build` clean; `eslint` clean on the three changed files.
- `web/`: `npm run build` clean; `pickleballer-web` restarted to publish the roadmap.
- **Backend round-trip (curl, live local API @ :9002)** with a seeded `@example.com` player:
  1. Initial `/me` → defaults (`all true`, `km`).
  2. `PATCH { units:'mi', notifications:{ chatMessages:false } }` → merged; other notifications
     stayed `true`.
  3. Re-fetch `/me` → persisted.
  4. `PATCH { notifications:{ gameReminders:false } }` → `chatMessages:false` + `units:'mi'`
     **survived** (dot-path merge confirmed).
  - Test user's `preferences` then reset (`$unset`) to leave no residue.

### How to test (manual / browser QA — not yet done here)
1. Switch to the v2.1 design (design toggle), log in, open Profile → gear → Settings.
2. Toggle a notification + flip units; reload → values stick. Log in on another device/browser
   → same values (server-synced).
3. Kill the API and toggle → the switch reverts and the inline error shows.
4. Log Out → guest v2 home.

## 5. Not committed
Changes are uncommitted (`app/` + `api/` + the `web/` roadmap), consistent with the rest of
the v2.1 integration ("browser QA, then commit"). `api/` and `web/` commit to their own
remotes; the `app/` change + roadmap go to the monorepo.

## 6. Remaining (optional, out of scope)
- Push **theme** up into `preferences` too, so appearance also syncs across devices (today it's
  localStorage-only). Left out to avoid coupling with `useTheme`'s on-mount localStorage read.
- Surface `units` at the actual distance-display call sites (Nearby/venue distances) so the
  preference visibly changes formatting, not just persists.
---

- **Author:** Ivan
- **Date:** 2026-06-18
- **Area:** `app/` (PWA, v2.1 player redesign) + `web/` roadmap (sanctioned cross-frontend doc edit)
- **Status:** ✅ Implemented & build-clean (`app` + `web`). Reasoned through CSS specificity; not browser-clicked (no headless browser in env) — see "How to test".

---

## 1. Goal

User report: *"appearance light, dark, system not works on all screens."* The Appearance
control (Light / Dark / System) only re-themed the **v1** screens; on the **v2.1** design —
the one the user was looking at — the toggle did nothing. Make dark/light/system apply to the
**whole** v2.1 design, with a dark-navy palette, while keeping the preference **per-device and
private** to each user.

User follow-up clarified the requirement: *"per user, not apply to all users"* — i.e. one
person choosing Dark must not change anyone else's view. (Already true — see §3 "Per-user".)

## 2. The gap (before)

- `useTheme` (`shared/hooks/useTheme.ts`) correctly maps the choice to `data-theme` on
  `<html>`, persisted in **per-browser localStorage** (`pickleballers:theme`).
- **v1** tokens in `shared/styles/index.css` have `[data-theme="dark"]` + a
  `prefers-color-scheme` block → v1 themed fine.
- **v2.1** lives in `shared/styles/v2.css` and was authored **light-only**: each
  `.pb-v2.v2-<screen>` scope (home / nearby / games / clubs / profile / creategame /
  createclub) redefines the same neutral tokens, and **none** keyed off `data-theme`. So all
  v2 screens ignored the toggle. `v2.css` had **zero** `data-theme` / `prefers-color-scheme`.
- Blocker: v2's `--ink` is **overloaded** — used as **both** primary text **and** the dark
  text sitting on bright lime buttons (~58 uses across 7 screens). A naïve flip to light would
  put unreadable light text on every lime CTA.

## 3. What changed

### App — `shared/styles/v2.css`
- **Two stable, mode-independent tokens** added to the base `.pb-v2 {}`:
  - `--on-accent: #1A2138` — text/icons that sit **on** bright lime/blue fills (stays dark in
    both modes).
  - `--ink-fill: #1A2138` — a dark surface used **as a fill** that carries light text (stays
    dark; flips to `#26314F` in dark for contrast).
- **Converted the two true dark-fill sites** to `--ink-fill` so they don't flip light:
  `.v2-home .chip.active` (background) and the `.v2-creategame .pro-banner` gradient.
- **Appended a dark block** at the end of the file for both:
  - `[data-theme="dark"] .pb-v2 { … }` (explicit Dark), and
  - `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .pb-v2 { … } }`
    (System — and *not* when the user explicitly picked Light).
  - Palette is **dark-navy**, matching v1's `index.css` dark (`--bg-page:#0E1014`,
    `--surface:#1A1D24`, `--ink/--navy/--text-primary` → light `#F3F5F9`, muted greys,
    translucent hairlines, deeper shadows). `--lime`/`--blue` accents stay vivid.
  - **Specificity:** `[data-theme="dark"] .pb-v2` (0,2,0) ties the per-screen
    `.pb-v2.v2-<screen>` token blocks and, being appended last, wins the tie; the system
    selector (0,3,0+) out-ranks them outright.
- **Forced `--on-accent` onto lime surfaces in the dark block** (a selector list:
  `.v2c-join`, `.v2c-fab`, `.join-pill`, `.badge-pill`, `.btn-lime`, `.fab`, `.qa-lime`,
  `.hero-mascot`, `.feat-badge.featured`, `.annotation`, `.seg-btn.active`, `.featured-label`,
  `.join-btn`, `.create-icon-circle`, `.club-icon.lime`, `.profile-avatar`, `.level-badge`,
  `.submit-btn`, `.pro-icon`, `.pro-toggle.on`, `.btn-next`, `.skill-pill.active`) — these
  either inherited the now-light `--ink` or hard-set `color:var(--ink)/var(--navy)`.

### App — inline JSX styles (inline beats the CSS override, so edited directly)
- `features/profile/v2/SettingsScreenV2.tsx` — theme/units segmented pill: active pill text
  `var(--ink)` → `active ? var(--on-accent) : var(--ink)`.
- `features/profile/v2/ProfileScreenV2.tsx` — avatar initials, the Hosted match-role chip, and
  the Appearance pill: lime cases switched to `--on-accent`.
- `features/home/v2/HomeScreenV2.tsx` — `.hero-mascot` initials/emoji on lime → `--on-accent`.

### Web (`web/`) — roadmap only (the one sanctioned cross-frontend edit)
- `RoadmapPage.jsx` — new Change Log entry (newest-first) describing app-wide dark mode and
  its per-device/private nature. Hero "Last updated" already today.

### Per-user (privacy) — already correct, confirmed
- Theme is **localStorage per browser** and only sets `data-theme` on that device's document.
  Every new rule is gated behind `[data-theme="dark"]` / the system media query, both driven
  by the local user's own preference. **No server/global state** — picking Dark changes only
  the picker's view. No change was needed to satisfy the "per user, not all users" requirement.

### Permissions
- **No new permission.** Appearance is a pre-existing control on the Settings/Profile surface,
  already gated by `player.profile.manage`. This is a bug fix/extension, not a new gated
  screen or action.

### /lists & FILEMAP
- **No `/lists` edit** — no API route touched (pure client styling).
- **No FILEMAP edits** — no files added/moved/renamed; `v2.css`'s responsibility (the v2
  stylesheet) is unchanged — it just gained dark variants.

## 4. Verification

- `app/`: `npm run build` clean (tsc + vite).
- `web/`: `npm run build` clean (roadmap edit).
- No v2 surface uses `createPortal`, so every v2 element renders inside `.pb-v2` and inherits
  the dark tokens (no escaped modals/sheets).

### How to test (manual / browser QA — not yet done here)
1. Switch to the v2.1 design (design toggle), open Profile → Settings → Appearance.
2. Tap **Dark** → the whole app (home, nearby, games, clubs, profile, create flows, tab bar,
   FAB) goes dark-navy; lime/blue CTAs keep **dark** text and stay legible. Tap **Light** →
   back to light. Tap **System** → follows the phone's OS setting; flip the OS theme to confirm
   it tracks live.
3. Reload → the choice persists (localStorage). Open in a **different** browser/incognito → it
   has its **own** independent theme (proves per-device, not global).
4. Spot-check on-lime text everywhere: join buttons, FABs, submit buttons, the active theme
   pill, profile avatar initials, the Hosted chip, segmented controls — all dark-on-lime.

## 5. Not committed
Changes are uncommitted (`app/` + the `web/` roadmap), consistent with the rest of the v2.1
integration ("browser QA, then commit"). The `app/` change + roadmap go to the monorepo; the
`web/` roadmap also commits to its own remote per repo conventions.

## 6. Remaining (optional, out of scope)
- Push **theme** into the account `preferences` blob so appearance also syncs across devices
  (today it's localStorage-only) — same follow-up noted in
  [2026-06-18-Ivan-settings-preferences-persistence.md](2026-06-18-Ivan-settings-preferences-persistence.md).
- A couple of v1 `@theme` Tailwind tokens (`--color-surface`/`--color-ink`, used by a handful
  of utility classes) still lack dark overrides; low impact (barely used) and outside this v2
  task, but worth a sweep if v1 dark mode is ever audited.
---

- **Author:** Ivan
- **Date:** 2026-06-18
- **Area:** `app/` (PWA, v2.1 player redesign) + `web/` roadmap (sanctioned cross-frontend doc edit)
- **Status:** ✅ Implemented & build-clean (`app` + `web`). Not runtime-clicked (no headless browser in env) — see "How to test" below.

---

## 1. Goal

Give the in-progress **v2.1** player redesign its own Settings screen so the
profile gear no longer drops into the old v1-styled `SettingsScreen` (v1 chrome,
no v2 top nav). Deliver the **settings shell** + a working **logout path**.

## 2. The gap (before)

In v2.1, `ProfileScreenV2`'s gear navigated to the `settings` screen, but
`App.tsx`'s `settings` case always rendered the **v1** `SettingsScreen`. Result:
a jarring v1 surface (`.scroll`, `ScreenHeader`, Material `Icon`) inside the
otherwise-v2 redesign, with no v2 universal header/back.

## 3. What changed

### App (`app/`)
- **New** `features/profile/v2/SettingsScreenV2.tsx` — a `V2Shell`-wrapped settings
  screen. Reuses the **`v2-profile` style scope**: the mockup kept its settings
  list inside `Profile.html`, so the `.settings-*` / `.content-section` /
  `.section-title` classes already live under `.pb-v2.v2-profile` in `v2.css` — no
  CSS duplication.
  - **Appearance**: light / dark / system theme picker via the existing `useTheme`.
  - **Account**: Edit Profile → `edit-profile`; Notifications → `notifications`
    (with a live unread `badge-pill` from `notificationStore`).
  - **Log Out** (destructive row) → `onLogout` = App's `handleLogout` (clears the
    session + tokens, drops to guest home, wipes saved nav).
- **`App.tsx`** — `settings` case now branches on `playerV2`: `SettingsScreenV2`
  for v2.1, the v1 `SettingsScreen` for New/Classic.
- **`FILEMAP.md`** — v2 screen listings now include Settings.

### Web (`web/`) — roadmap only (the one sanctioned cross-frontend edit)
- `RoadmapPage.jsx` — hero "Last updated" refreshed + a Change Log entry noting
  the v2.1 Settings screen (flagged as a preview behind the design toggle).

### Permissions
- **No new permission.** `settings` is already gated by `player.profile.manage`
  (`SCREEN_PERMISSIONS` + `SCREEN_AUTH_INTENT`), so guests tapping the gear hit the
  auth prompt. This task only re-skins an already-gated screen; logout isn't gated.

## 4. Known gap — why the feature is "Partial" (theme persists; prefs do not)

The screen is intentionally a **shell + logout**. The only setting that persists
is **theme**, and only because `useTheme` writes to `localStorage`
(`pickleballers:theme`) — purely client-side, no backend, so it survives reloads
**but does not sync across devices**.

Real **preferences don't persist** because there's nowhere to store them:
`PATCH /me` (`ProfileUpdate` in `api.ts`) only accepts identity fields
(`displayName/firstName/lastName/bio/skillLevel/skillLevelLabel/hasOnboarded`).
There is no `preferences` field on the user model and no endpoint to read/write
one.

**To make it "Full" (separate, backend task):**
1. `api/` — add a `preferences` blob to the user model (`{ notifications, privacy,
   units, … }`), expose on `/me`, accept in `PATCH /me`; update `/lists` if the
   route surface changes.
2. `app/` — add real toggles to `SettingsScreenV2` wired to
   `authStore.updateProfile()`; optionally push `theme` up so it syncs across
   devices.
3. Gate with the existing `player.profile.manage`.

## 5. Verification
- `npm run build` clean in **both** `app/` and `web/`.
- `eslint` clean on `SettingsScreenV2.tsx` + `App.tsx`.
- **Not** runtime-clicked (no headless browser here). Manual QA to confirm:
  gear → Settings renders in v2 chrome; back arrow returns to Profile;
  theme toggle applies + survives reload; Log Out → guest v2 home.

## 6. Not committed
Changes are uncommitted (`app/` + the `web/` roadmap), consistent with the rest
of the v2.1 integration ("browser QA, then commit").

