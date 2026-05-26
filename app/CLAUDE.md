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
- vite-plugin-pwa with Workbox (map tile runtime caching)
- Fonts: Fredoka (headings), Nunito Sans (body) via Google Fonts
- PM2 ecosystem config for production process management

### Navigation
Custom screen-stack system in `App.tsx`. Each screen is a discriminated union `Screen` with an `id` and optional `params`. The `navigate()` function pushes the current screen onto a history stack; `goBack()` pops it. Five tab screens (home, nearby, games, clubs, profile) use `activeTab` state. Non-tab screens show a back arrow.

### Folder structure
```
src/
  App.tsx              # Root component: nav, chrome (top bar, tab bar, FAB)
  main.tsx             # Entry point
  index.css            # Tailwind directives + global styles
  screens/             # Page components (one per route)
  components/
    layout/            # TabBar, TopBar, FAB
    ui/                # Icon, Avatar, Button, Card, Chip
  lib/
    types.ts           # Court, User, Game, Club, Message interfaces
```

### Data types
Defined in `src/lib/types.ts`: `Court`, `User`, `Game`, `Club`, `Message`. These represent the domain model used across screens. No actual API client or store exists yet — data is currently inline/demo content.

### Key patterns
- Screens receive `onNavigate` for navigation and `onBack` for going back. A few also accept entity IDs as props (e.g. `gameId`, `courtId`, `clubId`).
- The `Icon` component wraps Material Symbols Outlined, supporting `filled`, `weight`, and `size` props via CSS `fontVariationSettings`.
- Tailwind classnames are inline; no CSS modules or styled-components.
- The TabBar renders five fixed bottom tabs and is shown only on tab screens when logged in.
- Chrome visibility (top bar, tab bar, FAB) is controlled by a `hideChrome` allowlist in App.tsx.
