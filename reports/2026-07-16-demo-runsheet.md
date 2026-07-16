# PickleBallers — Live Demo Run-Sheet
**As of 16 Jul 2026 · presenter's copy (internal)**

## Setup
- **Preview:** https://pickleballer-pwa.eunika.xyz
- **Login:** open the app → Sign in → **Quick test login** buttons. All passwords `password123`.
  - Player = **Player 1** · Owner = **Owner 1** · Organizer = **Organizer 1**
  - Staff = type `staff@example.com` / `password123` (no quick button)
- **Viewport tip:** demo the player/organizer/coach flows on a **phone-sized window**; owner/staff on a **wide desktop window**.
- Have both progress boards open in a tab as backup (client-safe URL for screen-share).

---

## Act 0 — Framing (no clicks, ~2 min)
> "Last 8 July we set the direction: one app, role-based. Here's where each item lands a week later — 14 of 24 shipped, 6 in polish, 4 waiting on your decision."
Open the **client board** on screen.

## Act 1 — PLAYER · the core (login: Player 1, phone) ~8 min
| Step | Click path | Say | Proves |
|---|---|---|---|
| Home | after login you land on Home | "Three actions — Play, Book Court, Find Coach — plus a Friends rail and a live Social badge." | 12, 23 |
| Discover | tap **Play** | "One ranked list — time, distance, skill, spots, friends. Cards show venue, skill, distance, price, host, spots." | 1, 2, 4 |
| Sort/Filter | tap **Sort**, then **Filter** | "Five sorts; filters for skill, who-can-play, venue, date, distance, type, cost." | 16, 17 |
| Eligibility | scroll to a **Not Eligible** card | "Skill/gender eligibility — restricted sessions are marked before you open them." | (post-mtg) |
| Join | open a session → **I'm Interested** | "One tap to signal you're coming; it shows in Joined." | 3 |
| Social | tap **Social** → **PickleFeed** | "A Threads-style feed — post, like, comment, repost, share a game. Then Clubs and Friends behind one switch." | 13, 14, 15 |
| Coach | Home → **Find Coach** → open a coach → **Book a session** | "Only subscribed, verified coaches appear. Pick a date on the calendar, add a note. Nothing's charged now — you pay the coach on accept." | 21, 23 |
| Court | Home → **Book Court** | "Standard booking — with recurring court holds and a 3-day free-cancel window." | — |

## Act 2 — ORGANIZER · the licence to charge (login: Organizer 1, phone) ~3 min
1. Show the **Organizer subscription (₱999 / 30 days)** — "This is what lets an organizer charge a join fee."
2. **Create game / Open Play** → set a **join fee** — "The fee field only unlocks with an active subscription; everyone else is fixed at ₱0."
3. **Recurring series** → pick days + weeks — "Weekly Open Play, generated automatically; editable one / future / whole series."
> Note for the room: collecting that join fee is ready to build once we confirm the **payment rules (decision 2)**.

## Act 3 — COACH · end to end (player-facing + owner approval) ~3 min
1. As a player, **Find Coach** shows only subscribed coaches with a **verified badge**.
2. Show **Become a coach (₱499 / 30 days)** — "This subscription is the platform's live coach revenue."
3. Coach **applies at a venue** → later approved by the owner (Act 4, Partners).
> Note: session fee is paid to the coach today; a per-session commission is **decision 4**.

## Act 4 — VENUE OWNER · real operations (login: Owner 1, desktop) ~5 min
| Step | Click path | Say | Proves |
|---|---|---|---|
| Console | sidebar: Home/Venues/Calendar/Bookings/Pricing/Reservation/Partners/Social/Messages/Shop | "Full owner console — all menus restored." | — |
| Manual reservation | **Reservation** → pick venue+court, date, time, customer, **how booked** (Walk-in/Phone/Messenger/IG/Other), payment → Save | "Off-app bookings — calls, Messenger, walk-ins — recorded and blocking the slot." | 5 |
| Calendar | **Calendar** | "The manual reservation now blocks that court/time; server refuses double-booking." | 5 |
| Pricing | **Pricing** | "Variable, time-based pricing — peak, weekend, holiday, early-bird." | — |
| Partners | **Partners** → Approve a coach/organizer | "Owners approve who coaches or organizes at their venue." | 22 |
| Reports | **Reports** | "Owner-only financials — bookings, revenue, trends, CSV/PDF." | 11 |
| Messages | **Messages** | "Shared venue inbox — owner + staff, shown under the venue's name/photo." | 9 |

## Act 5 — STAFF · scoped access (login: staff@example.com, desktop) ~3 min
1. Sidebar footer reads **Staff**; inherits **all owner venues** automatically (Venues list — **no Delete**).
2. **Can:** Front Desk, Calendar, Bookings, Reservation, daily takings.
3. **Cannot:** Pricing, Reports/Revenue, Social, Create game.
4. **Messages:** venue conversations only.
> Internal note (don't say to client): the pricing/insights blocks are UI-level today; a server-side enforcement pass is the next hardening step.

## Act 6 — DECISIONS to confirm (~4 min)
Walk the 7, in order: **1** lobby · **2** Open Play payments · **3** eligibility behavior · **4** coach commission · **5** Like vs Interested · **6** homepage wording · **7** Events-as-tabs + staff figures.
> Close: "Nothing here is blocked by engineering — these are your calls, and each one lets us finish a specific feature."

---
### If something fails live
- Feature won't load → switch to the **backup screenshot** for that step (index attached).
- Data looks empty → try the other demo account (Player 2 / Owner 2 / Organizer 2).
- Keep the **client board** on screen as the narrative spine; dip into the app per act.
