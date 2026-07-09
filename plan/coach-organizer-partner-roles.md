# Plan — Coach/Organizer become per-venue *earned* partner roles, not sign-up roles

## Context

Today a new account picks one of four roles at sign-up (`player | owner | coach | organizer`)
and that single `roleDefault` string drives every permission. That's wrong for the product:
**everyone is fundamentally a player** (or an **owner**), and *coach* / *organizer* are
capabilities you **earn per-venue** by applying and being approved by that venue's owner.

We want:
1. **Registration offers only `player` and `owner`.** (Owner is unchanged — still a sign-up choice.)
2. **Only players apply as coach/organizer — never owners.** A player **applies at a specific
   venue** to become a coach or an organizer there. Owner (and staff/admin console) accounts do
   **not** get the apply flow; "become a coach/organizer" is a player-only action.
3. The venue **owner approves** (from a new **Partners** surface) → the applicant is **granted the
   coach/organizer permission set + a per-venue badge** ("Coach at Quezon Smash Club"). The
   coach/organizer roles still *exist* (with their permission bundles) — they're just no longer
   something you register as; they're granted.
4. Owners can also **invite** a coach/organizer directly (the mockup's "+ Invite Partner").

> **Owner is not something you "become" via apply.** A player cannot apply to become an owner. The
> application/grant mechanism is *only* for coach and organizer. Owner stays a registration role as
> today.

The good news from exploration: **the multi-role machinery already exists and is wired end-to-end** —
it's just dormant. This is mostly *activating* it, not building it.

### Key findings from exploration
- **Permissions are already multi-role.** `resolveRolePermissions(roles[])` unions the permission
  bundles of every role a user holds — `api/src/shared/lib/permissions.ts`. The coach & organizer
  bundles are already defined there (and mirrored in `app/src/shared/lib/permissions.ts`).
- **The app already consumes a `roles[]` array.** `toAppUser` (`app/src/shared/lib/api.ts:246`)
  reads `api.roles`, dedups, and **re-derives** permissions from them via the app's own
  `ROLE_PERMISSIONS`. So the moment `/me` returns `roles: ['player','coach']`, the app unlocks the
  coach surfaces (client gating) with **no app-permissions change**.
- **A per-user scoped-grant table already exists but is dormant:** `UserRole { userId, role,
  scopeType, scopeId, isPrimary }` with a unique index on `(userId, role, scopeType, scopeId)` —
  `api/src/features/auth/auth.model.ts:103`. It's referenced only by a seed script; runtime
  resolution ignores it. **This is the exact vehicle for a per-venue grant.**
- **Runtime role resolution is the single blocker:** `getUserRoles()`
  (`api/src/features/auth/auth.controller.ts:64`) returns only `[roleDefault]`. Make it merge
  `roleDefault` + the user's `UserRole` grants and everything downstream (token payload, `/me`,
  the app) lights up.
- **Coach applications already exist** (`api/src/features/coach-applications/*`): apply →
  owner approve/reject/remove, one row per coach+venue, approve adds the venue to `Coach.venues`.
  **Gap:** submitting/reading requires `coach.applications.manage` **first** — a chicken-and-egg
  for plain players — and approve does **not** grant any role. **Organizer applications don't
  exist at all.** No app UI consumes coach-applications yet.
- **Owner nav already has the exact placement pattern:** the Calendar row in
  `OwnerProfileScreen.tsx:89` uses `className: 'sm:hidden'` (mobile/tablet only) while the same
  action is a desktop **Sidebar** item — mirror this for **Partners**.
- Enforcement reads the **JWT** (`shared/middleware/auth.ts`), and the refresh path rebuilds the
  token from the DB user — so once `getUserRoles` reads grants, a token refresh/re-login picks them
  up automatically.

### Design decision (per the answers)
- **"Player-only apply" discriminator:** owners get the player *base* permissions but **not**
  `player.dashboard.access` (only the full `player`/`coach` roles have it —
  `api/src/shared/lib/permissions.ts`). So `hasPermission(user, 'player.dashboard.access')` cleanly
  means "player-type account" and **excludes owner/staff** — use it to gate the apply flow (API +
  app entry points). Coaches/organizers (players at heart) can still apply to *more* venues.
- **Grant = an additive per-venue `UserRole` row** (`role: 'coach'|'organizer'`, `scopeType:
  'venue'`, `scopeId: venueId`). Primary identity stays `player`/`owner`; the coach/organizer
  **permission bundle unlocks** the surfaces; the **venue linkage + badge are per-venue** (from the
  grant rows + `Coach.venues` + application records).
- **"Per-venue" is enforced at the data + display layer** (which venue you applied to, the badge,
  the venue-linked records). Permission *checks* stay capability-based — we are **not** rewriting
  every endpoint to re-verify the exact venue (no permission carries venue scope anywhere today, and
  venue-management actions are already owner-gated separately). This matches how the app already
  works: e.g. an organizer still needs that venue's own approval to run a tournament there
  (`tournament-applications`). This scope boundary is deliberate — call it out at review.

---

## Implementation order

**Step 0 — save this plan into the repo first.** This document lives at
`/var/public/pickleplay/plan/coach-organizer-partner-roles.md` for review before any code.

**Step 1 — build the Partners tab screen + its nav placement first (Phase E's app half).** Stand up
`OwnerPartnersScreen` and wire it so it shows **in the desktop Sidebar** and **inside the Profile
tab on mobile/tablet** (the `sm:hidden` row pattern), rendering the KPI cards + All/Coaches/Organisers
tabs + search + cards. It can ship immediately against the **existing** `getOwnerCoachApplications`
data for the Coaches tab (Organisers shows an empty state until Phase D lands; Approve is wired for
coaches). This makes the surface reviewable right away.

**Then** the rest, in dependency order: **A** (registration) → **B** (activate grants) →
**C** (coach apply player-only + grant on approve) → **D** (organizer-applications) →
**E API** (combined partners feed, fills the Organisers tab) → **F** (player apply entry +
Invite Partner) → **G** (badges).

---

## Phase A — Registration offers only player + owner ✅ DONE (verified 2026-07-08)

> Verified: API `REGISTERABLE_ROLES = ['player','owner']` + comment updated; live register with
> `role: coach` → 400 `VALIDATION_ERROR`. App `RegisterRole` trimmed, `ROLE_OPTIONS` = player/owner,
> `TEST_ACCOUNTS` untouched.

- **API** — `api/src/features/auth/auth.controller.ts:14`: `REGISTERABLE_ROLES = ['player','owner']`
  (update the comment above it). The `role` field already `.default('player')`. `coach`/`organizer`
  now 400 at register — intended. No migration: **existing** coach/organizer accounts keep working
  because `getUserRoles` still includes `roleDefault`.
- **App** — `app/src/shared/lib/api.ts:285` `RegisterRole = 'player' | 'owner'`; trim
  `ROLE_OPTIONS` in `app/src/features/auth/LoginScreen.tsx:20` to player + owner. Dev quick-logins
  (`TEST_ACCOUNTS`) are logins, not registration — leave them.

## Phase B — Activate grant-based roles (API)

- `getUserRoles()` → **async**, merges `roleDefault` + `distinct` roles from
  `UserRole.find({ userId })`. Await it in `authUserPayload` and `tokenPayloadFor` (both already run
  inside async handlers — `register`/`login`/`refresh`/`/me`).
- **Expose per-venue badges on `/me`:** add `partnerRoles: [{ role, venueId, venueName }]` to
  `authUserPayload`, built from the user's venue-scoped `UserRole` rows joined to `Venue`
  (displayName). This is what the app renders as "Coach at <venue>".
- Verify the `UserRole` rows seeded by `seed-dummy-data.ts:507` are consistent (they'll now grant
  roles); adjust the seed if any are stray.

## Phase C — Coach application opens to players (player-only) + grants on approve (API)

`api/src/features/coach-applications/coach-applications.controller.ts`:
- **Swap the apply/read gate to player-only:** `submitCoachApplication`, `getMyCoachApplications`,
  `getMyApplicationForVenue` drop `coach.applications.manage` and instead require
  `player.dashboard.access` — any **player** can apply and track status, but **owners/staff are
  rejected** (they lack that permission). Owner-side handlers keep `owner.coaches.manage`.
- **Grant on approve** in `decide(...)` when `status === 'approved'`:
  - `UserRole.updateOne({ userId: coachUserId, role:'coach', scopeType:'venue', scopeId: venueId },
    { $setOnInsert: {...} }, { upsert: true })`.
  - Ensure a `Coach` profile exists for the applicant (create a minimal one from the `User` and set
    `user.coachId` if none) so they show up as a coach; then the existing `Coach.venues $addToSet`.
- **Revoke on reject/remove:** delete that venue's `UserRole` coach grant (alongside the existing
  `Coach.venues $pull`).

## Phase D — Organizer applications (new feature, mirrors coach)

New slice `api/src/features/organizer-applications/` (model + controller + routes), a near-copy of
coach-applications:
- `OrganizerApplication { organizerUserId, venueId, status, message, decidedByUserId, decidedAt }`,
  unique `(organizerUserId, venueId)`.
- Player submit/read gated by `player.dashboard.access` (player-only, excludes owners/staff); owner
  list/approve/reject/remove (`owner.tournaments.manage`, the existing owner-side organizer gate —
  no new permission).
- Approve → upsert `UserRole { role:'organizer', scopeType:'venue', scopeId }`; reject/remove → delete it.
- Mount in `api/src/routes/index.ts`; add all routes to `/lists`
  (`api/src/features/root/root.controller.ts`).

## Phase E — Owner **Partners** surface (app) + combined feed (API)

- **API:** add `getOwnerPartners` (or call both existing/new list endpoints) returning coach +
  organizer applications across the owner's venues, each tagged `kind: 'coach'|'organizer'`, with
  status, applicant identity, venue, and (best-effort) counts. Reuse `getOwnerCoachApplications`'
  shaping. **KPIs:** Active Coaches / Organisers / Pending Review are derivable now; **Partner
  Revenue is a placeholder** for v1 (no partner-payment rollup exists — flag it).
- **App:** new `app/src/features/owner/OwnerPartnersScreen.tsx` (screen id `owner-partners`) — KPI
  cards, All / Coaches / Organisers filter tabs, search, cards with **Approve** (pending) / View
  Profile / **Message** (existing DM via `user.messages.send`) / **+ Invite Partner**. Add the
  coach- + organizer-application **API client fns** to `app/src/shared/lib/api.ts` (none exist yet).
- **Nav placement (the mockup's rule):**
  - **Desktop Sidebar** — add a **Partners** owner item in `app/src/shared/components/layout/Sidebar.tsx`
    (owner-only, alongside the Calendar/Pricing extras via an `onOpenPartners`/active flag).
  - **Mobile/tablet** — add a **Partners** `Row` in `OwnerProfileScreen.tsx` with
    `className: 'sm:hidden'` (exactly like the Calendar row), `onNavigate('owner-partners')`.
  - Register `owner-partners` in `app/src/shared/lib/navigation.ts` (union, path `/owner/partners`,
    `deepLinkParent` → profile) and `app/src/App.tsx` (render case + `SCREEN_PERMISSIONS:
    'owner.access'`; guard the two approve actions by `owner.coaches.manage` /
    `owner.tournaments.manage`).
- **Note:** the mockup's fuller "Venue OS" chrome (Portfolio/Finance/Shop/…) is **out of scope** —
  we add only the Partners screen + its nav entry, following current app patterns.

## Phase F — Player apply entry + Invite Partner (both directions)

- **Player applies** (per-venue, **player-only**): add an "Apply to coach / organise here" entry on
  the venue detail `app/src/features/venues/CourtDetailsScreen.tsx` (and a "My partner applications"
  list under the player Profile) → posts to the coach/organizer application endpoints; button state
  reflects `pending/approved`. **Show the entry only to player-type accounts** (guard with
  `userHasPermission(user, 'player.dashboard.access')`) so owners never see "apply as coach/organizer",
  and never "apply as owner".
- **Invite Partner (owner-initiated):** represent an invite as an application row with
  `origin: 'invite'` + status `invited` (owner creates it for a chosen user/email; no grant yet).
  - Owner: "+ Invite Partner" on the Partners screen → pick an existing user (reuse the player
    search used by game invites) → creates the `invited` row + notifies the invitee.
  - Invitee: a "Partner invitations" surface (player Profile) to **Accept** (→ status `approved` +
    the same grant path as Phase C/D) or decline.
  - Add the create-invite + accept endpoints to both application controllers, `/lists`, and app
    client fns.

## Phase G — Badges (app)

- Thread `partnerRoles` through `ApiUser`/`toAppUser` (`app/src/shared/lib/api.ts`) onto `AppUser`
  (`app/src/shared/lib/permissions.ts`).
- Add a per-venue badge helper in `app/src/shared/lib/roleDisplay.ts` and render "Coach/Organiser at
  <venue>" chips on the player profile (`ProfileScreenV2` / `OwnerProfileScreen`).

---

## Representative files
**API:** `features/auth/auth.controller.ts` (roles, register, `/me` payload) · `features/auth/auth.model.ts`
(UserRole already present) · `features/coach-applications/coach-applications.controller.ts` ·
**new** `features/organizer-applications/*` · `routes/index.ts` · `features/root/root.controller.ts` (`/lists`) ·
`shared/db/seed-dummy-data.ts` (verify).
**App:** `features/auth/LoginScreen.tsx` · `shared/lib/api.ts` (`RegisterRole`, `ApiUser.partnerRoles`,
`toAppUser`, new client fns) · `shared/lib/permissions.ts` · `shared/lib/roleDisplay.ts` ·
**new** `features/owner/OwnerPartnersScreen.tsx` · `shared/components/layout/Sidebar.tsx` ·
`features/owner/OwnerProfileScreen.tsx` · `features/venues/CourtDetailsScreen.tsx` ·
`shared/lib/navigation.ts` · `App.tsx`.

## Reuse (don't rebuild)
`resolveRolePermissions` (multi-role union) · `UserRole` model + its unique index · the entire
coach-applications flow as the template for organizer-applications · the `sm:hidden` owner-row
pattern · the game-invite player search for "Invite Partner" · existing DM for "Message".

## Verification (end-to-end)
1. **Register** via app + curl: only player/owner accepted; `coach`/`organizer` → 400.
2. **Coach apply→approve** (curl): player (no coach perm) applies at venue X → owner approves →
   player's next `/me`/token refresh returns `roles` incl. `coach` + `partnerRoles:[{coach, X}]`;
   coach surfaces unlock in-app; reject/remove revokes the grant. Confirm existing `roleDefault:
   'coach'` accounts still resolve correctly. **Assert an owner account gets 403 when it tries to
   apply as coach/organizer, and the app hides the apply entry for owners.**
3. **Organizer apply→approve** (curl): same, `role: organizer`; `/lists` shows the new routes.
4. **Partners screen**: owner sees pending coach+organizer across venues; Approve flips status +
   grants; desktop shows the Sidebar **Partners** item, mobile/tablet shows the Profile row
   (`sm:hidden`), and the two don't double-show at any width.
5. **Invite Partner**: owner invites a user → invitee sees the invitation → Accept grants role +
   badge; decline leaves them a player.
6. `npm run typecheck` (app) + `npm run lint`/`npm test` (api) clean; drive the flow in the PWA
   (per the `verify`/`run` skills) and screenshot the Partners screen at desktop + mobile widths.
7. Roadmap Change Log + both `FILEMAP.md`s + `/lists` updated (repo rules).

## Out of scope / flags
- Real **Partner Revenue** rollup (placeholder KPI for v1).
- Strict **per-endpoint venue enforcement** of coach/organizer actions (data + badge are per-venue;
  capability unlock is account-wide — deliberate, see Design decision).
- The mockup's broader Venue-OS console chrome beyond the Partners screen.
