---
name: Pickleball Social
colors:
  surface: '#fbf8ff'
  surface-dim: '#d9d9e6'
  surface-bright: '#fbf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f2ff'
  surface-container: '#ededfa'
  surface-container-high: '#e7e7f4'
  surface-container-highest: '#e2e1ee'
  on-surface: '#191b24'
  on-surface-variant: '#434656'
  inverse-surface: '#2e303a'
  inverse-on-surface: '#f0effd'
  outline: '#747687'
  outline-variant: '#c4c5d8'
  surface-tint: '#134bec'
  primary: '#003cce'
  on-primary: '#ffffff'
  primary-container: '#2455f4'
  on-primary-container: '#e1e4ff'
  inverse-primary: '#b8c4ff'
  secondary: '#4c6700'
  on-secondary: '#ffffff'
  secondary-container: '#b7f300'
  on-secondary-container: '#506c00'
  tertiary: '#4c4e57'
  on-tertiary: '#ffffff'
  tertiary-container: '#64666f'
  on-tertiary-container: '#e3e5ef'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dde1ff'
  primary-fixed-dim: '#b8c4ff'
  on-primary-fixed: '#001354'
  on-primary-fixed-variant: '#0036bb'
  secondary-fixed: '#baf603'
  secondary-fixed-dim: '#a3d800'
  on-secondary-fixed: '#151f00'
  on-secondary-fixed-variant: '#384e00'
  tertiary-fixed: '#e0e2ec'
  tertiary-fixed-dim: '#c4c6d0'
  on-tertiary-fixed: '#191b23'
  on-tertiary-fixed-variant: '#44474f'
  background: '#fbf8ff'
  on-background: '#191b24'
  surface-variant: '#e2e1ee'
  app-bg: '#F5F6FA'
  card-white: '#FFFFFF'
  muted-gray: '#737B8C'
  light-gray: '#E8EBF2'
  lavender: '#DDE2FF'
  coral: '#FF5B4A'
  lime-soft: '#E9FF8A'
typography:
  display:
    fontFamily: Plus Jakarta Sans
    fontSize: 30px
    fontWeight: '800'
    lineHeight: 38px
  h1:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '800'
    lineHeight: 32px
  h2:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '800'
    lineHeight: 28px
  h3:
    fontFamily: Plus Jakarta Sans
    fontSize: 17px
    fontWeight: '700'
    lineHeight: 24px
  body:
    fontFamily: Plus Jakarta Sans
    fontSize: 15px
    fontWeight: '500'
    lineHeight: 22px
  metadata:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
  label-caps:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '800'
    lineHeight: 14px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  base: 16px
  lg: 20px
  xl: 24px
  xxl: 32px
---

Pickleball App Design System
1. Design Principles
Energetic
The interface should feel active, sporty, and ready for play. Use bright accents, bold hierarchy, and confident spacing.
Social
Pickleball is community-driven. Design should highlight players, clubs, open spots, check-ins, and shared activity.
Fast
Users should be able to understand what is happening nearby in seconds. Prioritize time, location, skill level, and availability.
Friendly
Avoid overly serious sports branding. Use rounded shapes, soft shadows, playful illustrations, and encouraging copy.
Native Mobile
The product should feel like a polished iOS/Android mobile app, not a web dashboard.
2. Brand Personality
The visual identity should be:


Bright

Playful

Athletic

Approachable

Social

Modern

Slightly competitive
Avoid:


Corporate SaaS styling

Harsh borders

Dense layouts

Overly muted palettes

Generic fitness-app darkness

Complicated data-heavy screens
3. Color Palette
Primary Colors
TokenHexUsageprimary-blue#2455F4Active states, hero cards, links, selected navpickle-green#B9F500Primary actions, highlights, badges, streaksdeep-navy#10131AMain text, dark cards, selected statesapp-bg#F5F6FAMain screen backgroundcard-white#FFFFFFCards, sheets, list items
Secondary Colors
TokenHexUsagemuted-gray#737B8CMetadata, secondary labelslight-gray#E8EBF2Dividers, inactive chips, subtle borderslavender#DDE2FFAvatar backgrounds, secondary date blockscoral#FF5B4AAlerts, live dots, urgency indicatorslime-soft#E9FF8AAlert backgrounds, soft green surfaces
Gradients
Use gradients for game cards and featured content.
Examples:


Blue game card: #2455F4 → #26327F

Green game card: #B9F500 → #557000

Orange social card: #FF4A1F → #7A210F

Hero card: #2455F4 → #5F7CFF
4. Typography
Use a rounded sans-serif typeface with strong weight contrast.
Recommended font characteristics:


Rounded terminals

Friendly letterforms

High readability at small sizes

Bold headings
Suggested font options:


Nunito Sans

Plus Jakarta Sans

Satoshi

Inter Rounded

SF Pro Rounded
Type Scale
StyleSizeWeightUsageDisplay28–32px800Large empty states, feature introsH122–24px800Greeting, page titleH220–22px800Section titleH316–18px700Card titleBody14–15px500Standard textMetadata12–13px500Time, location, distanceLabel10–12px800Uppercase section labels, badges
Typography Rules


Headings should be short and punchy.

Section labels should use uppercase with letter spacing.

Metadata should remain compact and muted.

Use bold text to highlight game names, court names, and available spots.
5. Spacing System
Use an 8px spacing system.
TokenValuespace-14pxspace-28pxspace-312pxspace-416pxspace-520pxspace-624pxspace-832px
Layout Spacing


Screen horizontal padding: 16–20px

Section spacing: 24–32px

Card internal padding: 16–20px

Card gap: 12–16px

Metadata row gap: 6–8px
6. Radius System
The app should use large, friendly rounded corners.
TokenValueUsageradius-sm10pxSmall badges, chipsradius-md14pxButtons, small cardsradius-lg20pxStandard cardsradius-xl28pxHero cards, bottom navradius-full999pxPills, avatars, circular buttons
Avoid sharp corners.
7. Elevation
Use soft shadows to create layered mobile depth.
Card Shadow
0 6px 18px rgba(16, 19, 26, 0.08)
Floating Nav Shadow
0 -8px 24px rgba(16, 19, 26, 0.10)
Primary CTA Shadow
0 8px 18px rgba(185, 245, 0, 0.35)
Rules


Shadows should feel soft, not heavy.

Do not overuse borders and shadows together.

Cards should lift subtly from the app background.
8. Components
Buttons
Primary Button
Use for joining games, creating events, saving courts, and main CTAs.
Style:


Background: pickle-green

Text/icon: deep-navy

Radius: radius-full

Font weight: 800

Height: 44–52px
Secondary Button
Use for less important actions.
Style:


Background: white or light gray

Text: deep-navy

Radius: radius-full

Font weight: 700
Icon Button
Use for notifications, add buttons, filters, and quick actions.
Style:


Circular

Size: 40–56px

Background: white or pickle-green

Icon: navy or blue

Soft shadow when floating
9. Cards
Standard Card
Used for games, clubs, courts, and events.
Style:


Background: white

Radius: radius-lg

Padding: 16px

Shadow: card shadow

Optional subtle border: 1px solid rgba(16, 19, 26, 0.06)
Hero Card
Used for featured game or next match.
Style:


Gradient background

Radius: radius-xl

Padding: 20px

Min height: 180–220px

White text

Decorative pickleball/court illustration

Strong visual hierarchy
Dark Progress Card
Used for streaks, achievements, or stats.
Style:


Background: deep-navy

Radius: radius-xl

Text: white

Accent: pickle-green

Include large low-opacity trophy, flame, or paddle graphic
10. Badges & Chips
Badges are used to indicate game type, skill level, status, or availability.
Skill Badge
Examples:


Beginner

3.0–3.5

Advanced

Social
Style:


Radius: radius-full

Padding: 6px 10px

Font size: 11–12px

Weight: 800
Status Badge
Examples:


Open

Filling fast

4 spots left

Checked in
Style:


Use green for positive/open

Use coral for urgent/live

Use navy for selected/active
Date Chip
Style:


Width: 52–64px

Height: 68–76px

Radius: 16–18px

Selected state: deep navy background, white text, green activity dot

Default state: white background, dark text
11. Navigation
Use a floating bottom navigation bar.
Style:


Background: white

Radius: 28px

Height: 72–84px

Shadow: floating nav shadow

Icons: rounded line style

Active item: primary blue

Inactive items: muted gray
Navigation items:


Today

Games

Add

Courts

You
The center add button should be:


Circular

56–64px

Background: pickle-green

Icon: deep navy

Elevated above the nav bar
12. Iconography
Use simple rounded line icons.
Preferred icon style:


2px stroke

Rounded caps

Minimal detail

Friendly proportions
Icon categories:


Home

Calendar

Clock

Location pin

Bell

User

Plus

Trophy

Flame

Paddle

Pickleball ball

Court
13. Illustrations & Visual Motifs
Use subtle pickleball-inspired visuals to reinforce the product category.
Motifs:


Court line patterns

Tilted court illustrations

Pickleball ball dots

Paddle silhouettes

Motion trails

Trophy shapes

Net/grid textures
Illustrations should:


Be simple and geometric

Use blue, green, navy, and white

Sit behind content or beside it

Never reduce readability
14. Data Display
Prioritize the following information on game/event cards:


Time

Game name

Skill level

Court/location

Distance

Spots available

Player count

Club name
Metadata should use small icons and muted text.
Example metadata format: 6:30 PM · Riverside Courts · 1.2 mi
15. Copywriting Style
Copy should be short, social, and action-oriented.
Use phrases like:


“Hot near you”

“Plan your play”

“Open games tonight”

“4 spots open”

“Players checked in”

“Don’t miss out”

“Join the next rally”

“You’re on a streak”

“Find your court”
Avoid:


Long instructional text

Formal sports league language

Corporate dashboard wording
16. Accessibility


Maintain strong contrast between text and backgrounds.

Do not place small text on complex gradients.

Use white text only on dark or saturated backgrounds.

Minimum touch target: 44px.

Do not rely on color alone for status.

Include icons or labels for important states.

Keep body text at least 14px where possible.
17. Motion Guidelines
Motion should feel quick, bouncy, and lightweight.
Suggested interactions:


Cards lift slightly on tap.

Plus buttons scale subtly.

Date chips slide horizontally.

Live alert dots pulse gently.

Streak card can animate with a small flame/trophy reveal.
Avoid slow or overly complex animations.
18. Overall Visual Rules
Do:


Use rounded shapes everywhere.

Use neon green as the key action color.

Keep screens spacious and scannable.

Make games and events feel easy to join.

Emphasize nearby, live, and social activity.
Do not:


Use sharp rectangular cards.

Make the UI too dark overall.

Overload screens with statistics.

Use thin, formal typography.

Make the product feel like a generic calendar app.