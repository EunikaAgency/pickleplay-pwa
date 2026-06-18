# Task Report — Realtime chat (1:1 + game group chat), chat management, profile photo, and a roadmap truth-up

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
