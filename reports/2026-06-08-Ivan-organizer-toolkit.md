# Task Report — Organizer Toolkit (5 features)

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
