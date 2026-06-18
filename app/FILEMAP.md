# app/ — PickleBallers PWA (read this first)

Mobile-first React PWA for finding pickleball games, courts, clubs, and players.
**This file is the map.** Skim it before grepping/scanning the tree — it points
you straight at the right file so you don't have to read everything.

- Deep architecture, the add-a-screen checklist, and the roadmap-update rule
  live in [CLAUDE.md](CLAUDE.md). Repo-wide conventions live in
  [../AGENTS.md](../AGENTS.md). This file is the quick index; keep it short.

## Commands

```sh
npm run build    # tsc -b && vite build  — MUST stay clean after any change
npm run lint     # eslint .
npm run preview  # preview the production build
npm run doctor   # react-doctor diagnostics (lint/a11y/bundle/architecture)
```

## Stack

React 19 · TypeScript · Vite 8 · Tailwind v4 (`@tailwindcss/vite`, no config file —
tokens are CSS vars in `src/shared/styles/index.css`) · Leaflet (maps) ·
Material Symbols + a wrapper `Icon` · vite-plugin-pwa. Most state is local
`useState`; **auth/session state lives in a Zustand store**
(`shared/lib/authStore.ts`) so screens read the current user without prop-drilling.

## Entry points & navigation

- `index.html` → `src/main.tsx` → **`src/App.tsx`** (the composition root: holds
  all nav state, auth/guest state, and renders chrome + the active screen).
- No router lib. Navigation is a **screen-stack in `App.tsx`**: a `Screen`
  discriminated union + history array; `navigate(id, params?)` pushes, `goBack()`
  pops. The union and `tabScreens`/`TabId` live in `src/shared/lib/navigation.ts`.
- To add a screen: create it in the right `features/<slice>/`, then add it to the
  `Screen` union **and** the `renderScreen()` switch in `App.tsx`. (Full checklist
  in CLAUDE.md.)

## Directory map

```
src/
  App.tsx              # composition root — nav stack, auth gate, chrome wiring  ← start here
  main.tsx             # mount
  pwaUpdate.ts         # service-worker auto-update

  features/<slice>/    # vertical slices; each owns its screens + slice-only UI (filter sheets)
    auth/              # LandingScreen, LoginScreen, OnboardingScreen
    home/              # HomeScreenSwitch (picks ↓; App.tsx routes owners to owner/OwnerHomeScreen
                       #   instead), HomeScreenRefined (default "New"), HomeScreen (Classic),
                       #   DesignSwitch (floating New·Classic·v2.1 toggle), v2/HomeScreenV2
    # NOTE: each player slice has a v2/ folder with its "Pickleballers Mockup v2.1"
    #   redesign screen (venues/v2, games/v2 incl. CreateGameV2, clubs/v2 incl.
    #   CreateClubV2, profile/v2 incl. SettingsScreenV2). Active when the design
    #   switch = v2.1. See the
    #   "Design switch" note below + shared/components/layout/V2Chrome + shared/styles/v2.css.
    games/             # Games (player browse/join — owners get owner/OwnerGames instead via App.tsx),
                       #   GameDetails, CreateGame (venue-first: pick a priced court → date +
                       #   start/end time → details → PAY to book the court → game posts; with a
                       #   gameId prop it switches to the MANAGE form: edit details + kick players,
                       #   venue/time locked), MyGames (manage games you created: status + edit/delete),
                       #   InvitePlayers, GameChat (per-game group chat for the roster — opened from
                       #   GameDetails' "Chat"; realtime via realtimeBus 'game.message'; gated by
                       #   player.games.chat), GameFilterSheet + gameFilters (when/skill/type/openings
                       #   filter model+predicate), gameDisplay (API-wired: create/edit/delete/
                       #   list/detail/join/kick/group-chat; invite-send still demo)
    bookings/          # BookCourt (pick venue→court (CourtPicker)→whole-hour start/end via HourSelect,
                       #   taken hours greyed out from that court's live availability→pay test-checkout),
                       #   MyBookings (list+cancel), bookingDisplay
    venues/            # Nearby (the "Nearby" tab — player discover view; owners get owner/OwnerNearby instead via App.tsx), CourtDetails, NearbyFilterSheet, venueFilters (filter model+predicate)
    clubs/             # Clubs (live: my/discover lists), ClubDetails (live: detail +
                       #   members + Facebook-style feed with post/like, join/leave,
                       #   ⋯ menu: invite/share link + host delete), CreateClub (live:
                       #   POST /clubs). All via the clubs client in api.ts.
    profile/           # Profile, EditProfile, Settings, Notifications
    messages/          # direct 1:1 chat: ConversationsScreen (thread list, from Profile → Messages or
                       # the desktop Sidebar "Messages"; has a "New message" ✏️ that searches any
                       # player (searchPlayers) → startConversation → chat, so you can DM someone you've
                       # never met in a game),
                       # ChatScreen (thread + composer; reached from a game's "Message organizer" or
                       # a message notification → /messages/:id). Realtime: both screens subscribe to
                       # the realtime bus ('message') so new messages append / the list reorders live
                       # (see shared/lib/realtimeBus.ts + shared/hooks/useRealtimeStream.ts). Gated by
                       # user.messages.send.
    search/            # SearchScreen — live global search across courts/games/clubs/players
                       #   (crossSearch → GET /api/v1/search?type=all); debounced, recent
                       #   searches in localStorage, player rows open a DM. Gated by player.search.use
    owner/             # venue-owner console (the one feature with internal subfolders — it's
                       # ~3x any other slice). Root = the 8 screens: OwnerHome (the Home tab for
                       # owners — dashboard: revenue hero + KPIs + cross-venue pending/upcoming +
                       # venue cards), OwnerBookings (all-venues inbox: When tabs
                       # upcoming/ongoing/past + OwnerBookingsFilterSheet for
                       # status/sort/venue) + OwnerInsights (all-venues
                       # analytics: combined trends + per-venue compare) — the Home Bookings/Insights
                       # buttons open these; OwnerGames (the Games tab for owners — "Your courts":
                       # Schedule agenda of bookings+games per day + Games list at their venues);
                       # OwnerNearby (the Nearby tab for owners — a "your venues" operations
                       # map: your venues as live-status pins (today's bookings / pending /
                       # occupancy), tap → glance → console; attention-sorted venue list below);
                       # OwnerVenues (list w/ per-card glance), OwnerVenue (tabbed host),
                       # OwnerNewVenue (create).
      tabs/            # the OwnerVenue panels: Overview (business dashboard: revenue/bookings/
                       # occupancy KPIs + revenue trend chart), Insights (per-venue segmented
                       # analytics), Bookings (per-venue inbox), Listing/Location/Hours/Courts/
                       # Faqs/Reviews/Photos editors
      components/      # reusable blocks: OwnerSection/OwnerStat/VenueCard/OwnerBookingRow/
                       # OwnerGameCard/CompletenessMeter
      hooks/           # useOwnerDashboard.ts (shared venues+analytics+bookings+games hook; opts
                       # withBookings/withGames/withAnalytics; exposes analyticsByVenue, bookings, games)
      utils/           # ownerMetrics.ts (revenue bucketing + cross-venue merge helpers)
    organizer/         # organizer console (Phase 3) — entry from Profile "Organize" row →
                       # organizer-hub (gated by organizer.access). Organizers are players who
                       # ALSO run events, so this is an entry point, NOT a tab takeover (cf. owner).
                       # Root = OrganizerHubScreen (tool cards) + organizerDisplay.ts (status
                       # chips + date/time/days formatters). Reuses the same API the web
                       # /organizer console uses — no API changes, no new permissions.
      hooks/           # useOrganizerHub (aggregate hub counts), useVenueOptions (venue picker)
      components/      # OrganizerSection, StatusChip, ParticipantRow (approve/decline OR
                       # attendance+paid — shared by tournaments + open play), AnnouncementsPanel
      tournaments/     # TournamentsScreen (list), CreateTournamentScreen (draft form),
                       # TournamentDetailScreen (overview + participants + announcements +
                       # venue-request + Manage bracket), BracketScreen (orchestrator);
        bracket/       #   EntrantsManager (build/seed), BracketGenerator (format → generate),
                       #   BracketView (round-by-round match cards + standings; no pan/zoom),
                       #   MatchScoreSheet (enter games/walkover in a BottomSheet)
      openplay/        # OpenPlayScreen (series list + create), SessionRosterScreen (roster mgmt)
      rosters/         # RostersScreen (lists + create), RosterDetailScreen (members CRUD)
      venues/          # VenueRequestsScreen (submit + track tournament venue requests)

  shared/              # cross-feature only (never import a feature from another feature)
    components/ui/      # Icon, Avatar, Button, Card, Chip, BottomSheet, AuthPromptSheet,
                        # AvatarCropper (circular photo crop via croppie; used by EditProfile),
                        # EmptyState/ErrorState/LoadingSkeleton, DemoBranch, Toast,
                        # NotificationBadge (live unread-count bubble — reads notificationStore),
                        # HourSelect, CourtPicker (pick which court to book/host),
                        # CalendarDatePicker (month-grid date picker),
                        # Chart (dependency-free BarChart/LineChart/Sparkline/Heatmap), … (see folder)
    components/layout/  # TabBar (mobile), Sidebar (desktop)
    components/forms/   # FormField, FormSelect, FormTierPicker
    hooks/              # useForm, useTheme, usePrefersReducedMotion, useVenueAvailability
                        #   (per-hour availability → greys out taken hours; pass a courtId to
                        #    scope it to that court, else the whole-venue pool),
                        #   useNotificationPolling (keeps the unread badge live: polls +
                        #    refreshes on focus/visibility while signed in — now a fallback),
                        #   useRealtimeStream (one app-wide EventSource to GET /api/v1/me/stream;
                        #    fans new notifications + incoming messages onto the realtime bus)
    lib/                # navigation.ts, permissions.ts, authStore.ts, api.ts, venueDisplay.ts,
                        # geo.ts (distance/geolocation), demoState.tsx, skillTiers.ts, initials.ts, types.ts,
                        # notificationStore.ts (Zustand: live unread count + refresh, for the badge),
                        # realtimeBus.ts (tiny in-app pub/sub; useRealtimeStream publishes, screens subscribe)
                        # (games formatters live in features/games/gameDisplay.ts, next to the screens)
    styles/index.css    # Tailwind + all design tokens (--primary, --lime, --coral, shadows…)
```

## Key shared modules (know these before touching behavior)

- **`shared/lib/navigation.ts`** — `Screen` union, `ScreenId`, `tabScreens`, `Navigate`.
- **`shared/lib/permissions.ts`** — roles → permissions, `AppUser`, `userHasPermission`, `firstNameOf`.
- **`shared/lib/authStore.ts`** — Zustand store: `user`, `isLoggedIn`, and the
  `login`/`logout`/`restore`/`updateProfile`/`completeOnboarding` actions. Read it directly
  with `useAuthStore((s) => s.user)` instead of threading the user through props. Wraps `api.ts`
  (`updateProfile`/`completeOnboarding` → `PATCH /me`).
- **`shared/lib/api.ts`** — the API client. Auth (login/logout/`/me`) with token storage in
  `localStorage` + `toAppUser`, **and** venues/courts (`listVenues`/`getVenue` →
  `ApiVenue`/`ApiVenueDetail`). Talks to the Hono API (relative in dev via the Vite proxy;
  `VITE_API_BASE_URL` in prod). `shared/lib/venueDisplay.ts` holds the venue formatters
  (price/location/tags/amenities/`mapsUrl`). Also carries the **owner** endpoints
  (`listOwnerVenues`/`getOwnerVenue`/`updateVenue`/`createVenue`, courts/hours/closures/faqs/
  reviews CRUD, `uploadVenueMedia`, `fetchCities`/`geocodePlace`, plus the owner bookings inbox
  `getVenueBookings`/`updateBookingStatus` and `getVenueAnalytics`→`OwnerAnalytics`) + their
  `Owner*` types, **and
  the games endpoints** (`listGames`/`getGame`/`createGame`/`joinGame`/`leaveGame` → `ApiGame`);
  `features/games/gameDisplay.ts` holds the game formatters (day/time/location/title/spots).
- **`shared/lib/demoState.tsx`** — `DemoStateProvider`/`useDemoState`; lets reviewers flip
  normal/empty/loading/error/offline. Screens branch on it via `DemoBranch`.
- **`shared/styles/index.css`** — design tokens + most component classes (`.avatar`,
  `.game-row`, `.tabbar`, `.sticky-cta`, …). Prefer tokens over hard-coded hex.

## App behavior worth knowing

- **Guest-first flow:** cold start lands on the **home tab as a guest** (not the
  landing page). Guests browse everything; **commit actions** (join a game, create
  a game/club, the "You"/profile tab) are soft-gated by `requireAuth(intent)` in
  `App.tsx`, which opens `AuthPromptSheet` → login. Screen-level gates are driven
  by `SCREEN_PERMISSIONS` + `SCREEN_AUTH_INTENT` in `App.tsx`; the Join button is
  gated via the `onRequireAuth` prop on `GameDetailsScreen`.
- **Login is live against the API:** `LoginScreen` calls `useAuthStore().login()` →
  `POST /api/v1/auth/login`, stores tokens, and the user populates the greeting, profile,
  sidebar, etc. On cold start `App.tsx` calls `authStore.restore()` to revalidate a stored
  token via `/me`. **Profile edits save to the account** (`EditProfileScreen` → `updateProfile`
  → `PATCH /me`) and **onboarding is remembered** via a `hasOnboarded` flag on the user
  (set by `completeOnboarding`); `App.tsx` only onboards when `!user.hasOnboarded`. Profile
  *stats* (win rate, streak, achievements) are still demo data — only identity fields come from the API.
- **Nearby tab is live** (the tab labelled "Nearby"; `nearby` screen id): `NearbyScreen` lists venues and `CourtDetailsScreen` loads one
  from `/api/v1/venues` (see `api.ts`/`venueDisplay.ts`). Both own their loading/error/empty
  states. The list **paginates** (20/page via "Load more" using the API cursor) and shows
  venue **images** (media-derived) with a gradient fallback. **Near me:** the "Near me"
  chip / locate button asks for the user's location (`shared/lib/geo.ts`) and shows the
  courts *near them* — locatable venues only, ranked nearest-first and capped to a radius
  (default 10 km, adjustable in the sheet; `resolveNearby`), with a nearest-few fallback —
  not the whole directory. **Open to guests** (browse aid); `player.venues.locate` only governs signed-in
  users (`!isLoggedIn || userHasPermission(...)`). **Filters narrow the list too:** the quick
  chips (Games here / Indoor / Free / Lighted) and the `NearbyFilterSheet` (court type, price,
  open play, distance cap, amenities) edit one `VenueFilters` state applied via `matchesFilters`
  (`venueFilters.ts`). Filtering or locating switches the list to the full set (so a filter
  can't hide matches on unfetched pages); otherwise it stays the server-paged directory. Real
  data is sparse (ratings/coords often null) so fields degrade gracefully. **Court detail is
  fully live:** its location card renders a real Leaflet map at the venue's coords (falls back
  to the decorative pin box when a venue has no lat/lng), and the **"Games here"** list loads
  real games hosted at the venue via `listGames({ venueId })` (matched by the game's fixed
  `venueId`) — own loading/empty/error states; nothing on this screen is demo anymore.
- **Games tab is live:** `GamesScreen` has two top tabs — **Booking** and **Games**.
  **Booking** is the court-bookings view (`listBookings`/`cancelBooking`) with a **calendar ⇄
  list** toggle (month grid dots days that have bookings; tap a day to see its cards). **Games**
  holds the **My Games / Browse** sub-tabs: **Browse** = public published games from
  `/api/v1/games`, grouped into date sections with rich cards (time rail, roster avatars,
  spots/skill); **My Games** = games you created or joined, as commitment cards with a status
  accent (HOSTING/GOING). `GameDetailsScreen` loads one via
  `getGame` and **Join** calls `joinGame` (soft-gated by `onRequireAuth`; spots/roster are
  server-derived). A game's roster **is** its lobby: when it fills the **host** sees a
  "lobby full — ready to play" banner **and** gets a real notification in their inbox (the API
  emits a `game_full` `Notification` to the creator on the join that fills the game — see the
  Notifications note below); **joiners** get a **Leave game** action governed by the
  `LOBBY_LEAVE_GRACE_PERIOD_DAYS` rules in `gameDisplay.ts` (`isLobbyFull`/`isWithinGracePeriod`/
  `canLeaveLobby`) — leaveable while the lobby has openings, or when full and the game is still
  >N days out; a full lobby inside the window locks the spot in (final/non-refundable). Joining
  **within** that window first asks for confirmation in a no-refund modal. The rule is enforced
  in the UI **and** on the server — `leaveGame` returns 409 `LOBBY_LOCKED` if a non-host tries to
  leave a full lobby inside the window. `CreateGameScreen` is **venue-first**: a 3-step wizard (pick a priced court
  via `listAllVenues` + search → date + start/end time with a live `rate × hours` cost → game
  details) ending in a **payment** step that books the court (`createBooking` → `checkout`) and
  then posts a fixed-venue game (`createGame` with `venueId` + the booking's `bookingId`). With a
  `gameId` prop it instead renders the **manage** form — edit type/skill/name/spots/visibility
  (`updateGame`) and remove players (`kickPlayer`); venue + schedule are read-only. There is **no
  vote/lobby flow** — games are joinable immediately and open in `GameDetailsScreen`.
  Gated by `player.games.create` (`SCREEN_PERMISSIONS`); creating also exercises
  `player.bookings.create` (the host books the court). Browse **date grouping** is client-side
  over all upcoming published games; the **quick chips + `GameFilterSheet` now filter for real**
  (client-side via `gameFilters.ts` — when/skill/type/has-openings; both edit one `GameFilters`
  state, the header button shows an active-filter count). The search box was removed; the
  Game-Details **chat** is still demo (no endpoint yet).
- **Clubs are live** (reached via the **Clubs** tab in the TabBar, plus the home **Clubs**
  quick-action and a **Clubs** row in the Profile/"You" tab):
  `ClubsScreen` lists your clubs (`listClubs({ mine: true })`) + a
  Discover directory (`listClubs()`, your clubs filtered out), with client-side search.
  `ClubDetailsScreen` (mounted with `clubId`) loads the club, members, and a
  **Facebook-style feed** — members post (`createClubPost`) and like (`react/unreactClubPost`),
  and anyone can join/leave (`joinClub`/`leaveClub`); the host can't leave but can **delete**
  the club (`deleteClub`) from the ⋯ menu, which also carries an **invite/share** link
  (`/clubs/<slug>`, native share or clipboard). Arriving via that link shows a welcome modal
  (`invited` prop). Feed/members refetch on tab switch. `CreateClubScreen`
  posts to `createClub` then opens the new club (`replace` so Back skips the wizard). Gated by
  the `player.clubs.*` permissions (create/join/post/react). Clubs client lives in `shared/lib/api.ts`. (No club-events surface —
  the old Events tab was dropped; nested post replies aren't shown in the app yet.)
- **Notifications are live** (Profile → bell): `NotificationsScreen` reads the user's real inbox
  (`listNotifications`/`markNotificationRead`/`markAllNotificationsRead` → `/api/v1/notifications`,
  in the API's `interactions` slice). Rows tap through when their `linkUrl` is a known app path
  (currently `/games/:id` → game-details). Today the only producer is the games **`game_full`**
  notification (host's lobby filled); gated by the existing `user.notifications.manage`.
- **Web Push (real OS notifications)** delivers those alerts even with the app closed.
  `shared/lib/push.ts` (`enablePush`/`refreshPushSubscription`/`unbindPushOnLogout`/`disablePush`)
  subscribes the device via the service worker and registers it (`/api/v1/push/*` in `api.ts`); the
  SW push/notificationclick handlers live in `public/push-sw.js` (pulled into the Workbox-generated
  SW via `vite.config` `workbox.importScripts`). `NotificationsScreen` shows a "Turn on push" prompt
  (gated by `user.notifications.manage`); `authStore` re-binds the device on login/restore and
  unbinds on logout. The API signs + sends with VAPID when a game fills.
- **Owner console:** users with `owner.access` see a **"My venues"** row in the Profile
  ("You") tab → `owner-venues`. `OwnerVenuesScreen` lists their venues (live, via
  `listOwnerVenues`); `OwnerVenueScreen` is a single screen with an in-screen tab strip
  (Overview/Listing/Location/Hours/Courts/FAQs/Reviews/Photos) editing live API data;
  `OwnerNewVenueScreen` creates one. All gated by `SCREEN_PERMISSIONS` in `App.tsx`.
  Same API the web `/owner/` console uses; no API changes. (Known gaps mirror web: photos
  are upload-only, address text/city are staff-managed, no token refresh on 401.)
- **Organizer console (Phase 3):** users with `organizer.access` see an **"Organize"** row
  in Profile (both designs) → `organizer-hub`. From the hub: **Tournaments** (create draft →
  request venue → open registration → manage participants/payments → announcements →
  bracket: build/seed/generate/score → standings), **Open Play** (recurring series + per-session
  roster), **Player Lists** (reusable rosters), **Venue Requests**. All `features/organizer/`,
  gated by `organizer.*` via `SCREEN_PERMISSIONS`; reuses the web `/organizer` + bracket API
  (no API/route/permission changes). The bracket is mobile-adapted (round-by-round cards +
  a score BottomSheet, not the web's pan/zoom canvas). Out of scope: co-host assignment
  (net-new, needs API), leagues/seasons, and v2.1-redesigned variants of these screens.
- **Design switch (New · Classic · v2.1):** a floating reviewer toggle —
  `features/home/DesignSwitch.tsx`, mounted app-wide from `App.tsx` for non-owner
  browse screens — picks the player design and persists it in `localStorage`
  (`pb-home-design`) via `shared/lib/playerDesign.ts` (`usePlayerDesign`, value
  `new|classic|v2`). **New/Classic** keep today's UI (`HomeScreenSwitch` picks
  `HomeScreenRefined` vs `HomeScreen` for Home only). **v2.1** swaps the whole
  player side to the "Pickleballers Mockup v2.1" redesign: `features/*/v2/*Screen V2`
  (Home/Nearby/Games/Clubs/Profile/Settings + `CreateGameV2`/`CreateClubV2`, all wired to the
  same live API + formatters as the v1 screens; create-game keeps the real
  book→pay→create flow). The v2 screens share chrome from
  `shared/components/layout/V2Chrome.tsx` (`V2Shell`/`V2TopNav`/`V2TabBar`/`V2Fab`)
  and styling from `shared/styles/v2.css` — every rule scoped under `.pb-v2.v2-<screen>`
  (auto-ported from the mockup) so v2 fonts/tokens never leak into New/Classic. While
  v2 is active `App.tsx` suppresses the app's own mobile TabBar; the desktop Sidebar
  stays. Owners never see v2 (gated by `!owner.access`).
- **Home A/B (v1):** `HomeScreenSwitch` renders New vs Classic Home. "New" = `HomeScreenRefined`. The
  refined home's **hero is live**: your next commitment is the **soonest of your
  games (`listGames({ mine: true })`) and court bookings (`listBookings()`)** —
  a court booking renders the same hero (party size instead of a roster, opens
  My bookings); else it features the best open game (`listGames({ status:
  'published' })`); else the create-a-game prompt. **Open games near you**
  (`listGames({ status: 'published' })`) is a live list, and **Courts to book** is
  **location-aware**: it best-effort requests the user's location (`geo.ts`), and
  once located pulls the full directory (`listAllVenues`) to rank courts
  nearest-first with a distance on each card (heading flips to "Courts near you");
  with no location it falls back to the plain `listVenues({ pageSize: 6 })` list.
  The **check-in banner is live**: it shows the busiest venue right now from real
  check-ins (`getCheckInHotspot`) and hides when nobody's checked in. (The in-app
  check-in/out toggle was removed from the court page — `CourtDetailsScreen` is now
  pure details + "Games here"; the `player.venues.checkin` perm/API still exist.)
  Only the streak card stays demo (no player-stats backend).
- **Chrome:** TabBar (mobile) + Sidebar (desktop) render via `App.tsx`; hidden on
  `landing`/`login`/`onboarding`. The mobile TabBar's five tabs are **Today · Games ·
  Clubs · Nearby · You** (the old center **+** create-FAB was removed in favour of a Clubs
  tab; create a game from the home "Create match" quick-action). The desktop Sidebar still
  carries the create FAB (`onCreate`/`canCreate` props remain for it).

## Conventions (brief — full rules in CLAUDE.md / AGENTS.md)

- Feature slices import cross-feature code only through `shared/`. No `../../../`.
- Don't recreate flat `src/{screens,components,hooks,lib}/` — removed in the slice migration.
- Tailwind classes inline; colors via CSS-var tokens. Loading = `LoadingSkeleton`, not spinners.
- New top-level docs → `../docs/`, screenshots → `../docs/screenshots/`, scripts → `../scripts/`.
- A meaningful change (new/removed screen, flow change, big refactor) also requires a
  roadmap update in `../web/.../RoadmapPage.jsx` — see CLAUDE.md.

## Where to look first, by task

| Task | Open first |
|---|---|
| Navigation / new screen / auth-or-guest flow | `App.tsx`, `shared/lib/navigation.ts` |
| Player design toggle / "Pickleballers Mockup v2.1" redesign | `features/home/DesignSwitch.tsx`, `shared/lib/playerDesign.ts`, `shared/components/layout/V2Chrome.tsx`, `shared/styles/v2.css`, `features/*/v2/*` (v2 branches wired in `App.tsx`) |
| Login / current user / session | `shared/lib/authStore.ts`, `shared/lib/api.ts`, `LoginScreen.tsx` |
| Nearby tab / courts (list + detail, distance sort, filters) | `features/venues/NearbyScreen.tsx`, `CourtDetailsScreen.tsx`, `NearbyFilterSheet.tsx`, `venueFilters.ts`, `shared/lib/venueDisplay.ts`, `shared/lib/geo.ts` (owners get `features/owner/OwnerNearbyScreen.tsx` — a "your venues" ops map) |
| Games tab (browse/mine, create, detail, join) | `features/games/{GamesScreen,GameDetailsScreen,CreateGameScreen}.tsx`, `gameDisplay.ts`; games endpoints in `shared/lib/api.ts` |
| Create a game (venue-first + pay) | `features/games/CreateGameScreen.tsx` — `CreateGameWizard`: court → date/start-end → details → `createBooking`+`checkout`+`createGame`; gated by `player.games.create` (+ `player.bookings.create`) |
| Manage games you created (edit details, kick, delete) | `features/games/MyGamesScreen.tsx` (from Profile → "My games") **and** inline on the Games tab's "My Games" rows (`GameManageActions.tsx`); editing reuses `CreateGameScreen` with a `gameId` prop (the `ManageGameScreen` form: edit details + remove players via `kickPlayer`); `updateGame`/`deleteGame`/`kickPlayer` in `shared/lib/api.ts`; gated by `player.games.manage` |
| Direct messages / chat (realtime) | `features/messages/{ConversationsScreen,ChatScreen}.tsx`; messaging endpoints in `shared/lib/api.ts`; entry from `GameDetailsScreen` "Message organizer" + Profile → Messages; deep-link `/messages/:id` via `navigation.ts`; gated by `user.messages.send`. Realtime via `shared/hooks/useRealtimeStream.ts` + `shared/lib/realtimeBus.ts` (SSE `GET /api/v1/me/stream`) |
| Realtime stream (chat + notifications) | `shared/hooks/useRealtimeStream.ts` (one EventSource, mounted in `App.tsx`) + `shared/lib/realtimeBus.ts` (in-app pub/sub); backed by API `GET /api/v1/me/stream` |
| Live notification badge (unread) | `shared/lib/notificationStore.ts` + `shared/hooks/useNotificationPolling.ts` (started in `App.tsx`); `shared/components/ui/NotificationBadge.tsx` on the home bell + TabBar "You" tab |
| Global search (courts/games/clubs/players) | `features/search/SearchScreen.tsx`; `crossSearch` in `shared/lib/api.ts` → `GET /api/v1/search?type=all`; gated by `player.search.use` |
| Permissions / role gating | `shared/lib/permissions.ts`, `SCREEN_PERMISSIONS` in `App.tsx` |
| Venue-owner console (manage venues) | `features/owner/` (entry row in `ProfileScreen.tsx`); owner endpoints in `shared/lib/api.ts` |
| Organizer console (tournaments, brackets, open play, rosters, venue requests) | `features/organizer/` (entry "Organize" row in `ProfileScreen.tsx`/`ProfileScreenV2.tsx` → `organizer-hub`); organizer endpoints in `shared/lib/api.ts`; gated by `organizer.*` perms (`SCREEN_PERMISSIONS` in `App.tsx`). Reuses the web `/organizer` API — no API/route changes |
| Colors / spacing / shared CSS classes | `shared/styles/index.css` |
| A reusable UI primitive | `shared/components/ui/` (check it exists before building one) |
| A specific screen's content | `features/<slice>/<Name>Screen.tsx` |
| Empty/loading/error states | `DemoBranch` + `EmptyState`/`ErrorState`/`LoadingSkeleton` |

> Keep this file current when structure or core flow changes — it's only useful if it's true.
