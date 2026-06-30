# Task Report — Animated launch splash (app + web)

- **Author:** Ivan
- **Date:** 2026-06-19
- **Area:** `app/` (PWA) + `web/` (website) — explicit "apply on both" request from the owner
- **Status:** ✅ Implemented, build-clean (`app` + `web`), **committed & pushed** to both remotes. Animation reasoned through + timings mirror the source mockup; not browser-clicked (no headless browser in env) — see "How to test".

---

## 1. Goal

Owner request: *"apply this splash screen on both web and app"*, pointing at the standalone
`pickleballers-splash.html` mockup in the repo root. Follow-ups:

- *"syempre sa web full viewport width"* — on web the splash must span the **full viewport
  width**, not the centred phone-frame mockup.
- Dismiss behaviour (clarified): **app waits for the "Let's Play" tap**, **web auto-advances**.
- Frequency (clarified): **once per browser session**.
- *"sa web remove mo na yung button na let's play kasi auto na"* — drop the CTA on web since
  it auto-dismisses.

## 2. The source

`pickleballers-splash.html` is a self-contained vanilla-HTML/CSS/JS mockup: a pickleball is
served (paddle swings in, impact sparks + ripple + trail) into the **PickleBallers** wordmark
(per-letter pop), then ambient court lines, map pins and floating "12 Games Today / 2 Spots
Left / 4 Courts Nearby" badges reveal behind it, finishing on a tagline + "Let's Play" CTA.
It was built around an iOS phone frame (`.phone`, 390×844, centred on a desktop backdrop) and
used global element `id`s + generic class names (`.blob`, `.badge`, `.pin`, `.letter`, …).

## 3. What changed

### App — `features/auth/SplashScreen.tsx` (new) + `features/auth/splash.css` (new)
- Faithful React port of the mockup. The iOS phone-frame chrome (`.stage-backdrop`, `.phone`
  box-shadow/radius, home-indicator) is **dropped** — the splash is a fixed full-viewport
  overlay (the app already fills the viewport / becomes sidebar+main on desktop).
- **Fully scoped under a `.pb-splash` root** so nothing leaks into app styles: every selector
  is `.pb-splash …`, the CSS custom props live on `.pb-splash`, and **every keyframe is
  prefixed `splash-*`** (e.g. `splash-ballIn`, `splash-driftA`, `splash-wipeIn`) to avoid
  colliding with existing app animations. Fonts use the app's Fredoka/Nunito stack.
- Animation logic ported into **one `useEffect`** driven by a root `ref` + scoped
  `querySelector` (no global `id`s) so it's **StrictMode-safe** and can't double-bind. All
  timers are tracked and cleared on unmount; the CTA listener is removed on cleanup.
- Props: `onDone()` (host swaps the splash out), `auto` (auto-dismiss vs wait for CTA), `wide`
  (full-viewport-width modifier). On the app it's mounted with the defaults (tap-to-enter).
- Ends with the mockup's circular **wipe** (`go-overlay`, `clip-path: circle()`), then calls
  `onDone`. Honours **`prefers-reduced-motion`**: skips the choreography, reveals the brand
  immediately, and (web) auto-dismisses after a short beat.

### App — `App.tsx`
- Mounted as a **once-per-session overlay** on top of everything (after `DemoStateControl`),
  gated by `sessionStorage['pb-splash-seen']`. The app mounts **behind** it, so session
  restore / data fetches run during the intro. `dismissSplash()` sets the flag + hides it.

### Web — `features/marketing/SplashScreen.jsx` (new) + `features/marketing/splash.css` (new)
- JSX port of the same component (web is JSX, not TSX; separate repo, so the component is
  duplicated rather than shared). Same `.pb-splash` scoping + `splash-*` keyframes.
- Defaults to **`auto` + `wide`**: runs full viewport width and **auto-advances** into the
  site after the intro settles (~4.2s), then the wipe. The **"Let's Play" CTA is omitted on
  web** (`{!auto && <button…>}`) per the follow-up — only the tagline shows.
- **Full-width modifier** `.pb-splash--wide` in `splash.css`: wordmark/logo/tagline scale with
  `clamp(…, vw, …)` and the ambient blobs grow to `40–46vw` so the art spreads across the
  whole screen instead of a phone-sized strip.

### Web — `App.jsx`
- Wrapped `RouterProvider` in a fragment + a once-per-session `<SplashScreen>` overlay (same
  `sessionStorage['pb-splash-seen']` gate). The router renders behind it the whole time.

### Permissions
- **No new permission.** The splash is a **universal cold-start surface** shown to everyone,
  guests included (exactly like `LandingScreen`, which isn't gated). Gating it behind a
  capability would wrongly hide it from guests — so, per judgement, no permission applies.

### /lists & FILEMAP
- **No `/lists` edit** — no API route touched (pure client UI).
- **FILEMAP updated** in both repos: `app/FILEMAP.md` (auth slice now lists `SplashScreen`
  +`splash.css`) and `web/FILEMAP.md` (`App.jsx` overlays the splash; `marketing/` lists
  `SplashScreen`).

### Roadmap (sanctioned cross-frontend doc edit)
- `web/.../RoadmapPage.jsx`: hero "Last updated" → June 19, 2026 + a new Change Log entry
  (newest-first) describing the splash on both surfaces. `web/DONE.md` also gets a dated entry.

## 4. Verification
- `app/`: `npm run build` clean (tsc + vite).
- `web/`: `npm run build` clean.
- Diagnosed an unrelated user-reported runtime error ("Failed to fetch dynamically imported
  module: LoginPage-…js" on every page **except** the homepage): it was the standard
  **stale-chunk** churn — the web rebuild regenerated all hashed chunk names, so an
  already-open tab tried to lazy-import the old hashes (the server returns `index.html`, which
  can't be imported as a JS module). Confirmed the fresh `dist` is self-consistent (new
  `LoginPage` chunk serves as real JS); **a hard reload fixes it**. Not a code bug.

### How to test (manual / browser QA — not yet done here)
1. **App** (`:9000`): open in a fresh tab → splash plays → ball is served into the wordmark →
   court art + badges reveal → tap **"Let's Play"** → circular wipe → app. Reload within the
   same tab → splash does **not** replay (sessionStorage). New tab/session → plays again.
2. **Web** (`:9001`): open a fresh tab → splash plays **full viewport width**, **no CTA**, and
   **auto-advances** into the site after the intro. Same once-per-session behaviour.
3. **Reduced motion**: enable OS "reduce motion" → splash skips straight to the brand (app
   shows the CTA immediately; web auto-dismisses after a short beat).

## 5. Committed & pushed (unlike the rest of the working tree)
This change was committed in **isolation** from the surrounding uncommitted work (payment
history, settings persistence, dark mode, owner booking detail, etc.):

- **Monorepo** → `EunikaAgency/pickleplay-pwa` `main` (`739dd7f`): `SplashScreen.tsx`,
  `splash.css`, and splash-only edits to `App.tsx` / `FILEMAP.md` / `CLAUDE.md`.
- **Web** → `EunikaAgency/pickleplay-web` `main` (`97720ac`): `SplashScreen.jsx`, `splash.css`,
  `App.jsx`, `FILEMAP.md`, `DONE.md`, and splash-only edits to `RoadmapPage.jsx`.

The entangled files were reset to HEAD, re-edited with only the splash hunks, committed, then
restored — so all other in-flight work stayed untouched and uncommitted.

## 6. Remaining (optional, out of scope)
- **Timing/length:** the intro is ~4–5s end-to-end. If it feels long, the timeline lives at
  the top of each component's `useEffect` (and the web auto-dismiss is a single `after(4200, …)`).
- **Frequency:** currently once per session (`sessionStorage`). Switch to once-ever
  (`localStorage`) or every-load by changing the gate in `App.tsx`/`App.jsx`.
- **Stale-chunk UX (web):** a lazy-import retry that force-reloads `index.html` on a chunk-load
  failure would turn the post-deploy error into a silent refresh — separate enhancement.
- A non-blocking **React Doctor** "staged regressions" warning fired on the monorepo commit;
  worth a `react-doctor --staged` pass if we want it clean.
