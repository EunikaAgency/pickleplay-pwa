# Task Report — Realtime notifications & messaging (invites, live badge, tournament alerts, direct chat)

- **Author:** Ivan
- **Date:** 2026-06-17
- **Area:** `api/` (backend, shared) + `app/` (PWA) + the 3-copy permission catalogue (`web/` perms synced + roadmap)
- **Status:** ✅ Implemented. Backend invites + messaging + unread-badge **verified end-to-end via curl** (two seeded accounts). Tournament notifications + the app UI are **compiled-only** (not runtime-clicked — no headless browser in env).

---

## 1. Goal

Make the product feel connected and live — everything around realtime
notifications, people messaging, and organizer/match/tournament updates. Built in
four feature tracks (+ permissions, testing, and known gaps below).

## 2. What already existed (reused, not rebuilt)

- **`shared/lib/notify.ts`** — one call records an in-app `Notification` *and*
  fires a best-effort Web Push. Every new notification here goes through it, so
  each one reaches the inbox + push automatically.
- **Web Push** (VAPID), the **notification inbox** (`/notifications`), the
  **`/search`** controller, the **`games`** notification helpers, and
  **Tournaments + brackets** — all already shipped; this task extended them.

---

## Task 1 — Real game invites
- Added real **player search** for inviting players to a game (`/search?type=players`).
- **Removed** the old demo / "Suggested players" list.
- Added **actual invite sending** from the host to selected players (`POST /games/:id/invite`; records `invitedUserIds` on the game).
- Added a **notification** to each invited player.
- Added an **invite permission** (`player.games.invite`) so only allowed users can invite.

## Task 2 — Live notification badge
- Added an **unread notification count API** (`GET /notifications/unread-count`).
- Added a **live unread badge** in the PWA (`NotificationBadge` + `notificationStore`).
- Badge shown on the **home notification bell**.
- Badge shown on the **"You" tab**.
- **Auto-refresh every 30 seconds** and **when the app becomes active again** (focus / tab visibility) — `useNotificationPolling`.
- Badge **updates instantly** when notifications are marked as read.

## Task 3 — Tournament & match alerts
- Notification when a **tournament is cancelled** (to all registrants).
- Notification when a **registration is approved**.
- Notification when a **registration is declined**.
- Notification when a **tournament bracket is generated** (to all entrants).
- Notification when a **match result is posted** (to both sides).
- **Champion notification** (🏆) for the final winner.

## Task 4 — Direct messaging
- Added a **1-on-1 conversation system** (new `messages` API feature: `Conversation` + `Message`).
- Added **message sending** and **message-thread viewing**.
- Added an **unread message count** (`GET /messages/unread-count`).
- Added a **conversation list screen** in the app (`ConversationsScreen`).
- Added a **chat screen** in the app (`ChatScreen`).
- Connected the **"Message organizer"** button to open a real chat.
- Added a **"Messages"** entry under the user profile area.
- Added a **notification** when someone receives a new message.
- Added a **deep link** (`/messages/:id`) so message notifications open the correct chat.

## Task 5 — Permissions & route updates
- Added a new permission for **inviting players** (`player.games.invite`).
- Added a new permission for **sending messages** (`user.messages.send`).
- **Synced** the new permissions across **API, web, and app**.
- Updated **seeded roles** (`SYSTEM_PERMISSION_BACKFILLS`) so existing users receive the new permissions on restart.
- Updated **`/lists`** to include the new invite, unread-count, and messaging routes.

## Task 6 — Testing & verification
- Tested the **game-invite flow** using two seeded accounts.
- Confirmed the **invited user received the correct notification** (with deep link).
- Tested the **unread notification count**.
- Confirmed unread count **requires login** (401 without a token).
- Tested **direct messaging** using two seeded accounts.
- Confirmed **message notification, unread count, thread opening, and conversation list** all worked.
- **Cleaned up** the test game, notifications, conversations, and messages afterward.
- Confirmed **API typecheck** passed.
- Confirmed **PWA app build** passed.
- Confirmed **web build** passed.
- **Restarted** API, web, and PWA services.
- Updated the public **roadmap + changelog**.

## Task 7 — Known gaps / not fully tested
- **Tournament notifications** are implemented and typecheck-clean, but **not fully tested** through a live tournament flow (would need a tournament → registrations → bracket → result run). Tournaments are a **web** surface, not in the PWA.
- The **app UI builds cleanly** but was **not manually clicked through** in a browser.
- Realtime uses **30-second polling + Web Push**, not a websocket / SSE stream. (The `clubs` feature already has an SSE bus that a notifications stream could mirror later.)
- **Opening a chat clears the per-conversation message unread**, but does **not** auto-mark the related notification row as read (consistent with other notification types).
- Messaging is **1-on-1 only** (the `Conversation` shape leaves room for group threads later).

---

## How to test locally
- **PWA:** `http://localhost:9000` (PM2 `pickleplay-pwa`) / `pickleballer-pwa.eunika.xyz`. Need **two accounts** for invites/messaging — the messaging + invite features live in the **PWA**, not the website.
- **Logins:** any seeded dummy player (e.g. `0418f540.king@example.com`, `09105328.macdonald@example.com`) / `password123`. New permissions take effect on **next login** (baked into the 15-min access token).
- **Try:** create a game → "Invite players" → search a name → Send. From a second account, open that game → "Message organizer" → send; the host sees the badge + Profile → Messages.
- **`/lists`:** `pickleballer-api.eunika.xyz/lists` — look for `messages`, `invite`, `unread-count`.

## Not committed
All changes are uncommitted across the monorepo (`app/`, roadmap) + the nested
`api/` repo, pending review.
