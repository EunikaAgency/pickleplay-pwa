# Task Report — Live cross-entity search (courts · games · clubs · players)

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
