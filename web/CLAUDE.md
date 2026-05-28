# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
npm run dev      # Start Vite dev server
npm run build    # TypeScript check + Vite build
npm run lint     # ESLint all source
npm run preview  # Preview production build
```

## Project Identity

- **Brand name:** pickleBaller
- **Tagline:** "Find Courts. Join Games."
- **Domain:** pickleballer.eunika.xyz -> localhost:9001

## Project Status

Greenfield responsive website in `web/`. Companion PWA prototype lives in `app/` (different codebase, mobile-first). The API lives in the sibling `api/` repo (Hono + MongoDB, port 9002 / `pickleballer-api.eunika.xyz`).

## Tech Stack

- React 19 + Vite 8 (JSX, not TSX yet)
- Tailwind CSS 4 (via `@tailwindcss/vite` plugin)
- react-router-dom 7 for routing
- Zustand 5 for state management
- Leaflet + react-leaflet for map views
- Lucide React for icons
- date-fns for date formatting

## Architecture — feature-based vertical slices

Code is organised by **feature**, not by technical layer. Every feature owns its pages, feature-specific components/layouts, and any feature-scoped store.

```
src/
  features/
    <feature>/
      <Feature>Page.jsx          # one or more page components
      <Feature>Layout.jsx        # if the feature owns a layout
      <feature>Store.js          # if the feature owns Zustand state
  shared/
    components/        # cross-feature UI: Header, Footer, MegaMenu, MobileMenu, Icon, VenueMap
    layouts/           # cross-feature layouts: RootLayout
    data/              # dummy-data accessor (index.js → ../../../dummies/*.json)
  App.jsx              # RouterProvider
  router.jsx           # composition root — imports from features/* and shared/*
  main.jsx
  index.css
```

Current features:

| Feature | Owns |
|---|---|
| `admin` | AdminVenuesPage, AdminUsersPage, AdminGamesPage, AdminAnalyticsPage, AdminLayout, AdminSidebar |
| `auth` | LoginPage, RegisterPage, AuthGuard, **authStore.js** (Zustand) |
| `clubs` | ClubsPage, ClubDetailPage, CreateClubPage, CommunityPage |
| `coaches` | CoachesPage |
| `games` | OpenPlayPage, OpenPlayDetailPage, LeaguesPage, TournamentsPage, CreateGamePage |
| `marketing` | HomePage, AboutPage, DownloadPage, LearnPage, NewsPage, RoadmapPage, PricingPage, NotFoundPage |
| `my` (user dashboard) | MyBookings/MyGames/MyEvents/MyPayments/MyMembership/MyWaitlists/MyFavorites/MyGroups/MyProfile/MySettingsPage, UserLayout, UserSidebar |
| `venues` | VenuesPage, VenueDetailPage, CityPage, SearchPage, BookingPage, CheckoutPage |

### Route tree (three layouts)

| Tier | Layout file | Mounted routes |
|---|---|---|
| **Public** | `shared/layouts/RootLayout.jsx` | `/`, `/venues`, `/venues/:slug`, `/venues/:slug/book`, `/clubs`, `/clubs/:slug`, `/open-play`, `/games/create`, `/clubs/create`, `/search`, `/download`, `/city/:slug`, `/pricing`, `/leagues`, `/tournaments`, `/learn`, `/community`, `/coaches`, `/news`, `/about`, `/roadmap`, `/checkout`, `/login`, `/register` |
| **User** (auth) | `features/my/UserLayout.jsx` | `/my/bookings`, `/my/games`, `/my/events`, `/my/payments`, `/my/membership`, `/my/waitlists`, `/my/favorites`, `/my/groups`, `/my/profile`, `/my/settings` |
| **Admin** | `features/admin/AdminLayout.jsx` | `/admin/venues`, `/admin/users`, `/admin/games`, `/admin/analytics`, etc. |

### Adding a new page or feature — checklist

1. **Pick the slice.** If it belongs to an existing feature, add `<NewName>Page.jsx` inside `src/features/<feature>/`. Otherwise create `src/features/<new-feature>/` and put it there.
2. **Mount it in [src/router.jsx](src/router.jsx)** — the central composition root. Import as `'./features/<feature>/<NewName>Page.jsx'`, then add a route entry under the correct layout block (`RootLayout` / `UserLayout` / `AdminLayout`).
3. **Cross-feature imports** go via the shared layer or sibling feature paths:
   - UI primitives: `'../../shared/components/Icon.jsx'`, `'../../shared/components/VenueMap.jsx'`, etc.
   - Dummy data: `'../../shared/data/index.js'`.
   - Auth store: `'../auth/authStore.js'` (or `'./authStore.js'` if you're inside auth/).
   - Layouts: `'./AdminLayout.jsx'` (own feature) or `'../my/UserLayout.jsx'` (sibling feature).
4. **No deep relative paths** like `'../../../components/...'`. If you need three `..`s you're crossing a layer that should go through `shared/`.
5. **Don't reintroduce `src/pages/`, `src/components/`, `src/layouts/`, or `src/stores/`** — those flat dirs were removed during the vertical-slice migration. Putting a new page in `src/pages/` will break the convention.
6. **`npm run build` must stay clean.** Run it after structural changes to catch broken imports.

### Data layer
- No API client yet. All reads go through `src/shared/data/index.js`, which imports `dummies/*.json` from the project root. When wiring to the real API, **swap the function bodies** in that one file — call sites don't change.
- The API base URL will be `https://pickleballer-api.eunika.xyz` in prod, `http://localhost:9002` in dev.
- Domain types are implicit in the JSON shapes today; if you add a `src/shared/types/` directory, document it here.

## Keeping the public roadmap current

The product's public progress page lives at **https://pickleballer.eunika.xyz/roadmap** and is rendered from `/var/public/pickleplay/web/src/features/marketing/RoadmapPage.jsx`. **Whenever you finish a meaningful task — new feature, removed feature, big refactor, infrastructure change — you must update the roadmap as part of the same work**:

1. Edit `/var/public/pickleplay/web/src/features/marketing/RoadmapPage.jsx`.
2. Update the `Last updated:` string in the hero (look for the `<Badge label="Living Document" ...>` block, ~line 81) to today's date.
3. Prepend a new entry at the top of the Change Log array (~line 970): `{ date: 'YYYY-MM-DD', change: '…' }`.
4. If the task moves a phase status (e.g. Phase 2 going from `status="active"` to `status="done"`), update the relevant `TimelineItem` props and badges too.
5. If you added or removed routes/pages, update the matching `Section` tables (Existing Screens, Core Features, etc.) so the surface inventory stays truthful.
6. Run `npm run build` and reload the page in the browser to confirm.

Skipping the roadmap update is treated like skipping a test: the work isn't done.

### Game-type pages — distinct purposes (do NOT merge)

All four pages pull from `games.json` but serve different use cases:

| Page | Filter | Purpose |
|---|---|---|
| **Open Play** `/open-play` | `format === 'open_play'` | Casual drop-in sessions. No team, no commitment — just show up with your paddle. |
| **Leagues** `/leagues` | `eventType === 'Round Robin'` | Season-long league play. Teams, standings, playoffs across 8-week seasons. |
| **Tournaments** `/tournaments` | `eventType === 'Tournament'` | One-off bracket competitions. Register with a partner, compete, win. |

These are **not redundant** — each targets a completely different player need (casual vs competitive vs event-based). The dummy data currently lacks sufficient differentiation; real data will make the distinction obvious.

### Key patterns
- Desktop-first responsive down to mobile (opposite of the PWA prototype)
- Every venue, club, city, league gets its own URL (SEO-first)
- `Venue ≠ Court`: a venue is a facility with multiple courts

## Design System

Source of truth: [DESIGN.md](./DESIGN.md) (extracted from the PWA prototype in `app/`).

- **Fonts:** Fredoka (headings), Nunito Sans (body) via Google Fonts
- **Palette:** Electric Blue `#0040E0` (brand), Neon Lime `#C1F100` (CTAs), Coral `#CF3000` (urgency)
- **Cards:** `rounded-[12px]`, white on `#F8F9FC` background, blue-tinted shadows
- **Buttons & Chips:** Always `rounded-full` (pill-shaped)
- **Inputs:** `rounded-[12px]` ("squircle"), `h-12` (48px touch target)
- **Icons:** Material Symbols Outlined (same as PWA), loaded via Google Fonts CSS
- **Shadow system:** All shadows tinted Electric Blue, never pure black
- **8px baseline grid** for spacing
- Sentence case for all UI copy; uppercase only on `label-sm` (11px) items

## Implementation Phases (from PLAN.md)

1. **Scaffold + Design System** — Vite project, shadcn/ui init, Tailwind theme, route tree, layouts, types
2. **Discovery Pages** — Home, venue/game/club/player finder + detail, search, download
3. **Booking + Payments** — Court booking flow, booking management, checkout, pricing, memberships
4. **User Dashboard + Community** — All `/my/` pages, create game, invite, RSVP, groups/chat
5. **Competition + Content** — Leagues, ladders, tournaments, live scoring, ratings, learn, coach directory, news, city landing pages
6. **Admin Dashboard + Polish** — All `/admin/` pages, responsive QA, Lighthouse audit
