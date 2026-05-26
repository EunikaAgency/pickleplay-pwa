---
name: visual-review
description: "Visually inspect the running Pickleballers app using browser automation. Launches the dev server, opens playwright-cli Chromium at mobile viewport (390x844), screenshots key pages, and analyzes against ui-ux-pro-max design guidelines. Use for: UI review, design QA, visual regression checks, responsive verification, accessibility audits, and verifying design fixes before/after."
---

# Visual Design Review

A structured workflow for visually inspecting the Pickleballers app while working on it. Bridges browser automation (`playwright-cli`) with design analysis (`ui-ux-pro-max`, `design-system`, `ui-styling`).

## When to Use

Use this skill when you need to:

- **Review UI quality** — see what a page actually looks like before/after changes
- **Verify responsive behavior** — confirm the app renders correctly at mobile viewport
- **Design QA** — audit against accessibility, touch target, spacing, and typography rules
- **Debug layout issues** — take screenshots to diagnose visual bugs
- **Verify fixes** — screenshot the same page before and after a change to confirm improvement
- **Design implementation** — reference the current visual state while implementing new UI

## Prerequisites

- `playwright-cli` must be installed globally (`npm install -g @playwright/cli` or use via `npx`)
- Browsers must be installed: `npx playwright install chromium`

## Project Setup

- **Dev server**: runs at `http://localhost:5173` via `npm run dev`
- **Build/preview**: runs at `http://localhost:9101` via `npm run start`
- **Mobile viewport**: 390x844 pixels (iPhone 14 Pro size)
- **App type**: Vite + React PWA (mobile-first web app)

## Standard Review Workflow

### Step 1: Launch the App

```bash
cd /var/public/pickleballers-mobile.eunika.xyz/pickleballers && npm run dev
```

Wait for the Vite dev server to be ready (`localhost:5173`).

### Step 2: Open Browser Session

Start a persistent playwright-cli session at mobile viewport:

```bash
playwright-cli open http://localhost:5173 --viewport=390,844 --session=pb-review
```

### Step 3: Navigate and Screenshot

For each page being reviewed:

```bash
# Navigate to a page
playwright-cli goto http://localhost:5173/path --session=pb-review

# Take a full-page screenshot
playwright-cli screenshot --session=pb-review --full-page --path=screenshots/page-name.png
```

### Step 4: Analyze the Screenshot

Review the screenshot against the analysis criteria below. Load the `ui-ux-pro-max` and `design-system` skills for detailed guidelines.

### Step 5: Report Findings

Document issues by page with: severity (CRITICAL / HIGH / MEDIUM), description, and suggested fix.

### Step 6: Implement and Re-Verify

After making changes, re-screenshot the same page and confirm improvement.

## Key Pages for Review

| Page | URL | Notes |
|---|---|---|
| Home | `/` | Hero, featured content, primary CTA |
| Explore | `/explore` | Search/filter UI, list/card rendering |
| Open Play | `/open-play` | Session listings, date picker, CTAs |
| Bookings | `/bookings` | Booking cards, statuses, actions |
| Profile | `/profile` | User info, settings, avatar |
| Coaches | `/coaches` | Coach cards, filtering |
| Tournaments | `/tournaments` | Tournament grid/list, filters |
| Events | `/events` | Event listings |
| Guides | `/guides` | Guide cards, categories |
| Venue detail | `/venues/:slug` | Venue info, court listing, reviews |
| Venue dashboard | `/venue/dashboard` | Venue owner panel, tabs, stats |
| For Clubs | `/for-clubs` | Marketing page, CTA |
| Admin | `/admin` | Admin panel |

## Analysis Criteria

Drawn from `ui-ux-pro-max` priority rules. Check each screenshot against these:

### CRITICAL

- **Touch targets** — all interactive elements (buttons, links, taps) must be ≥44x44pt. Check that small icons/links have sufficient hit area.
- **Color contrast** — text on background must meet WCAG AA (4.5:1 for normal text, 3:1 for large text). Check against the design system tokens.
- **Safe areas** — content must not overlap with device notch, status bar, or home indicator. Check top/bottom padding on the app shell.

### HIGH

- **Readable font size** — body text should not be below 16px on mobile.
- **Spacing consistency** — check that spacing follows a consistent grid (4px base unit). Margins and padding should be uniform.
- **No horizontal scroll** — at 390px viewport width, no content should overflow horizontally.
- **Focus states** — all interactive elements must have visible focus indicators.
- **Bottom navigation** — active tab should be clearly indicated, labels should be visible and readable.
- **Touch feedback** — buttons and interactive elements should show visual feedback on tap/hover.
- **Layout alignment** — elements should be aligned to a consistent grid; no misaligned text or uneven card spacing.

### MEDIUM

- **Forms** — all form fields should have visible labels, error states (color + message), and clear validation feedback.
- **Typography hierarchy** — heading sizes should follow a clear hierarchy; no orphaned headings.
- **Loading states** — pages with async data should show skeleton loaders or spinners.
- **Empty states** — list pages with no data should show helpful empty state messages.
- **Animation** — animations should be 150-300ms duration and respect `prefers-reduced-motion`.

## Integration with Other Skills

- **`ui-ux-pro-max`** — full design rule reference (50+ styles, 161 palettes, 99 UX guidelines, 57 font pairings). Load for detailed design decisions.
- **`design-system`** — token architecture (primitive/semantic/component) and component specifications. Use to check visual consistency against tokens.
- **`ui-styling`** — shadcn/ui + Tailwind patterns. Use when implementing CSS/style fixes from review findings.
- **`playwright-cli`** — the browser automation tool used for navigation and screenshots.

## Quick Reference Commands

```bash
# Start session
playwright-cli open http://localhost:5173 --viewport=390,844 --session=pb-review

# Navigate
playwright-cli goto http://localhost:5173/explore --session=pb-review

# Screenshot (full page)
playwright-cli screenshot --session=pb-review --full-page --path=screenshots/explore.png

# Screenshot (viewport only)
playwright-cli screenshot --session=pb-review --path=screenshots/explore-viewport.png

# Get page accessibility tree (for element targeting)
playwright-cli accessibility --session=pb-review

# Click an element (by ref from accessibility tree)
playwright-cli click e15 --session=pb-review

# Close session
playwright-cli close --session=pb-review
```
