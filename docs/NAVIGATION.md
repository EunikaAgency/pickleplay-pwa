# Navigation Structure

## Bottom Tab Bar (always visible on main screens)

| Tab | Icon | Label | Target Screen |
|---|---|---|---|
| 1 | 🏠 | Home | Home feed |
| 2 | 📍 | Nearby | Nearby map |
| 3 | 🎾 | Games | Games list |
| 4 | 👥 | Clubs | Clubs list |
| 5 | 👤 | Profile | My Profile |

## Top Bar (on main tab screens)

| Position | Element | Action |
|---|---|---|
| Left | App logo | Scroll to top / refresh |
| Right | Search icon | Open Search overlay |
| Right | Bell icon | Open Notifications |
| Right | Chat icon | Open Active Chats |

## FAB (floating action button)

**Visible on**: Home, Games tabs

**Options on press**:
1. Create Game → Create Game form
2. Create Open Play → Create Meet form (Phase 3)
3. Create Round Robin → Round Robin creation (Phase 2)
4. Create Club → Create Club wizard
5. Create Competition → Competition creation (Phase 3)

## Screen Transition Map

```
Tab: Home
  └─→ Game Card tap → Game Details (push right)
  └─→ Filter icon → Game Filters (slide up bottom sheet)
  └─→ Quick Action card → target screen (push right)
  └─→ Invites counter → Pending Invites (push right)

Tab: Nearby
  └─→ Court pin/card tap → Court Details (push right)
  └─→ Filter icon → Court Filters (slide up bottom sheet)
  └─→ Map/List toggle → toggle view (instant)

Tab: Games
  └─→ Game card tap → Game Details (push right)
  └─→ Filter icon → Game Filters (slide up bottom sheet)
  └─→ + FAB → Create Game (push right)

Tab: Clubs
  └─→ Club card tap → Club Details (push right)
  └─→ + FAB → Create Club (push right)

Tab: Profile
  └─→ Edit Profile → Edit Profile form (push right)
  └─→ Settings → Settings hub (push right)

Global (top bar)
  └─→ Search icon → Search overlay (full screen, fade)
  └─→ Bell icon → Notifications (push right)
  └─→ Chat icon → Active Chats (push right)

Game Details
  └─→ Players tab → Players list (tab switch)
  └─→ Chat tab → Game Chat (tab switch)
  └─→ Invite button → Invite Players (slide up sheet)
  └─→ Edit button → Edit Game (push right)

Club Details
  └─→ Members tab → Members list (tab switch)
  └─→ Chat tab → Club Chat (tab switch)
  └─→ Events tab → Club Events (tab switch)

Settings
  └─→ Profile → Edit Profile (push right)
  └─→ Notifications → Notification Settings (push right)
  └─→ Location → Location Settings (push right)
```

## Deep Link Handling

| URL Pattern | Target |
|---|---|
| `/game/:id` | Game Details |
| `/game/:id/invite/:token` | Game Details + auto-join prompt |
| `/club/:id` | Club Details |
| `/court/:id` | Court Details |

## Back Navigation Rules
- Hardware/software back button always goes to previous screen in stack
- On tab screens: back exits app (PWA behavior)
- On detail screens: back returns to parent list
- On modal/sheet: back closes the modal/sheet
