# Component Inventory — Reusable UI Components

## UI Primitives (`src/components/ui/`)

| Component | Props | States | Used In |
|---|---|---|---|
| `Button` | variant (primary/secondary/dark/ghost), size (sm/md/lg), disabled, loading, fullWidth, onPress | default, hover, pressed, disabled, loading | Every screen |
| `Card` | padding, shadow, onPress | default, pressable | Lists, feeds |
| `Input` | label, placeholder, value, error, type, onChange | default, focus, error, disabled | Forms |
| `Badge` | variant (info/success/warning/danger/premium), size (sm/md) | — | Game cards, club cards |
| `Chip` | label, selected, onPress | selected, unselected | Filters, date selectors |
| `Avatar` | src, name, size (sm/md/lg/xl), onPress | default, with image, fallback initials | Profiles, lists, chat |
| `BottomSheet` | visible, onClose, title, children | open, closing, closed | Filters, create menus |
| `Modal` | visible, onClose, title, children | open, closing, closed | Confirmations, success states |
| `EmptyState` | icon, title, description, action ({label, onPress}) | — | All empty lists |
| `Tabs` | tabs ([{label, count}]), activeIndex, onChange | — | Games, Clubs, Court Details |
| `TabBar` | activeTab, onTabPress | — | Root navigation |
| `TopBar` | title, showBack, showSearch, showBell, showChat, onBack | — | Screen chrome |
| `FAB` | onPress, options | closed, open | Home, Games tabs |

## Domain Components

### Courts

| Component | Props | Used In |
|---|---|---|
| `CourtCard` | court, onPress, onFollow | Nearby list, search results |
| `CourtMap` | courts, selectedCourt, onSelectCourt, userLocation | Nearby map |
| `CourtFilters` | filters, onChange, onApply, onClear | Nearby filter sheet |
| `CourtDetailsHero` | court | Court Details |

### Games

| Component | Props | Used In |
|---|---|---|
| `GameCard` | game, onPress | Home feed, Games list, search results |
| `GameFilters` | filters, onChange, onApply, onClear | Home, Nearby, Games filter sheets |
| `GameForm` | initialValues, onSubmit, loading | Create Game, Edit Game |
| `GameStatusBadge` | status, visibility | Game cards, Game Details |
| `AttendeeList` | participants, onRemove, onApprove | Game Details > Players tab |
| `InviteSheet` | gameId, onClose | After game creation, Game Details |

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
| `SkillPicker` | value, onChange | Edit Profile, Onboarding, Game creation |

### Layout

| Component | Props | Used In |
|---|---|---|
| `ScreenShell` | children, withTabBar | All screens |
| `ScrollContainer` | children, onRefresh, refreshing | Feed screens |
| `SectionHeader` | title, action ({label, onPress}) | Lists |

## State Coverage

Every component that loads data must handle:
1. **Loading**: Skeleton/spinner while fetching
2. **Error**: Inline error message with retry
3. **Empty**: Friendly illustration + description + CTA
4. **Success**: Rendered content

This is non-negotiable. No component ships without all 4 states.

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
