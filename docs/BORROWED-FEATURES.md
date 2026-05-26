# Borrowed Features — Source Attribution & Justification

## From Pickleheads (Primary Reference)

| Feature | Why Borrowed | Implementation Notes |
|---|---|---|
| 5-tab navigation | Proven IA for pickleball discovery apps | Renamed "Groups" → "Clubs", "Stats" → merged into Profile |
| Teal/coral/navy palette | Friendly, sporty, distinct from generic apps | Exact hex values in DESIGN-TOKENS.md |
| Card-based UI | Clean, scannable, mobile-optimized | All list items are cards with soft shadow |
| Game creation flow | Best-in-class organizer UX | Quick Game form → success modal → invite prompt |
| Court map/list toggle | Essential discovery pattern | Leaflet for map, cards for list |
| Home with quick actions + game feed | Single dashboard for player and organizer | Cards: Create Game, Find Games, Create Club |
| Onboarding checklist | Gentle new-user activation | 5 steps, all skippable, progress tracked |
| Round robin formats | Differentiator for serious organizers | Start with 4 formats (Popcorn, Gauntlet, Pool Play, Shuffle) |
| Reusable player lists | Reduces repeat organizer work | Private to organizer, populated from search/contacts |
| Multi-channel invites | Flexible sharing (link, QR, player search) | Link + player search for Phase 1; QR for Phase 2 |
| Subscription tiers | Monetization reference for Phase 6 | Plus/Pro/Ultra model — same structure |
| Notification preferences | Fine-grained control that users value | Simplify to essential categories for Phase 1 |

## From ReClub (Community Structure)

| Feature | Why Borrowed | Implementation Notes |
|---|---|---|
| Clubs as durable hubs | Makes communities sticky | Sub-tabs for activities, discussion, members, library, chat |
| Club announcements | Keeps members informed | Pinned posts from club admins |
| Club library | Useful for organized clubs | Links + files; simple implementation |
| Activity feed | Social proof and engagement | Fan-out on write; simple event types |
| Tile-based creation menu | Cleaner than long dropdown | Use as FAB expansion with clear icons |
| Meet vs Game vs Competition | Clear user mental model | Different creation forms, different badges |
| Global search overlay | Unified discovery | Tabbed results: Courts, Games, Players, Clubs |

## From Playtomic (Consumer Polish)

| Feature | Why Borrowed | Implementation Notes |
|---|---|---|
| "I want to play" wizard | Beginner-friendly discovery | Step-by-step: sport → skill → location → results |
| Skill-based suggestions | Personalized experience | Simple heuristic, no ML needed |
| Clean empty states | Less intimidating | Every empty list: illustration + friendly text + one CTA |
| Visual discovery feed | Better browsing | Larger images, clearer CTAs, more whitespace |

## From PlayByPoint (Facility Readiness — Data Model Only)

| Feature | Why Borrowed | Implementation Notes |
|---|---|---|
| Court availability model | Future booking prep | JSONB field, nullable, no UI yet |
| Court price field | Transparency | Simple text string; parse later |
| External booking link | Partner integration path | URL field; validate protocol |
| Partner facility tag | Monetization path | Boolean + date; filterable |
| Facility contact details | Complete court profile | Phone, email, website fields |

## NOT Borrowed (with Reasons)

| Feature | Source | Reason |
|---|---|---|
| Full court booking checkout | PBP | Different product category; huge complexity |
| Membership management | PBP | Requires legal agreements, admin tools |
| Waivers / proof of residency | PBP | Legal liability, document storage |
| Club credits / billing passes | PBP | Payment complexity; Phase 6 at earliest |
| Family profiles | PBP | Niche; adds navigation depth |
| 17-section settings | PBP | Anti-pattern; keep settings minimal |
| Booking marketplace | PT | Different product direction |
| Coaches directory | RC | Requires coach verification ecosystem |
| Full social network feed | RC | Keep community lightweight |
| 11 round robin formats | PH | Start with 4; add based on data |
| DUPR integration | PH | Requires business partnership |
| Stripe payment processing | PH | Legal/compliance; Phase 6 |
| Learning/classes marketplace | PT | Requires instructor ecosystem |
