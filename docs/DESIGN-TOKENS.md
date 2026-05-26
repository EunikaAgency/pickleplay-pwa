# Design Tokens — PicklePlay PWA

## CSS Custom Properties

```css
:root {
  /* Brand */
  --color-primary-500: #2FAFC3;
  --color-primary-400: #67CFE0;
  --color-primary-100: #DDF5FB;

  /* Accent / Actions */
  --color-accent-500: #F26D4D;
  --color-accent-400: #FF8D6F;

  /* Dark / Utility */
  --color-navy-700: #171B5A;
  --color-navy-500: #2A316F;

  /* Premium (Phase 6) */
  --color-premium-500: #7C63F2;

  /* Semantic */
  --color-success-500: #32B36B;
  --color-success-100: #DDF7E8;
  --color-warning-500: #E0A72E;
  --color-warning-100: #FFF3C9;
  --color-danger-500: #D85B4A;
  --color-danger-100: #FDE3DE;

  /* Surfaces */
  --color-bg-page: #FAFBFC;
  --color-bg-surface: #FFFFFF;
  --color-border-soft: #E7EDF1;
  --color-border-strong: #C9D7DF;

  /* Text */
  --color-text-strong: #1F2A33;
  --color-text-body: #42515B;
  --color-text-muted: #7E8C96;
  --color-text-disabled: #A8B3BA;

  /* Radii */
  --radius-xs: 8px;
  --radius-sm: 12px;
  --radius-md: 16px;
  --radius-lg: 20px;
  --radius-pill: 999px;

  /* Shadows */
  --shadow-soft: 0 6px 18px rgba(31, 42, 51, 0.08);
  --shadow-card: 0 2px 10px rgba(31, 42, 51, 0.06);

  /* Spacing */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 12px;
  --space-base: 16px;
  --space-lg: 20px;
  --space-xl: 24px;
  --space-2xl: 32px;
}
```

## Tailwind Config Extension

```js
// tailwind.config.ts
{
  theme: {
    extend: {
      colors: {
        brand: {
          500: '#2FAFC3',
          400: '#67CFE0',
          100: '#DDF5FB',
        },
        accent: {
          500: '#F26D4D',
          400: '#FF8D6F',
        },
        navy: {
          700: '#171B5A',
          500: '#2A316F',
        },
        premium: '#7C63F2',
      },
      borderRadius: {
        xs: '8px',
        sm: '12px',
        md: '16px',
        lg: '20px',
        pill: '999px',
      },
      fontFamily: {
        sans: ['Nunito Sans', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'display': ['28px', { fontWeight: '700', lineHeight: '1.2' }],
        'section': ['22px', { fontWeight: '700', lineHeight: '1.3' }],
        'card-title': ['18px', { fontWeight: '700', lineHeight: '1.3' }],
        'body': ['16px', { fontWeight: '400', lineHeight: '1.5' }],
        'body-sm': ['14px', { fontWeight: '400', lineHeight: '1.5' }],
        'helper': ['12px', { fontWeight: '400', lineHeight: '1.4' }],
        'btn': ['16px', { fontWeight: '600', lineHeight: '1.2' }],
        'tab': ['13px', { fontWeight: '600', lineHeight: '1.2' }],
      },
    },
  },
}
```

## Color Usage Rules

### Teal (brand-500)
- Page titles
- Active tab indicators
- Selected pills/chips
- Icon accents
- Slider tracks
- Section headers

**Do not** use teal for every button. Teal is the brand anchor, not always the strongest CTA.

### Coral (accent-500)
- Primary action buttons (Create, Join, Invite, Save)
- FAB button
- Bordered CTA treatments
- "Request to Join" actions

Coral is the clearest action-driving color.

### Navy (navy-700)
- Dark utility bars
- High-contrast filled buttons
- Date range controls
- Navigation emphasis (selected bottom tab)

Navy provides stabilizing contrast against the lighter teal/coral palette.

### Purple (premium-500)
- **RESERVED** for premium/paid features
- Do not use before Phase 6

### Surface Colors
- `bg-page` (#FAFBFC): App background, behind all content
- `bg-surface` (#FFFFFF): Cards, sheets, modals, inputs
- `border-soft` (#E7EDF1): Default card borders and dividers
- `border-strong` (#C9D7DF): Visible separators, inactive controls

## Typography Stack
- Primary: 'Nunito Sans' — rounded, friendly, readable at small sizes
- Fallback: system-ui, -apple-system, sans-serif
- Weight scale: 400 (regular), 500 (medium), 600 (semibold), 700 (bold)
- No weight below 400 or above 700

## Component Tokens

### Buttons
```
Primary CTA:      bg=accent-500, text=white, radius=pill
Secondary:        bg=white, border=accent-500, text=accent-500, radius=pill
Dark utility:     bg=navy-700, text=white, radius=pill
Disabled:         bg=gray-200, text=text-disabled, radius=pill
```

### Cards
```
Container:        bg=surface, border=border-soft, radius=md, shadow=card
Highlighted:      bg=brand-100, border=brand-400
```

### Inputs
```
Default:          bg=surface, border=border-strong, radius=sm
Focus:            border=brand-500
Placeholder:      text-muted
```

### Bottom Sheets
```
Container:        bg=surface, radius=lg (top only)
Backdrop:         rgba(0,0,0,0.4)
```
