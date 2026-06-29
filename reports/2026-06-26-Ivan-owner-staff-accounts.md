# Task Report — Owner staff accounts (delegated "Venue staff" role)

- **Author:** Ivan
- **Date:** 2026-06-26
- **Area:** `api/` (new role + staff feature + scoping) and `app/` (PWA owner console). Permission catalogue synced to `web/`.
- **Status:** ✅ Built & **verified end-to-end** (curl, on the live local API). API restarted (`pickleballer-api`); PWA serves source live (Vite dev). Not yet committed.

---

## 1. Goal

Let a venue owner create staff **login accounts** that run the owner console on their
behalf. A staff member created by an owner can manage **all** of that owner's venues,
bookings, and clubs — but cannot create more staff or list/claim new venues. Only owners
and admins can create staff. Entry point lives on the owner **Profile** page (per request).

> This is **org-level** delegation — distinct from the pre-existing per-venue `VenueStaff`
> (which attaches an *existing* user to a *single* venue). This feature creates a brand-new
> account scoped to the owner's whole org.

## 2. How it works

- **New `staff` role** — operational owner permissions (`owner.access`, `owner.venues.manage`,
  `owner.bookings.manage`, analytics/games/market/reviews/coaches/tournaments/notifications +
  the player base set) **minus** `owner.staff.manage`, `owner.venues.create`, `owner.venues.claim`.
- **`parentOwnerUserId`** on the `User` model ties each staff account to its creating owner.
  Carried in the JWT as `parentOwnerId`.
- **`effectiveOwnerId(user)`** (new helper in `shared/lib/permissions.ts`) = the creating
  owner's id for a staff member, else the user's own id. **Single lever:** every "is this my
  resource?" check compares the resource's owner to this id, so staff inherit their owner's
  resources without owning them.
- **`isActive`** on `User` — a backend safety net (an inactive account is refused a session,
  403). The owner UI itself removes accounts outright (hard delete) rather than deactivating.

## 3. What changed

### API
- **`shared/lib/permissions.ts`** — `staff` role + `STAFF_PERMISSIONS`; new `effectiveOwnerId()`.
- **`features/auth/auth.model.ts`** — `parentOwnerUserId` + `isActive` on `User`.
- **`features/auth/auth.controller.ts`** — token + `/me` payload carry `parentOwnerId`/`parentOwnerUserId`/`isActive`; **login rejects deactivated accounts (403)**.
- **`shared/lib/jwt.ts`** — `parentOwnerId` on `TokenPayload`.
- **`features/roles/roles.controller.ts`** — seed metadata for the `staff` role ("Venue staff").
- **`features/staff/` (new slice)** — `staff.controller.ts` + `staff.routes.ts` (no model; reuses `User`):
  - `POST /api/v1/staff` — create a staff account (owner → under self; admin → `?ownerUserId`).
  - `GET /api/v1/staff` — list the owner's staff (admin may pass `?ownerUserId`).
  - `PATCH /api/v1/staff/:id` — rename / reset password / toggle `isActive`.
  - `DELETE /api/v1/staff/:id` — **remove** the account outright (hard-deletes the login;
    scoped to staff sub-accounts only). The owner UI uses Remove (with a confirm), not deactivate.
  - All gated by `owner.staff.manage`; non-admins scoped to their own staff via `effectiveOwnerId`.
- **Scoping honored:** `venues.controller.ts` (`requireVenueOwner`, `getVenueManagerRole`,
  `listVenues` managed-mode + `viewerStaffRole`) and `clubs.controller.ts` (`isHostOf` /
  `canViewClub` made staff-aware) now resolve ownership via `effectiveOwnerId`. Bookings come
  along for free (the owner inbox is venue-scoped).

### App (PWA)
- **`features/owner/hooks/useOwnerDashboard.ts`** — the owner console now loads
  `listManagedVenues` (`?managedByUserId=self`, resolved server-side via `effectiveOwnerId`)
  instead of `listOwnerVenues` (`?ownerUserId=self`). This was the bug that made a staff
  member see **0 venues** (they own none) even though their owner has venues; managed-mode
  returns the owner's full set. `OwnerVenuesScreen` hides Create/Claim for staff (no permission).
  Also: `listVenues` now sends the auth token (`auth: true`) — the `managedByUserId` filter is
  self-only and 403s without it, so the whole owner/staff dashboard would otherwise fail to load
  (safe for guests: the endpoint is optionalAuth and only reads the token for the self-check).
- **`features/owner/OwnerStaffScreen.tsx` (new)** — `/owner/staff`: list staff, add account
  (name/email/temp password), reset password, **remove** (with an inline confirm). Gated by `owner.staff.manage`.
- **`OwnerProfileScreen.tsx`** — new **"Staff"** row in the Manage section (the requested
  `/profile` entry point); role pill/label now reflect the real role (a staff member sees "Staff").
- **`shared/lib/api.ts`** — `StaffAccount` type + `listStaffAccounts`/`createStaffAccount`/
  `updateStaffAccount`/`removeStaffAccount`.
- **`shared/lib/permissions.ts` + `roleDisplay.ts`** — `staff` role synced + ranked/labelled.
- **`navigation.ts` + `App.tsx`** — `owner-staff` screen, path, parser, `SCREEN_PERMISSIONS`
  (`owner.staff.manage`), auth intent.

## 4. Permissions / `/lists` / FILEMAP
- **No new permission key** — reuses `owner.staff.manage` (already on owner + admin). The new
  `staff` **role** is added to all three permission copies (api/app/web) + seeded to the DB.
- **API routes added:** `GET/POST /api/v1/staff`, `PATCH/DELETE /api/v1/staff/:id` — all in `/lists`.
- **FILEMAP:** updated (api `staff/` slice + `effectiveOwnerId`; app `OwnerStaff` screen).

## 5. Verification (curl, live API)
- Owner login → manages **7 venues**. Create staff → `parentOwnerUserId` set ✓
- Owner lists staff (1) ✓
- Staff login → role `staff`, `parentOwner` set, **has** `owner.access`, **lacks**
  `owner.staff.manage` + `owner.venues.create` ✓
- Staff lists managed venues → **same 7**, `viewerStaffRole: 'owner'` ✓ (`?ownerUserId=self`
  returns 0 — confirming why the console must use managed-mode, now fixed in `useOwnerDashboard`)
- Staff reads an owner venue's bookings inbox → **200** ✓
- Staff views + **edits the owner's private club** (`isHost: true`, PATCH **200**) ✓
- Staff create venue → **403**; staff create staff → **403** ✓
- Owner **removes** staff → account gone from DB, removed staff login → **401** ✓
- `staff` role seeded in DB (label "Venue staff", 29 perms) ✓
- **QA regression caught + fixed:** the owner/staff dashboard fetches `?managedByUserId=self`
  (self-only). With the token it returns 7 venues; without it → **403** ("Couldn't load your
  venues" for owners *and* staff). Fixed by having `listVenues` send `auth: true`. Re-verified
  both owner and staff load the dashboard.
- API typecheck, app build, web build, scoped ESLint — all clean.

## 6. Commit status
- **Not yet committed.** Spans `api/` (new role, staff slice, scoping) + `app/` (owner staff
  screen + profile entry) + the `web/` permission sync and roadmap entry. Ready to commit on request.
