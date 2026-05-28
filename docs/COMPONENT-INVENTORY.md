# Component Inventory — Reusable UI Components

## UI Primitives (`src/components/ui/`)

| Component | Props | States | Used In |
|---|---|---|---|
| `Button` | variant (primary/secondary/dark/ghost), size (sm/md/lg), disabled, loading, fullWidth, onPress | default, hover, pressed, disabled, loading | Every screen |
| `Card` | padding, shadow, onPress | default, pressable | Lists, feeds |
| `Badge` | variant (info/success/warning/danger/premium), size (sm/md) | — | Game cards, club cards |
| `Chip` | label, selected, onPress | selected, unselected | Filters, date selectors |
| `Avatar` | src, name, size (sm/md/lg/xl), onPress | default, with image, fallback initials | Profiles, lists, chat |
| `Icon` | name, size, filled, weight | — | Everywhere |
| `Segmented` | options, value, onChange | — | Map/List toggle, My/Upcoming/Completed |
| `BottomSheet` | visible, onClose, title, children | open, closing, closed | Filter sheets, DUPR explainer, invite |
| `EmptyState` | icon/illustration, title, description, action ({label, onPress}) | — | All empty lists |
| `ErrorState` | title, message, onRetry | — | API failure surfaces |
| `LoadingSkeleton` | shape (line/card/avatar), count | — | Lists, detail screens during fetch |
| `Toast` | message, tone, duration | enter, visible, leave | Action confirmations, errors |
| `GameRow` | game, onPress | default, pressable | Compact game list rows |
| `CourtIllustration` | size, variant | — | Empty states, Landing, hero areas |
| `DuprExplainerSheet` | visible, onClose | — | Inline "what is DUPR?" affordance during onboarding/profile |
| `OfflineBanner` | forceShow | — | Top of app shell when offline (or demo offline mode) |
| `InstallPrompt` | hasBottomChrome | iOS variant, Android `beforeinstallprompt` variant, dismissed | App shell |
| `DemoStateControl` | — | normal / empty / loading / error / offline | Globally mounted for reviewers |

### Removed primitives

| Component | Replaced By | Reason |
|---|---|---|
| `TopBar` | per-screen headers | Global TopBar removed; screens now own their own header (back arrow, title, contextual actions) |
| `FAB` | `TabBar.onCreate` | Create action inlined into the bottom tab bar to consolidate chrome |
| `Sidebar` | n/a | Drawer pattern was redundant with TabBar + Profile-driven settings access |
| `LoadingSpinner` | `LoadingSkeleton` | Spinners flashed empty layouts; skeletons reduce perceived latency by matching final shape |
| `Modal` | `BottomSheet` (mobile) | Mobile flows favor bottom sheets; `Modal` may return for desktop work in `/web` |
| `TabBar` (as listed primitive) | still present, just moved to chrome | TabBar lives under `components/layout/`, not `components/ui/`; remains the sole chrome element |

## Filter Sheets (`src/components/filters/`)

| Component | Purpose |
|---|---|
| `NearbyFilterSheet` | Court / game discovery filters (court type, surface, amenities, distance, skill) — opens over Nearby |
| `GameFilterSheet` | Game discovery filters (skill, type, day, time, distance) — opens over Home and Games |

## Form Library (`src/components/forms/`)

| Component | Purpose |
|---|---|
| `FormField` | Labeled input wrapper with error + helper text |
| `FormSelect` | Labeled select wrapper |
| `FormTierPicker` | Skill-tier picker bound to `lib/skillTiers.ts` |

Paired with the `useForm` hook (`src/hooks/useForm.ts`) for generic form state + validation.

## Hooks (`src/hooks/`)

| Hook | Purpose |
|---|---|
| `useForm` | Generic form state + validation |
| `usePrefersReducedMotion` | Respects OS reduce-motion preference for animations |
| `useTheme` | Applies the current theme to `<html>` |

## App-level State (`src/lib/`)

| Module | Purpose |
|---|---|
| `types.ts` | Core domain types: `Court`, `User`, `Game`, `Club`, `Message` |
| `demoState.tsx` | `DemoStateProvider` + `useDemoState()` for runtime switching between normal / empty / loading / error / offline review modes |
| `skillTiers.ts` | Skill-tier definitions and helpers |

## Domain Components

### Courts

| Component | Props | Used In |
|---|---|---|
| `CourtCard` | court, onPress, onFollow | Nearby list, search results |
| `CourtMap` | courts, selectedCourt, onSelectCourt, userLocation | Nearby map |
| `CourtDetailsHero` | court | Court Details |

> The legacy `CourtFilters` component was replaced by `NearbyFilterSheet` (filter sheet, not embeddable component).

### Games

| Component | Props | Used In |
|---|---|---|
| `GameCard` | game, onPress | Home feed, Games list, search results |
| `GameRow` | game, onPress | Compact list rows (e.g. Games tab, Court Details > games this week) |
| `GameForm` | initialValues, onSubmit, loading | Create Game, Edit Game |
| `GameStatusBadge` | status, visibility | Game cards, Game Details |
| `AttendeeList` | participants, onRemove, onApprove | Game Details > Players tab |
| `InviteSheet` | gameId, onClose | After game creation, Game Details (now BottomSheet-based) |

> The legacy `GameFilters` component was replaced by `GameFilterSheet`.

### Clubs

| Component | Props | Used In |
|---|---|---|
| `ClubCard` | club, onPress | Clubs list, search results |
| `ClubWizard` | onComplete | Create Club |
| `ClubTabs` | club, activeTab | Club Details |

### Chat

| Component | Props | Used In |
|---|---|---|
| `MessageBubble` | message, isOwn | Chat screens |
| `MessageList` | messages, loading, onRefresh | Chat screens |
| `ChatComposer` | onSend, disabled | Chat screens |

### Profile

| Component | Props | Used In |
|---|---|---|
| `ProfileCard` | user, editable, onEdit | Profile, Player Profile |
| `SkillPicker` | value, onChange | Edit Profile, Onboarding, Game creation (now backed by `FormTierPicker` + `skillTiers`) |

### Layout (`src/components/layout/`)

| Component | Props | Used In |
|---|---|---|
| `TabBar` | activeTab, onTabPress, onCreate | Sole chrome element; bottom tab bar with inlined create action |

> The previous Layout inventory listed `ScreenShell`, `ScrollContainer`, `SectionHeader`. Those patterns are now handled inline by each screen rather than via shared wrappers.

## State Coverage

Every component that loads data must handle:
1. **Loading**: `LoadingSkeleton` matching the eventual content layout
2. **Error**: `ErrorState` with retry
3. **Empty**: `EmptyState` — illustration + description + CTA
4. **Success**: Rendered content

This is non-negotiable. No component ships without all 4 states. The `DemoStateProvider` lets any reviewer toggle through all 4 states without code changes.

## Component File Template

```tsx
// src/components/ui/Button.tsx
import { type ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'dark' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  // component implementation
}
```

---

## Change History

| Date | Change |
|---|---|
| 2026-05-27 | Removed `TopBar`, `FAB`, `Sidebar` from layout primitives. Removed `LoadingSpinner` in favor of `LoadingSkeleton`. Removed standalone `CourtFilters` / `GameFilters` embeddable components — replaced by bottom sheets. |
| 2026-05-27 | Added `BottomSheet`, `CourtIllustration`, `DemoStateControl`, `DuprExplainerSheet`, `GameRow`, `LoadingSkeleton`, `OfflineBanner`, `Segmented`, `Toast` to UI primitives. |
| 2026-05-27 | Added `components/filters/` (NearbyFilterSheet, GameFilterSheet) and `components/forms/` (FormField, FormSelect, FormTierPicker) directories. |
| 2026-05-27 | Added hooks (`useForm`, `usePrefersReducedMotion`, `useTheme`) and lib helpers (`demoState`, `skillTiers`). |
| 2026-05-27 | `TabBar` now accepts an `onCreate` handler — create action is no longer a separate FAB. |
