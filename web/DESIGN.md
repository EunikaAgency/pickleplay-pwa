# PicklePlay Website — Design System

> **Playful Modernism** — A design language blending high-energy neon accents with a clean, mobile-first card architecture. The UI feels "bouncy" and approachable, targeting active lifestyle enthusiasts who value connection over rigid competition.

> The source of truth for this design is the PicklePlay PWA prototype at [`app/`](../app/). All tokens, colors, and components documented here are extracted from the live PWA code ([`app/src/index.css`](../app/src/index.css)) and production mockups ([`mockup/`](../mockup/)).

---

## Design Philosophy

- **Emotional goal:** Move the user from "browsing" to "on the court" with a sense of excitement and encouragement.
- **Tone:** Direct, human, and sporty. "Let's go!" instead of "Submit," "Who's playing?" instead of "Player List."
- **Strategy:** Generous negative space, soft multi-layered depth, vibrant palette kept readable through careful contrast.
- **Accessibility:** Sentence case throughout. Uppercase restricted to small labels (11px and below) so they don't get lost.

---

## Color Palette

### Primary — Electric Blue (`#0040E0`)

The brand anchor. Used for trustworthy yet energetic foundation elements.

| Token | Hex | Usage |
|---|---|---|
| `--color-primary` | `#0040E0` | Branding, active states, primary iconography, top bar logo |
| `--color-primary-container` | `#2E5BFF` | Desktop hero panel, hover states |
| `--color-on-primary` | `#FFFFFF` | Text on primary fills |
| `--color-on-primary-container` | `#EFEFFF` | Text on primary container fills |
| `--color-primary-fixed` | `#DDE1FF` | Avatar backgrounds, subtle highlights |
| `--color-primary-fixed-dim` | `#B8C3FF` | Inverse primary |
| `--color-on-primary-fixed` | `#001356` | Text on primary-fixed surfaces |
| `--color-on-primary-fixed-variant` | `#0035BE` | Text on primary-fixed-dim |
| `--color-inverse-primary` | `#B8C3FF` | Inverted primary (for dark surfaces) |
| `--color-surface-tint` | `#124AF0` | Shadow tint reference |

### Secondary — Neon Lime (`#C1F100`)

High-action accent for primary calls-to-action and critical interactive highlights. Always paired with dark text for accessibility.

| Token | Hex | Usage |
|---|---|---|
| `--color-secondary` | `#506600` | Text on lime backgrounds |
| `--color-secondary-container` | `#C1F100` | Primary buttons, FAB, "Join" actions, active tabs, chips |
| `--color-on-secondary` | `#FFFFFF` | Text on secondary fills |
| `--color-on-secondary-container` | `#546B00` | Text on lime buttons (dark for contrast) |
| `--color-secondary-fixed` | `#C3F400` | Avatar backgrounds |
| `--color-secondary-fixed-dim` | `#ABD600` | Dim variant |
| `--color-on-secondary-fixed` | `#161E00` | Text on secondary-fixed |
| `--color-on-secondary-fixed-variant` | `#3C4D00` | Text on secondary-fixed variants |

### Tertiary — Coral (`#CF3000`)

Warm accent for urgent notifications, error states, and visual contrast against the cool blue palette.

| Token | Hex | Usage |
|---|---|---|
| `--color-tertiary` | `#A32400` | Decorative, tertiary actions |
| `--color-tertiary-container` | `#CF3000` | Notification badges, urgent CTAs |
| `--color-on-tertiary` | `#FFFFFF` | Text on tertiary fills |
| `--color-on-tertiary-container` | `#FFEDE9` | Text on tertiary container |
| `--color-tertiary-fixed` | `#FFDAD2` | Avatar backgrounds |
| `--color-tertiary-fixed-dim` | `#FFB4A2` | Dim variant |

### Error — Red

| Token | Hex |
|---|---|
| `--color-error` | `#BA1A1A` |
| `--color-error-container` | `#FFDAD6` |
| `--color-on-error` | `#FFFFFF` |
| `--color-on-error-container` | `#93000A` |

### Surface & Background

Cool-tinted off-white foundation (`#F8F9FC`) that lets white cards "float" prominently.

| Token | Hex | Usage |
|---|---|---|
| `--color-surface` | `#F8F9FC` | App background, card-adjacent surfaces |
| `--color-surface-dim` | `#D9DADD` | Modal backdrops, dimmed panels |
| `--color-surface-bright` | `#F8F9FC` | Bright variant of surface |
| `--color-surface-container-lowest` | `#FFFFFF` | Cards, login card, elevated panels |
| `--color-surface-container-low` | `#F2F3F6` | Input backgrounds, subtle fills |
| `--color-surface-container` | `#EDEEF1` | Default container level |
| `--color-surface-container-high` | `#E7E8EB` | Quick action tiles, hover states |
| `--color-surface-container-highest` | `#E1E2E5` | Avatar "+" overflow indicator |
| `--color-surface-variant` | `#E1E2E5` | Borders, dividers |
| `--color-background` | `#F8F9FC` | Root background |
| `--color-on-background` | `#191C1E` | Primary text on background |

### Text Colors

| Token | Hex | Usage |
|---|---|---|
| `--color-on-surface` | `#191C1E` | Primary body text (near-black) |
| `--color-on-surface-variant` | `#434656` | Secondary/muted text, subtitles |
| `--color-inverse-on-surface` | `#F0F1F4` | Text on dark/inverse surfaces |

### Outline

| Token | Hex | Usage |
|---|---|---|
| `--color-outline` | `#747688` | Focus rings, dividers |
| `--color-outline-variant` | `#C4C5D9` | Input borders, subtle dividers |

---

## Color Usage Rules

| Color | Do Use | Don't Use |
|---|---|---|
| Electric Blue `#0040E0` | Branding, active states, primary iconography, section headers, active tabs | Every button (reserve for brand anchoring) |
| Neon Lime `#C1F100` | Primary CTAs (Sign In, Create, Join), FAB, active tab indicator, chips | Background fills, large text blocks |
| Coral `#CF3000` | Urgent notifications, error badges, tertiary accents | Primary navigation elements |
| White `#FFFFFF` | Card backgrounds, elevated panels, container-lowest | Page backgrounds (use `#F8F9FC`) |
| Navy `#191C1E` | Body text, high-contrast needs | Decorative use |

---

## Typography

### Font Stack

| Role | Font | Fallback |
|---|---|---|
| **Headings** | `Fredoka` (PWA) / `Rubik` (early mockups) | `system-ui, sans-serif` |
| **Body** | `Nunito Sans` | `system-ui, sans-serif` |
| **Icons** | Material Symbols Outlined | — |

> **Note:** The PWA CSS uses `Fredoka` for headings via `--font-heading`. Early mockups used `Rubik`. Both are rounded geometric sans-serifs — `Fredoka` is the current standard. For new website work, default to `Fredoka` for headings.

### Type Scale

| Token | Size | Line Height | Weight | Letter-spacing | Usage |
|---|---|---|---|---|---|
| `headline-xl` | 36px | 42px | 700 Bold | -0.02em | Hero greeting, large display text |
| `headline-lg` | 28px | 34px | 700 Bold | -0.01em | Section titles ("Discover Games") |
| `headline-lg-mobile` | 25px | 30px | 700 Bold | — | Section titles on small screens |
| `headline-md` | 21px | 28px | 600 SemiBold | — | Card titles, top-bar logo |
| `body-lg` | 16px | 24px | 400 Regular | — | Larger body text, button labels |
| `body-md` | 14px | 21px | 400 Regular | — | Default body, descriptions, metadata |
| `label-sm` | 11px | 14px | 700 Bold | 0.05em UPPERCASE | Labels, badges, tab names, form labels |

### Font Weight Scale

| Weight | Value | Usage |
|---|---|---|
| 400 Regular | `--font-weight-normal` | Body text |
| 600 SemiBold | `--font-weight-semibold` | Card titles, button text, body emphasis |
| 700 Bold | `--font-weight-heading` | All headings, labels, primary CTAs |

No weights below 400 or above 700.

### Rules
- **Sentence case** is default for all UI copy. Never use ALL CAPS for body text.
- **Uppercase** is only permitted for `label-sm` items (form labels, badges, tab items).
- Use SemiBold (600) for emphasis within body — not italics.
- Headings use tighter letter-spacing at large sizes to keep a "sporty" feel.

---

## Shapes & Border Radii

| Token | Value | Usage |
|---|---|---|
| `--radius-xs` | 6px | Minimal rounding, small elements |
| `--radius-sm` | 10px | Subdued container corners |
| `--radius-lg` / `--radius-card` | 12px | Cards, containers (PWA standard) |
| `--radius-input` | 12px | Input fields ("squircle" feel) |
| `--radius-full` | 999px | Buttons, chips, pills, avatars |

### Shape Language

- **Buttons & Chips:** Always pill-shaped (`rounded-full`).
- **Cards:** 12px–14px radius (PWA), 16px (mockup). For new work, use **12px**.
- **Inputs:** 12px radius for a "squircle" look between pill buttons and rectangular cards.
- **Avatars:** Strictly circular to signify community and personhood.
- **Bottom Tab Bar:** Rounded top corners (`rounded-t-[24px]`).
- **Dialogs/Sheets:** Rounded top corners only.

---

## Shadows

All shadows are **tinted with Electric Blue** (`#0040E0`), never pure black. This tethers shadow depth to the brand.

| Token | Value | Usage |
|---|---|---|
| `--shadow-card` | `0 4px 20px -2px rgba(0, 64, 224, 0.10)` | Default card elevation, tiles |
| `--shadow-fab` | `0 8px 30px -4px rgba(0, 64, 224, 0.15)` | FAB, floating elements |
| `--shadow-nav` | `0 -4px 20px -4px rgba(0, 64, 224, 0.10)` | Bottom tab bar (top shadow) |
| Top bar | `0 1px 8px rgba(0, 64, 224, 0.05)` | Subtle header separation |
| Login card | `0 10px 30px -10px rgba(0, 64, 224, 0.15)` | Elevated card states |

### Shadow Layer System

| Depth | Technique | Usage |
|---|---|---|
| Level 0 | No shadow, no border | Background, surface-container, surface-variant |
| Level 1 | Tinted shadow, 10% @ 20px blur | Default card state, tile grid items |
| Level 2 | Tinted shadow, 15% @ 30px blur | FAB, active card states, elevated dialogs |
| Layering | Color blocking (white cards on grey) | Primary separation strategy — not heavy borders |

---

## Spacing

**8px baseline grid system.**

| Token | Value | Usage |
|---|---|---|
| `--spacing-touch-target-min` | 48px | All interactive elements min height/width |
| `--spacing-container-padding` | 20px | Screen/content horizontal padding |
| `--spacing-gutter` | 16px | Gap between adjacent elements |
| `--spacing-card-gap` | 12px | Grid gaps between cards/tiles |

### Common Spacing Map

| Token | Value | Used For |
|---|---|---|
| `px-5` | 20px | Container horizontal padding |
| `p-6` | 24px | Card inner padding |
| `p-8` | 32px | Login card inner padding |
| `gap-3` | 12px | Card grid gaps |
| `gap-4` | 16px | Section-to-section spacing |
| `gap-6` | 24px | Large section gaps |
| `space-y-6` | 24px | Vertical section rhythm |
| `space-y-8` | 32px | Large section separation |
| `pt-6` | 24px | Top padding on main content |
| `pb-24` | 96px | Bottom padding to clear tab bar |
| `h-12` | 48px | Touch target height (buttons, inputs, top bar) |
| `w-14 h-14` | 56px | FAB, social login buttons |

---

## Layout

### Breakpoints

- **Mobile (default):** Single-column, fluid layout with `px-5` padding
- **Tablet (`md:`, ≥768px):** Wider cards, 2-column sections
- **Desktop (`lg:`, ≥1024px):** Max-width `max-w-7xl`, side panels, hero+form split layouts

### Chrome Structure (Standard App Shell — post-redesign)

```
┌──────────────────────────────────────┐
│        OfflineBanner (conditional)   │  z-9999, only when offline
├──────────────────────────────────────┤
│   Screen-owned header (per screen)   │  back arrow + title, optional actions
├──────────────────────────────────────┤
│                                      │
│         Screen Content                │  flex-1, overflow-y-auto
│         (scrollable)                  │  max-w-7xl mx-auto px-5
│                                      │
├──────────────────────────────────────┤
│   Tab Bar (fixed bottom-0 z-50)      │  pb-4 pt-2, rounded-t-[24px]
│   includes inlined Create action     │
└──────────────────────────────────────┘
```

> **Previous chrome (May 26 and earlier):** A persistent global TopBar (h-12, logo + search/bell/chat icons) sat above content, and a separate FAB (56×56, fixed bottom-24 right-6) floated above the TabBar on Home/Games. Both were removed in the May 27, 2026 redesign — see [Change History](#change-history).

### Screen Types & Chrome

| Type | Screens | Screen Header | Tab Bar |
|---|---|---|---|
| **Landing** | landing | Self-rendered hero (no back arrow) | No |
| **Tab screens** | home, nearby, games, clubs, profile | Self-rendered (logo or section title) | Yes |
| **Detail screens** | game-details, court-details, club-details | Back arrow + title + actions | No |
| **Form screens** | create-game, create-club, edit-profile, settings | Back arrow + title | No |
| **Overlay screens** | search, notifications | Hidden / self-rendered | No |
| **Bottom sheets** | nearby-filters, game-filters, invite, DUPR explainer | Sheet handle + title | (inherits host) |
| **Auth screens** | login, onboarding | Hidden / minimal | No |

> The previous table had columns for **Top Bar** and **FAB** — both removed. Filter screens (`nearby-filters`, `game-filters`) moved from Overlay screens to Bottom sheets.

### Tab Bar

- 5 fixed tabs: **Home**, **Nearby**, **Create** (inlined), **Clubs**, **Profile**
- The center "Create" tab fires the `onCreate` handler instead of navigating to a tab screen
- Active tab: `bg-secondary-container` (#C1F100) with `text-on-secondary-container` + filled icon
- Inactive tab: `text-on-surface-variant` with outlined icon
- Container: `bg-surface-container-lowest`, `rounded-t-[24px]`, shadow-nav

> **Previously:** the 5 tabs were Home, Nearby, **Games**, Clubs, Profile, with the create action handled by a separate FAB. Games is still reachable from Home and elsewhere; the tab slot was reclaimed for Create.

---

## Components

### Buttons

| Type | Background | Text | Shape | Extra |
|---|---|---|---|---|
| **Primary CTA** | `bg-secondary-container` (#C1F100) | `text-on-secondary-container` (#546B00) | `rounded-full` | Tinted shadow, `active:scale-95` |
| **Secondary** | `bg-primary-container` (#2E5BFF) | `text-on-primary-container` (#EFEFFF) | `rounded-full` | Tinted shadow |
| **Ghost/Text link** | Transparent | `text-primary` (#0040E0) | Inline | `hover:underline` |
| **Social** (Google, Apple) | Transparent | — | `rounded-full`, 56px circle | `border-outline-variant` 1px |
| **Disabled** | `opacity-50` | Inherited | Same as enabled | `cursor: default` |

All primary buttons: `h-12` (48px min), font `body-lg` (16px) **bold**, centered with optional trailing icon.

### Cards

| Property | Value |
|---|---|
| Background | `bg-surface-container-lowest` (`#FFFFFF`) |
| Border radius | `rounded-[14px]` |
| Border | None (float via shadow) |
| Shadow | `--shadow-card` |
| Inner padding | `p-6` |
| Image header | `h-40`, `object-cover`, `group-hover:scale-105` transition |

### Input Fields

| State | Border | Background | Details |
|---|---|---|---|
| Default | `border-outline-variant` 1px | `bg-surface-container-low` | Icon left gutter (`text-outline`) |
| Focus | `border-primary` 2px | Same | Ring: `ring-2 ring-primary/20`, icon → `text-primary` |
| Placeholder | — | — | Browser-default color |

- Height: `h-12` (48px touch target)
- Radius: `rounded-[12px]`
- Padding: `pl-12 pr-4` (left gutter icon)

### Chips & Tags

| Property | Value |
|---|---|
| Background | `bg-white/90 backdrop-blur` (on images) or solid tint |
| Shape | `rounded-full` |
| Text | `label-sm` (11px, bold, uppercase) |
| Padding | `px-3 py-1` |

### Avatar

| Property | Value |
|---|---|
| Shape | `rounded-full` (strictly circular) |
| Sizes | 32px (standard stack), 48px+ (profile) |
| Border | `border-2 border-white` (for overlapping stacks) |
| Text | Bold initials, 10px font |
| Colors | `bg-primary-fixed`, `bg-secondary-fixed`, `bg-tertiary-fixed`, `bg-surface-container-highest` |

### Quick Action Tiles (Home Screen)

- 2-column grid: `grid-cols-2 gap-3`
- `rounded-[14px]`, padded `p-6`
- Icon in 48px circle, label below (body-lg bold)
- Color variants:
  - **Create Game:** `bg-secondary-container` (Neon Lime)
  - **Find Games:** `bg-primary-container` (Electric Blue)
  - **Create Club / Find Courts:** `bg-surface-container-high` (Neutral)

---

## Icons

- **Set:** Material Symbols Outlined (Google Fonts)
- **Loaded via:** Google Fonts CSS (`Material+Symbols+Outlined`)
- **Wrapper component:** `Icon` in [`app/src/components/ui/Icon.tsx`](../app/src/components/ui/Icon.tsx)
- **CSS class:** `.material-symbols-outlined`
- **Font variation settings pattern:**
  ```css
  font-variation-settings: 'FILL' 0|1, 'wght' 400|600, 'GRAD' 0, 'opsz' 20|24;
  ```
- **Filled state** (`FILL: 1`): Active tabs, emphasized states
- **Outlined state** (`FILL: 0`): Default/inactive (this is the standard)
- **Weight:** 400 default, 600 for active/hover
- **OPSZ:** 20 for icons ≤20px, 24 for larger
- Use the **Rounded** icon style variant where available (not sharp/default or two-tone).

---

## Animations & Micro-interactions

| Element | CSS | Duration | Timing |
|---|---|---|---|
| Button press | `active:scale-95` or `active:scale-90` | Instant | Ease-out |
| Button hover | `hover:opacity-90` / `hover:brightness-105` | 150ms | Ease |
| Tab switch | `transition-all duration-200` + `active:scale-90` | 200ms | Ease |
| Card image zoom | `group-hover:scale-105 transition-transform duration-500` | 500ms | Ease |
| FAB hover/press | `hover:scale-110` / `active:scale-90` | Instant | Ease-out |
| Page enter (slide-up) | `animate-slide-up` — `translateY(16px) → translateY(0)` + opacity | 300ms | Ease-out |
| Loading spinner | `animate-spin` on `sync` icon | Continuous | Linear |

### Keyframes (from index.css)

```css
@keyframes slide-up {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

---

## Responsive Behavior

| Viewport | Layout | Notable Changes |
|---|---|---|
| **Mobile** (<768px) | Single column, `px-5` container padding | 2-col quick action grid, full-width cards |
| **Tablet** (768px–1023px) | Wider cards, horizontal layouts | `md:flex-row` cards, `md:grid-cols-4` actions |
| **Desktop** (≥1024px) | `max-w-7xl` centered, side panels | Login: hero panel (left) + form (right) split |

---

## UI Copy Voice & Tone

| Context | Example |
|---|---|
| Hero greeting | **"Ready to play, Alex?"** |
| Subtitle | *"There are 12 open games near you today!"* |
| Empty state | *"No games yet. Be the first to create one!"* |
| Login headline | **"Welcome Back"** — subtitle: *"Ready to hit the courts?"* |
| Brand tagline | *"Enter the Kitchen."* |
| CTA | **"Sign In"** / **"View Details"** / **"Join the league"** |
| Encouraging | **"You're on a roll!"** — *"You've played 4 games this week."* |
| Player list | **"Who's playing?"** (not "Player List") |
| Submit action | **"Let's go!"** (not "Submit") |

---

## Implementation Reference

### PWA Tailwind v4 Theme (source: `app/src/index.css`)

```css
@theme {
  --font-heading: 'Fredoka', 'Rubik', system-ui, sans-serif;
  --font-body: 'Nunito Sans', system-ui, sans-serif;

  /* Electric Blue primary palette */
  --color-primary: #0040e0;
  --color-primary-container: #2e5bff;
  /* ... see full palette above ... */

  /* Typography scale */
  --text-headline-xl: 36px;
  --text-headline-xl--line-height: 42px;
  --text-headline-xl--letter-spacing: -0.02em;
  /* ... see full type scale above ... */

  /* Shadows */
  --shadow-card: 0 4px 20px -2px rgba(0, 64, 224, 0.10);
  --shadow-fab: 0 8px 30px -4px rgba(0, 64, 224, 0.15);
  --shadow-nav: 0 -4px 20px -4px rgba(0, 64, 224, 0.10);
}
```

### Icon Component (TypeScript)

```tsx
function Icon({ name, size = 24, filled = false, weight = 400 }) {
  return (
    <span
      className="material-symbols-outlined"
      style={{
        fontSize: size,
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' ${weight}, 'GRAD' 0, 'opsz' ${size <= 20 ? 20 : 24}`,
      }}
    >
      {name}
    </span>
  );
}
```

### Google Fonts Import URLs

```
https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600;700&family=Nunito+Sans:wght@400;600;700&family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap
```

---

## Source Files Reference

| File | What It Defines |
|---|---|
| [`app/src/index.css`](../app/src/index.css) | Tailwind v4 theme: all color tokens, typography scale, radii, shadows, spacing, keyframe animations |
| [`app/src/App.tsx`](../app/src/App.tsx) | Chrome framework: TabBar visibility, navigation stack, DemoStateProvider, OfflineBanner, InstallPrompt |
| [`app/src/components/ui/Icon.tsx`](../app/src/components/ui/Icon.tsx) | Material Symbols wrapper component |
| [`app/src/components/layout/TabBar.tsx`](../app/src/components/layout/TabBar.tsx) | Bottom tab bar (now the sole chrome element — includes inlined `onCreate`) |
| [`app/src/components/ui/BottomSheet.tsx`](../app/src/components/ui/BottomSheet.tsx) | Shared bottom-sheet primitive used by filter sheets and invite/explainer surfaces |
| [`app/src/screens/LandingScreen.tsx`](../app/src/screens/LandingScreen.tsx) | New cold-start welcome surface |
| [`app/src/screens/LoginScreen.tsx`](../app/src/screens/LoginScreen.tsx) | Login flow — form component patterns |
| [`app/src/screens/HomeScreen.tsx`](../app/src/screens/HomeScreen.tsx) | Home screen — quick actions, cards, discover games |
| [`app/Redesign/`](../app/Redesign/) | Latest visual reference (JSX prototype + iOS frame + tweaks panel) |
| [`mockup/home_pickleplay_playful/code.html`](../mockup/home_pickleplay_playful/code.html) | Production-style static mockup (Tailwind CDN) |
| [`mockup/login_pickleplay_playful/code.html`](../mockup/login_pickleplay_playful/code.html) | Login mockup with mesh background |
| [`mockup/pickleball_social_play/DESIGN.md`](../mockup/pickleball_social_play/DESIGN.md) | Original design document (designer reference) |
| [`docs/DESIGN-TOKENS.md`](../docs/DESIGN-TOKENS.md) | Early PWA design tokens (legacy, superseded by index.css) |

---

## Change History

| Date | Change |
|---|---|
| 2026-05-27 | Chrome diagram updated: removed global TopBar and standalone FAB. Tab Bar is now the sole chrome element and includes the create action inline via `onCreate`. |
| 2026-05-27 | Screen Types & Chrome table updated: dropped Top Bar / FAB columns; added Landing row; moved filter screens to "Bottom sheets" type. |
| 2026-05-27 | TabBar tabs re-balanced — center slot reclaimed for **Create** (Games remains reachable from Home and elsewhere). |
| 2026-05-27 | Removed standalone FAB section. |
| 2026-05-27 | Source files reference table updated to point to TabBar (sole chrome), BottomSheet primitive, LandingScreen, and the `app/Redesign/` reference prototype. |

> Previous chrome (TopBar + 5-tab TabBar + FAB) is preserved in earlier commits and described inline in the diagram/table notes above so reviewers can compare.
