# Dashboard Instruction — PickleBallers Web

**Scope:** This document specifies the per-role dashboard surfaces for the web frontend at `pickleballer.eunika.xyz`. The existing **player** dashboard at `/dashboard/*` stays as-is — this doc is the spec for the three additional role surfaces: **coach**, **owner** (venue owner), and **admin**.

**Audience:** anyone implementing the next phase of dashboard work (Claude or human). Read [api/CLAUDE.md](api/CLAUDE.md) and [web/CLAUDE.md](web/CLAUDE.md) first for project conventions.

**Status:** spec only. No code in this doc — implementation lands in `web/src/features/{coach,owner,admin}/`.

**Last updated:** 2026-05-28.

---

## Table of contents

1. [Role model](#1-role-model)
2. [Route structure](#2-route-structure)
3. [Role detection + post-login redirect](#3-role-detection--post-login-redirect)
4. [Layout chrome per role](#4-layout-chrome-per-role)
5. [Coach dashboard spec](#5-coach-dashboard-spec)
6. [Owner dashboard spec](#6-owner-dashboard-spec)
7. [Admin dashboard spec](#7-admin-dashboard-spec)
8. [Reports & analytics](#8-reports--analytics)
9. [Cross-cutting concerns](#9-cross-cutting-concerns)
10. [API gaps to fill](#10-api-gaps-to-fill)
11. [Implementation phases](#11-implementation-phases)
12. [Open decisions](#12-open-decisions)

---

## 1. Role model

The API distinguishes **role identity** from **role view**:

| Field | Type | Purpose |
|---|---|---|
| `User.roleDefault` | enum `player` \| `coach` \| `owner` \| `admin` | Their *primary* role for default routing. Set at registration or by admin. |
| `User.modePreference` | enum `player` \| `coach` \| `owner` | Their currently selected *view*. Independent of `roleDefault` — a coach with `modePreference: 'player'` sees the player dashboard. |
| `UserRole` collection | many-to-one User | Extra roles beyond `roleDefault`. Lets one person own a venue AND be a coach without losing player access. |
| `User.coachId` | ObjectId → Coach | If a coach user has claimed a public Coach profile, this links them. Owner-equivalent (`User.ownerOfVenueIds`) is implicit via `Venue.ownerUserId === user._id`. |

**Decision rule for which dashboard shows:**

```
if (user.roleDefault === 'admin')                         → /admin (separate)
else if (user.modePreference === 'coach' && hasCoach)     → /coach
else if (user.modePreference === 'owner' && hasVenue)     → /owner
else                                                       → /dashboard (player)
```

Players always have access to `/dashboard`; coaches always have access to `/coach`; owners always have access to `/owner`. A user with multiple roles uses the **role switcher** in the header to flip.

**Admin is a hard separation** — `/admin/*` is not modePreference-driven. Admin users still get `/dashboard` for their personal player stuff (since admins are people too); they navigate to `/admin/*` for moderation work.

---

## 2. Route structure

Four top-level roots. The existing player root and admin scaffold stay; coach + owner are new.

```
/dashboard/*    Player — UNCHANGED. 10 tabs already wired (profile, bookings, games, etc.).
/coach/*        Coach console — NEW.
/owner/*        Venue-owner console — NEW.
/admin/*        Admin console — extends the existing scaffold.
```

Each root has its own Layout component, its own sidebar/tab nav, and its own route subtree. Pages live under `web/src/features/{coach,owner,admin}/` per the vertical-slice convention.

Legacy `/my/*` → `/dashboard/*` redirect already in place (see [web/src/router.jsx](web/src/router.jsx)). No legacy paths to forward for coach/owner since this is greenfield.

---

## 3. Role detection + post-login redirect

After successful login (`POST /api/v1/auth/login`), redirect by precedence:

1. If `location.state.from` was set by AuthGuard → return there (overrides everything).
2. If `user.roleDefault === 'admin'` → `/admin`.
3. If `user.modePreference === 'coach'` and the user has a linked `Coach` → `/coach`.
4. If `user.modePreference === 'owner'` and the user owns ≥1 `Venue` → `/owner`.
5. Else → `/dashboard/profile` (current behavior).

**Implementation note:** the `from` honoring already exists in [LoginPage.jsx](web/src/features/auth/LoginPage.jsx) — keep it; only the fallback default changes from a hardcoded `/dashboard/profile` to a role-aware default. Centralize the default-route logic in `web/src/features/auth/roleRedirect.js` so RegisterPage, role-switcher, and any deep-link landing pages share it.

---

## 4. Layout chrome per role

All layouts share the same `Header` and design tokens from [web/DESIGN.md](web/DESIGN.md). Differentiation is subtle, not loud — a chip in the header, a sidebar style change, an accent color.

| Role | Layout file | Nav style | Visual cue | Default landing |
|---|---|---|---|---|
| Player | `dashboard/UserLayout.jsx` (existing) | Horizontal tab bar | Electric Blue header gradient | `/dashboard/profile` |
| Coach | `coach/CoachLayout.jsx` (new) | Horizontal tab bar (mirrors UserLayout) | `Coach` chip in header; warm-accent gradient | `/coach` (overview) |
| Owner | `owner/OwnerLayout.jsx` (new) | Left sidebar (deeper nav tree) | `Venue Owner` chip; cool-accent gradient | `/owner` (venues list) |
| Admin | `admin/AdminLayout.jsx` (existing scaffold) | Left sidebar with grouped sections | Neutral grey chrome; no marketing gradient | `/admin` (overview) |

**Rationale for owner getting a sidebar instead of tabs:** per-venue pages have a 2-level nav (list of venues → individual venue's sub-pages like Courts / Hours / Bookings). A sidebar handles this better than a tab bar.

**Role switcher:** small dropdown in the header next to the user avatar, visible only when the user has more than one role. Options shown reflect their actual roles (coach if linked Coach, owner if owns ≥1 venue, plus player which everyone has). Selecting an option:
1. PATCHes `user.modePreference` server-side.
2. Updates the local `authStore` so chrome re-renders.
3. Navigates to the new root.

---

## 5. Coach dashboard spec

**Audience:** Users with a linked `Coach` profile (32 seeded today via `db:seed:users`).
**Root:** `/coach`. Layout uses `CoachLayout` (horizontal tabs).

### Pages

| Path | Component | Purpose | API |
|---|---|---|---|
| `/coach` | `CoachOverviewPage` | Stats cards (sessions this month, new students, avg rating, earnings); upcoming sessions table; recent reviews. | New `GET /api/v1/coaches/me` (returns the logged-in user's Coach + aggregates), `GET /api/v1/bookings?coachId=me`, `GET /api/v1/coaches/me/reviews` |
| `/coach/profile` | `CoachProfilePage` | Edit my public Coach profile — displayName, bio, photo, certifications, languages, specialty, rate, location. Preview link to `/coaches/<slug>`. | `GET /api/v1/coaches/me`, **NEW** `PATCH /api/v1/coaches/me` |
| `/coach/services` | `CoachServicesPage` | CRUD on `CoachService` rows — name, duration, price, description. | **NEW** `GET /api/v1/coaches/me/services`, `POST /api/v1/coaches/me/services`, `PATCH /api/v1/coach-services/:id`, `DELETE /api/v1/coach-services/:id` |
| `/coach/sessions` | `CoachSessionsPage` | Bookings made with me. Filter by status (upcoming, completed, cancelled). | **NEW** `GET /api/v1/bookings?coachId=me` (filter scoped to current user) |
| `/coach/reviews` | `CoachReviewsPage` | Reviews I received. Post + edit replies. | **NEW** `GET /api/v1/coaches/me/reviews`; existing `POST /api/v1/coach-reviews/:id/reply` |
| `/coach/availability` | `CoachAvailabilityPage` | Weekly available hours (used to filter when students can book). | **NEW** model + endpoints `GET/PUT /api/v1/coaches/me/availability` |
| `/coach/reports` | `CoachReportsPage` | See [section 8](#8-reports--analytics). | See section 8 |
| `/coach/settings` | `CoachSettingsPage` | Notification prefs specific to coaching (e.g. new booking emails). | `PATCH /api/v1/auth/me` |

### Coach onboarding

A user becomes a coach by one of:
1. Self-declaration during signup (`role=coach` in registration body — needs API tweak, currently registration is hardcoded `player`).
2. Admin promotes an existing user → coach (sets `roleDefault: 'coach'` and links `User.coachId` to a Coach profile).
3. **Claim flow** (preferred): user logs in, finds their unclaimed coach profile in `/coaches`, clicks "Claim this profile" → submits proof → admin approves → `User.coachId` set + `Coach.userId` set + `Coach.claimStatus = 'claimed'`.

The claim flow needs a new model `CoachClaim` parallel to `VenueClaim`, with endpoints `POST /api/v1/coach-claims` (user) and `GET/PATCH` (admin).

---

## 6. Owner dashboard spec

**Audience:** Users with `User.roleDefault === 'owner'` OR who own ≥1 Venue (`Venue.ownerUserId === user._id`). 12 seeded today.
**Root:** `/owner`. Layout uses `OwnerLayout` (left sidebar).

### Top-level pages

| Path | Component | Purpose | API |
|---|---|---|---|
| `/owner` | `OwnerOverviewPage` | Aggregate cards (total bookings this week across all my venues, revenue, avg rating, occupancy %); per-venue mini-cards with quick stats. | **NEW** `GET /api/v1/owners/me/summary`, or client-aggregate from `/api/v1/venues?ownerUserId=me` + `/api/v1/bookings?ownerUserId=me` |
| `/owner/venues` | `OwnerVenuesPage` | List of venues I own; click to manage. | **NEW** `GET /api/v1/venues?ownerUserId=me` (server-enforced) |
| `/owner/claims` | `OwnerClaimsPage` | Status of venue-ownership claims I've submitted. | `GET /api/v1/claims?submittedBy=me` |
| `/owner/reports` | `OwnerReportsPage` | See [section 8](#8-reports--analytics). | See section 8 |
| `/owner/profile` | `OwnerProfilePage` | Personal account info — same as `/dashboard/profile` (reuse component). | Existing `/api/v1/auth/me` |
| `/owner/settings` | `OwnerSettingsPage` | Notification prefs (e.g. new booking alerts), payout settings (stub for now — no payment provider). | `PATCH /api/v1/auth/me` |

### Per-venue sub-pages

When the owner clicks a venue in `/owner/venues`, they land in a venue-scoped workspace at `/owner/venues/:slug/*`. Sidebar replaces the top-level owner sidebar with a venue-specific one + a back-to-all-venues link.

| Path | Component | Purpose | API (mostly existing) |
|---|---|---|---|
| `/owner/venues/:slug` | `VenueDashboardPage` | Snapshot — bookings today, revenue this month, recent reviews, quick links. | Aggregated from existing endpoints |
| `/owner/venues/:slug/edit` | `VenueEditPage` | Edit venue details — name, address, description, amenities, photos. Live preview of the public `/venues/:slug` page. | `PATCH /api/v1/venues/:id` |
| `/owner/venues/:slug/courts` | `VenueCourtsPage` | CRUD on courts. | `GET /api/v1/venues/:id/courts`, `POST /api/v1/venues/:id/courts`, `PATCH /api/v1/venues/courts/:id`, `DELETE /api/v1/venues/courts/:id` |
| `/owner/venues/:slug/hours` | `VenueHoursPage` | Weekly opening hours grid. | `GET/PUT /api/v1/venues/:id/hours` |
| `/owner/venues/:slug/holidays` | `VenueHolidaysPage` | Holiday closures calendar. | `GET/POST /api/v1/venues/:id/holiday-closures` |
| `/owner/venues/:slug/faqs` | `VenueFaqsPage` | FAQ entries. | `GET/POST /api/v1/venues/:id/faqs`, `PATCH/DELETE /api/v1/venues/faqs/:id` |
| `/owner/venues/:slug/staff` | `VenueStaffPage` | Staff list + invite/remove. | `GET/POST /api/v1/venues/:id/staff`, `DELETE /api/v1/venues/staff/:id` |
| `/owner/venues/:slug/bookings` | `VenueBookingsPage` | Incoming bookings — accept/decline, change status. Calendar view + list view. | `GET /api/v1/venues/:id/bookings`, `PATCH /api/v1/venues/:id/bookings/:bookingId` |
| `/owner/venues/:slug/reviews` | `VenueReviewsPage` | All reviews on this venue + reply to each. | `GET /api/v1/venues/:id/reviews`, existing `POST /api/v1/reviews/:id/reply` |
| `/owner/venues/:slug/suggested-edits` | `VenueSuggestedEditsPage` | User-submitted corrections to my venue listing — accept/reject. | **NEW** scope filter on existing endpoint: `GET /api/v1/suggested-edits?venueId=…` (or owner sees own venues only) |
| `/owner/venues/:slug/reports` | `VenueReportsPage` | Per-venue reports drill-down. | See section 8 |

### Owner onboarding

A user becomes an owner by:
1. **Venue claim** (existing flow): user finds an unclaimed venue at `/venues/:slug`, clicks "Claim this venue" → `POST /api/v1/claims` → admin reviews → on approval, API sets `Venue.ownerUserId = user._id` and `User.roleDefault = 'owner'` (if it was player).
2. Admin manually assigns a venue to a user.
3. **New-venue submission** (future): self-service "List my venue" form for owners who want to list a not-yet-on-platform venue. Out of scope for phase 1.

---

## 7. Admin dashboard spec

**Audience:** `User.roleDefault === 'admin'`. 1 seeded today (`info@eunika.agency`).
**Root:** `/admin`. Layout uses `AdminLayout` (existing left-sidebar scaffold).

The existing scaffold ([web/src/features/admin/](web/src/features/admin/)) has stub pages for `AdminVenuesPage`, `AdminUsersPage`, `AdminGamesPage`, `AdminAnalyticsPage`. Wire those to the API and add the missing pages below.

### Section: Overview

| Path | Component | Purpose |
|---|---|---|
| `/admin` | `AdminOverviewPage` | Headline numbers (users, venues, coaches, bookings, pending moderation); 4 mini-charts (signups/day, bookings/day, new venues/week, new reviews/week); recent activity feed. |

### Section: Directory (read + admin-edit on every entity)

| Path | Component | Purpose | API |
|---|---|---|---|
| `/admin/users` | `AdminUsersPage` | Searchable user list. Inline edit role, verify, ban. | `GET /api/v1/admin/users`, `PATCH /api/v1/admin/users/:id` |
| `/admin/users/:id` | `AdminUserDetailPage` | Single user view — profile, bookings, reviews, devices, role history. | aggregate + `GET /api/v1/admin/users/:id/...` (NEW) |
| `/admin/venues` | `AdminVenuesPage` | All venues including unclaimed. Filter by claim status, city, listing status. | `GET /api/v1/venues?listingStatus=*` |
| `/admin/venues/:id` | `AdminVenueDetailPage` | Single-venue admin view — same as owner's but with override controls (force-edit, reassign owner, delist). | Existing venue endpoints + `PATCH` |
| `/admin/coaches` | `AdminCoachesPage` | All coaches; verify, edit, delist. | `GET /api/v1/coaches?listed=*`, `PATCH` |
| `/admin/coaches/:id` | `AdminCoachDetailPage` | Single coach — reviews, bookings, claim status. | Aggregated |
| `/admin/bookings` | `AdminBookingsPage` | All bookings system-wide. Filter by status, venue, user. | `GET /api/v1/bookings` (admin-scope) |
| `/admin/cities` | `AdminCitiesPage` | Cities CRUD — add/edit/disable. | `GET /api/v1/cities`, **NEW** `POST/PATCH/DELETE` |
| `/admin/tags` | `AdminTagsPage` | Tags CRUD. | `GET /api/v1/tags`, **NEW** `POST/PATCH/DELETE` |

### Section: Moderation

| Path | Component | Purpose | API |
|---|---|---|---|
| `/admin/moderation` | `ModerationDashboardPage` | Counts of every queue, oldest item per queue. | Aggregated counts |
| `/admin/moderation/reviews` | `ReviewQueuePage` | Pending venue/coach reviews. Approve, reject, edit, ban author. | `GET /api/v1/admin/reviews`, `PATCH /api/v1/admin/reviews/:id` |
| `/admin/moderation/review-reports` | `ReviewReportsPage` | User reports against existing reviews. | `GET /api/v1/admin/reports`, `PATCH /api/v1/admin/reports/:id` |
| `/admin/moderation/claims` | `ClaimsQueuePage` | Venue ownership claims. Approve → wires `Venue.ownerUserId`. | `GET /api/v1/claims`, `PATCH /api/v1/claims/:id` |
| `/admin/moderation/coach-claims` | `CoachClaimsQueuePage` | (After coach-claim flow exists) Coach profile claims. | NEW |
| `/admin/moderation/suggested-edits` | `SuggestedEditsPage` | User edits to venue listings. Diff view (old → new) + accept/reject. | `GET /api/v1/suggested-edits`, `PATCH /api/v1/suggested-edits/:id` |

### Section: Reports & analytics

See [section 8](#8-reports--analytics) for the full list. Mounts under `/admin/reports/*`.

### Section: Content (editorial)

| Path | Component | Purpose | API |
|---|---|---|---|
| `/admin/content/posts` | `AdminPostsPage` | Editorial posts (guides, news) list. | `GET /api/v1/posts` |
| `/admin/content/posts/new` | `PostEditorPage` | Markdown/rich editor for posts. | **NEW** `POST/PATCH /api/v1/posts` |
| `/admin/content/series` | `AdminSeriesPage` | Post series (multi-part articles). | **NEW** |

### Section: System

| Path | Component | Purpose | API |
|---|---|---|---|
| `/admin/audit-logs` | `AuditLogPage` | Filterable view of `AuditLog`. Search by actor, action, entityType. | `GET /api/v1/admin/audit-logs` |
| `/admin/subscribers` | `SubscribersPage` | Newsletter subscriber list, export. | `GET /api/v1/admin/subscriptions` |
| `/admin/tables` | `TablesPage` | Raw collection counts + last-import timestamps. | Existing `GET /api/tables/data` |
| `/admin/settings` | `AdminSettingsPage` | Site-wide settings (feature flags, default city, CORS allowlist preview). | **NEW** key/value config endpoint |

---

## 8. Reports & analytics

A first-class section per role, scoped to what they're allowed to see.

### Charting library

Recommend **Recharts** — React-native, small footprint, plays well with Tailwind. If a heavier dashboard kit is wanted, Tremor is the alternative (more opinionated, faster to ship).

### Admin reports (`/admin/reports/*`)

| Report | What it shows | Source |
|---|---|---|
| `/admin/reports/growth` | Signups, new venues, new coaches, new bookings per day/week/month. Line charts + period-over-period delta. | NEW `GET /api/v1/admin/analytics/growth?period=…` |
| `/admin/reports/activity` | DAU/WAU/MAU. Funnel: visit → signup → first booking. | NEW endpoint; for v1, derive from `User.lastLoginAt` + Booking dates client-side |
| `/admin/reports/bookings` | Booking volume + value over time. Top venues, no-show / cancellation rates. | Aggregated from `Booking` |
| `/admin/reports/revenue` | (After payments live) gross/net, by method, by venue. | `Payment` collection |
| `/admin/reports/coaches` | Sessions per coach, fill rate, top earners, idle coaches. | `Coach` + `CoachService` + `Booking` |
| `/admin/reports/venues` | Booking density, avg rating, review velocity, claim status mix. Top + bottom by score. | `Venue` + `Booking` + `Review` |
| `/admin/reports/geographic` | Heatmap of venues + coaches per city/region. User signup density. | `Venue.lat/lng` + `User.homeCityId` |
| `/admin/reports/moderation` | Resolution time per queue, throughput per admin, backlog age. | Aggregated from admin queues + audit log |
| `/admin/reports/search` | What people search for, zero-result queries, click-through to detail page. | NEW `SearchLog` model + endpoint |
| `/admin/reports/exports` | Download CSV/JSON of any major entity. | NEW `GET /api/v1/admin/exports/<entity>?format=csv` |

### Owner reports (`/owner/reports/*` and `/owner/venues/:slug/reports`)

Scoped to venues where `Venue.ownerUserId === me`.

| Report | What it shows |
|---|---|
| `/owner/reports` | Aggregate across all my venues. |
| `/owner/reports/performance` | Per-venue card: bookings this month, revenue, rating, review delta, top courts. |
| `/owner/reports/bookings` | Daily/weekly volume across my venues, peak-hours heatmap, cancellation rate. |
| `/owner/reports/revenue` | Earnings by venue, by method, by date range. |
| `/owner/reports/reviews` | Avg rating trend, recent reviews, response rate (how often I replied). |
| `/owner/venues/:slug/reports/utilization` | Per-court usage, idle slots, peak vs off-peak. |

### Coach reports (`/coach/reports/*`)

Scoped to the logged-in user's Coach profile.

| Report | What it shows |
|---|---|
| `/coach/reports` | Top-level summary. |
| `/coach/reports/sessions` | Sessions per week, attendance, fill rate, repeat-student ratio. |
| `/coach/reports/earnings` | Revenue by service type, by date range, year-to-date. |
| `/coach/reports/ratings` | Avg rating trend, review count, recent feedback. |
| `/coach/reports/students` | Unique students taught, repeat rate, retention. |

### Phasing for reports

**Phase A (no API changes):** Implement Admin Overview and `/owner` overview with **client-side aggregation** from existing list endpoints. Get the "looks like a real dashboard" feel without blocking on API work.

**Phase B:** Add the dedicated `/api/v1/admin/analytics/*` endpoints listed under [section 10](#10-api-gaps-to-fill). Migrate the overview pages to them.

**Phase C:** Add full `/admin/reports/*`, `/owner/reports/*`, `/coach/reports/*` pages — most use the same backend endpoints with role-scope filters.

---

## 9. Cross-cutting concerns

### Authorization

| Layer | Responsibility |
|---|---|
| **API** | Hard authority. Every owner/coach/admin endpoint MUST enforce scope server-side (`requireAdmin()`, owner-of-venue check, coach-self check). Never trust the client. |
| **Web (route)** | Route guards block unauthorized navigation early (already partly there via `AuthGuard`). Need parallel guards `RequireRole('admin')`, `RequireRole('owner')`, `RequireRole('coach')`. |
| **Web (UI)** | Hide controls a user can't use (e.g. don't show "Reassign owner" button on AdminVenueDetailPage if logged-in user isn't admin). But never *rely* on hiding for security. |

### Role-guard component

```
web/src/features/auth/RequireRole.jsx
```

Wraps a route element like `<AuthGuard>`. Accepts a role or array of roles. Renders the child if `user.role` matches; otherwise renders a 403-style fallback ("You don't have access to this area") with a link back to `/dashboard`.

### Role switcher

| When visible | Behavior |
|---|---|
| User has ≥2 `UserRole` entries (or `roleDefault !== 'player'` + linked Coach/Venue), the switcher appears in the header next to the avatar. | Click → dropdown lists their roles. Selecting one PATCHes `user.modePreference`, updates the local store, and navigates to that role's default landing page. |

### Shared components to extract (move to `shared/components/dashboard/`)

The following appear in 2+ role surfaces. Extract once, reuse:

- `StatCard` — number + label + trend chip. Used on every overview page.
- `MiniChart` — Recharts wrapper with consistent styling (used on overview pages).
- `DataTable` — sortable, filterable list with row actions. Backbone of admin list pages and owner/coach lists.
- `EmptyState` — already in PWA; port to web.
- `LoadingSkeleton` — already in PWA; port to web.
- `ErrorState` — already in PWA; port to web.
- `EntityCard` — venue / coach / user card with avatar + headline + actions. Reused in admin directory and owner picker.
- `RoleChip` — small uppercase chip showing the user's current mode. Used in header and on user list pages.
- `ConfirmDialog` — modal for destructive actions (delete venue, ban user). New.

### Visual design

Reuse [web/DESIGN.md](web/DESIGN.md) tokens. Per-role accents (subtle):

- Player — Electric Blue `#0040E0` (current).
- Coach — Tertiary container (warm).
- Owner — Primary container (cool deep).
- Admin — Neutral grey (no gradient).

Header gradient on each layout pulls from the role accent. CTAs across the app stay Neon Lime `#C1F100` regardless of role.

### Empty states & onboarding

Each role's first visit should not be a wall of zero-state cards. Either:

1. Show a friendly "Welcome to the coach dashboard — here's how to set up your profile" with a checklist.
2. Auto-populate with sample/demo data clearly marked as preview.

The PWA has a `DemoStateProvider` pattern worth porting. For now, ship #1 (welcome checklist) per role.

---

## 10. API gaps to fill

The API today has read endpoints for most entities and write endpoints for personal data (auth, reviews, favorites). The following are **needed for this dashboard work** and don't exist yet:

### Coach
- `GET /api/v1/coaches/me` — returns the logged-in user's Coach profile + aggregates.
- `PATCH /api/v1/coaches/me` — self-edit.
- `GET /api/v1/coaches/me/services`, `POST /api/v1/coaches/me/services` — coach service CRUD.
- `PATCH /api/v1/coach-services/:id`, `DELETE /api/v1/coach-services/:id` — coach service CRUD.
- `GET /api/v1/coaches/me/reviews` — reviews on me.
- `GET /api/v1/coaches/me/availability`, `PUT /api/v1/coaches/me/availability` — weekly availability model (new schema needed).
- `GET /api/v1/bookings?coachId=me` — filter scope.
- **`CoachClaim`** model + endpoints (parallel to `VenueClaim`).

### Owner
- `GET /api/v1/owners/me/summary` — aggregate stats across owned venues. (Or keep client-side.)
- `GET /api/v1/venues?ownerUserId=me` — filter scope (server-enforces user can only pass `me`).
- `GET /api/v1/bookings?ownerUserId=me` — same.
- `GET /api/v1/suggested-edits?venueId=…` — restrict to venues the user owns.
- Booking status update on owner side (accept/reject) — `PATCH /api/v1/venues/:id/bookings/:bookingId` exists but needs an explicit `status` enum check.

### Admin
- `GET /api/v1/admin/users/:id/...` aggregates — bookings/reviews/devices in one shot.
- `POST/PATCH/DELETE /api/v1/cities` — currently read-only.
- `POST/PATCH/DELETE /api/v1/tags` — currently read-only.
- `POST/PATCH /api/v1/posts` — editorial CRUD.
- `GET /api/v1/admin/exports/<entity>?format=csv` — CSV exports.

### Reports / analytics
- `GET /api/v1/admin/analytics/growth?period=day|week|month&days=30`
- `GET /api/v1/admin/analytics/activity?days=30`
- `GET /api/v1/admin/analytics/bookings?groupBy=day|venue|status`
- `GET /api/v1/admin/analytics/revenue?…`
- `GET /api/v1/admin/analytics/coaches`
- `GET /api/v1/admin/analytics/venues`
- `GET /api/v1/admin/analytics/geographic`
- `GET /api/v1/admin/search-logs?…` (needs new `SearchLog` collection)

### Registration role selection
- `POST /api/v1/auth/register` currently hardcodes `roleDefault: 'player'`. Add optional `role` field accepting `player|coach|owner` (admin only via admin endpoint). When `coach` or `owner` is chosen, the new account is in a pending-verification state until admin/claim flow resolves.

### Convention
All `me` endpoints derive scope from JWT — the path doesn't take an ID. Keeps the API surface tight and prevents IDOR-style mistakes.

---

## 11. Implementation phases

Each phase delivers a coherent vertical slice. Don't start a phase until the prior one is shipped and rotted (i.e. used briefly to catch obvious problems).

### Alignment with the public roadmap

The dashboard work slots into the existing 7-phase public roadmap rendered at https://pickleballer.eunika.xyz/roadmap. Each dashboard sub-phase below is tagged with its parent roadmap phase so progress on this doc rolls up to the same numbering everyone else sees. Append a Change Log entry on the roadmap when each sub-phase ships — see [web/CLAUDE.md](web/CLAUDE.md) for the procedure.

| Dashboard sub-phase | Maps to roadmap phase | Roadmap title |
|---|---|---|
| Player dashboard (already shipped) | **Phase 2** | Backend Integration & Persistence |
| 4.1 — Admin foundation | **Phase 5** | Polish & Guidance *(moderation surfaces)* |
| 4.2 — Owner foundation | **Phase 6** | Facility Readiness *(direct match — venue management)* |
| 4.3 — Coach foundation | **Phase 3** | Organizer Tools *(coach = primary organizer role)* |
| 4.4 — Reports & analytics | **Phase 5** + **Phase 7** | Polish & Guidance *(operator reports)* + Monetization *(revenue reports)* |
| 4.5 — Polish & advanced | **Phase 5** | Polish & Guidance |

The "4.x" numbering is purely an artifact of this doc — the 4 came from the web's own implementation phasing ([web/PLAN.md](web/PLAN.md) marks role-based dashboards as web Phase 4). When tagging roadmap commits, use the public roadmap's phase number (2/3/5/6/7), not the 4.x sub-number.

### 4.1 — Admin foundation *(roadmap Phase 5 — Polish & Guidance)*
**Goal:** the seeded admin (`info@eunika.agency`) can do their job.

- `AdminLayout` polish (sidebar with Overview / Directory / Moderation / Reports / System sections; collapsed-state).
- `RequireRole('admin')` guard.
- `AdminOverviewPage` with 4 client-aggregated mini-charts (signups/day, bookings/day, new venues, new reviews).
- Wire existing scaffolded pages: `AdminUsersPage`, `AdminVenuesPage` to live endpoints.
- Add: `AdminCoachesPage`, `AdminBookingsPage`.
- Add: `ModerationDashboardPage` + the 3 existing queues (`/admin/moderation/reviews`, `/admin/moderation/review-reports`, `/admin/moderation/claims`, `/admin/moderation/suggested-edits`).
- **Success:** admin can review and approve a venue claim end-to-end. Admin can ban a user end-to-end.

### 4.2 — Owner foundation *(roadmap Phase 6 — Facility Readiness)*
- `OwnerLayout` with sidebar.
- `RequireRole('owner')` guard.
- `OwnerOverviewPage` (aggregate cards client-side).
- `OwnerVenuesPage` — list of my venues.
- Per-venue: `VenueDashboardPage`, `VenueEditPage`, `VenueCourtsPage`, `VenueHoursPage`, `VenueBookingsPage`, `VenueReviewsPage`.
- Role switcher in header (visible for users with both player and owner).
- **Success:** an owner can edit their venue's hours and FAQs and respond to a review.

### 4.3 — Coach foundation *(roadmap Phase 3 — Organizer Tools)*
- `CoachLayout` with tabs.
- `RequireRole('coach')` guard.
- `GET /api/v1/coaches/me` + `PATCH /api/v1/coaches/me` (API work).
- `CoachOverviewPage`, `CoachProfilePage`, `CoachServicesPage`, `CoachReviewsPage`.
- Coach claim flow (`CoachClaim` model + UI on `/coaches/:slug` + admin queue).
- **Success:** a coach can claim their public profile, edit it, and add 3 services.

### 4.4 — Reports & analytics *(roadmap Phase 5 — Polish; revenue → Phase 7 — Monetization)*
- Admin: `/admin/reports/growth`, `/admin/reports/bookings`, `/admin/reports/venues`, `/admin/reports/coaches`, `/admin/reports/geographic`.
- Owner: `/owner/reports/performance`, `/owner/reports/bookings`, `/owner/reports/reviews`.
- Coach: `/coach/reports/sessions`, `/coach/reports/ratings`.
- API: implement the `/admin/analytics/*` endpoints (replace client-side aggregation in overview pages).
- Revenue reports gated behind the payment-provider work in roadmap Phase 7.

### 4.5 — Polish & advanced *(roadmap Phase 5 — Polish & Guidance)*
- `/admin/audit-logs`, `/admin/exports`, `/admin/content/posts`.
- `/owner/reports/utilization` (court-level), `/owner/venues/:slug/staff`, `/owner/venues/:slug/holidays`, `/owner/venues/:slug/suggested-edits`.
- `/coach/availability` model + page.
- Onboarding checklists per role.
- Role switcher polish for multi-role users.

---

## 12. Open decisions

These need owner sign-off before implementation:

1. **Coach availability model.** New schema needed. Options: (a) simple weekly grid (open day-of-week + open hour range); (b) iCal-style recurring rules; (c) date-specific availability (calendar app pattern). Recommend (a) for v1.

2. **Owner role assignment.** When admin approves a venue claim, should the user's `roleDefault` auto-flip to `owner`, or stay as `player` with owner being a *secondary* role via `UserRole`? Recommend: stay `player`, add `UserRole(role: 'owner')`, and update `modePreference` to `owner` so the next login lands on `/owner`. This preserves the player surface for owners.

3. **Multi-tenancy of staff.** `VenueStaff` exists in the API. Should venue staff (non-owner) get a scoped login that can only see their venue's bookings? If yes, that's a new role `staff` and a new dashboard scope. Recommend defer to a later phase.

4. **Coach as staff.** Can a coach be assigned to a venue (e.g. as the venue's resident instructor) and show in `VenueStaffPage`? The schema supports it via `Coach.venues[]` (existing field). UI surface for this: small "Coaches" sub-tab under `/owner/venues/:slug/staff`. Defer to phase 5.

5. **Reporting period defaults.** Last 7 days, last 30 days, this month, this year, custom? Recommend last 30 days as default with a quick-toggle for 7d/30d/90d/12m + a custom date-range picker.

6. **CSV export gating.** Should non-admin owners be able to export their own venue bookings as CSV? Recommend yes (under `/owner/venues/:slug/bookings` with an "Export" button) since it's their data, but rate-limit to one export per 5 minutes.

7. **Audit-log scope.** Currently `AuditLog` is admin-only. Should owners see audit entries for actions on their own venues? Recommend yes, but limited to their venue's `entityId`. Out of phase 1; add in phase 5.

8. **Notifications.** When a booking comes in, the owner needs to know. Email? In-app? Both? `Notification` model exists but `UserDevice` push hasn't been wired. Recommend: in-app notification + email digest. Defer email to phase 5.

---

## References

- [api/CLAUDE.md](api/CLAUDE.md) — feature-based vertical slice rules; how to add new endpoints.
- [web/CLAUDE.md](web/CLAUDE.md) — same for web; the slice/import conventions.
- [api/src/features/](api/src/features/) — backend feature implementations.
- [web/src/features/dashboard/](web/src/features/dashboard/) — the existing **player** dashboard (do not modify per this spec).
- [web/src/features/admin/](web/src/features/admin/) — existing scaffold; extend per [section 7](#7-admin-dashboard-spec).
- [web/PLAN.md](web/PLAN.md) — historical admin route sketch (now superseded by this doc for admin scope).
- [web/DESIGN.md](web/DESIGN.md) — design tokens shared across all role surfaces.
- Public roadmap: https://pickleballer.eunika.xyz/roadmap — log every phase landing per the rule in [web/CLAUDE.md](web/CLAUDE.md).
