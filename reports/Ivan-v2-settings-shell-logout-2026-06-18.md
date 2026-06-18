# Task Report — v2.1 Settings shell + logout path

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
