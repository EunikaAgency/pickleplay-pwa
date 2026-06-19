# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
npm run dev      # Start Vite dev server on port 9000
npm run build    # TypeScript check + Vite build
npm run lint     # ESLint all source
npm run preview  # Preview production build
```

The app runs at `http://localhost:9000`. API requests to `/api/*` are proxied to `http://localhost:9002` (the sibling Hono/MongoDB API at `/var/public/pickleplay/api`).

## Architecture

**Mobile-first React PWA** for finding pickleball games, courts, clubs, and players.

### Stack
- React 19 + TypeScript 6 + Vite 8
- Tailwind CSS v4 (via `@tailwindcss/vite` plugin)
- Zustand 5 — used for auth/session state (`shared/lib/authStore.ts`); everything else is local `useState` in `App.tsx` and per screen
- Leaflet / react-leaflet for map views
- Google Material Symbols Outlined for icons (loaded as a Google Font; wrapped by `shared/components/ui/Icon`)
- vite-plugin-pwa with Workbox (map tile runtime caching) + custom `pwaUpdate.ts` for service-worker auto-update
- Fonts: Fredoka (headings), Nunito Sans (body) via Google Fonts
- PM2 ecosystem config for production process management

### Navigation
Custom screen-stack system in `App.tsx`. Each screen is a discriminated union `Screen` with an `id` and optional `params`. The `navigate()` function pushes the current screen onto a history stack; `goBack()` pops it. Five tab screens (home, nearby, games, clubs, profile) use `activeTab` state. Non-tab screens show a back arrow rendered by the screen itself.

The cold-start entry point is **LandingScreen** (a marketing/welcome surface). Tapping "Get Started" or "Sign In" navigates to **LoginScreen**. Logout returns to LandingScreen, not LoginScreen.

### Architecture — feature-based vertical slices

Code is organised by **feature**, not by technical layer. Every feature owns its screens and any feature-specific UI (filter sheets, forms). Cross-feature UI primitives, hooks, types, and the global stylesheet live in `shared/`.

```
src/
  App.tsx                          # Composition root: screen-stack nav + chrome wiring
  main.tsx                         # Entry point
  pwaUpdate.ts                     # Service-worker auto-update registration

  features/
    auth/                          # Unauthenticated/cold-start flow
      LandingScreen.tsx
      LoginScreen.tsx
      OnboardingScreen.tsx
    home/
      HomeScreen.tsx
    games/
      GamesScreen.tsx
      GameDetailsScreen.tsx
      CreateGameScreen.tsx
      InvitePlayersScreen.tsx
      GameFilterSheet.tsx
    venues/                        # "Nearby" tab + court detail (matches web/'s naming)
      NearbyScreen.tsx
      CourtDetailsScreen.tsx
      NearbyFilterSheet.tsx
    clubs/
      ClubsScreen.tsx
      ClubDetailsScreen.tsx
      CreateClubScreen.tsx
    profile/                       # User dashboard (analog of web/'s `my/`)
      ProfileScreen.tsx
      EditProfileScreen.tsx
      SettingsScreen.tsx
      NotificationsScreen.tsx
    search/
      SearchScreen.tsx

  shared/
    components/
      layout/                      # TabBar (mobile), Sidebar (desktop)
      ui/                          # Icon, Avatar, Button, Card, Chip, BottomSheet,
                                   # CompletionScreen, CourtIllustration, DemoBranch,
                                   # DemoStateControl, DuprExplainerSheet, EmptyState,
                                   # ErrorState, GameRow, InstallPrompt, LoadingSkeleton,
                                   # OfflineBanner, ProgressBar, ScreenHeader, Segmented,
                                   # Toast
      forms/                       # FormField, FormSelect, FormTierPicker
    hooks/
      useForm.ts                   # Generic form state + validation helper
      usePrefersReducedMotion.ts   # Respects OS reduce-motion preference
      useTheme.ts                  # Theme application
    lib/
      types.ts                     # Court, User, Game, Club, Message interfaces
      authStore.ts                 # Zustand auth/session store (user, login/logout/restore)
      api.ts                       # API client: auth (+token storage, toAppUser) + venues/courts
      venueDisplay.ts              # Venue formatters: price/location/tags/amenities/mapsUrl
      permissions.ts               # Roles → permissions, AppUser, userHasPermission, firstNameOf
      navigation.ts                # Screen union, ScreenId, tabScreens, Navigate
      initials.ts                  # getInitials(name) helper
      demoState.tsx                # DemoStateProvider + useDemoState
      skillTiers.ts                # Skill-tier definitions and helpers
    styles/
      index.css                    # Tailwind directives + global styles + design tokens
```

#### Adding a new screen or feature — checklist

1. **Pick the slice.** If it belongs to an existing feature, add `<NewName>Screen.tsx` inside `src/features/<feature>/`. Otherwise create `src/features/<new-feature>/` and put it there.
2. **Mount it in [src/App.tsx](src/App.tsx)** — the composition root. Add the screen to the `Screen` discriminated union, import it as `'./features/<feature>/<NewName>Screen'`, and add the `case` to `renderScreen()`.
3. **Cross-feature imports go via the shared layer:**
   - UI primitives: `'../../shared/components/ui/Icon'`, `'../../shared/components/ui/Button'`, etc.
   - Layout chrome: `'../../shared/components/layout/TabBar'`.
   - Forms: `'../../shared/components/forms/FormField'`.
   - Hooks: `'../../shared/hooks/useForm'`.
   - Types: `'../../shared/lib/types'`.
4. **Feature-specific UI stays in the feature.** Filter sheets, feature-only components, and feature-scoped hooks live next to the screens that use them and import as `'./<Sibling>'`.
5. **No deep relative paths** like `'../../../...'`. Three `..`s means a layer should be crossed via `shared/`.
6. **Don't reintroduce `src/screens/`, `src/components/`, `src/hooks/`, or `src/lib/`** at the top level — those flat dirs were removed during the vertical-slice migration.
7. **`npm run build` must stay clean.** Run it after structural changes to catch broken imports.

### Data types
Defined in [`src/shared/lib/types.ts`](src/shared/lib/types.ts): `Court`, `User`, `Game`, `Club`, `Message`. These represent the domain model used across screens. Most screen data is still inline/demo content. The wired-to-API exceptions are **auth** (see the next section) and **venues/courts** (the "Courts" tab): `NearbyScreen` and `CourtDetailsScreen` fetch from `/api/v1/venues` via `api.ts` (`listVenues`/`getVenue` → `ApiVenue`/`ApiVenueDetail`), with formatting in `venueDisplay.ts`. Real venue data is sparse (lat/lng, ratings, amenities are often null), so both screens degrade gracefully and own their loading/error/empty states (DemoBranch still overrides for reviewer modes). The list **paginates** with the API's cursor — 20 per page via a "Load more" button (`listVenues` returns `{ items, cursor }`; pass `cursor` for the next page). Venue **images** come from the API's media-derived `image` field (list + detail); only ~20 seeded venues have one, so cards fall back to a gradient. Court detail screens are mounted with `key={id}` so they remount per venue. The court-detail **location card** renders a real Leaflet map at the venue's coords (`venueCoords`), and the **"Games here"** list is wired to `listGames({ venueId })` — both formerly demo.

### Auth & the current user
- **`shared/lib/api.ts`** is the auth API client: `login`/`logout`/`fetchCurrentUser` hit `POST|GET /api/v1/auth/*`, tokens are stored in `localStorage` (`pb-access-token`/`pb-refresh-token`), and `toAppUser()` maps the API payload onto the app's `AppUser`. Base URL is relative in dev (Vite proxies `/api` → `:9002`); set `VITE_API_BASE_URL` for prod.
- **`shared/lib/authStore.ts`** is a Zustand store holding `user` + `isLoggedIn` and the `login`/`logout`/`restore` actions. **Screens read the current user directly** via `useAuthStore((s) => s.user)` — do not pass the user through props. `App.tsx` calls `restore()` on mount and still owns navigation + permission gating (`userHasPermission(currentUser, …)`).
- Identity fields (name, avatar, skill/DUPR, bio) render from the real user; profile **stats** (win rate, games, streak, achievements) are still demo data because the API doesn't expose them. `EditProfileScreen` prefills from the user and **saves to the account** via `authStore.updateProfile()` → `PATCH /me` (name/bio/skill tier; the picker tier maps to a numeric `skillLevel` via `duprForTier`). The free-text **Location** field is not persisted yet — the user model only has a `homeCityId` ref, not a free string.
- **Onboarding is remembered on the account.** The user model carries a `hasOnboarded` flag (exposed on `/me`). `OnboardingScreen` calls `authStore.completeOnboarding()` (→ `PATCH /me { hasOnboarded: true, … }`, best-effort) when the user finishes/skips, saving their skill tier too. `App.tsx` shows onboarding after login only when `!user.hasOnboarded`, so returning users are never re-onboarded (across devices/reloads).

### Key patterns
- Screens receive `onNavigate` for navigation and `onBack` for going back. A few also accept entity IDs as props (e.g. `gameId`, `courtId`, `clubId`).
- The `Icon` component wraps Material Symbols Outlined, supporting `filled`, `weight`, and `size` props via CSS `fontVariationSettings`.
- Tailwind classnames are inline; no CSS modules or styled-components.
- The TabBar renders five fixed bottom tabs and also receives an `onCreate` handler — the create action is inlined into the tab bar (no separate FAB). It is shown only on tab screens when logged in.
- Chrome visibility (TabBar only) is controlled by a `hideChrome` allowlist in App.tsx (`['landing', 'onboarding', 'login']`).
- Filter UIs are bottom sheets opened over the current screen via the shared `BottomSheet` primitive — they do not push onto the navigation stack.
- Loading states use `LoadingSkeleton` (layout-shaped placeholders), not a centered spinner.
- The `DemoStateProvider` wraps the app so any reviewer can switch between normal/empty/loading/error/offline modes at runtime via the `DemoStateControl` widget. The `OfflineBanner` shows when offline mode is selected or the browser reports offline.

### Reference assets
The visual source of truth for the latest mobile redesign lives under [`app/Redesign/`](./Redesign/): a JSX prototype (`app.jsx`), `ios-frame.jsx` wrapper, `screens-tabs.jsx`, `screens-detail.jsx`, shared `components.jsx`, `icons.jsx`, a `tweaks-panel.jsx` for live design tweaking, a self-contained `PickleBallers.html` showcase, and source PNG illustrations. Match against this folder when polishing the implementation.

---

## Keeping the public roadmap current

The product's public progress page lives at **https://pickleballer.eunika.xyz/roadmap** and is rendered from `/var/public/pickleplay/web/src/features/marketing/RoadmapPage.jsx` in the sibling web/ project. **Whenever you finish a meaningful task in this PWA — new screen, removed screen, big refactor, lifecycle change — you must update that roadmap as part of the same work**:

1. Edit `/var/public/pickleplay/web/src/features/marketing/RoadmapPage.jsx`.
2. Update the `Last updated:` string in the hero (~line 81) to today's date.
3. Prepend a new entry at the top of the Change Log array (~line 970): `{ date: 'YYYY-MM-DD', change: '…' }`.
4. If the task touches the screen inventory (added/removed/renamed screens or sheets), update the relevant Section tables (Existing Screens, Screen list — before vs after, etc.) so the roadmap stays truthful.
5. If a phase status changes (e.g. Phase 2 going from `status="active"` to `status="done"`), update the relevant `TimelineItem`.
6. The web project is in the same git remote as this one (parent monorepo `EunikaAgency/pickleplay-pwa`), so a single commit at the parent level can include both your app/ change and the roadmap update.

Skipping the roadmap update is treated like skipping a test: the work isn't done.

> Editing the web-repo roadmap from `app/` is the **single sanctioned exception**
> to the frontend-isolation rule (`../AGENTS.md` → "Stay in your lane") — only
> `web` can render it. Don't touch any other `web` file from an app task.

---

## Keeping the API endpoint catalogue (`/lists`) current

If your work adds, removes, or changes an API route (in the sibling `api/`
repo), you must also update the endpoint catalogue at
**https://pickleballer-api.eunika.xyz/lists** so it never drifts from what the
API exposes. Source: `api/src/features/root/root.controller.ts` →
`listEndpoints()`; see `api/CLAUDE.md` for the full checklist. Skipping it is
treated like skipping a test: the work isn't done.

---

## Keeping the file-map (`FILEMAP.md`) current

[`FILEMAP.md`](FILEMAP.md) is this repo's file-map — skim it before scanning
`src/`. **Whenever you add, remove, rename, or move a file/folder, or change a
file's primary responsibility, update it in the same change** (the directory
tree comments, the key-modules list, and the "Where to look first" table). Don't
touch it for logic-only edits that don't change what a file is for. Full rule +
rationale: [`../AGENTS.md`](../AGENTS.md) → "Keep the file-map (`FILEMAP.md`)
current". Skipping it is treated like skipping a test: the work isn't done.

---

## Change History

| Date | Change |
|---|---|
| 2026-06-19 | **v2.1 "Game On" create flow — join a game or host a lobby on a booked court.** The home Create-Game button (and FAB) is relabelled **Game On** and now opens a chooser instead of jumping straight to the form. New `features/games/v2/CreateChoiceSheet.tsx` (an app-level `BottomSheet`, mounted in `App.tsx`; `handleCreate` opens it for `playerV2`, classic/New keep the direct form): **Join a game** → Games browse/discover; **Host a lobby** → loads the user's **hostable bookings** (`listBookings` filtered to non-cancelled, upcoming, not-already-hosted via `listGames({mine:true})` `bookingId`s) and lets them pick one — or, with none, routes to **Nearby** to book first. `CreateGameV2` was **reworked from venue-first pay-to-book to lobby-on-booking**: it takes a `bookingId`, loads the reservation (`getBooking`), locks venue/date/time as a read-only "Your booked court" card, drops the court picker + date/time pickers + payment (no more `createBooking`/`checkout`), and submit is just `createGame({ bookingId, … })` (booking + payment now happen up-front in the Book flow). **Seamless hand-off** for the no-booking path: a new `intent: 'lobby'` param threads `nearby` (shows a "Select a court to book — you'll set up your lobby right after" banner) → `court-details` ("Book & set up lobby" CTA) → `book-court` (its confirmation leads with **"Create your lobby"**, replacing into `create-game` with the fresh `bookingId`). The `Navigate` type was generalised to support **optional** screen params (so `nearby` is callable both bare as a tab and with `{intent}`) via a single conditional-rest-tuple signature (replacing the two-overload `ScreensWith/WithoutParams`). No new permission — Join reuses browse/join, Host reuses `player.games.create` + `player.bookings.create` (no new capability). No API/`/lists` change (uses existing `getBooking`/`createGame`/`listBookings`). |
| 2026-06-19 | **v2.1 Nearby keeps the user's location in view, and tapping the map focuses on it.** `features/venues/v2/NearbyScreenV2.tsx` — the list sheet overlaps the map's lower edge, so `FrameMap` now measures how many pixels of the map the sheet covers (`map.getContainer()` bottom vs the sheet's `getBoundingClientRect().top`) and feeds that as `paddingBottomRight` to `fitBounds`. Result: when the list is **open**, the user's "you are here" dot is framed in the *visible* strip above the list (previously it sat centred behind the sheet, hidden); when the list **collapses**, the user re-centres into the now-large visible map. The sheet's height transition (300ms) drives a re-frame via a `transitionend` listener so the map pans in sync as the list opens/closes. New `CollapseOnMapClick` (`useMapEvents({ click })`) dismisses the list when the user taps the visible map — which, through the same re-frame, recentres on their location; it's a no-op when the list is already collapsed so the map pans freely. The nearest-court popup now opens only when the list is collapsed (map focused), keeping the thin open-list strip clean. No new permission (refines the existing `player.venues.locate` flow), no API/`/lists` change, no FILEMAP change. |
| 2026-06-19 | **Animated launch splash on cold start.** New `features/auth/SplashScreen.tsx` (+ `splash.css`) — a self-contained React port of the standalone `pickleballers-splash.html` mockup: a pickleball is served into the PickleBallers wordmark, court lines + floating badges reveal behind it, then a circular wipe hands off to the app. Fully scoped under `.pb-splash` (generic class names + `splash-*` keyframes) so nothing leaks into app styles; the iOS phone-frame chrome from the mockup is dropped (the splash fills the app viewport). The animation logic is ported into one `useEffect` driven by a root `ref` + scoped `querySelector` (no global `id`s, StrictMode-safe). Mounted in `App.tsx` as a **once-per-session** overlay (sessionStorage `pb-splash-seen`) on top of everything — the app mounts behind it, so session restore runs during the intro. The app waits for the **"Let's Play"** CTA tap; the same component takes `auto`/`wide` props used by the web build (web auto-dismisses, full-width). Respects `prefers-reduced-motion` (skips to the brand). No new permission — it's a universal cold-start surface shown to guests too (like `LandingScreen`), so it isn't permission-gated. No API/`/lists` change. (Sibling `web/` got the matching splash in the same task per the explicit "apply on both" request.) |
| 2026-06-18 | **v2.1 Settings gains persisted search radius + profile privacy.** Two more account settings now save server-side: a default "Near me" **search radius** (preset 5/10/25/50, stored as `preferences.searchRadiusKm` in km, labelled in the user's unit) and **profile privacy** (`privacySetting`: public/friends/private). Both render as segmented controls in `features/profile/v2/SettingsScreenV2.tsx` and persist optimistically via `authStore.updateProfile()` (radius → `PATCH /me { preferences: { searchRadiusKm } }` dot-path-merged; privacy → top-level `PATCH /me { privacySetting }`), rolling back + showing the inline error on failure. `NearbyScreen` seeds its distance-cap filter from `currentUser.preferences.searchRadiusKm` (falls back to `DEFAULT_NEARBY_KM` for guests). Types threaded: `UserPreferences.searchRadiusKm` + `PrivacySetting` + `AppUser.privacySetting` in `shared/lib/permissions.ts`; `ApiUser.privacySetting`, `toAppUser` (`normalizePrivacy`), and `ProfileUpdate` in `shared/lib/api.ts`. API change (sibling `api/`): `searchRadiusKm` added to the `preferences` sub-doc (`auth.model.ts`), the `updateProfileSchema`, the `/me` payload (default 10), and the dot-path merge in `updateMe`; `privacySetting` was already supported. Verified end-to-end via curl (set/partial-merge/reset). No `/lists` change (route surface unchanged); no new permission (Settings is gated by `player.profile.manage`); no FILEMAP change (no responsibility shift). |
| 2026-06-18 | **Dark mode now applies to the v2.1 design (Appearance toggle works on all screens).** The `useTheme` toggle (Light/Dark/System → `data-theme` on `<html>`, per-device localStorage) only re-themed v1 screens; the v2.1 system in `shared/styles/v2.css` was authored light-only (each `.pb-v2.v2-<screen>` scope redefines the same neutral tokens, none keyed off `data-theme`), so most of the app ignored the setting. Added a dark palette (dark-navy, matching v1's `index.css` dark) appended to `v2.css` for both `[data-theme="dark"] .pb-v2` and `@media (prefers-color-scheme: dark) :root:not([data-theme="light"]) .pb-v2` (specificity ties/out-ranks the per-screen scopes; appended-last wins the tie). The overloaded `--ink` (used as **both** primary text **and** text-on-lime) is disambiguated: `--ink`/`--navy`/`--text-*` flip light; two stable tokens added — `--on-accent` (always dark, forced onto lime fills like `.v2c-join`/`.fab`/`.join-btn`/`.submit-btn`/etc. in the dark block) and `--ink-fill` (dark fills carrying light text: `.chip.active`, the `.pro-banner` gradient). Inline lime+`--ink` styles in `ProfileScreenV2`/`SettingsScreenV2`/`HomeScreenV2` switched to `--on-accent` (inline beats the CSS override). Theme stays **per-device & private** (localStorage; only the picker's own view changes). No new permission (Appearance is an existing control under `player.profile.manage`); no FILEMAP change (no responsibility shift); no API/`/lists` change. |
| 2026-06-18 | **v2.1 Settings now persists account preferences (shell → full).** `features/profile/v2/SettingsScreenV2.tsx` gained real, saved settings: a "Notify me about" section (game reminders / chat messages / announcements toggles) and a distance-units segmented control (km / mi). Changes apply optimistically and persist via `authStore.updateProfile()` → `PATCH /me { preferences }`, rolling the local mirror back + showing an inline error if the save fails. Theme stays client-side (`useTheme`/localStorage) as before. New shared `UserPreferences` type + `DEFAULT_PREFERENCES` live in `shared/lib/permissions.ts` (next to `AppUser`, which now carries `preferences`) so `api.ts` can reuse them without a circular import; `ApiUser`/`ProfileUpdate`/`toAppUser` thread preferences through. API change (sibling `api/`): a `preferences` sub-document on the user model (`auth.model.ts`), surfaced on `/me` with defaults, accepted by `PATCH /me` and **dot-path-merged** so a partial update never wipes sibling prefs. No `/lists` edit (route surface unchanged); no new permission (settings is already gated by `player.profile.manage`). |
| 2026-06-18 | **Player payment history + spend report.** New `features/profile/PaymentHistoryScreen.tsx` — reads the current user's real payments (`listPayments` → `GET /api/v1/payments`, self-scoped, no API change) and renders a report: total-spent / this-month KPIs, a **6-month spend bar chart** (`shared/components/ui/Chart.tsx` `BarChart`, paid vs pending segments), and a receipts list tagged Paid/Pending/Refunded. Both `'completed'` and seeded `'paid'` count as paid spend. Entry rows added to `ProfileScreen.tsx` (Activity menu) and `v2/ProfileScreenV2.tsx` (Account settings list), both gated by the new **`player.payments.view`** permission (synced to api/web copies + `PERMISSION_CATALOGUE` + player role default; resolved client-side so existing players get it on next login). Screen registered in `navigation.ts` + `App.tsx` (`SCREEN_PERMISSIONS`/`SCREEN_AUTH_INTENT`). Money/status formatters inlined locally (profile slice must not import the bookings slice). Brings the app to parity with web's `/dashboard/payments`. |
| 2026-06-08 | **Court detail's last two demo pieces wired live.** `CourtDetailsScreen`'s **location card** now renders a real (non-interactive) Leaflet map centred on the venue's coordinates (`venueCoords`) with a marker — falling back to the old decorative pin box only when a venue has no lat/lng. Its **"Games this week"** block (a hardcoded 3-game array all linking to game id `1`) is replaced by a live **"Games here"** list from `listGames({ venueId })`, with loading/empty/error states; small game-row formatters are inlined locally (the venues slice must not import the games slice's `gameDisplay.ts`). API change (sibling `api/`): the games **list** filter, when `venueId` is passed, now matches a game's fixed `venueId` **or** its lobby-voted `winningVenueId` and drops the published-only default (just hides cancelled) — so games that voted+booked a venue surface on that venue (the app's create flow only ever stores a vote-flow game, so `winningVenueId` is how a game ends up "at" a venue). No route surface change (no `/lists` edit); no new permission (read-only surface of already-public game browse + venue location). |
| 2026-06-08 | **Nearby "Near me" switched to kilometres + map centres on the user.** The distance filter is now km (`maxDistanceKm`, slider 1–50 km, default 10 km; dropped the miles↔km conversion since venue distances are already km). On the map, once located, `FrameMap` keeps the **user** centred (a box symmetric about them, grown to the nearby cluster) instead of fitting the courts' centroid, and the map now renders **every** locatable court when located (the radius narrows only the list) so courts beyond the radius stay visible. No API change. |
| 2026-06-08 | **Home "Open games near you" + "Courts to book" wired live.** Both lists on `HomeScreenRefined` now render real data instead of hardcoded arrays. "Open games near you" reuses the hero's `listGames({ status: 'published' })` feed (drops the game already featured in the hero, joinable only, top 4); cards derive tag/title/time/venue/spots from `ApiGame` and show the day instead of a faked distance. "Courts to book" (renamed from "Courts available now") fetches `listVenues({ pageSize: 6 })` and shows real name, media image (`apiImageUrl`, gradient fallback), area, and a real stat (rating → price → court count) — the fake "X Open" availability badge is gone (no availability endpoint). Both own loading skeletons + empty states; the shared error retry now refetches. Check-in banner + streak card remain demo. No API change. |
| 2026-06-08 | **Home hero wired to live games + bookings.** `HomeScreenRefined`'s state-aware hero now reads real data instead of demo constants. `CommitmentHero` shows the player's soonest upcoming **commitment** — the earliest across their games (`listGames({ mine: true })`) and **court bookings** (`listBookings()`), unified via `NextCommitment` (`kind: 'game' \| 'booking'`); a booking renders the same hero (party size instead of a roster, primary action opens My bookings, Directions → the venue). When there's no commitment it falls back to the best open game from `listGames({ status: 'published' })` (`FindGameHero`), else the create-a-game prompt. Guests skip the `mine`/bookings fetches. Small game/booking formatters are inlined locally (home must not cross-import the `games` slice's `gameDisplay.ts` per the shared-only rule). The rest of the home screen (Open games near you, Courts available now, check-in banner, streak card) stays demo. No API change. |
| 2026-06-05 | **Owner Nearby tab → "your venues" operations map.** Owners get `features/owner/OwnerNearbyScreen.tsx` on the Nearby tab instead of the player discover view — their venues plotted as live-status pins (amber = pending approvals, green = active today, slate = quiet; today's booking count inside each pin). Tapping a pin shows a glance (today's bookings / pending / occupancy) with Manage + Bookings actions; an attention-sorted venue list (pending first) sits below. Reuses `useOwnerDashboard` (venues + per-venue glance/analytics) — no new fetch, no competitor data. New `owner.market.view` permission gates it (`App.tsx` branches the `nearby` case); synced to api/web. (Superseded the earlier same-day market/competitor map concept — `marketMetrics.ts` removed.) |
| 2026-06-04 | Added a **court-booking flow** (new `features/bookings/` slice: `BookCourtScreen`, `MyBookingsScreen`, `bookingDisplay.ts`). Pick a **priced** court → date/time/duration → live cost (`priceFrom × hours`) → review → **checkout**. Checkout reads a new server setting (`GET /api/v1/settings`): in **test mode** it pre-fills the 4242 demo card, shows a TEST banner, and `POST /api/v1/payments/checkout` completes the payment + confirms the booking (no charge); live mode leaves it pending. Entry points: a "Book this court" CTA on `CourtDetailsScreen` (disabled when the venue has no rate) and "My bookings" in `ProfileScreen` (list + cancel). New `book-court`/`my-bookings` screens + `player.bookings.create` permission (synced to api/web). API change (sibling `api/`): new `settings` slice + `payments/checkout` (both on `/lists`). |
| 2026-06-02 | Nearby tab: **filter chips + filter sheet now narrow the list.** Lifted filter state into `NearbyScreen` (new `venueFilters.ts` — `VenueFilters` model, `makeDefaultFilters`, `matchesFilters` predicate, `countActiveFilters`); `NearbyFilterSheet` is now controlled (court type, price Any/Free/Paid, open play, distance cap, amenities) and the quick chips (Games here / Indoor / Free / Lighted) edit the same state. Filtering or locating switches the list to the full venue set (client-side filter — so a filter can't hide matches on unfetched pages) and hides "Load more"; otherwise the server-paged directory is unchanged. The Filter button shows an active-filter count. Amenity options pruned to flags that carry data (dropped Restrooms/Pro shop — `true` for no seeded venue). No API change. |
| 2026-06-02 | **Nearby** tab (renamed from "Courts" in `TabBar`/`Sidebar`): added **distance-based search**. A "Near me" chip + the floating locate button request the user's location (new `shared/lib/geo.ts` — haversine + distance formatting + a geolocation wrapper) and show the courts **near them** — only locatable venues, ranked nearest-first and limited to a radius (default 25 mi, adjustable via the filter sheet slider), not the whole directory (`resolveNearby` in `NearbyScreen`). Falls back to the nearest few if nothing is in range so the list never blanks. Each court shows its distance on rows/popups; the map frames the user (a "you are here" dot) + the nearby pins. Search keeps working alongside. **Open to guests** (it's a browse aid, like the rest of the tab); the new `player.venues.locate` permission (added to all three synced copies + the API `PERMISSION_CATALOGUE`/role defaults) only governs signed-in users, via `canLocate = !isLoggedIn \|\| userHasPermission(...)`. No API route change (no `/lists` edit). |
| 2026-06-01 | Wired **profile editing** + **onboarding memory** to the account. `EditProfileScreen` save now persists to `PATCH /me` via a new `authStore.updateProfile()`; added `updateMe`/`ProfileUpdate` to `api.ts` and `duprForTier` to `skillTiers.ts`. Onboarding completion is remembered on the account: new `hasOnboarded` flag on the user (API `auth.model`/`auth.controller` + `/me` payload), `authStore.completeOnboarding()`, and `App.tsx` now derives the onboarding gate from `user.hasOnboarded` instead of in-memory state. Both flows stay behind the existing `player.profile.manage` permission; `PATCH /me` remains `requireAuth` (self-scoped). API route surface unchanged (no `/lists` edit). |
| 2026-05-29 | Courts tab: added cursor **pagination** (20/page, "Load more") and venue **images** on list cards. `listVenues` now returns `{ items, cursor }` and accepts a `cursor` param; `ApiVenue` gained `image`. API change (sibling `api/`): `listVenues` controller attaches a media-derived `image` per venue via one batched `Media` lookup (mirrors the get-by-id `image`). Cards render the image with a gradient fallback. |
| 2026-05-29 | Wired the "Courts" tab to the live API. `NearbyScreen` lists venues from `GET /api/v1/venues` and `CourtDetailsScreen` loads a venue via `GET /api/v1/venues/:id` (by slug or `_id`). Added `listVenues`/`getVenue` + `ApiVenue`/`ApiVenueDetail` to `api.ts` and a `venueDisplay.ts` formatter module (price/location/tags/amenities/mapsUrl). Both screens fetch on mount with real loading/error/empty(not-found) states; detail screens remount per id via `key`. Real data is sparse, so all fields degrade gracefully. Games-on-venue section remains demo. |
| 2026-05-29 | Wired login to the live API and made the current-user UI dynamic. Added `shared/lib/api.ts` (auth client + token storage) and `shared/lib/authStore.ts` (Zustand auth store — first real use of the Zustand dep). `LoginScreen` now calls `useAuthStore().login()` → `POST /api/v1/auth/login`; `App.tsx` restores the session via `/me` on mount. The greeting, profile page, edit-profile prefill, sidebar, and nearby header now read the user from the store (no prop-threading) instead of the hardcoded "Riley Pickler". Profile stats remain demo data; edit-profile save not yet wired to `PATCH /me`. Extracted `getInitials` to `shared/lib/initials.ts`. |
| 2026-05-28 | Restructured `app/src/` into feature-based vertical slices (`features/{auth,home,games,venues,clubs,profile,search}` + `shared/{components,hooks,lib,styles}`), mirroring the `web/` convention. Pure file-move + import-update refactor — no behavior changes. Filter sheets co-located with their owning feature (`GameFilterSheet` → `features/games/`, `NearbyFilterSheet` → `features/venues/`). |
| 2026-05-27 | Commit `c4ceec6` — Removed `TopBar`, `Sidebar`, and `FAB` from `components/layout/`. Create action moved into `TabBar.onCreate`. Added `CourtIllustration`, `GameRow`, `Segmented`, `Toast` UI primitives. Polished all major screens. |
| 2026-05-27 | Commit `0e32861` — Added `LandingScreen` as new cold-start entry. Added `components/filters/` (bottom sheets replacing routed filter screens), `components/forms/` (FormField/Select/TierPicker), `hooks/` (useForm, usePrefersReducedMotion, useTheme), `lib/demoState.tsx`, `lib/skillTiers.ts`. Replaced `LoadingSpinner` with `LoadingSkeleton`. Added `BottomSheet`, `DuprExplainerSheet`, `OfflineBanner`, `DemoStateControl`. Included `Redesign/` reference assets. |
| 2026-05-28 | Removed the stale `docs/pickleplay-*` inventory (markdown, CSVs, xlsx). They were written against the pre-migration `src/screens/`-`src/components/` layout and the old "PicklePlay" brand, and had drifted far enough to mislead. Future inventory should be regenerated from current code rather than maintained by hand. |
| 2026-05-26 | Commit `16acf6c` — Added PWA install/update support (`pwaUpdate.ts`, install prompt, OpenStreetMap tile runtime caching) and PWA asset icons. |
