# Ivan Report — 2026-07-01 (Part 2): Staff Scope, Club Staff & Custom Amenities

## 1. Staff — Per-Venue Access Fix (Breaking Change)

**Before:** Staff accounts created at `/owner/staff` inherited the owner's full portfolio via `parentOwnerId` in the JWT. `effectiveOwnerId()` resolved to the owner's ID, granting staff access to ALL venues, bookings, clubs, and games — without any per-venue assignment.

**Now:** Staff accounts start with ZERO venue access. They must be explicitly added to individual venues through each venue's Staff tab, which creates `VenueStaff` rows. The `parentOwnerId` is removed from the JWT entirely — staff permissions come only from `VenueStaff` assignments.

### What changed

| Layer | File | What |
|-------|------|------|
| API | `auth/auth.controller.ts` | Removed `parentOwnerId` from JWT payload (`tokenPayloadFor`). The field stays on the User doc only for `listStaff` queries |
| API | `staff/staff.controller.ts` | Updated module comment — no longer "manage ALL venues" |
| API | `permissions.ts` | `effectiveOwnerId()` now returns staff's own ID (no `parentOwnerId` in token) |
| PWA | `OwnerStaffScreen.tsx` | Updated subtitle, comment, and info banner — now says "add to specific venues" |
| PWA | `StaffEditorTab.tsx` | Search now uses `searchOwnerStaff` (owner-scoped) instead of `searchPlayers` (global) |

### Verified
- ✅ Staff JWT has `parentOwnerId: null`
- ✅ `listVenues?managedByUserId=<staffId>` returns 0 venues for unassigned staff
- ✅ Staff can only access venues where they have a `VenueStaff` row
- ✅ Clubs: `isHostOf` returns false for staff without `parentOwnerId`
- ✅ Staff see public clubs normally (same as players)

---

## 2. Per-Venue Staff Tab — Staff-Only Search + On-Focus Suggestions

**Before:** The "Find a person" search in the Staff tab used `searchPlayers`, which returned ALL users in the system (players, coaches, anyone). No suggestions on focus.

**Now:** Search is scoped to staff accounts created by this owner only. On-focus auto-suggests all owner's staff.

### What changed

| Layer | File | What |
|-------|------|------|
| API | `search/search.controller.ts` | Added `ownerUserId` query param. When set with `type=players`, filters to `roleDefault:'staff'` + `parentOwnerUserId` match. `q` made optional — empty query returns all staff of that owner (on-focus suggestions). Limit: 30 for staff search, 10 for regular. Added `isStaff` boolean to results |
| PWA | `api.ts` | Added `searchOwnerStaff(ownerUserId, q?)` function |
| PWA | `StaffEditorTab.tsx` | Uses `searchOwnerStaff` instead of `searchPlayers`. `onFocus` handler loads suggestions. Placeholder: "Search your staff accounts…". Empty state: "No matching staff found. Create staff accounts in Owner → Staff first." Added "No staff yet? Create one in Owner → Staff" link |
| PWA | `OwnerVenueScreen.tsx` | Passing `onNavigate` to `StaffEditorTab` for the link |

### Verified
- ✅ On-focus with empty field: returns all staff of this owner
- ✅ Typed search: returns only matching staff of this owner
- ✅ Regular users/players never appear in results

---

## 3. Club Staff — Per-Club Staff Assignment

**Before:** No per-club staff assignment existed. Staff inherited the owner's full club portfolio via `parentOwnerId` → `isHostOf`.

**Now:** Club hosts can assign staff to specific clubs as moderators. Club staff can moderate posts and members but cannot delete the club or manage other staff.

### What changed

| Layer | File | What |
|-------|------|------|
| API | `clubs/clubs.model.ts` | New `ClubStaff` model: `clubId`, `userId`, `staffRole` (default: 'moderator'), `status`. Unique index on `(clubId, userId)` |
| API | `clubs/clubs.controller.ts` | Added `isClubStaff()`, `canModerateClub()` (host OR staff). Added `getClubStaff`, `addClubStaff`, `removeClubStaff` handlers. Updated `listClubs` `mine` to include ClubStaff clubs. Updated `serializeClub` to include `isStaff`. Updated moderation gates: edit club, remove member, moderate posts now allow ClubStaff. Delete club and manage staff remain host-only |
| API | `clubs/clubs.routes.ts` | Added `GET/POST /:id/staff`, `DELETE /staff/:id` (declared before bare `/:id`) |
| PWA | `api.ts` | New `ApiClubStaff` type. `isStaff` on `ApiClub`. `listClubStaff`, `addClubStaff`, `removeClubStaff` functions |
| PWA | `ClubDetailsScreen.tsx` | Staff section in About tab (host-only): list current staff with role badges + Remove, search owner's staff accounts via `searchOwnerStaff` with focus suggestions, add as moderator |

### API routes
| Method | Path | Gate |
|--------|------|------|
| GET | `/clubs/:id/staff` | Host only |
| POST | `/clubs/:id/staff` | Host or `owner.staff.manage` |
| DELETE | `/clubs/staff/:id` | Host or `owner.staff.manage` |

### Verified
- ✅ Host creates club → adds staff → staff appears in list
- ✅ Staff's `mine: true` clubs list includes assigned club with `isStaff: True`
- ✅ Staff can moderate posts/remove members (via `canModerateClub`)
- ✅ Staff cannot delete club (host-only gate preserved)
- ✅ Staff cannot view/manage other staff (host-only gate preserved)
- ✅ Duplicate add blocked (409)
- ✅ Reactivating inactive staff assignment works

---

## 4. Custom Amenities — ListingEditorTab

**Before:** 13 preset amenity toggles only. No way to add custom amenities.

**Now:** Custom amenities TagField below presets in the Amenities section.

### What changed

| Layer | File | What |
|-------|------|------|
| API | `venues/venues.model.ts` | Added `customAmenities: [String]` to Venue interface + schema |
| API | `venues/venues.controller.ts` | Added `customAmenities: z.array(z.string()).max(20).optional()` to `updateVenueSchema` |
| PWA | `api.ts` | Added `customAmenities?: string[] \| null` on `ApiVenue` |
| PWA | `venueDisplay.ts` | `venueAmenities()` now merges boolean flags + `customAmenities` (not override) |
| PWA | `ListingEditorTab.tsx` | `TagField` for custom amenities below preset chips. Placeholder: "e.g. Ball machine, Locker room, etc." Updated description |

### Verified
- ✅ Custom amenities saved and returned in venue detail
- ✅ Player-facing Court Details shows custom amenities alongside presets
- ✅ 20-item max enforced by Zod schema

---

## 5. CSV & Test Guide Updates

| File | Change |
|------|--------|
| `TASKS/Copy of Standardised Pickleballers - Pickleballers Questions.csv` | Row 43 (curated highlights) → Done. Row 49 formatting fixed. Row 53 removed |
| `TASKS/test-guide.md` | Added test paths for custom amenities, staff per-venue, staff tab search, club staff |
| `TASKS/demo-tour-guide.md` | Added sections 28 (staff per-venue), 29 (club staff), 30 (custom amenities) |

---

*Generated 2026-07-01. Covers all changes between 14:00–16:00 PHT.*
