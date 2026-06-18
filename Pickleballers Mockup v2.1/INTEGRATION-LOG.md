# Pickleballers Mockup v2.1 — Integration Log

Running history of integrating this static mockup into the live PWA (`app/`) as a
toggleable **v2.1** player design. Newest entries at the top of the Changelog.

---

## ⏮️ Restore point (read this first)

**Backup commit:** `0ebb9a4` — _"backup before integrating Pickleballers Mockup v2.1"_
(pushed to `origin/main`, EunikaAgency/pickleplay-pwa).

This commit captures the repo **before any integration work**. All integration work
lands in **new commits on top of `0ebb9a4`**. To get back to exactly this clean state:

```sh
git reset --hard 0ebb9a4
```

> ⚠️ `git reset --hard` discards uncommitted changes and any commits after `0ebb9a4`
> on your current branch. Stash or branch first if you want to keep in-progress work.

---

## 🎯 Goal

Add a third option — **v2.1** — to the existing floating design toggle
(`.home-design-switch …` in `app/src/features/home/`) so the whole **player side**
(Home, Nearby, Games, Clubs, Profile, Create Game/Club) can flip to this mockup's
redesign, **wired to live data**.

**Decisions locked in:**
- Scope: all player tab screens **+** create flows.
- Data: live API (existing `app/src/shared/lib/api.ts`); demo-only metrics (win rate,
  rank, streak, recent matches) stay demo, as the current screens already treat them.
- Look: full new fonts (Lexend + Grandstander) + tokens, **scoped under `.pb-v2`** so
  `New`/`Classic` keep today's brand untouched.
- Create Game: mockup styling on top, real venue-first book→pay→create flow underneath.
- Gating: ungated, matching the existing reviewer toggle (no new permission).

Full plan: `~/.claude/plans/wait-im-very-sorry-snuggly-beaver.md`

---

## 📋 Work checklist

Infra
- [x] `app/src/shared/lib/playerDesign.ts` — design store (`new|classic|v2`, persisted)
- [x] `app/index.html` — add Lexend + Grandstander to the Google Fonts link
- [x] `app/src/shared/styles/v2.css` (+ import in `index.css`) — mockup CSS scoped under `.pb-v2`
- [x] `app/src/features/home/DesignSwitch.tsx` — 3-way floating toggle (New · Classic · v2.1)
- [x] `app/src/shared/components/layout/V2Chrome.tsx` — v2 top nav, bottom tab bar, FAB, `V2Shell`
      (moved to `shared/` since multiple slices import it — shared-only rule)
- [x] `app/src/App.tsx` — read design state, suppress old chrome in v2, mount toggle, branch screens
- [x] `app/src/features/home/HomeScreenSwitch.tsx` — toggle removed; now only picks New vs Classic Home

Screens (live data, mockup markup)
- [x] HomeScreenV2 — `app/src/features/home/v2/`
- [x] NearbyScreenV2 — `app/src/features/venues/v2/`
- [x] GamesScreenV2 — `app/src/features/games/v2/`
- [x] ClubsScreenV2 — `app/src/features/clubs/v2/`
- [x] ProfileScreenV2 — `app/src/features/profile/v2/`
- [x] CreateGameV2 — `app/src/features/games/v2/` (mockup look, real book→pay→create flow)
- [x] CreateClubV2 — `app/src/features/clubs/v2/`

Wrap-up
- [x] `app/FILEMAP.md` — index new `v2/` folders + files
- [x] `npm run build` clean (`tsc -b && vite build`); lint shows only 2 v2 findings that
      match the existing codebase pattern (`react-hooks/set-state-in-effect`, same as
      `GamesScreen`/`CreateGameScreen`)
- [ ] **Pending:** visual QA in the browser (toggle + each tab in v2 with live data;
      confirm New/Classic unchanged); commit + push

### ⚠️ Known gaps / follow-ups
- ~~**v2 Nearby is NOT distance-based.**~~ ✅ Fixed 2026-06-17 — see changelog (Distance is
  now the default sort, geolocation-ranked).
- **Profile stats are demo.** The win-rate / activity / recent-matches blocks on
  `ProfileScreenV2` show **static placeholder numbers** — the API exposes no player
  win/loss/rank/streak data yet, same as the v1 Profile. Wire to a real stats endpoint when
  one exists. (Home's old fake stats banner was replaced by the real "Up next" card.)

---

## 📝 Changelog

### 2026-06-18 — v2 Settings shell + logout path
- The v2 Profile gear used to open the **v1** `SettingsScreen` (v1 chrome, no v2 top
  nav) — a jarring break from the redesign. Added `features/profile/v2/SettingsScreenV2.tsx`,
  a `V2Shell`-wrapped settings screen reusing the `v2-profile` style scope (the mockup
  kept its `.settings-*` list inside Profile.html, so those classes already live under
  `.pb-v2.v2-profile`). Contents: an Appearance theme picker (light/dark/system via
  `useTheme`), Account rows (Edit Profile, Notifications with a live unread badge), and a
  destructive **Log Out** row wired to App's `handleLogout` (clears session → guest home).
- `App.tsx` `settings` case now branches on `playerV2` (v2 screen vs the v1 one); v1
  `SettingsScreen` still serves New/Classic. `FILEMAP.md` v2 listings updated.

### 2026-06-17 — Fix: v2 Nearby venue photos rendered white
- Bug: `NearbyScreenV2` set `style={{ ...thumbStyle, background: hasImg ? undefined : gradient }}`.
  React applies an undefined **shorthand** as `style.background = ''`, which wiped the
  `backgroundImage` that `thumbStyle` had just set → valid venue photos showed as a blank
  white box. Fix: `thumbStyle(v, fallback)` now always returns a `backgroundImage` (photo or
  gradient) and the `background` shorthand is gone. Venue/court images now render; missing
  images fall back to a gradient (never white).

### 2026-06-17 — Home "Up next" banner replaces the static stats banner
- `HomeScreenV2`'s fake "You're on a roll!" wins/rating/rank banner is gone. In its place
  a real, state-aware card: the player's **soonest upcoming game or court booking**
  (`listGames({mine:true})` + `listBookings()`, soonest via `pickNextCommitment`, with a
  relative "Up next · In 2 hr" eyebrow + View CTA → game-details / my-bookings). No
  commitment → a "Find a game" prompt (uses the live open-games count); guests → a
  "Join the community" CTA via `requireAuth`. Helpers inlined (home must not import the
  games slice). Removes the last fabricated numbers from the v2 Home.

### 2026-06-17 — v2 Nearby is now distance-based (default sort = Distance)
- `NearbyScreenV2` now fetches the full venue set (`listAllVenues`), auto-requests the
  user's location on mount (`shared/lib/geo.ts` `getCurrentLocation`), and **defaults the
  sort to Distance** — nearest-first via `haversineKm` + `venueCoords`, with a distance
  label on the featured card + each row (`formatDistance`). Falls back to Rating when
  location is denied/unavailable (with a "Turn on location" retry button). List capped to
  nearest/top 30 to bound image loads. Respects `player.venues.locate` (guests may locate).
- Note on photos: venues without a usable image still show a gradient — e.g. Courtside
  Amore's `mainImageUrl` is an Instagram link, which `apiImageUrl` rejects. Distance default
  means a real nearby venue (with a photo) becomes the Top Pick instead.

### 2026-06-17 — Game-card images (court → venue fallback)
- v2 game cards (Home "Discover Games" + featured, Games tab) now show the **booked
  court's photo**, falling back to the **venue image**, gradient if neither.
- API (`api/src/features/games/games.controller.ts`): game serializer now deep-populates
  `bookingId → courtId → mainImageUrl` and exposes `courtImage` on each game. Restarted
  `pickleballer-api`. App: `ApiGame.courtImage` added; `gameImage()` helper in
  `HomeScreenV2`/`GamesScreenV2` resolves court→venue via `apiImageUrl`.

### 2026-06-17 — Universal header back button (history-based)
- The v2 universal header (`V2TopNav`/`V2Shell`) now shows a left **back arrow** wired to
  the app's existing absolute history stack (`App.tsx` `goBack`/`history`). Shown only when
  there's somewhere to go back to; tab switches count (pure chronological). Create wizards
  keep their own step-aware back.
- Files: `App.tsx` (added `onBack`/`canGoBack` to the v2 chrome bundle),
  `shared/components/layout/V2Chrome.tsx` (`V2ScreenChrome` + `V2Shell` effective-back).

### 2026-06-17 — v2.1 integration implemented (not yet committed)
- Added the app-wide design store + 3-way floating toggle (**New · Classic · v2.1**);
  v2.1 swaps the whole player side to the redesign, wired to the live API.
- New: `playerDesign.ts`, `v2.css` (scoped under `.pb-v2.v2-<screen>`, ~110 KB auto-ported),
  `DesignSwitch.tsx`, `V2Chrome.tsx` (V2Shell/TopNav/TabBar/Fab), and 7 v2 screens under
  `features/*/v2/`. Edited `App.tsx`, `index.html`, `index.css`, `HomeScreenSwitch.tsx`,
  `FILEMAP.md`. Fonts (Lexend + Grandstander) added.
- `npm run build` clean. Owners are excluded (gated by `!owner.access`).
- Next: browser QA, then commit on top of `0ebb9a4`.

### 2026-06-17 — Backup baseline
- Committed the `Pickleballers Mockup v2.1/` folder (22 files, 7.2 MB) as commit
  `0ebb9a4` and pushed to `origin/main`. This is the restore point above.
- Plan approved; no integration code written yet.

<!-- Add new entries above this line as work progresses:
### YYYY-MM-DD — <short title>
- commit `<hash>` — what changed / why
-->
