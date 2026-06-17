# Pickleballers — Professional Design Specification Document
### Version 1.0 | Reverse Engineered from pickleballers.com + Mobile App Screenshots
### Fonts Confirmed via Inspection: **Lexend Variable** + **Grandstander Variable**

> **Audience:** Product Designers · UX Designers · Frontend Developers · AI UI Builders · Design Systems Teams  
> **Source:** Desktop screenshot (pickleballers.com), Mobile app screenshot (iOS/Android), QR card visual

---

## Table of Contents

1. [Brand Personality](#1-brand-personality)
2. [Visual Design Language](#2-visual-design-language)
3. [Color System](#3-color-system)
4. [Typography System](#4-typography-system)
5. [Iconography](#5-iconography)
6. [Illustration Style](#6-illustration-style)
7. [Layout System](#7-layout-system)
8. [Component Library](#8-component-library)
9. [Mobile Design System](#9-mobile-design-system)
10. [Desktop Design System](#10-desktop-design-system)
11. [UX Principles](#11-ux-principles)
12. [Motion Design](#12-motion-design)
13. [Accessibility](#13-accessibility)
14. [Design Tokens](#14-design-tokens)
15. [Recreate the Design DNA](#15-recreate-the-design-dna)

---

## 1. Brand Personality

### Brand Archetype
**The Community Builder** — Pickleballers is the "town square" for pickleball players. It organizes, connects, and enables community without ego. It leads with helpfulness, not authority.

### Emotional Tone
| Dimension | Expression |
|---|---|
| Primary emotion | **Welcoming warmth** — "Hi, Na!" — the product greets you like a friend |
| Secondary emotion | **Playful energy** — the sport is fun, the product reflects that |
| Tertiary emotion | **Reliable trust** — 691,300 members, structured data, partner logos |
| Avoided emotion | Cold, corporate, intimidating, exclusive |

### Product Positioning
> "The #1 platform for round robins, leagues, and tournaments."

Pickleballers positions itself as the **operational backbone** of recreational pickleball — not just a court finder, but the full-stack organizer for the community. It handles discovery, scheduling, payments, and social coordination in one place.

### Target Users
| Persona | Description |
|---|---|
| **Recreational Player** | Wants to find games nearby, meet people, improve skill |
| **Organizer / Facility Manager** | Runs leagues, events, round robins; needs scheduling tools |
| **New Player** | Just learning; needs guides, coaching, beginner content |
| **Coach / Instructor** | Lists lessons, builds reputation, finds students |
| **Group Organizer** | Creates and manages recurring play groups |

### Trust Signals
- **Hard community numbers:** 691,300 members · 4,253,030 games · 24,600 locations · 9,700 cities
- **Endorsed by leading pickleball organizations around the world** — USAPA, IAPF, PPR logos in partner strip
- **Structured, professional content:** How-to guides, gear reviews, clinic videos
- **Free to start:** Lowers friction and builds trust before asking for commitment

### Community Aspects
- Personal greeting by first name ("Hi, Na!")
- Invitation & message inbox visible on home
- Group creation tools
- "Find games near you" discovery model
- Social proof at footer: largest pickleball community

### Visual Identity
- **Mascot-driven:** Lime-green pickleball character with headband is the emotional core of the brand
- **Blue + Lime** color scheme signals reliability + energy
- **Rounded typography + pill shapes** keep the feel approachable, never corporate
- Consistent character (the mascot) across web, app, and QR card creates brand coherence

### Personality Traits
`Friendly` · `Playful` · `Community-first` · `Sporty` · `Accessible` · `Organized` · `Welcoming` · `Trustworthy` · `Modern` · `Casual but reliable`

---

## 2. Visual Design Language

### Overall Visual Style
**Friendly Sports-Tech UI** — a hybrid of consumer social apps (think Meetup, Strava, Eventbrite) with a recreational sports sensibility. Clean, card-based, highly scannable. Never sterile.

### Design Era Influence
**2020–2025 Consumer App Design** — influenced by Material Design 3 and Apple HIG's rounded, soft, accessible aesthetic. But grounded in the warmth of sports community apps rather than the precision of SaaS dashboards.

### Modern vs Traditional Ratio
`85% Modern` / `15% Traditional` — Predominantly modern UI with a touch of friendly, almost retro character in the mascot illustration style.

### Flat vs Skeuomorphic
**Flat with soft depth.** Cards use subtle shadows for lift. No gradients except in mascot illustrations. No textures, no fake 3D. The QR card uses a dark background to make the code pop — purely functional contrast.

### Illustration Style
- **Semi-flat character illustration** — the mascot has bold outlines, flat fills, and simple shading
- Spot illustrations for empty states and onboarding
- Photography used for courts/players (realistic, aspirational)
- Illustration and photography never mixed in the same section

### Iconography Style
- **Dual-tone outlined icons** — Ink Navy outline with occasional Pickleballers Blue accent
- Consistent stroke weight across the set
- Slightly rounded corners to match brand softness
- Navigation icons transition from outline (inactive) to filled (active)

### Shapes and Geometry
- **Dominant shape:** Pill / fully-rounded rectangle — used in buttons, filters, tags, search bars
- **Secondary shape:** Rounded rectangle (12–16px radius) — used in cards, modals, panels
- **Tertiary shape:** Circle — avatars, quick-action buttons, mascot progress ring
- **Zero sharp corners** anywhere in the product

### Use of Whitespace
**Generous and intentional.** The desktop site uses large section padding to let content breathe. The mobile app uses card separation and section gaps to create clear visual rhythm. Never feels cluttered despite high information density.

### Density Level
**Medium density on mobile.** Comfortable touch targets, clear section breaks, but efficient use of screen space. **Low-to-medium density on desktop** — sections have room, but stats and content grids increase density purposefully.

### Motion Philosophy
**Subtle and functional.** Transitions exist to orient the user, not to impress them. Mascot progress ring animates on load. Navigation tab switching uses a soft fade or slide. Hover states are gentle, not flashy.

---

## 3. Color System

### Primary Colors
| Usage | Color Name | Hex | Emotional Purpose |
|---|---|---|---|
| Brand / Nav Background | **Pickleballers Blue** | `#3355FF` | Authority, trust, depth — the anchor of the brand |
| Primary CTA / Active State | **Pickleballers Lime** | `#CCFF33` | Energy, action, optimism — drives conversion |
| Active Lime (darker shade) | **Lime Pressed** | `#B8E600` | Pressed/active CTA variant, focused states |

### Secondary Colors
| Usage | Color Name | Hex | Emotional Purpose |
|---|---|---|---|
| Mascot / Highlight | **Court Lime** | `#CCFF33` | Joy, playfulness, sport — the mascot's identity |
| Mascot Outline | **Ink Navy Outline** | `#1A2138` | Grounding, outline definition for illustrations |

### Accent / Functional Colors
| Usage | Color Name | Hex | Emotional Purpose |
|---|---|---|---|
| Success / Complete | **Confirm Green** | `#22C55E` | Positive reinforcement, task completion |
| Warning / Badge | **Alert Orange** | `#F97316` | Urgency, notification badges, attention needed |
| Error | **Error Red** | `#EF4444` | Failure, destructive action warning |
| Info Pill / Tag | **Guide Blue** | `#3B82F6` | Content categorization (e.g. "Guide" tags) |
| Deal / Promo Tag | **Promo Teal** | `#14B8A6` | Deals, promotions, gear section labels |

### Neutral / Background Colors
| Usage | Color Name | Hex | Purpose |
|---|---|---|---|
| Page / Section Background | **Cloud White** | `#F3F5FA` | Soft, airy base — lighter than pure white, friendlier |
| Mobile App Background | **Ice Blue** | `#E9EDFF` | Whole-app light tint, gives calm sports-app feel |
| Card Surface | **White** | `#FFFFFF` | Clean card fill, maximum contrast for content |
| Section Alternate BG | **Light Blue Wash** | `#E1E8FF` | Alternating sections to break monotony |
| Feature Section BG | **Pale Lime** | `#F4FFD6` | Used for product feature highlight sections |
| Primary Text | **Ink Navy** | `#1A2138` | Main body and heading color |
| Secondary Text | **Slate Gray** | `#64748B` | Supporting text, captions, meta |
| Placeholder / Disabled | **Muted Gray** | `#94A3B8` | Inputs, disabled states |
| Border | **Border Gray** | `#CBD5E1` | Dividers, card strokes, input outlines |
| Subtle Border | **Soft Border** | `#E2EAF2` | Light separators within cards |

### CTA Buttons
| State | Hex |
|---|---|
| Primary default | `#CCFF33` (Pickleballers Lime) |
| Primary hover | `#B8E600` (Lime Pressed) |
| Primary text | `#1A2138` (Ink Navy — required for contrast on Lime) |
| Secondary default | `#3355FF` (Pickleballers Blue pill) |
| Secondary text | `#FFFFFF` |
| Ghost / Outline | border `#3355FF`, text `#3355FF` |

---

## 4. Typography System

### Confirmed Typefaces (via CSS inspection)
| Role | Typeface | Variable Axes |
|---|---|---|
| **Display / Brand / Headings** | **Grandstander Variable** | Weight 400–900; slightly condensed, sporty, friendly — the brand voice |
| **Body / UI / Data / Utility** | **Lexend Variable** | Weight 300–700; optimized for reading speed, clean, modern |

### Font Pairing Philosophy
- **Grandstander** carries personality — used wherever the brand speaks: wordmark, hero headlines, section titles, CTAs, mascot speech
- **Lexend** carries information — used wherever the user needs to read or scan: body copy, labels, inputs, table data, nav items, captions
- The combination creates an intentional contrast: **character + clarity**

### Logo / Wordmark
- **"PICKLEBALLERS"** — Grandstander Variable, Weight 800–900, wide tracking, uppercase
- Color: Pickleballers Blue `#3355FF` on light backgrounds; White on dark backgrounds

### Type Scale

#### Desktop

| Level | Font | Weight | Size | Line Height | Letter Spacing | Usage |
|---|---|---|---|---|---|---|
| **H1** | Grandstander | 800 | 48–56px | 1.1 | -0.5px | Hero headline, main page title |
| **H2** | Grandstander | 700 | 32–38px | 1.2 | -0.3px | Section headers ("Find courts, games…") |
| **H3** | Grandstander | 700 | 24–28px | 1.3 | 0 | Sub-section titles, card headings |
| **H4** | Grandstander | 600 | 18–20px | 1.4 | 0 | FAQ questions, feature titles |
| **Body Large** | Lexend | 400 | 16–18px | 1.6 | 0 | Hero subheadline, feature descriptions |
| **Body** | Lexend | 400 | 14–16px | 1.6 | 0 | General body text, card descriptions |
| **Small** | Lexend | 500 | 12–13px | 1.5 | 0.2px | Labels, meta info, tags |
| **Caption** | Lexend | 400 | 11–12px | 1.4 | 0.3px | Timestamps, legal, footnotes |
| **Button** | Lexend | 600 | 14–16px | 1 | 0.1px | All button text |
| **Stat Number** | Grandstander | 800 | 36–48px | 1.0 | -0.5px | Community stats (691,300 / 4,253,030) |
| **Stat Label** | Lexend | 500 | 13–14px | 1.3 | 0.3px | Stat subtitles ("members", "games") |

#### Mobile

| Level | Font | Weight | Size | Line Height | Usage |
|---|---|---|---|---|---|
| **H1 Mobile** | Grandstander | 800 | 26–30px | 1.15 | Page title |
| **H2 Mobile** | Grandstander | 700 | 20–24px | 1.2 | Section headers ("Find Games", "Today") |
| **H3 Mobile** | Grandstander | 600 | 16–18px | 1.3 | Card titles, greeting card |
| **Body Mobile** | Lexend | 400 | 13–15px | 1.6 | Card descriptions, messages |
| **Label Mobile** | Lexend | 500 | 11–13px | 1.4 | Action labels below quick-action icons |
| **Caption Mobile** | Lexend | 400 | 10–11px | 1.4 | Timestamps, meta |
| **Button Mobile** | Lexend | 600 | 13–15px | 1 | Filter pills, tab labels |
| **Nav Tab Label** | Lexend | 500 | 10–11px | 1 | Bottom tab bar labels |
| **Greeting / Name** | Grandstander | 700 | 20–22px | 1.2 | "Hi, Na!" — personalized greeting |

---

## 5. Iconography

### System Overview
Pickleballers uses a **custom-adjacent icon set** that combines elements of Heroicons, Phosphor, or a custom-drawn library, all aligned to a consistent grid.

### Stroke & Style Rules
| Property | Specification |
|---|---|
| **Stroke width** | 1.5–2px (regular), 2.5px (emphasized/navigation) |
| **Corner radius** | Slightly rounded — matching the brand's geometry |
| **Style: Navigation (inactive)** | Outline / stroked only |
| **Style: Navigation (active)** | Filled or dual-tone (Ink Navy + Pickleballers Blue accent) |
| **Quick Action Icons** | Outline, navy stroke, occasionally dual-tone on white circle bg |
| **Functional Icons** | Chevrons, bells, chat bubbles — pure outline at 1.5px stroke |
| **Visual weight** | Medium — never too thin (fragile), never too thick (aggressive) |

### Icon Grid
- Base size: **24×24px** (UI standard)
- Quick action circles: **32×32px** icon inside **64×64px** circle container
- Bottom nav icons: **24×24px** with **10–11px** label below
- Notification/badge icons: **20×20px**

### Consistency Rules
- All icons from same visual family — no mixing of multiple icon sets
- Icon color always matches the text color of its context (navy on light, white on dark)
- Active tab icon gets Ink Navy fill + Pickleballers Blue label
- Icons never used without label in primary navigation

### Visible Icons in Screenshots
| Icon | Style | Context |
|---|---|---|
| Person / Avatar circle | Outline | Top nav — user profile |
| Plus in circle | Filled green | Quick action badge overlays |
| Map / Compass | Outline dual-tone | "Find games" quick action |
| Calendar / Grid | Outline | "Games" tab |
| Groups / People | Outline | "Groups" quick action & tab |
| Bar chart | Outline | "Stats" tab |
| Bell | Outline | Notifications (top nav + status card) |
| Chat bubble | Outline | Messages (top nav + status card) |
| Funnel / Filter | Filled navy | "Customize" filter trigger |
| Location pin | Outline gray | Pending setup step indicator |
| Chevron down | Outline | Accordion / expandable card |

---

## 6. Illustration Style

### Mascot: The Pickleballers Character
A **smiling lime-green pickleball** wearing a **white athletic headband with a blue stripe**. Expressive cartoon eyes — wide, friendly, curious. No arms or legs. Spherical body with pickleball hole-pattern texture implied by subtle spots/circles on the lime-green surface.

### Character Style Attributes
| Property | Detail |
|---|---|
| **Form** | Circular/spherical — matches the real pickleball shape |
| **Eyes** | Large cartoon whites with dark irises — expressive, friendly |
| **Headband** | White with blue stripe — signals athleticism, fun |
| **Outline** | Bold dark outline (2–3px equivalent) — makes mascot pop on any background |
| **Fill treatment** | Flat color fills with minimal gradient, slight shading for depth |
| **Color palette** | Pickleballers Lime `#CCFF33`, white, Pickleballers Blue `#3355FF`, Ink Navy `#1A2138`, outline dark |
| **Expression default** | Friendly, slightly wide-eyed, enthusiastic — never aggressive |
| **Usage contexts** | Avatar rings (onboarding progress), QR code center, app icon, loading states, empty states |

### Progress Ring Usage (Mobile)
- Mascot appears inside a **circular progress ring** — Ink Navy outer ring, Pickleballers Blue fill that animates to show completion %
- Highly effective as a personalized onboarding tracker: makes the mascot feel like "your buddy" guiding you through setup

### Brand Mascot Usage Rules
| Context | Usage |
|---|---|
| Onboarding / Welcome | Mascot with progress ring, first-name greeting |
| Empty states | Mascot with expressive look (curious/waiting) + helper text |
| Loading | Mascot animation (spin/bounce) |
| QR codes | Mascot centered in QR code module area |
| App icon | Mascot face on navy background |
| Error states | Mascot with sad/confused expression variant |

### Photography Style
- **Candid, joyful, active** — players on courts, smiling, mid-game
- Natural lighting, outdoor settings preferred
- Age-diverse — not just young players; inclusive visual range
- Courts shown as clean, professional, community-appropriate

### Recommendations for Future Illustrations
- Create 5–6 **mascot expression variants:** Happy, Excited, Confused, Sad, Celebrating, Thinking
- Develop **scene illustrations** (court scenes in flat style) for empty state / feature sections
- Maintain the bold outline + flat fill style across all future character art
- Never add limbs — the limbless ball is a distinctive brand choice; keep it
- Spot illustrations for each main feature: courts, games, lessons, groups

---

## 7. Layout System

### Spacing Scale
```
4px   — micro: icon padding, inner badge spacing
8px   — xs: tight UI spacing, tag internal padding
12px  — sm: card inner gap, list item spacing
16px  — md: standard padding, mobile horizontal margin
24px  — lg: card padding, gap between cards
32px  — xl: section inner padding, gap between major elements
48px  — 2xl: desktop section padding top/bottom
64px  — 3xl: desktop hero padding, large section gaps
80px  — 4xl: max desktop section vertical spacing
96px  — 5xl: hero section height supplement
```

### Desktop Layout

| Property | Value |
|---|---|
| **Max content width** | `1280px` |
| **Container width** | `1140–1200px` with auto margins |
| **Horizontal padding** | `40–48px` at container edges |
| **Grid** | 12-column, `24px` gutters |
| **Section vertical padding** | `64–80px` top & bottom |
| **Card grid gap** | `24px` |
| **Nav height** | `60–64px` |

#### Desktop Breakpoints
| Name | Width | Behavior |
|---|---|---|
| `xl` | `≥1280px` | Full desktop layout |
| `lg` | `1024–1279px` | Slight gutter reduction, same grid |
| `md` | `768–1023px` | 2-column grids collapse to 1–2 col, nav condenses |
| `sm` | `640–767px` | Single column, nav becomes hamburger |
| `xs` | `<640px` | Full mobile layout |

### Mobile Layout

| Property | Value |
|---|---|
| **Horizontal margin** | `16px` (sides) |
| **Content width** | `calc(100% - 32px)` |
| **Top nav height** | `56px` (including status bar safe area) |
| **Bottom tab bar height** | `60–64px` + device safe area inset |
| **Card gap (vertical)** | `12–16px` |
| **Section gap** | `24–32px` |
| **Quick action icon size** | `64×64px` circle |
| **Quick action row gap** | `16px` horizontal |
| **Touch target minimum** | `44×44px` (all interactive elements) |
| **Card border radius** | `16px` |
| **Card padding** | `16px` |

### Mobile Safe Areas
- Top: accounts for status bar dynamically
- Bottom: `env(safe-area-inset-bottom)` applied to tab bar
- Left/Right: `16px` fixed margin unless full-bleed (background washes)

---

## 8. Component Library

---

### 8.1 Top Navigation — Desktop

**Purpose:** Global wayfinding, brand presence, primary CTA entry point

| Property | Spec |
|---|---|
| Background | `#3355FF` (Pickleballers Blue) |
| Height | `60–64px` |
| Position | Sticky on scroll |
| Logo | White SVG wordmark, left-aligned |
| Nav links | Lexend 500, 14–15px, White, 4 items: Play · Organize · Facilities · Shop |
| Nav link hover | Underline or opacity shift: `opacity 0.7`, `transition 150ms` |
| Right side | `Log in` (text, white) + `Join for free` (Pickleballers Lime pill button, Ink Navy text) |
| Alert bar above nav | Yellow/orange banner with promo copy + CTA, dismissible |

**States:** Default · Scrolled (shadow appears) · Link hover · CTA hover

---

### 8.2 Top Navigation — Mobile

**Purpose:** Identity anchor, primary utility access, personal actions

| Property | Spec |
|---|---|
| Background | `#FFFFFF` |
| Height | `56px` |
| Left zone | Circular avatar icon (40×40px) + Add friend icon (40×40px), navy stroke |
| Center | Pickleballers wordmark (Grandstander, Pickleballers Blue, ~120px wide) |
| Right zone | Bell icon + Chat bubble icon (both 24×24px, navy) |
| Border bottom | `1px solid #E2EAF2` |

---

### 8.3 Bottom Tab Bar — Mobile

**Purpose:** Primary mobile navigation

| Property | Spec |
|---|---|
| Background | `#FFFFFF` |
| Height | `60px` + safe area |
| Border top | `1px solid #E2EAF2` |
| Tabs | 5 equal-width: Home · Nearby · Games · Groups · Stats |
| Icon size | `24×24px` |
| Label size | Lexend 500, `10–11px` |
| Active state | Filled icon + label in `#3355FF` Pickleballers Blue |
| Inactive state | Outline icon + label in `#94A3B8` Muted Gray |
| Active indicator | No bar/dot — purely filled icon + color change |
| Touch target | Full tab width × full bar height |

---

### 8.4 Quick Action Row — Mobile

**Purpose:** One-tap shortcuts to core app functions from home

| Property | Spec |
|---|---|
| Container | Horizontal scroll row, `16px` side padding |
| Item layout | Icon circle above label text |
| Circle size | `64×64px`, radius `50%` |
| Circle background | `#FFFFFF` |
| Circle shadow | `0 2px 8px rgba(0,0,0,0.08)` |
| Icon size | `32×32px` inside circle |
| Icon color | `#1A2138` Ink Navy |
| Badge overlay | Green circle `+` badge, `20×20px`, top-right corner of circle |
| Label | Lexend 500, `11–12px`, `#1A2138`, centered, 2-line wrap allowed |
| Item gap | `16–20px` horizontal |
| Items shown | 5 (Create a game · Find games · Take a lesson · Learn to play · Create a group) |

---

### 8.5 Greeting / Onboarding Progress Card — Mobile

**Purpose:** Personalized welcome + setup progress tracker

| Property | Spec |
|---|---|
| Card background | `#FFFFFF` |
| Card radius | `16px` |
| Card padding | `16px` |
| Shadow | `0 2px 8px rgba(0,0,0,0.08)` |
| Avatar zone | Circular mascot (64×64px) inside progress ring (80×80px), ring = Pickleballers Blue fill on Ink Navy base |
| Progress ring | Animated circular stroke, `#3355FF` color, `#1A2138` track |
| Greeting headline | Grandstander 700, `20px`, `#1A2138` → "Hi, Na!" |
| Sub-copy | Lexend 400, `14px`, `#64748B` → "Only 1 easy setup task left!" |
| Progress dots | 5 dots in a row: filled green `#22C55E` (✓ complete), gray pin icon (⊙ pending) |
| Chevron | Right-side chevron button, `32×32px`, outline style, toggles expanded view |

---

### 8.6 Status Indicators (Invitations / Messages) — Mobile

**Purpose:** Quick-glance activity counters

| Property | Spec |
|---|---|
| Layout | Two-up grid (50% / 50% split) |
| Card background | `#FFFFFF` |
| Card radius | `12px` |
| Card padding | `16px` |
| Count | Grandstander 800, `28–32px`, `#1A2138` |
| Label | Lexend 600, `14px`, `#1A2138` (bold) |
| Icon | Bell / Chat bubble, outline, `28×28px`, `#94A3B8` muted gray, right-aligned |
| Empty state | "0" with gray icon — no empty state illustration at this size |

---

### 8.7 Buttons

#### Primary Button (CTA)
| Property | Spec |
|---|---|
| Background | `#CCFF33` (Pickleballers Lime) |
| Text | `#1A2138` (Ink Navy), Lexend 600, `14–16px` |
| Radius | `9999px` (pill) |
| Padding | `12px 24px` (desktop) / `10px 20px` (mobile) |
| Height | `44px` (desktop) / `40–44px` (mobile) |
| Hover | `#B8E600` background (Lime Pressed), `transform: translateY(-1px)` |
| Active | `#A3CC00`, scale `0.98` |
| Transition | `all 150ms ease-out` |

#### Primary Dark Button (Blue)
| Property | Spec |
|---|---|
| Background | `#3355FF` |
| Text | `#FFFFFF`, Lexend 600 |
| Radius | `9999px` |
| Padding | `12px 24px` |
| Hover | background darkens to `#2440D9` |

#### Ghost / Outline Button
| Property | Spec |
|---|---|
| Background | Transparent |
| Border | `1.5–2px solid #3355FF` |
| Text | `#3355FF`, Lexend 600 |
| Radius | `9999px` |
| Hover | Background `#3355FF10` (5% tint) |

#### Pill Filter Button (Active)
| Property | Spec |
|---|---|
| Background | `#3355FF` (Pickleballers Blue) |
| Text | `#FFFFFF`, Lexend 600, `13px` |
| Radius | `9999px` |
| Padding | `8px 16px` |
| Height | `36–40px` |

#### Pill Filter Button (Inactive)
| Property | Spec |
|---|---|
| Background | `#E9EDFF` (Ice Blue) |
| Text | `#3355FF` (Pickleballers Blue), Lexend 500, `13px` |
| Border | None |
| Radius | `9999px` |

---

### 8.8 Cards — Desktop

**Purpose:** Content containers for games, guides, gear, courts

| Property | Spec |
|---|---|
| Background | `#FFFFFF` |
| Border radius | `12–16px` |
| Shadow resting | `0 2px 8px rgba(0,0,0,0.08)` |
| Shadow hover | `0 6px 20px rgba(0,0,0,0.12)` |
| Padding | `16–24px` |
| Image area | Top of card, `16:9` or `4:3` ratio, radius applied to top corners |
| Category tag | Small pill, Lexend 600, 11px, colored background (Guide=blue, Gear=teal) |
| Title | Grandstander 700, `16–20px`, `#1A2138` |
| Meta | Lexend 400, `12–13px`, `#64748B` |
| CTA link | Lexend 600, `13px`, `#3355FF`, no underline by default, underline on hover |
| Transition | `box-shadow 200ms ease`, `transform 200ms ease` |

---

### 8.9 Date / Type Filter Row — Mobile

**Purpose:** Temporal and categorical filtering of game listings

| Property | Spec |
|---|---|
| Layout | Horizontally scrollable pill row |
| Container padding | `0 16px` |
| Pill gap | `8px` |
| Active pill | Pickleballers Blue `#3355FF` background, white text |
| Inactive pill | Ice Blue `#E9EDFF` background, Pickleballers Blue `#3355FF` text |
| Pill height | `36–40px` |
| Pill radius | `9999px` |
| Pill padding | `8px 16px` |
| Font | Lexend 600, `13px` |
| Row 1 (dates) | "Next 7 days" · "Jun 22 – Jun 28" · "Jun 29 – ..." |
| Row 2 (types) | "All" · "Games" · "Open Plays" · "Round Robin" |

---

### 8.10 Avatars

| Size | Dimension | Usage |
|---|---|---|
| XS | `24×24px` | List item avatars, mentions |
| SM | `32×32px` | Comment avatars |
| MD | `40×40px` | Nav avatar, card avatars |
| LG | `56×64px` | Profile header |
| XL | `80×80px` | Onboarding progress ring container |
| Default | Mascot illustration or initials fallback |
| Fallback bg | `#3355FF` with white initials in Grandstander |
| Border | None by default; progress ring uses `3px` ring |

---

### 8.11 QR Experience

| Property | Spec |
|---|---|
| Background | `#FFFFFF` or dark card |
| QR module color | `#1A2138` (Ink Navy) |
| QR background | White |
| Center logo zone | Mascot illustration (30% of QR size) placed in center |
| Corner finders | Navy squares with rounded outer corners |
| Label above | "Scan the QR code" in Lexend 500, gray |
| Use case | App download flow, join via shared link |

---

### 8.12 Section Headers — Desktop

| Property | Spec |
|---|---|
| Eyebrow label | Lexend 600, `11–12px`, all-caps, colored (Pickleballers Blue or category color) |
| Headline | Grandstander 700, `32–38px`, `#1A2138` |
| Sub-copy | Lexend 400, `16–18px`, `#64748B`, max-width `600px` |
| Alignment | Left-aligned (content sections) or center-aligned (community stats, CTA sections) |
| Spacing below | `32–48px` before content grid |

---

### 8.13 Community Stats Bar — Desktop

**Purpose:** Social proof strip showing scale

| Property | Spec |
|---|---|
| Background | `#FFFFFF` or `#F3F5FA` |
| Layout | 4-column horizontal (or 2×2 on tablet) |
| Stat number | Grandstander 800, `40–48px`, `#1A2138` |
| Stat label | Lexend 500, `13–14px`, `#64748B` |
| Stat description | Lexend 400, `12px`, `#94A3B8` |
| Divider | `1px vertical line, #CBD5E1` between columns |
| CTA button | Adjacent Pickleballers Lime pill "Join for free" |

---

### 8.14 FAQ Accordion — Desktop

| Property | Spec |
|---|---|
| Background | `#FFFFFF` |
| Border | `1px solid #CBD5E1` top, then each item separated by the same |
| Item padding | `20px 24px` |
| Question text | Lexend 500, `15–16px`, `#1A2138` |
| Answer text | Lexend 400, `14–15px`, `#64748B` |
| Toggle icon | `+` or chevron, right-aligned, `24×24px` |
| Expanded state | Answer slides down with `300ms ease`, icon rotates |
| Hover background | `#F3F5FA` |

---

### 8.15 Partner Logo Strip — Desktop

| Property | Spec |
|---|---|
| Layout | Auto-scrolling horizontal carousel |
| Background | White or light gray section |
| Logos | Grayscale or colored, uniform height `~40px` |
| Label above | "Endorsed by leading pickleball organizations around the world" |
| Gap | `40–60px` between logos |
| Animation | Continuous scroll, pausable on hover |

---

## 9. Mobile Design System

### Navigation Model
**Bottom Tab Bar Navigation** — 5 tabs. Follows thumb-reach patterns; all primary actions reachable with one thumb in natural hold position.

### Thumb Reach Optimization
| Zone | Content |
|---|---|
| **Easy reach (bottom 40%)** | Tab bar, filter pills, primary CTA buttons |
| **Medium reach (middle 40%)** | Card content, quick action row, status cards |
| **Hard reach (top 20%)** | Top nav (avatar, logo, bell) — passive, infrequent actions |

### Interaction Patterns
- **Horizontal scroll:** Quick action row, date filter pills, type filter pills — all scroll left/right
- **Vertical scroll:** Main feed, game list
- **Tap to expand:** Greeting/progress card (chevron toggle)
- **Tap to navigate:** Tab bar switches, quick action icons navigate to feature
- **Pull to refresh:** Standard on feed screens

### Touch Targets
| Element | Minimum Size |
|---|---|
| Tab bar item | Full zone (≥44px height) |
| Quick action circle | `64×64px` |
| Pill filter | `36×44px` minimum |
| Chevron button | `44×44px` |
| Nav icon (bell, chat) | `44×44px` touch area |
| Card | Full width tap |

### Mobile Hierarchy (Visual Priority)
1. Top nav — identity anchor
2. Quick action row — most frequent tasks
3. Greeting / progress card — personalization hook
4. Status cards — social signals (invitations, messages)
5. Find Games section — core content feed
6. Date/Type filters — refinement
7. Game listing cards — primary content
8. Bottom tab bar — global navigation

---

## 10. Desktop Design System

### Header Behavior
- **Sticky nav** — remains at top on scroll
- At page load: transparent or Pickleballers Blue; after first scroll: solid Pickleballers Blue with subtle drop shadow
- `transition: box-shadow 200ms ease`
- Alert banner above nav collapses when dismissed, stored in localStorage

### Search Behavior
- Hero-level search bar, full-width on desktop (max `600px`)
- Pill shape (`9999px` radius), white background, subtle border
- Left: search/location icon; Right: search button (Pickleballers Lime)
- Placeholder: "Search for courts and games…"
- Below search: "or organize a game" in Lexend 400, `#64748B`, underlined link

### Grid Layout
| Section | Grid |
|---|---|
| Hero | Full bleed, overlay content centered |
| Game cards | 3–4 column, `24px` gap |
| Guide cards | 2 column (image left + list right) |
| Gear articles | 3 column |
| Court finder table | Full-width tabbed table |
| Stats | 4-column single row |
| FAQ | Single column, max-width `800px` centered |
| Footer | 5–6 column link grid |

### Sidebar Behavior
No persistent sidebar on the current homepage. Feature/dashboard pages likely use a `260px` left sidebar at `lg` breakpoint.

### Card Layouts — Desktop
- **Guide cards:** Left-side list (4 items) + Right-side featured card — asymmetric 2/3 + 1/3 split
- **Gear cards:** Uniform 3-column grid with image, badge, title, CTA
- **Court city cards:** Uniform grid with city name, court count, game count

### Responsive Behavior
| Breakpoint | Nav | Content |
|---|---|---|
| `xl` (≥1280px) | Full horizontal nav | 4-col grids |
| `lg` (1024–1279px) | Full horizontal nav | 3-col grids |
| `md` (768–1023px) | Condensed nav | 2-col grids |
| `sm` (<768px) | Hamburger menu | 1-col, stacked |
| Mobile (<640px) | App shell (no top nav, bottom tabs) | Full mobile layout |

---

## 11. UX Principles

### 1. Community First, Tool Second
Every screen leads with social context — how many people are nearby, who's inviting you, what your community is doing. The product is the community; the features are just infrastructure.

### 2. Personalization as Warmth
"Hi, Na!" isn't a feature — it's a philosophy. The product learns your name and uses it. The mascot tracks *your* progress. Your stats are *your* stats. This creates emotional investment quickly.

### 3. Fast Discovery, Low Friction
The search bar is the first element after the nav. The "Find games" tab is one tap on mobile. Date filters and type filters default to the most useful state (Next 7 days, All). Discovery should take under 10 seconds.

### 4. Progressive Onboarding
Setup tasks are broken into 5 steps shown as friendly dots. The progress ring shows you're close ("Only 1 task left!"). Never dumps the user with a form — guides them forward with visual momentum.

### 5. Organized Information Hierarchy
Content is segmented clearly: Courts → Games → Lessons → Guides → Gear. Each section is visually distinct (alternating backgrounds, different card layouts) so users orient instantly without reading headers.

### 6. Trust Through Transparency
Large community numbers (691,300 members) are prominently displayed. Endorsing organization logos are shown. Reviews and ratings are prominent. The product earns trust with evidence, not just claims.

### 7. Accessible to Beginners
"Learn to play" is a top-5 quick action. Beginner guides are SEO-prominent. The site assumes the user may never have played. Jargon is avoided; everything is labeled plainly.

### 8. Operator-Ready
Organizers have dedicated features (Create a game, Create a group, Organize section in nav). The platform speaks to both player and organizer simultaneously without making either feel secondary.

---

## 12. Motion Design

### Philosophy
**Purposeful and brief.** Motion orients, confirms, and delights — in that priority order. Nothing animates "just because." The mascot is the exception: it can be expressive and joyful.

### Timing Scale
| Name | Duration | Use |
|---|---|---|
| `instant` | `100ms` | Toggle switches, checkbox checks |
| `fast` | `150ms` | Button press feedback, icon transitions |
| `standard` | `200ms` | Tab switching, nav highlight, hover states |
| `moderate` | `300ms` | Card hover lift, accordion expand, filter pill switch |
| `slow` | `400ms` | Page transitions, modal enter/exit |
| `mascot` | `600–800ms` | Progress ring fill animation on load |

### Easing
| Curve | Token | Use |
|---|---|---|
| `ease-out` | `motion-ease-out` | Elements entering screen — feel natural, decelerating |
| `ease-in-out` | `motion-ease-in-out` | Accordion open/close, smooth transitions |
| `spring` (CSS: `cubic-bezier(0.34,1.56,0.64,1)`) | `motion-spring` | Button press scale, mascot pop |

### Interaction Details

| Element | Motion |
|---|---|
| **Primary button hover** | `translateY(-1px)`, shadow deepens — `150ms ease-out` |
| **Primary button active** | `scale(0.97)` — `100ms ease` — tactile press feel |
| **Card hover (desktop)** | `translateY(-2px)` + shadow lift — `200ms ease-out` |
| **Filter pill switch** | Background color crossfade — `200ms ease` |
| **Tab bar switch (mobile)** | Icon morphs outline → filled — `150ms ease` |
| **Accordion expand** | Height from `0` to `auto` — `300ms ease-in-out` |
| **Progress ring** | Stroke draws from 0% to actual progress — `600ms ease-out` on mount |
| **Greeting card expand** | Chevron rotates 180°, content slides down — `300ms ease` |
| **Partner logo strip** | Continuous CSS scroll animation, `linear`, pauses on hover |
| **Alert banner dismiss** | Slides up + fades — `200ms ease-in` |
| **Page load** | No fancy splash — fast, direct render; mascot ring animation is the welcome moment |

### Reduced Motion
All animations respect `prefers-reduced-motion: reduce` — transitions drop to instant, no translate animations.

---

## 13. Accessibility

### Contrast Standards (WCAG 2.1 AA Minimum)
| Pair | Ratio | Status |
|---|---|---|
| White text on Pickleballers Blue `#3355FF` | ~5.4:1 | ✅ AA |
| Ink Navy text on White | ~15:1 | ✅ AAA |
| Ink Navy text on Ice Blue `#E9EDFF` | ~14:1 | ✅ AAA |
| Ink Navy text on Pickleballers Lime `#CCFF33` | ~14:1 | ✅ AAA |
| Gray `#64748B` on White | ~5.9:1 | ✅ AA |
| Muted Gray `#94A3B8` on White | ~2.9:1 | ❌ Fails AA — use only for decorative/non-essential |

> **Action:** Always pair Pickleballers Lime `#CCFF33` CTA backgrounds with Ink Navy `#1A2138` text — white text on Lime fails contrast entirely. Pickleballers Blue `#3355FF` backgrounds should use white text (~5.4:1, AA).

### Touch Target Sizes
- **Minimum:** `44×44px` on all interactive elements (WCAG 2.5.5 / Apple HIG)
- Quick action circles at `64×64px` — comfortably exceeds minimum
- Bottom tab items span full column width — excellent

### Keyboard Support (Desktop)
- All nav links reachable by Tab key
- Accordion open/close via Enter/Space
- Filter pills navigable via arrow keys (ideal)
- Modal dialogs trap focus correctly
- Skip-to-content link at top of page (if not present, add one)
- Visible focus ring: `2px solid #3355FF`, `outline-offset: 2px`

### Screen Reader Support
- All icons have `aria-label` or adjacent visible text labels
- Tab bar labels are always visible (not icon-only)
- Progress ring has `aria-valuenow`, `aria-valuemin`, `aria-valuemax`
- Greeting card: live region `aria-live="polite"` for dynamic name
- Stats: mark up as `<dl>` term/definition pairs or use `aria-label` on each stat

### WCAG Recommendations Summary
| Criterion | Level | Status |
|---|---|---|
| 1.4.3 Contrast (text) | AA | Mostly pass; audit CTA blue |
| 1.4.11 Non-text contrast | AA | Icons likely pass; verify |
| 2.1.1 Keyboard navigable | A | Implement full keyboard nav |
| 2.4.3 Focus order | A | Logical DOM order matches visual |
| 2.5.5 Target size | AAA | 44px minimum enforced |
| 4.1.2 Name, Role, Value | A | All components must have accessible names |

---

## 14. Design Tokens

### Color Tokens
```
--color-brand-blue:        #3355FF
--color-brand-lime:        #CCFF33
--color-brand-lime-pressed: #B8E600
--color-brand-ink-navy:    #1A2138

--color-bg-page:           #F3F5FA
--color-bg-app-mobile:     #E9EDFF
--color-bg-surface:        #FFFFFF
--color-bg-section-alt:    #E1E8FF
--color-bg-feature:        #F4FFD6

--color-text-primary:      #1A2138
--color-text-secondary:    #64748B
--color-text-placeholder:  #94A3B8
--color-text-inverse:      #FFFFFF

--color-border:            #CBD5E1
--color-border-subtle:     #E2EAF2

--color-success:           #22C55E
--color-warning:           #F97316
--color-error:             #EF4444
--color-info:              #3B82F6

--color-cta-primary:       #CCFF33
--color-cta-primary-text:  #1A2138
--color-cta-primary-hover: #B8E600
--color-cta-dark:          #3355FF
--color-cta-dark-hover:    #2440D9
```

### Typography Tokens
```
--font-display:    'Grandstander Variable', cursive
--font-body:       'Lexend Variable', sans-serif

--font-weight-regular:    400
--font-weight-medium:     500
--font-weight-semibold:   600
--font-weight-bold:       700
--font-weight-extrabold:  800

--text-xs:     11px
--text-sm:     12px
--text-base:   14px
--text-md:     16px
--text-lg:     18px
--text-xl:     20px
--text-2xl:    24px
--text-3xl:    30px
--text-4xl:    36px
--text-5xl:    48px
--text-hero:   56px

--leading-tight:   1.1
--leading-snug:    1.2
--leading-normal:  1.5
--leading-relaxed: 1.6
```

### Spacing Tokens
```
--space-1:   4px
--space-2:   8px
--space-3:   12px
--space-4:   16px
--space-5:   20px
--space-6:   24px
--space-8:   32px
--space-10:  40px
--space-12:  48px
--space-16:  64px
--space-20:  80px
--space-24:  96px
```

### Border Radius Tokens
```
--radius-none:   0px
--radius-sm:     4px
--radius-md:     8px
--radius-lg:     12px
--radius-xl:     16px
--radius-2xl:    20px
--radius-card:   16px
--radius-button: 9999px   (pill)
--radius-circle: 50%
```

### Shadow Tokens
```
--shadow-xs:     0 1px 2px rgba(0,0,0,0.05)
--shadow-sm:     0 2px 8px rgba(0,0,0,0.08)
--shadow-md:     0 4px 16px rgba(0,0,0,0.10)
--shadow-lg:     0 6px 20px rgba(0,0,0,0.12)
--shadow-xl:     0 8px 32px rgba(0,0,0,0.18)
--shadow-nav:    0 2px 4px rgba(0,0,0,0.06)
```

### Animation Tokens
```
--duration-instant:  100ms
--duration-fast:     150ms
--duration-standard: 200ms
--duration-moderate: 300ms
--duration-slow:     400ms
--duration-mascot:   700ms

--ease-out:         cubic-bezier(0, 0, 0.2, 1)
--ease-in-out:      cubic-bezier(0.4, 0, 0.2, 1)
--ease-spring:      cubic-bezier(0.34, 1.56, 0.64, 1)
```

---

## 15. Recreate the Design DNA

> "If another company wanted to build a product with the same design feeling, this is what they would do."

---

### Visual DNA

**Use Grandstander + Lexend.** This exact pairing is rare and immediately distinctive. Grandstander's slight condensed roundness feels athletic without being aggressive. Lexend's reading-speed optimization makes information-dense screens feel easy. Together: personality + clarity.

**Blue + Lime + White is the entire canvas.** The Ice Blue app background (`#E9EDFF`) is the secret third color that makes the mobile app feel like its own space — not just a website in a phone. Everything on top is white cards with Ink Navy text, Pickleballers Blue identity accents, and Pickleballers Lime call-to-action highlights. The palette is focused because the sport is focused.

**Every corner is rounded. No exceptions.** The pill button, the round avatar, the rounded card, the circular mascot — geometry is the brand. If you find a sharp corner, it doesn't belong.

**Flat with lift, never flat without depth.** Cards have shadows. Buttons have hover states. But nothing has textures or gradients. Depth comes from shadow, not surface treatment.

---

### UX DNA

**Greet the user by name in the first 3 seconds.** The product earns intimacy early. "Hi, Na!" with a mascot avatar creates an emotional hook that no feature list can match. Build this pattern: personalization before utility.

**Put the most common action in the most reachable position.** On mobile: quick actions are above the fold, thumb-reachable. On desktop: the search bar is the hero. The product's primary value proposition is discoverable in one gesture.

**Show progress, not process.** The 5-dot onboarding indicator doesn't say "step 3 of 5." It shows completion visually with green circles and one pending pin. The user feels momentum, not obligation.

**Categorize before listing.** Date filters AND type filters appear before the game list. Users set context before seeing content. This prevents overwhelming users with irrelevant results.

---

### Brand DNA

**The mascot is the personality.** Every brand touchpoint with the mascot becomes memorable and consistent. It appears on the QR code, in the app avatar, in progress rings, on the website hero. It's the face of the product. Build a mascot with range: multiple expressions, multiple contexts.

**Community scale is always visible.** The 691K members stat isn't buried in an about page. It's front and center in the footer of every page. Numbers build trust; show them prominently, update them dynamically.

**The name "Pickleballers" is a self-aware inside joke.** The brand leans into playfulness and community identity. The wordmark in Grandstander feels like a team logo, not a startup name. Brand energy is "club member" not "SaaS subscriber."

---

### Interaction DNA

**Pill everything.** Every clickable filter, every CTA, every date range — pill-shaped. It signals "tap me" without needing an arrow or special icon. The rounded form is the universal affordance of this product.

**Lime is the signal color.** Any time the product wants the user to act, it uses `#CCFF33` paired with Ink Navy text. Trained over time, users know: lime means do. Don't use lime for decorative purposes — reserve it for action.

**The bottom tab bar is the compass.** Five equal tabs with labels and icons. No hidden navigation, no hamburgers, no drawers on mobile. Everything lives in these 5 tabs. The clarity of the nav reduces cognitive load and improves retention.

**Active = filled icon + same color label.** Never just a dot indicator or an underline. The filled icon state communicates "you are here" through form (filled vs outlined), not through color alone — supporting accessibility.

---

*End of Pickleballers Design Specification Document v1.0*  
*Reverse engineered from: pickleballers.com (desktop) + mobile app screenshots (June 2026)*  
*Fonts confirmed via browser CSS inspection: Grandstander Variable + Lexend Variable*
