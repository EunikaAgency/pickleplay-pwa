# Navigation Structure

## Cold-start entry

The PWA opens to **LandingScreen** — a welcome surface with "Get Started" and "Sign In" CTAs. Both CTAs route to **LoginScreen**. On logout, the user returns to LandingScreen.

> **Was:** Cold-start opened directly on LoginScreen. There was no marketing/welcome surface before authentication, and logout returned to LoginScreen. See [Change History](#change-history).

## Bottom Tab Bar (only chrome element on tab screens)

| Tab | Icon | Label | Target Screen |
|---|---|---|---|
| 1 | 🏠 | Home | Home feed |
| 2 | 📍 | Nearby | Nearby map / list |
| 3 | ➕ | Create | Inlined create action — calls `onCreate` |
| 4 | 👥 | Clubs | Clubs list |
| 5 | 👤 | Profile | My Profile |

The TabBar absorbs the create action via an `onCreate` handler — there is no separate floating button.

> **Was:** A 5-tab bar (Home, Nearby, Games, Clubs, Profile) plus a separate floating **FAB** for create actions, plus a persistent **TopBar** with logo (left) and search/bell/chat icons (right). The TopBar and FAB were both removed in the redesign. Games is still reachable; the tabs were re-balanced to make room for Create. See [Change History](#change-history).

## Screen Headers

Each screen now owns its own header (title + back button when applicable) instead of relying on a global TopBar. The global search overlay is still reachable, but typically from in-screen search affordances (e.g. the search input on Home) rather than a top-bar icon.

## Filter sheets (bottom sheets, not screens)

Filters are reusable bottom sheets, not routed screens:

- `NearbyFilterSheet` — court / game discovery filters on Nearby tab
- `GameFilterSheet` — game discovery filters on Home and Games tabs

Both open via the shared `BottomSheet` primitive and dismiss without polluting the navigation stack.

> **Was:** Filters were full-screen routed screens (`NearbyFiltersScreen`, `GameFiltersScreen`) pushed onto the navigation stack, requiring a back gesture to return. See [Change History](#change-history).

## Screen Transition Map

```
Cold start
  └─→ Landing → "Get Started" / "Sign In" → Login

Login success
  └─→ first-time → Onboarding → Home
  └─→ returning  → Home

Tab: Home
  └─→ Game card tap   → Game Details (push right)
  └─→ Filter affordance → GameFilterSheet (slide up bottom sheet)
  └─→ Quick action card → target screen (push right)
  └─→ Invites counter → Notifications (push right)

Tab: Nearby
  └─→ Court pin/card tap → Court Details (push right)
  └─→ Filter affordance → NearbyFilterSheet (slide up bottom sheet)
  └─→ Map/List toggle → toggle view (instant)

Tab: Games
  └─→ Game card tap   → Game Details (push right)
  └─→ Filter affordance → GameFilterSheet (slide up bottom sheet)
  └─→ Create (from TabBar) → Create Game (push right)

Tab: Clubs
  └─→ Club card tap → Club Details (push right)
  └─→ Create (from TabBar) → Create Club (push right)

Tab: Profile
  └─→ Edit Profile → Edit Profile form (push right)
  └─→ Settings    → Settings hub (push right)
  └─→ Logout      → Landing

Game Details
  └─→ Players tab   → Players list (tab switch)
  └─→ Chat tab      → Game Chat (tab switch)
  └─→ Invite button → Invite Players (push right)

Club Details
  └─→ Members tab → Members list (tab switch)
  └─→ Chat tab    → Club Chat (tab switch)
  └─→ Events tab  → Club Events (tab switch)

Settings
  └─→ Profile       → Edit Profile (push right)
  └─→ Notifications → Notification Settings (push right)
  └─→ Location      → Location Settings (push right)
  └─→ Logout        → Landing
```

## Deep Link Handling

| URL Pattern | Target |
|---|---|
| `/game/:id` | Game Details |
| `/game/:id/invite/:token` | Game Details + auto-join prompt |
| `/club/:id` | Club Details |
| `/court/:id` | Court Details |

> Deep linking is not yet wired — the current navigation stack is memory-only and resets on reload. Tracked under integration gaps.

## Back Navigation Rules

- Hardware/software back button always goes to previous screen in stack
- On tab screens: back exits app (PWA behavior)
- On detail screens: back returns to parent list
- On a bottom sheet (filters, invite, DUPR explainer): back dismisses the sheet

---

## Change History

| Date | Change |
|---|---|
| 2026-05-27 | Removed global **TopBar** (logo + search + bell + chat). Screen headers are now owned by each screen. |
| 2026-05-27 | Removed standalone **FAB**. Create action inlined into the TabBar via `onCreate`. |
| 2026-05-27 | Added **LandingScreen** as cold-start entry. Login is now reached via Landing CTAs. |
| 2026-05-27 | Filters converted from routed screens to bottom sheets (`NearbyFilterSheet`, `GameFilterSheet`). |
