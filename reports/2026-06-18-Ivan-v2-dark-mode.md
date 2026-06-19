# Task Report — Dark mode for the v2.1 design (Appearance toggle works on all screens)

- **Author:** Ivan
- **Date:** 2026-06-18
- **Area:** `app/` (PWA, v2.1 player redesign) + `web/` roadmap (sanctioned cross-frontend doc edit)
- **Status:** ✅ Implemented & build-clean (`app` + `web`). Reasoned through CSS specificity; not browser-clicked (no headless browser in env) — see "How to test".

---

## 1. Goal

User report: *"appearance light, dark, system not works on all screens."* The Appearance
control (Light / Dark / System) only re-themed the **v1** screens; on the **v2.1** design —
the one the user was looking at — the toggle did nothing. Make dark/light/system apply to the
**whole** v2.1 design, with a dark-navy palette, while keeping the preference **per-device and
private** to each user.

User follow-up clarified the requirement: *"per user, not apply to all users"* — i.e. one
person choosing Dark must not change anyone else's view. (Already true — see §3 "Per-user".)

## 2. The gap (before)

- `useTheme` (`shared/hooks/useTheme.ts`) correctly maps the choice to `data-theme` on
  `<html>`, persisted in **per-browser localStorage** (`pickleballers:theme`).
- **v1** tokens in `shared/styles/index.css` have `[data-theme="dark"]` + a
  `prefers-color-scheme` block → v1 themed fine.
- **v2.1** lives in `shared/styles/v2.css` and was authored **light-only**: each
  `.pb-v2.v2-<screen>` scope (home / nearby / games / clubs / profile / creategame /
  createclub) redefines the same neutral tokens, and **none** keyed off `data-theme`. So all
  v2 screens ignored the toggle. `v2.css` had **zero** `data-theme` / `prefers-color-scheme`.
- Blocker: v2's `--ink` is **overloaded** — used as **both** primary text **and** the dark
  text sitting on bright lime buttons (~58 uses across 7 screens). A naïve flip to light would
  put unreadable light text on every lime CTA.

## 3. What changed

### App — `shared/styles/v2.css`
- **Two stable, mode-independent tokens** added to the base `.pb-v2 {}`:
  - `--on-accent: #1A2138` — text/icons that sit **on** bright lime/blue fills (stays dark in
    both modes).
  - `--ink-fill: #1A2138` — a dark surface used **as a fill** that carries light text (stays
    dark; flips to `#26314F` in dark for contrast).
- **Converted the two true dark-fill sites** to `--ink-fill` so they don't flip light:
  `.v2-home .chip.active` (background) and the `.v2-creategame .pro-banner` gradient.
- **Appended a dark block** at the end of the file for both:
  - `[data-theme="dark"] .pb-v2 { … }` (explicit Dark), and
  - `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .pb-v2 { … } }`
    (System — and *not* when the user explicitly picked Light).
  - Palette is **dark-navy**, matching v1's `index.css` dark (`--bg-page:#0E1014`,
    `--surface:#1A1D24`, `--ink/--navy/--text-primary` → light `#F3F5F9`, muted greys,
    translucent hairlines, deeper shadows). `--lime`/`--blue` accents stay vivid.
  - **Specificity:** `[data-theme="dark"] .pb-v2` (0,2,0) ties the per-screen
    `.pb-v2.v2-<screen>` token blocks and, being appended last, wins the tie; the system
    selector (0,3,0+) out-ranks them outright.
- **Forced `--on-accent` onto lime surfaces in the dark block** (a selector list:
  `.v2c-join`, `.v2c-fab`, `.join-pill`, `.badge-pill`, `.btn-lime`, `.fab`, `.qa-lime`,
  `.hero-mascot`, `.feat-badge.featured`, `.annotation`, `.seg-btn.active`, `.featured-label`,
  `.join-btn`, `.create-icon-circle`, `.club-icon.lime`, `.profile-avatar`, `.level-badge`,
  `.submit-btn`, `.pro-icon`, `.pro-toggle.on`, `.btn-next`, `.skill-pill.active`) — these
  either inherited the now-light `--ink` or hard-set `color:var(--ink)/var(--navy)`.

### App — inline JSX styles (inline beats the CSS override, so edited directly)
- `features/profile/v2/SettingsScreenV2.tsx` — theme/units segmented pill: active pill text
  `var(--ink)` → `active ? var(--on-accent) : var(--ink)`.
- `features/profile/v2/ProfileScreenV2.tsx` — avatar initials, the Hosted match-role chip, and
  the Appearance pill: lime cases switched to `--on-accent`.
- `features/home/v2/HomeScreenV2.tsx` — `.hero-mascot` initials/emoji on lime → `--on-accent`.

### Web (`web/`) — roadmap only (the one sanctioned cross-frontend edit)
- `RoadmapPage.jsx` — new Change Log entry (newest-first) describing app-wide dark mode and
  its per-device/private nature. Hero "Last updated" already today.

### Per-user (privacy) — already correct, confirmed
- Theme is **localStorage per browser** and only sets `data-theme` on that device's document.
  Every new rule is gated behind `[data-theme="dark"]` / the system media query, both driven
  by the local user's own preference. **No server/global state** — picking Dark changes only
  the picker's view. No change was needed to satisfy the "per user, not all users" requirement.

### Permissions
- **No new permission.** Appearance is a pre-existing control on the Settings/Profile surface,
  already gated by `player.profile.manage`. This is a bug fix/extension, not a new gated
  screen or action.

### /lists & FILEMAP
- **No `/lists` edit** — no API route touched (pure client styling).
- **No FILEMAP edits** — no files added/moved/renamed; `v2.css`'s responsibility (the v2
  stylesheet) is unchanged — it just gained dark variants.

## 4. Verification

- `app/`: `npm run build` clean (tsc + vite).
- `web/`: `npm run build` clean (roadmap edit).
- No v2 surface uses `createPortal`, so every v2 element renders inside `.pb-v2` and inherits
  the dark tokens (no escaped modals/sheets).

### How to test (manual / browser QA — not yet done here)
1. Switch to the v2.1 design (design toggle), open Profile → Settings → Appearance.
2. Tap **Dark** → the whole app (home, nearby, games, clubs, profile, create flows, tab bar,
   FAB) goes dark-navy; lime/blue CTAs keep **dark** text and stay legible. Tap **Light** →
   back to light. Tap **System** → follows the phone's OS setting; flip the OS theme to confirm
   it tracks live.
3. Reload → the choice persists (localStorage). Open in a **different** browser/incognito → it
   has its **own** independent theme (proves per-device, not global).
4. Spot-check on-lime text everywhere: join buttons, FABs, submit buttons, the active theme
   pill, profile avatar initials, the Hosted chip, segmented controls — all dark-on-lime.

## 5. Not committed
Changes are uncommitted (`app/` + the `web/` roadmap), consistent with the rest of the v2.1
integration ("browser QA, then commit"). The `app/` change + roadmap go to the monorepo; the
`web/` roadmap also commits to its own remote per repo conventions.

## 6. Remaining (optional, out of scope)
- Push **theme** into the account `preferences` blob so appearance also syncs across devices
  (today it's localStorage-only) — same follow-up noted in
  [2026-06-18-Ivan-settings-preferences-persistence.md](2026-06-18-Ivan-settings-preferences-persistence.md).
- A couple of v1 `@theme` Tailwind tokens (`--color-surface`/`--color-ink`, used by a handful
  of utility classes) still lack dark overrides; low impact (barely used) and outside this v2
  task, but worth a sweep if v1 dark mode is ever audited.
