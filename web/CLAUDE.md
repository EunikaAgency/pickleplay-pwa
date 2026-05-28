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

Greenfield responsive website in `web/`. Currently only contains design/plan docs — no source code scaffolded yet. The companion PWA prototype (different codebase) lives in `app/` and is the visual source of truth for design tokens.

## Tech Stack

- React 19 + TypeScript 6 + Vite 8
- Tailwind CSS 4 (via `@tailwindcss/vite` plugin)
- shadcn/ui (Radix-based, Tailwind-native, zero bundle cost)
- react-router-dom 7 for routing
- Zustand 5 for state management
- Leaflet + react-leaflet for map views
- Lucide React for icons
- date-fns for date formatting

## Architecture (from PLAN.md)

Three-tier route structure:

| Tier | Routes | Layout |
|---|---|---|
| **Public** | `/`, `/venues`, `/games`, `/clubs`, `/players`, `/search`, `/login`, `/register`, `/download`, `/city/:slug`, etc. | `RootLayout` |
| **User** (auth required) | `/my/bookings`, `/my/games`, `/my/profile`, `/my/settings`, etc. | `UserLayout` |
| **Admin** (admin role) | `/admin/venues`, `/admin/users`, `/admin/analytics`, etc. | `AdminLayout` |

### Data layer
- No API client yet. All data is demo/dummy content from JSON files in `dummies/`
- Zustand stores abstract data access — swapping to a real API later is a store-only change
- Core domain types defined in `src/lib/types.ts`: `Court`, `User`, `Game`, `Club`, `Message`, `Venue`, `Booking`, `Review`, `NewsArticle`, `League`, `Tournament`, `Group`, `Coach`, `Notification`, `Payment`, `PricingPlan`

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
