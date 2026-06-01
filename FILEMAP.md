# Repo map — read this first

**This file is the map of the monorepo.** Skim it before scanning the tree —
it tells you which area owns what, so you don't go spelunking in the wrong one.
Each area keeps its own detailed file-map in its `FILEMAP.md`; open that for
file-level detail. Repo-wide rules for all agents live in `AGENTS.md`.

## Areas

| Path | What it is | Detailed map |
|---|---|---|
| `app/`  | Mobile-first React PWA (React 19 + TS + Vite) | `app/FILEMAP.md` |
| `api/`  | Hono + MongoDB API — **nested independent git repo** (gitignored here) | `api/FILEMAP.md` |
| `web/`  | Desktop-first responsive website (React 19 + Vite) — **nested independent git repo** (gitignored here) | `web/FILEMAP.md` |
| `docs/` | Product / UX / data specs + `docs/screenshots/` | `README.md` → Documentation |
| `mockup/` | Static multi-page HTML mockup (clickable design prototype) | `mockup/pickleball_social_play/DESIGN.md` |
| `scripts/` | Helper utilities (`.mjs` / `.sh`) | — |
| `Competitors/` | Competitor app research (ReClub, PlayByPoint, …) | `docs/README-APPS.md` |

`app/` (PWA) and `web/` (website) are **separate products**; `api/` is the
shared backend both consume. See `AGENTS.md` → "Stay in your lane" — an `app`
task touches only `app`+`api`, a `web` task only `web`+`api`.

## Where to look first, by task

| Task | Go to |
|---|---|
| Mobile PWA screen / flow | `app/` (→ `app/FILEMAP.md`) |
| Website page / route | `web/` (→ `web/FILEMAP.md`) |
| API endpoint, data model, auth | `api/` (→ `api/FILEMAP.md`) |
| Product / UX / data spec | `docs/` (see `README.md` → Documentation) |
| Repo-wide conventions (root-clean, `/lists`, permissions, git remotes) | `AGENTS.md` |
| Public roadmap (product-wide) | `web/src/features/marketing/RoadmapPage.jsx` |

## Conventions you must follow (full text in `AGENTS.md`)

- **Keep file-maps current:** add/remove/rename/move a file or change its
  purpose → update that area's `FILEMAP.md` in the same change.
- **Stay in your lane:** the two frontends never edit each other (only shared
  exceptions: the public roadmap and the 3-copy permission catalogue).
- **`/lists`** must stay in sync when API routes change; **permissions** gate
  every new user-facing feature.
- `api/` and `web/` push to their **own** remotes — see "Git remotes and pushing".

> Keep this current when top-level structure changes — it's only useful if it's true.
