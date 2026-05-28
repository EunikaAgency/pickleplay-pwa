# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
npm run dev      # Start Vite dev server on port 9000
npm run build    # TypeScript check + Vite build
npm run lint     # ESLint all source
npm run preview  # Preview production build
```

The app runs at `http://localhost:9000`. API requests to `/api/*` are proxied to `http://localhost:3001`.

## Architecture

**Mobile-first React PWA** for finding pickleball games, courts, clubs, and players.

### Stack
- React 19 + TypeScript 6 + Vite 8
- Tailwind CSS v4 (via `@tailwindcss/vite` plugin)
- Zustand 5 for state management
- react-router-dom 7 (installed but not used — navigation is custom)
- Leaflet / react-leaflet for map views
- Lucide React icons (installed) alongside Google Material Symbols Outlined (used in practice)
- vite-plugin-pwa with Workbox (map tile runtime caching) + custom `pwaUpdate.ts` for service-worker auto-update
- Fonts: Fredoka (headings), Nunito Sans (body) via Google Fonts
- PM2 ecosystem config for production process management

### Navigation
Custom screen-stack system in `App.tsx`. Each screen is a discriminated union `Screen` with an `id` and optional `params`. The `navigate()` function pushes the current screen onto a history stack; `goBack()` pops it. Five tab screens (home, nearby, games, clubs, profile) use `activeTab` state. Non-tab screens show a back arrow rendered by the screen itself.

The cold-start entry point is **LandingScreen** (a marketing/welcome surface). Tapping "Get Started" or "Sign In" navigates to **LoginScreen**. Logout returns to LandingScreen, not LoginScreen.

### Folder structure
```
src/
  App.tsx              # Root: nav + chrome (TabBar only) + DemoStateProvider + InstallPrompt + OfflineBanner
  main.tsx             # Entry point
  index.css            # Tailwind directives + global styles + design tokens
  pwaUpdate.ts         # Service-worker auto-update registration
  screens/             # Page components (one per Screen id)
  components/
    layout/            # TabBar only (TopBar, FAB, Sidebar removed in redesign)
    ui/                # Icon, Avatar, Button, Card, Chip, BottomSheet, CourtIllustration,
                       # DemoStateControl, DuprExplainerSheet, EmptyState, ErrorState,
                       # GameRow, InstallPrompt, LoadingSkeleton, OfflineBanner, Segmented, Toast
    filters/           # NearbyFilterSheet, GameFilterSheet (bottom-sheet replacements for
                       # the old NearbyFiltersScreen / GameFiltersScreen)
    forms/             # FormField, FormSelect, FormTierPicker
  hooks/
    useForm.ts                  # Generic form state + validation helper
    usePrefersReducedMotion.ts  # Respects OS reduce-motion preference
    useTheme.ts                 # Theme application
  lib/
    types.ts           # Court, User, Game, Club, Message interfaces
    demoState.tsx      # DemoStateProvider + useDemoState (normal/empty/loading/error/offline modes)
    skillTiers.ts      # Skill-tier definitions and helpers
```

### Data types
Defined in `src/lib/types.ts`: `Court`, `User`, `Game`, `Club`, `Message`. These represent the domain model used across screens. No actual API client or store exists yet — data is currently inline/demo content. Integration gaps are tracked in [`docs/pickleplay-integration-gaps.csv`](./docs/pickleplay-integration-gaps.csv).

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

## Change History

| Date | Change |
|---|---|
| 2026-05-27 | Commit `c4ceec6` — Removed `TopBar`, `Sidebar`, and `FAB` from `components/layout/`. Create action moved into `TabBar.onCreate`. Added `CourtIllustration`, `GameRow`, `Segmented`, `Toast` UI primitives. Polished all major screens. |
| 2026-05-27 | Commit `0e32861` — Added `LandingScreen` as new cold-start entry. Added `components/filters/` (bottom sheets replacing routed filter screens), `components/forms/` (FormField/Select/TierPicker), `hooks/` (useForm, usePrefersReducedMotion, useTheme), `lib/demoState.tsx`, `lib/skillTiers.ts`. Replaced `LoadingSpinner` with `LoadingSkeleton`. Added `BottomSheet`, `DuprExplainerSheet`, `OfflineBanner`, `DemoStateControl`. Included `Redesign/` reference assets. |
| 2026-05-26 | Commit `16acf6c` — Added PWA install/update support (`pwaUpdate.ts`, install prompt, OpenStreetMap tile runtime caching) and PWA asset icons. Generated structured app inventory under [`docs/`](./docs/). |
