# PicklePlay Theming

## Purpose

This file captures the visual theme inferred from the provided screenshots.

It is not a pixel-perfect brand guideline from source design files. It is a practical theming reference based on repeated UI patterns visible across the app.

## Theme Summary

PicklePlay uses a bright, friendly, mobile-first sports UI with:

- soft white and pale blue surfaces
- aqua/teal as the primary brand color
- coral/orange for key actions
- deep navy for utility bars, strong contrast buttons, and navigation emphasis
- rounded cards, pills, and inputs
- light, approachable spacing instead of dense enterprise layouts

The overall feeling is:

- welcoming
- active
- social
- lightweight
- easy to scan

## Brand Personality

- Primary mood: upbeat community sports app
- Secondary mood: trustworthy scheduling utility
- Visual tone: clean, rounded, approachable, non-corporate
- Interaction style: obvious actions, low-friction forms, high visibility CTAs

## Core Color Palette

These hex values are inferred from screenshots and should be treated as theme approximations.

| Token | Hex | Usage |
|---|---|---|
| `primary-500` | `#2FAFC3` | Main brand color, headings, icons, active tabs, sliders |
| `primary-400` | `#67CFE0` | Lighter brand surfaces, pills, selected backgrounds |
| `primary-100` | `#DDF5FB` | Soft tinted cards, onboarding panels, gentle highlights |
| `accent-500` | `#F26D4D` | Primary CTA, action borders, prominent action buttons |
| `accent-400` | `#FF8D6F` | Hover/pressed accent variant, supportive highlights |
| `navy-700` | `#171B5A` | Utility bars, dark primary buttons, strong contrast UI |
| `navy-500` | `#2A316F` | Secondary dark emphasis, icons, headers |
| `success-100` | `#DDF7E8` | Positive confirmation backgrounds |
| `success-500` | `#32B36B` | Success icons, positive states |
| `warning-100` | `#FFF3C9` | Educational alerts and helper banners |
| `warning-500` | `#E0A72E` | Warning icons, caution emphasis |
| `danger-100` | `#FDE3DE` | Destructive or blocked state backgrounds |
| `danger-500` | `#D85B4A` | Error/destructive actions |
| `purple-500` | `#7C63F2` | Premium/PLUS badge and subscription highlights |

## Neutral Palette

| Token | Hex | Usage |
|---|---|---|
| `bg-page` | `#FAFBFC` | App background |
| `bg-surface` | `#FFFFFF` | Cards, sheets, modals, inputs |
| `border-soft` | `#E7EDF1` | Default dividers and card outlines |
| `border-strong` | `#C9D7DF` | More visible separators and inactive controls |
| `text-strong` | `#1F2A33` | Main body text |
| `text-body` | `#42515B` | Secondary text |
| `text-muted` | `#7E8C96` | Helper text, placeholder text |
| `text-disabled` | `#A8B3BA` | Disabled labels and controls |

## Recommended Token Set

```css
:root {
  --color-primary-500: #2FAFC3;
  --color-primary-400: #67CFE0;
  --color-primary-100: #DDF5FB;

  --color-accent-500: #F26D4D;
  --color-accent-400: #FF8D6F;

  --color-navy-700: #171B5A;
  --color-navy-500: #2A316F;

  --color-success-100: #DDF7E8;
  --color-success-500: #32B36B;
  --color-warning-100: #FFF3C9;
  --color-warning-500: #E0A72E;
  --color-danger-100: #FDE3DE;
  --color-danger-500: #D85B4A;
  --color-premium-500: #7C63F2;

  --color-bg-page: #FAFBFC;
  --color-bg-surface: #FFFFFF;
  --color-border-soft: #E7EDF1;
  --color-border-strong: #C9D7DF;
  --color-text-strong: #1F2A33;
  --color-text-body: #42515B;
  --color-text-muted: #7E8C96;
  --color-text-disabled: #A8B3BA;

  --radius-xs: 8px;
  --radius-sm: 12px;
  --radius-md: 16px;
  --radius-lg: 20px;
  --radius-pill: 999px;

  --shadow-soft: 0 6px 18px rgba(31, 42, 51, 0.08);
  --shadow-card: 0 2px 10px rgba(31, 42, 51, 0.06);
}
```

## Color Usage Rules

### Primary Teal

Use teal for:

- page titles
- active tabs
- selected pills
- icons
- slider tracks
- informational emphasis

Do not use teal for every button on a screen. In the screenshots, teal is often the brand anchor, not always the strongest CTA.

### Coral Accent

Use coral for:

- primary action buttons in light layouts
- add/create/invite actions
- bordered CTA treatments
- positive urgency prompts

Coral is the clearest action-driving color in the screenshots.

### Navy

Use navy for:

- major utility bars
- high-contrast filled buttons
- date-range controls
- dense navigation emphasis

Navy appears as a stabilizing contrast color against the lighter, friendlier teal/coral palette.

### Purple

Reserve purple for:

- premium badges
- subscription upsells
- PLUS or plan-marketing moments

Purple should stay limited so premium states remain visually distinct.

## Typography Direction

The screenshots suggest a rounded, friendly sans-serif with strong readability on mobile.

Recommended direction:

- Headings: rounded sans, semibold to bold
- Body: clean sans, regular to medium
- Labels: medium
- Buttons: semibold

Good implementation candidates:

- `Nunito Sans`
- `Avenir Next`
- `Poppins`
- `DM Sans`

If only one family is used, `Nunito Sans` is the closest overall fit to the visible tone.

## Type Scale

```txt
Display / major page title: 28px / 700
Section title: 22px / 700
Card title: 18px / 700
Body: 14px to 16px / 400-500
Small helper text: 12px to 13px / 400-500
Button text: 14px to 16px / 600
Tab label: 13px to 14px / 600
```

## Shape Language

The interface consistently uses rounded geometry.

- Inputs: rounded rectangle
- Buttons: rounded rectangle or pill
- Cards: soft corners, usually `16px` to `20px`
- Pills and segmented controls: fully rounded
- Sheets and modals: large radius with soft edges

Avoid sharp corners unless used for embedded media or map tiles.

## Spacing Rhythm

Recommended base spacing:

```txt
4px  micro spacing
8px  tight spacing
12px compact spacing
16px default spacing
20px roomy spacing
24px section spacing
32px major separation
```

The screenshots lean toward generous vertical spacing, especially on settings and creation screens.

## Component Styling

### Buttons

- Primary light-screen CTA: coral fill with white text
- Secondary CTA: white background with coral border or teal border
- Dark utility CTA: navy fill with white text
- Disabled CTA: pale gray fill with muted text

### Inputs

- White fill
- Thin cool-gray border
- Rounded corners
- Placeholder text in muted gray
- Light icon treatment using teal or muted navy

### Cards

- White or pale-blue surface
- Thin border or very soft shadow
- Rounded corners
- Limited elevation, never heavy material-style shadows

### Tabs and Pills

- Selected: teal or navy fill depending on hierarchy
- Unselected: white background with border
- Text should remain high contrast and compact

### Empty States

- Lots of whitespace
- Small illustrative icon
- One obvious next action
- Friendly copy tone

## Screen-Specific Patterns

### Home

- light blue welcome/checklist surfaces
- white feed background
- navy date-range pills
- teal section headers

### Games and Groups

- white content surfaces
- coral invitation and creation actions
- teal tab indicators
- success green for joined/confirmed states

### Nearby / Discovery

- teal for search and segmented state
- coral for result CTA buttons
- map cards stay mostly white for readability

### Settings

- mostly white surfaces
- teal section labels
- coral add/edit actions
- occasional blue or purple promotional cards

### Premium / Plan

- purple reserved for PLUS signaling
- subscription cards can mix purple with coral and teal, but purple should remain the premium cue

## Motion Direction

If motion is introduced, it should feel soft and fast:

- short fades
- slight upward card entrances
- pill and toggle state transitions
- no dramatic bounce
- no heavy parallax

Recommended timing:

- micro interaction: `120ms` to `180ms`
- panel transition: `180ms` to `240ms`
- modal/sheet entrance: `220ms` to `280ms`

## Accessibility Notes

- Coral on white may need a darker text or border treatment for WCAG-safe contrast in some cases
- Teal should not be the only signal for selected state; pair with fill, icon, underline, or weight
- Small helper text should not go below `12px`
- Navy is the safest color for high-importance contrast

## Do / Don't

### Do

- keep the UI airy and mobile-friendly
- use rounded components consistently
- use teal as the brand anchor
- use coral to drive action
- reserve purple for premium
- preserve white space generously

### Don't

- over-darken the app
- replace the palette with generic grayscale enterprise styling
- use too many saturated accent colors at once
- make shadows heavy
- make every CTA teal

## Suggested Naming For Implementation

If you want a simpler product-facing theme vocabulary:

- `brand`
- `brand-soft`
- `action`
- `action-soft`
- `ink`
- `ink-soft`
- `surface`
- `surface-muted`
- `success`
- `warning`
- `danger`
- `premium`

## Confidence Notes

High confidence:

- teal as primary brand color
- coral as primary action color
- navy as strong utility contrast
- soft white surfaces and rounded forms

Medium confidence:

- exact hex values
- precise font family
- motion details

Lower confidence:

- official brand naming
- whether premium purple is part of the core system or only a campaign color

