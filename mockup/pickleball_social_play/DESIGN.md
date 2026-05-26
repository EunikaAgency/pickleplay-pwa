---
name: Pickleball Social & Play
colors:
  surface: '#f8f9fc'
  surface-dim: '#d9dadd'
  surface-bright: '#f8f9fc'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3f6'
  surface-container: '#edeef1'
  surface-container-high: '#e7e8eb'
  surface-container-highest: '#e1e2e5'
  on-surface: '#191c1e'
  on-surface-variant: '#434656'
  inverse-surface: '#2e3133'
  inverse-on-surface: '#f0f1f4'
  outline: '#747688'
  outline-variant: '#c4c5d9'
  surface-tint: '#124af0'
  primary: '#0040e0'
  on-primary: '#ffffff'
  primary-container: '#2e5bff'
  on-primary-container: '#efefff'
  inverse-primary: '#b8c3ff'
  secondary: '#506600'
  on-secondary: '#ffffff'
  secondary-container: '#c1f100'
  on-secondary-container: '#546b00'
  tertiary: '#a32400'
  on-tertiary: '#ffffff'
  tertiary-container: '#cf3000'
  on-tertiary-container: '#ffede9'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dde1ff'
  primary-fixed-dim: '#b8c3ff'
  on-primary-fixed: '#001356'
  on-primary-fixed-variant: '#0035be'
  secondary-fixed: '#c3f400'
  secondary-fixed-dim: '#abd600'
  on-secondary-fixed: '#161e00'
  on-secondary-fixed-variant: '#3c4d00'
  tertiary-fixed: '#ffdad2'
  tertiary-fixed-dim: '#ffb4a2'
  on-tertiary-fixed: '#3c0700'
  on-tertiary-fixed-variant: '#8a1d00'
  background: '#f8f9fc'
  on-background: '#191c1e'
  surface-variant: '#e1e2e5'
typography:
  headline-xl:
    fontFamily: Rubik
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 42px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Rubik
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Rubik
    fontSize: 25px
    fontWeight: '700'
    lineHeight: 30px
  headline-md:
    fontFamily: Rubik
    fontSize: 21px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Nunito Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Nunito Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 21px
  label-sm:
    fontFamily: Nunito Sans
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.05em
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 16px
  xl: 3rem
  full: 16px
spacing:
  base: 8px
  container-padding: 20px
  gutter: 16px
  card-gap: 12px
  touch-target-min: 48px
---

## Brand & Style

The design system is engineered to evoke high energy, accessibility, and the social joy of community sports. It targets active lifestyle enthusiasts who value connection over rigid competition. The aesthetic is **Playful Modernism**—a blend of high-visibility neon accents with a clean, mobile-first card architecture.

The UI should feel "bouncy" and approachable. We utilize generous negative space and a soft, multi-layered depth model to ensure that even with a vibrant palette, the experience remains readable and stress-free. The emotional goal is to move the user from "app browsing" to "on the court" with a sense of excitement and encouragement.

## Colors

The palette is anchored by **Electric Blue**, providing a trustworthy yet energetic foundation. **Neon Lime** serves as the high-action accent, used exclusively for primary calls-to-action and critical interactive highlights.

- **Primary (Electric Blue):** Used for branding, active states, and primary iconography.
- **Accent (Neon Lime):** Used for "Join" buttons, success states, and key highlights. It should always be paired with dark text for accessibility.
- **Background:** A soft, cool-tinted off-white (`#F8F9FC`) is used to provide enough contrast for pure white cards to "float" prominently.
- **Feedback:** Use a warm coral (`#FF3D00`) for urgent notifications to contrast against the cool primary blue.

## Typography

This design system uses a dual-font strategy to balance personality with readability. **Rubik** provides rounded, friendly geometric terminals for headings, while **Nunito Sans** ensures high legibility for long-form content and player stats.

- **Headings:** Always use Rubik. Maintain a tight letter-spacing on larger sizes to keep the "sporty" feel.
- **Body:** Nunito Sans is the workhorse. Use the SemiBold (600) weight for emphasis within paragraphs rather than italics.
- **Case Styling:** Sentence case is the default for almost all UI elements. Small labels (11px and below) are the only elements permitted to use Uppercase to ensure they don't get lost in the layout.

## Layout & Spacing

The layout philosophy is **Card-Centric and Mobile-First**. All content should be contained within white cards that sit on the neutral background. 

- **Grid:** A fluid 4-column grid for mobile, expanding to 12 columns for desktop.
- **Rhythm:** Use an 8px baseline grid. 
- **Padding:** Content inside cards should have a minimum of 20px (2.5 units) padding to maintain a "breathable" and premium feel.
- **Tap Targets:** Every interactive element must respect a 48px minimum height/width to accommodate fast-paced, "on-the-go" usage.

## Elevation & Depth

To maintain the playful and light feel, this design system avoids heavy, dark shadows. Instead, it uses **Tinted Ambient Shadows**.

- **Level 1 (Cards):** Low-blur, 10% opacity shadow using the Primary Electric Blue hex rather than pure black. This tethers the elements to the brand color even in the shadows.
- **Level 2 (Active/Floating):** Used for floating action buttons (FABs) and active card states. Increased blur and slightly higher opacity (15%) to suggest the element is "ready to jump."
- **Layering:** Content is layered primarily through color blocking (White cards on Soft Grey backgrounds) rather than heavy borders.

## Shapes

The shape language is defined by **hyper-roundness**. This removes any "sharpness" or perceived formality from the app, making it feel safe and inclusive.

- **Buttons & Chips:** Always pill-shaped (999px radius).
- **Cards:** Use a generous 24px radius on large containers, scaling down to 18px for smaller nested cards.
- **Inputs:** 16px radius to provide a distinctive "squircle" look that sits comfortably between the pill-buttons and the rectangular cards.
- **Avatars:** Strictly circular to signify community and personhood.

## Components

### Buttons
- **Primary:** Pill-shaped, Neon Lime background with Dark Navy text.
- **Secondary:** Pill-shaped, Electric Blue background with White text.
- **Ghost:** Pill-shaped, Electric Blue outline (2px) with Electric Blue text.

### Inputs & Fields
- Use a 16px corner radius. Border should be a soft 1px stroke in a muted blue-grey. On focus, the border should thicken to 2px in Electric Blue with a soft glow.

### Cards
- Pure white background. 24px corner radius. No borders; use the tinted ambient shadow for separation. Content inside should be vertically centered to reinforce the "balanced" feel.

### Chips & Tags
- Pill-shaped. Use subtle background tints of the primary color (e.g., 10% Electric Blue) with full-saturation text for high legibility.

### Icons
- Use "Rounded" or "Duotone" icon sets. Strokes should be at least 2px thick to match the bold weight of the typography. Avoid thin, hairline icons.

### Voice & Tone
- Copy should be direct and human. Use "Let's go!" instead of "Submit," and "Who's playing?" instead of "Player List."
