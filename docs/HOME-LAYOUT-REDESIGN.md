# Home Screen — Layout Refinement Plan

> **Status:** ✅ Implemented (2026-05-29), then **superseded** by a
> stakeholder-supplied design. The shipped "new" home (`HomeScreenRefined.tsx`)
> now follows `app/new homepage/` (a "Ready to play?" hero, a quick-access row,
> an "Open games near you" list with one-tap Join, a "players checked in" strip,
> a "Courts available now" list, and a streak card) rather than the
> section-by-section plan below (which captured the earlier refinement iteration
> — hero CTA, uniform headers, Tonight vertical list, desktop hero pairing). The
> classic layout is still retained behind a floating **Home: New / Classic**
> switch (persisted to `localStorage`). Files: `HomeScreenRefined.tsx`,
> `HomeScreenSwitch.tsx`. Implemented captures:
> [home-refined-mobile.png](screenshots/home-refined-mobile.png) ·
> [home-refined-desktop.png](screenshots/home-refined-desktop.png).
>
> **Scope:** Layout only. Fonts (Fredoka / Nunito Sans), colors (electric blue
> `#0040e0` · lime `#c1f100` · coral `#cf3000`), the logo, icons (Material
> Symbols via `Icon`), imagery style, button styles, and every component's
> styling stay **exactly as they are today**. This is a layout refinement, not a
> rebrand.
>
> **Source of layout ideas:** Google **Stitch MCP** (`stitch.googleapis.com/mcp`),
> project *"Pickleball Social"*. Stitch generated a `Home - Refined Layout`
> screen from our real content. We adopt only its **layout/structure** — its
> own fonts (Plus Jakarta Sans) and slightly different blues are ignored.
>
> **Target file:** [app/src/features/home/HomeScreen.tsx](../app/src/features/home/HomeScreen.tsx)
> · tokens & component CSS in [app/src/shared/styles/index.css](../app/src/shared/styles/index.css)
>
> **Reference captures (layout only — ignore their type/color):**
> - Primary: [docs/screenshots/stitch-home-refined-layout.png](screenshots/stitch-home-refined-layout.png)
> - Alt ideas: [docs/screenshots/stitch-home-alt-quick-actions.png](screenshots/stitch-home-alt-quick-actions.png)

---

## 1. Summary of current layout issues

The current home (`HomeScreen.tsx`) stacks: header → now-card hero → activity
ticker → calendar strip → "Tonight" horizontal rail → "From your clubs" → streak
card. The content is good; the **arrangement** has these weaknesses:

| # | Issue | Where | Effect |
|---|-------|-------|--------|
| 1 | **No explicit primary CTA.** The "next game" hero is a whole-card tap with no visible button. | `.now-card` (lines 124–164) | The most important action on the screen has the weakest affordance; users may not realize the hero is tappable. |
| 2 | **Misaligned gutters.** Header & sections sit at `20px`; the hero, activity ticker and clubs/streak cards sit at `16px` (`calc(100% - 32px)`). | `.app-header` (20px) vs `.now-card` / `.activity` (16px) | The left edge "wobbles" 4px between blocks — the screen never reads as a clean column. |
| 3 | **Irregular vertical rhythm.** Spacing is set ad-hoc per block: `.section{margin-top:22px}`, plus inline `mt-4!`, `mt-3.5!`, hero `margin:4px…`. | throughout | Gaps jump between ~4px, 14px and 22px, so sections feel unevenly spaced rather than rhythmic. |
| 4 | **Inconsistent section headers.** Calendar / Tonight / Clubs get the eyebrow→title pattern (`t-eyebrow` + `hd-2`); the hero and activity ticker get none. | hero & `.activity` | Visual hierarchy is uneven — some sections announce themselves, others float. |
| 5 | **Two stacked horizontal scrollers.** The calendar strip *and* the Tonight rail both scroll sideways, back to back. | `.cal-strip` + `.rail` | "Swipe fatigue" and ambiguous gesture zones; the Tonight cards also hide their action (you must tap a poster, scroll, and there's no Join/▸ affordance). |
| 6 | **Cramped hero content.** Hero text is forced to `max-w-[70%]` to clear the `CourtIllustration`, and avatars + meta + spots-text stack tightly with no CTA. | `.now-card` inner | The hero looks decorative more than actionable, and wastes its prominence. |
| 7 | **Under-used desktop width above the fold.** At ≥1024px the hero, activity and calendar each span the full 1100px column as single rows; only the bottom (clubs+streak) and Tonight use multi-column grids. | desktop `@media (min-width:1024px)` | The most valuable above-the-fold area is a tall single column on a wide canvas. |

---

## 2. Proposed new homepage structure

Stitch's refined layout **keeps our section order and all content** and fixes
the issues above with four moves:

1. **Give the hero an explicit primary CTA button** ("View game →") instead of a
   silent whole-card tap.
2. **Apply the eyebrow→title section header to *every* grouped section** so
   hierarchy is uniform.
3. **Standardise one vertical rhythm** (a single section gap) and **align every
   block to one gutter**, removing the ad-hoc margins and the 16/20px wobble.
4. **Make "Tonight" a scannable vertical list** (one horizontal scroller on the
   page, not two) — reusing the existing `GameRow` component — while keeping the
   poster grid on desktop where width allows it.

```
MOBILE (new)                         DESKTOP ≥1024 (new)
┌─────────────────────────────┐      ┌──────────┬───────────────────────────┐
│ Header  (greet · bell ·avtr)│      │          │ Header                    │
├─────────────────────────────┤      │          ├──────────────┬────────────┤
│ ▍NEXT GAME hero  [View game]│      │ Sidebar  │ NEXT GAME hero│ This week  │
├─────────────────────────────┤      │  (nav)   │  [View game]  │ • activity │
│ ▸ activity ticker           │      │          │  (≈1.6fr)     │ • calendar │
├─────────────────────────────┤      │          │               │  (≈1fr)    │
│ PLAN YOUR PLAY / Your week  │      │          ├──────────────┴────────────┤
│ ◻︎◻︎◻︎◻︎◻︎◻︎ (calendar →)       │      │          │ TRENDING NOW / Hot near you│
├─────────────────────────────┤      │          │ ◻︎ ◻︎ ◻︎ ◻︎  (poster grid)   │
│ TRENDING NOW / Hot near you │      │          ├───────────────────────────┤
│ ▭ Friday Night Dinks      ▸ │      │          │ From your clubs │ Streak   │
│ ▭ Beginner Open Play      ▸ │      │          │  (rows)         │ (card)   │
│ ▭ Round Robin Mixer       ▸ │      └──────────┴───────────────────────────┘
│ ▭ Competitive 4.0+        ▸ │
├─────────────────────────────┤
│ COMMUNITY / From your clubs │
│ ▭ row   ▭ row               │
├─────────────────────────────┤
│ ▓ 4-game streak 🔥          │
└─────────────────────────────┘
```

Order is unchanged from today (hero → activity → calendar → tonight → clubs →
streak). The wins are in CTA, headers, spacing, gutters, and the Tonight list.

---

## 3. Section-by-section layout plan

### 3.1 Header
- **Keep** greeting block (`greet-name` + `greet-sub`) left, bell + `Avatar`
  right. No change to content or styling.
- **Align** its horizontal padding to the single page gutter (see §5). Today
  it's `8px 20px 4px`; the gutter becomes the source of truth.

### 3.2 Next-game hero — *add an explicit CTA (highest-impact change)*
- Keep `.now-card`, the gradient, the `deco` glow, `CourtIllustration`, the
  `NEXT GAME · IN 4H` pill, the live dot, the avatar stack, and "8/12 · 4 spots
  open" — all unchanged.
- **Add a visible primary button** at the bottom of the card, e.g. `View game →`,
  styled with the **existing** join-button style (`.sticky-cta .btn-join` — lime
  `--lime` on `--lime-ink`) or a white pill. Reuse, don't invent.
- Let the button (not the whole card) be the obvious tap target; the card may
  stay tappable as a secondary affordance.
- Give the inner content column a touch more room (relax `max-w-[70%]` to
  `~78%`, or drop the CourtIllustration's opacity behind the new button row) so
  text + CTA don't collide with the illustration.

### 3.3 Activity ticker
- Keep `.activity` exactly (lime-soft pill, pulsing coral dot, chevron).
- Only its **margin** changes to match the unified gutter so it lines up with
  the hero and sections above/below.

### 3.4 Calendar strip — "Your week / Plan your play"
- **No layout change** — this is the *one* horizontal scroller we keep; a date
  picker is the right use of horizontal scroll. Keep `.cal-strip`, `today`
  highlight, and the lime `has` dots.
- Confirm the eyebrow→title header (`t-eyebrow` "Your week" + `hd-2` "Plan your
  play") — already present.

### 3.5 Tonight — "Hot near you" — *convert rail → vertical list on mobile*
- **Mobile/tablet:** render the four games as a **vertical list of full-width
  rows** instead of the horizontal poster rail. **Reuse the existing `GameRow`
  component** already used by "From your clubs" — same styling, same chevron/
  action affordance, zero new CSS. This removes the second horizontal scroller
  (issue #5) and surfaces tag/time/court inline + a clear ▸ affordance.
- Keep the existing skill-tag chip, time and `location` meta as the row content.
- **Desktop (≥1024):** **keep the poster grid.** The current
  `.rail.rail-desktop-grid` already lays the `.tonight-card` posters into a
  4-column grid — that's a good use of width, so retain it there.
- Net effect: scannable + actionable on phones, visual + browseable on desktop,
  with **no component restyling** either way.

### 3.6 From your clubs — "Don't miss out"
- **No change.** Already a clean vertical `GameRow` list. Now it visually rhymes
  with the Tonight list above it (both `GameRow`), which *strengthens* grouping
  rather than weakening it, because each keeps its own eyebrow→title header.

### 3.7 Streak card
- **No change.** Stays the dark capstone card at the bottom (the "reward" beat).

---

## 4. Responsive behavior

### Mobile (< 640px) — the primary target
- Single column. Apply: explicit hero CTA, uniform section headers, one
  consistent section gap, single gutter, Tonight as a vertical `GameRow` list.
- Keep the floating glass `.tabbar`; nothing about chrome changes.

### Tablet (640–1023px)
- Today this breakpoint only bumps type/card sizes (no structural change). Add:
  lay **Tonight** into a **2-column grid** of `GameRow`s (or 2-col poster grid)
  to use the extra width, and widen the page gutter to ~24px. Hero, activity and
  calendar stay full-width single column.

### Desktop (≥ 1024px) — sidebar app shell
- Keep the existing sidebar + 1100px capped `.scroll` column.
- **New above-the-fold pairing:** put the **hero** and a stacked **right rail**
  (activity ticker + calendar) side by side in a 2-column grid (~`1.6fr / 1fr`),
  mirroring the existing `.home-bottom-grid` pattern. This fixes issue #7 — the
  tall single column above the fold — without touching any card's styling.
- **Tonight** keeps the existing 4-column poster grid
  (`.rail.rail-desktop-grid`).
- **Clubs + Streak** keep the existing `.home-bottom-grid` (`1.4fr / 1fr`).

---

## 5. Developer implementation notes

All changes are layout/structure only and lean on **existing** classes,
components and tokens.

1. **Unify the gutter.** Pick one page gutter (recommend **20px**, matching
   `.section`). Change the hero/activity/clubs from the 16px breakout
   (`margin: … 16px`, `width: calc(100% - 32px)`) to the 20px gutter
   (`calc(100% - 40px)`), or wrap them in `.section`. Result: one clean left
   edge top-to-bottom.
2. **Standardise vertical rhythm.** Settle on a single section gap
   (`.section { margin-top: 24px }`) and **delete the ad-hoc inline overrides**
   (`mt-4!`, `mt-3.5!`, the hero's `margin:4px…`). Let the section rhythm own
   spacing. (Stitch uses one `space-y` rhythm for exactly this reason.)
3. **Hero CTA.** Add a button row inside `.now-card`; reuse the lime join-button
   style (`--lime` / `--lime-ink`, the `.sticky-cta .btn-join` recipe). Keep it
   above the `CourtIllustration` (`z-[2]`). Wire it to
   `onNavigate('game-details', { id: 'g1' })`.
4. **Uniform section headers.** Wrap the hero and activity blocks so each grouped
   section uses the `section-head` → `t-eyebrow` + `hd-2` pattern already used by
   calendar/tonight/clubs. (Hero can keep its in-card pill *and* gain an external
   eyebrow, or keep just the pill — but the surrounding rhythm should match.)
5. **Tonight → `GameRow` on mobile.** Replace the `.rail` of `.tonight-card`
   posters with a `flex flex-col gap-2.5` list of `GameRow` components (same
   props shape as the clubs list: `day`/`num`/`thumb`/`title`/`time`/`loc`/
   `onTap`). **Gate the poster grid to desktop** — e.g. render `GameRow`s by
   default and the existing `.tonight-card` grid only at `≥1024px`, or keep both
   markup paths behind a CSS `hidden`/`lg:block` toggle. No new CSS needed —
   `GameRow` and `.rail.rail-desktop-grid` both already exist.
6. **Desktop hero pairing.** Add a wrapper grid (clone the `.home-bottom-grid`
   rule as e.g. `.home-hero-grid { grid-template-columns: minmax(0,1.6fr)
   minmax(0,1fr) }` at `≥1024px`, `display:block` below) around the hero + a
   right-rail `<div>` holding the activity ticker and calendar.
7. **Preserve `DemoBranch`.** The loading/error/empty branches wrap the whole
   body — keep them, and update the `LoadingSkeleton` shapes so the skeleton
   roughly matches the new arrangement (hero block + a few rows).
8. **Keep build clean.** Run `npm run build` and `npm run lint` after the edit
   (per `app/CLAUDE.md` checklist).
9. **Roadmap.** Per `app/CLAUDE.md`, when this is *implemented* (not just
   planned), update `web/src/features/marketing/RoadmapPage.jsx` (Last-updated +
   Change Log) in the same commit.

---

## 6. Risks & assumptions

- **Assumption — layout only.** Stitch's output uses Plus Jakarta Sans and
  slightly different blues; per the brief we take **only its layout/structure**
  and keep all PickleBallers fonts, colors, icons, imagery and component styles.
- **Risk — Tonight loses its "poster/discovery" feel on mobile.** Converting the
  rail to `GameRow`s trades visual browse-appeal for scannability + a visible
  action. *Mitigation:* desktop keeps the posters; if the product wants imagery
  on mobile too, keep a small thumbnail in the row (`GameRow` already supports a
  `thumb`). This is the one genuinely debatable change — flag for product sign-off.
- **Risk — hero CTA vs `CourtIllustration` overlap.** The illustration sits
  `-right-2.5 -bottom-5`; a new bottom CTA must sit above it (`z-[2]`) or the
  illustration's footprint must shrink/dim. Verify on the smallest target width.
- **Risk — desktop hero pairing height mismatch.** Hero and the activity+calendar
  rail may differ in height; use `align-items:start` (as `.home-bottom-grid`
  does) so they top-align instead of stretching.
- **Assumption — no content/IA changes.** Stitch's *alternate* screen also
  suggested a quick-actions shortcut row (Join / Book / Create / Find Players)
  and a "Courts near you" block. Those add **new content/IA**, not just layout,
  so they're **out of scope** here and noted only as future options.
- **Dependency.** The `claude` CLI isn't installed in this sandbox, so the Stitch
  MCP couldn't be registered as a session tool; it was driven directly over its
  HTTP/JSON-RPC endpoint instead. The MCP config the user provided still belongs
  in a **local/untracked** scope (never a tracked file) so the API key can't leak
  on push.
