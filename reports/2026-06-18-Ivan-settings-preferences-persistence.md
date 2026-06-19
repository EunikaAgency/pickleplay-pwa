# Task Report — v2.1 Settings: persist account preferences (shell → full)

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
