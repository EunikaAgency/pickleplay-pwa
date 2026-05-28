# PicklePlay Website — Implementation Plan

## Context

Greenfield responsive website in `web/`. Aggregates best features from 40 pickleball/racquet-sport competitors (analyzed in `PICKLEBALLERS ANALYSIS.xlsx`) — excluding physical product sales.

**In scope:** Venue finder, court booking, open play/games, clubs, player profiles, community/chat, leagues/ladders/tournaments, ratings/standings, payments, memberships/subscriptions, content/learning, search, SEO pages, admin dashboards, mobile app download page.

**Out of scope:** Physical merchandise sales, full POS, hardware integrations.

## Tech Stack

| Package | Role |
|---|---|
| `react` + `react-dom` 19 | UI framework |
| `typescript` ~6.0 | Type safety |
| `vite` 8 + `@vitejs/plugin-react` | Bundler |
| `tailwindcss` 4 + `@tailwindcss/vite` | Styling |
| `react-router-dom` 7 | Routing |
| `zustand` 5 | State management |
| `shadcn/ui` (Radix-based) | UI components (accessible, Tailwind-native, zero bundle cost) |
| `lucide-react` | Icons |
| `leaflet` + `react-leaflet` | Maps |
| `date-fns` | Date formatting |

## Design System

Source: [DESIGN.md](./DESIGN.md) — contains all color tokens, typography scale, radii, shadows, spacing, and component specs.

## Feature Set

### P0 — MVP (Discovery + Identity)

| Feature | Source Competitors | What We Build | Access |
|---|---|---|---|
| Venue finder w/ map + list | Pickleheads, GPN, Playtomic | Leaflet map, list toggle, filters | Public |
| Venue detail pages | Pickleheads, GPN | Photos, amenities, hours, directions, court list, games at venue | Public |
| Game / open play finder | Pickleheads, PlayTime, PicklePlay | List with skill/date/distance filters | Public |
| Game detail pages | Pickleheads, PicklePlay | Info, players, skill level, chat | Public |
| Club finder | CourtReserve, GPN, ReClub | Search + list | Public |
| Club detail pages | ReClub, Pickleheads | About, members, events, chat | Public |
| Player profiles | DUPR, UTR, Pickleheads | Photo, skill, stats, badges, match history | Public |
| Home page | All | Hero, featured venues/games/clubs, quick stats | Public |
| Global search | ReClub, Pickleheads | Tabbed: venues, games, clubs, players | Public |
| Login / Register | All | Email + social buttons | Public |
| Mobile app download page | — | App Store + Play Store badge buttons, QR codes, features | Public |
| Notification preferences | Pickleheads, Playtomic | Push/web notification settings | User |

### P1 — Launch (Booking, Payments, Competition)

| Feature | Source Competitors | What We Build | Access |
|---|---|---|---|
| Court booking flow | Playtomic, CourtReserve, PBP | Calendar, time slots, booking form | User |
| Booking management | CourtReserve, OpenCourt | My bookings, cancel, history | User |
| Event registration + payment | Spond, CourtReserve | Registration forms, fee collection | User |
| Create game / meetup | Pickleheads, PlayTime | Form with date/venue/skill/capacity | User |
| RSVP + waitlist | TeamReach, ReClub, Spond | Join, leave, waitlist, attendance | User |
| Private games + invites | TeamReach, PicklePlay, Spond | Invite links, friend invites | User |
| Player matching | Pickleheads, UTR, PicklePlay | By area, level, availability | User |
| Leagues | Pickleball Den, SportyHQ, GPN | Seasons, teams, standings, results | Public + User |
| Ladders | GPN, Pickleball Den, SportyHQ | Rankings, challenges | Public + User |
| Round robins | Pickleball Den, Pickleplanner | Rotation generator, scores | User |
| Standings + rankings | DUPR, UTR, GPN, Swish | Local/city leaderboards | Public |
| Groups + community chat | ReClub, TeamReach, Spond | Group creation, messaging | User |
| Notifications | All app competitors | In-app + push for invites, changes | User |
| DUPR / UTR rating display | DUPR, UTR, Swish | Profile rating links, event tags | Public |
| City landing pages (SEO) | Pickleheads | Programmatic city pages | Public |

### P2 — V2 (Monetization, Admin, Content)

| Feature | Source Competitors | What We Build | Access |
|---|---|---|---|
| Memberships / subscriptions | CourtReserve, PBP, Spond | Plans, signup, member pricing | Public + User |
| Event payments (fees) | Spond, CourtReserve | Fee collection, refunds, receipts | User |
| Waivers + rules acceptance | CourtReserve, PBP | Online forms, policy acceptance | User |
| Tournaments / brackets | PickleballBrackets, Swish | Registration, brackets, scoring | Public + User |
| Live scoring | Swish, SportyHQ, DUPR | Score entry, match status | User |
| Beginner guides + learning | Pickleball.com | Rules, etiquette, first-game guide | Public |
| Coach directory + clinics | CourtReserve, Playtomic | Coach profiles, clinic listings | Public |
| News / media section | Pickleball.com | Articles, local stories | Public |
| Photo + highlight galleries | PodPlay | Event photos, match clips | User |
| Venue management | CourtReserve, PBP | Venue profile, court inventory, hours | Admin |
| Court management | CourtReserve, PBP | Court config, pricing, availability | Admin |
| User moderation | Community platforms | Reports, flags, bans | Admin |
| Content moderation | Community platforms | Event approval, photo review | Admin |
| Booking management | CourtReserve, PBP | View/manage all bookings | Admin |
| Analytics dashboard | Operator tools | Users, revenue, density | Admin |
| API / integrations | DUPR, UTR ecosystem | Rating sync, payment gateway | System |

## Site Map

### Public Pages (/)
```
/                              Home — hero, featured venues, games, clubs, quick stats
/venues                        Venue finder (map + list toggle, filters)
/venues/:slug                  Venue detail (photos, info, courts list, games at venue)
/venues/:slug/book             Court booking (calendar + time slots)
/games                         Game / open play finder (skill, date, distance filters)
/games/:id                     Game detail (info, players, skill, venue, organizer, chat)
/games/create                  Create game / meetup form
/games/:id/invite              Invite players (link, search, friends)
/clubs                         Club finder (search, list)
/clubs/:slug                   Club detail (about, members, events, chat)
/clubs/create                  Create club wizard
/clubs/:slug/membership        Membership plans + signup
/players                       Player directory (search, filter by skill/location)
/players/:id                   Player profile (photo, stats, badges, match history, ratings)
/pricing                       Subscription + membership plans comparison
/leagues                       Leagues + ladders + standings
/leagues/:id                   League detail (teams, schedule, standings)
/tournaments                   Tournament listing
/tournaments/:id               Tournament detail (registration, brackets, results)
/learn                         Beginner guides, rules, etiquette, tutorials
/learn/:city-guide             City-specific pickleball guide
/community                     Groups hub
/community/:id                 Group detail + chat
/coaches                       Coach directory + clinic listings
/news                          News + articles + media
/about                         About + contact
/download                      Download app (App Store + Play Store badge buttons, QR codes)
/search                        Global search (tabbed: venues, games, clubs, players)
/login                         Login (email + social buttons)
/register                      Register (email + social buttons)
/checkout                      Booking / event payment checkout
/city/:slug                    City SEO landing page
```

### User Dashboard (/my)
```
/my/bookings                   My bookings (upcoming, past, cancel/reschedule)
/my/games                      My games (created, joined, pending invites)
/my/events                     My event registrations
/my/payments                   Payment history + receipts
/my/membership                 Subscription / membership management
/my/waitlists                  My waitlisted events
/my/favorites                  Saved venues, clubs, players
/my/groups                     My groups + communities
/my/profile                    Edit profile (name, photo, skill, location, bio)
/my/settings                   Settings (notifications, privacy, account, payment methods)
```

### Admin Dashboard (/admin)
```
/admin/venues                  Manage venues (CRUD, listings)
/admin/venues/:id/courts       Manage courts within venue (name, surface, pricing, hours)
/admin/venues/:id/bookings     Venue booking calendar + manage bookings
/admin/users                   Manage users (list, roles, ban)
/admin/games                   Manage games/events (approve, edit, cancel)
/admin/clubs                   Manage clubs (verify, edit, moderate)
/admin/content                 Moderate content (reviews, photos, discussions)
/admin/reports                 Reports + flags from users
/admin/analytics               Analytics dashboard (users, revenue, density, growth)
```

## Implementation Phases

### Phase 1 — Scaffold + Design System
1. Scaffold Vite + React + TS project
2. Install deps including shadcn/ui (`npx shadcn@latest init`)
3. Tailwind v4 via `@tailwindcss/vite` plugin
4. Copy DESIGN.md tokens into `index.css` `@theme`
5. Set up route tree with react-router-dom (public + user + admin layouts)
6. Create RootLayout, UserLayout, AdminLayout shells
7. Define all TypeScript interfaces in `lib/types.ts`
8. Add shadcn/ui components as needed
9. Build layout components (Header, Footer, MobileMenu, UserSidebar, AdminSidebar)

### Phase 2 — Discovery Pages
1. Home page
2. Venue finder + Venue detail
3. Game finder + Game detail
4. Club finder + Club detail
5. Player directory + Player profile
6. Search page
7. Download page

### Phase 3 — Booking + Payments
1. Court booking flow
2. Booking management (/my/bookings)
3. Checkout page
4. Pricing page
5. Membership signup (/clubs/:slug/membership)
6. Event registration with fee

### Phase 4 — User Dashboard + Community
1. All /my/ pages
2. Create game + Invite players
3. RSVP / waitlist / attendance
4. Player matching
5. Groups/community hub + chat

### Phase 5 — Competition + Content
1. Leagues + Ladders + Round robins
2. Tournaments + Brackets
3. Live scoring
4. DUPR/UTR rating display
5. Learn section
6. Coach directory
7. News section
8. City landing pages (SEO)

### Phase 6 — Admin Dashboard + Polish
1. All /admin/ pages
2. Responsive QA (375px → 1440px)
3. Lighthouse audit + SEO metadata

## Key Decisions

| Decision | Rationale |
|---|---|
| **shadcn/ui** | Zero bundle cost, Radix accessibility, Tailwind-native. Avoids MUI bloat (~100kb+). |
| **Venue ≠ Court** | A venue is a facility with multiple courts. `/venues/:slug` → court list → book specific court. |
| **Three access tiers** | Public (no auth), User (`/my/*`), Admin (`/admin/*`). Route guards based on auth state + role. |
| **No API layer yet** | Demo data in `data/demo/`. Zustand stores abstract access — swapping to real API later is store-only change. |
| **Desktop-first** | Website targets desktop primary, responsive down to mobile. DESIGN.md has desktop specs. |
| **SEO-first** | Every venue, club, city, league gets its own URL. JSON-LD structured data on detail pages. |
