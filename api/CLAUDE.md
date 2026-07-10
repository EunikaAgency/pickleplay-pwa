# CLAUDE.md

Guidance for Claude Code (claude.ai/code) when working in this repository.

## Project

**pickleballers-api** — Hono + MongoDB + Mongoose API for the PickleBallers product suite.

- Runtime: Node 20+, TypeScript with `tsx` (ESM, `"type": "module"`, `.js` extensions in imports).
- Port: **9002** (PM2 app name `pickleballer-api`, public host `pickleballer-api.eunika.xyz`).
- Database: MongoDB on `localhost:27017/pickleballers`.
- Frontends that consume this API: `pickleballer.eunika.xyz` (web, port 9001) and `pickleballer-pwa.eunika.xyz` (PWA, port 9000) — both live in the sibling monorepo.

## Commands

```sh
npm run dev          # tsx watch src/index.ts
npm run typecheck    # tsc --noEmit
npm run lint         # typecheck + eslint
npm test             # vitest run
npm run db:import    # load real-data/handoff CSVs into MongoDB
npm run db:seed      # legacy mock-data seed (kept for reference)
npm run pm2          # start under PM2 using ecosystem.config.json
npm run pm2:restart  # restart the running PM2 process
npm run pm2:logs     # tail PM2 logs
```

## Architecture — feature-based vertical slices

Code is organised by **feature**, not by technical layer. Every feature owns its routes, controller, and Mongoose model in one directory.

```
src/
  features/
    <feature>/
      <feature>.controller.ts    # Hono handlers
      <feature>.routes.ts        # route mounts, middleware
      <feature>.model.ts         # Mongoose schemas + model exports
  shared/
    db/                # connectDb, seed.ts, import-real-data.ts
    lib/               # jwt + other framework-agnostic helpers
    middleware/        # auth, error-handler, rate-limiter, request-id
  routes/
    index.ts           # composition root — mounts all feature routes
    health.test.ts
  index.ts             # entry point: Hono app + global middleware
  test-setup.ts        # vitest setup
```

Current features: `admin`, `auth`, `bookings`, `cities`, `coaches` (+ `coach-reviews.*`), `content`, `geo`, `interactions`, `media`, `payments` (Payment + VenuePricing), `roles`, `root` (health/home/lists), `search`, `subscriptions`, `tables`, `tags`, `venues` (+ `venue-management.*`). (Full per-feature index in [FILEMAP.md](FILEMAP.md).)

### Adding a new feature — checklist

1. **Create the slice** under `src/features/<feature>/` containing:
   - `<feature>.model.ts` — Mongoose schemas (one file can export multiple related models — see `venues.model.ts` for the pattern).
   - `<feature>.controller.ts` — pure Hono handlers, no routing.
   - `<feature>.routes.ts` — `const r = new Hono()`, attach middleware + handlers, `export default r`.
2. **Mount it** in `src/routes/index.ts`:
   ```ts
   import myFeatureRoutes from '../features/<feature>/<feature>.routes.js';
   v1.route('/<feature>', myFeatureRoutes);    // or wherever the prefix lives
   ```
3. **Register it in `/lists`** — add an entry in `src/features/root/root.controller.ts` → `listEndpoints()` with path, methods, description. **This is required.** `/lists` is the only authoritative endpoint catalogue and is rendered as HTML at `https://pickleballer-api.eunika.xyz/lists`.
4. **Import paths** use the `.js` extension (ESM): cross-feature imports go `'../<other-feature>/<other-feature>.model.js'`; shared infra goes `'../../shared/middleware/auth.js'` etc.
5. **Typecheck** with `npm run typecheck` before committing.
6. **Restart PM2** (`npm run pm2:restart`) after deploying to pick up the new routes.

### Adding routes to an existing feature

- Add the handler in `<feature>.controller.ts`, wire it in `<feature>.routes.ts`.
- **Still update `/lists`** if the route's surface materially changes (new methods, new sub-resource, new prefix).

## /lists — the endpoint catalogue

`GET /lists` is the human-facing endpoint index. It must stay in sync with what the API actually exposes.

- Source: `src/features/root/root.controller.ts` → `listEndpoints()`.
- Output: HTML page (dark theme), table of `Methods | Path | Description`. GET-supported, non-parameterized paths render as clickable `<a>` links; others render as `<code>`.
- Companions: `/` and `/health` are also HTML, with nav links between the three. If you change the visual shell, keep `BASE_STYLE` shared across all three.

**Rule: any PR that adds or removes a route must also update the `endpoints` array in `listEndpoints()`.**

## Data model conventions

- Every model with imported data carries an `_importId` field + index so re-imports can be diff'd or rolled back.
- Schemas have `{ timestamps: true }` by default — `createdAt`/`updatedAt` come for free.
- IDs come in three flavours: Mongo `_id` (`ObjectId`), human-facing `slug` (kebab-case, unique), and external `<entity>Id` (e.g. `venueId: ph-zone-sports-center-makati`) for cross-system traceability.
- Boolean *vs* tri-state strings: amenity-style fields (`amenityWifi`, `hasDedicatedLines`, `allowsWalkins`) are typed as **`String`** in the schema because the source data has three states (`true` / `false` / `unknown`). The matching `has*` boolean fields (`hasParking`, `hasShowers`) coerce to plain booleans. Don't change the type without checking both call sites.

## Data import

`src/shared/db/import-real-data.ts` (`npm run db:import`) loads CSVs from `real-data/handoff/` into MongoDB:

- Re-runnable: **drops the target collections** (`cities`, `venues`, `venuepricings`, `venuehours`, `courts`, `coaches`) before inserting.
- Uses `importCreate()` which calls `new Model(...).save({ validateBeforeSave: false })` — Mongoose validators are intentionally bypassed because the CSV is the source of truth and contains pre-vetted strings that occasionally exceed schema `maxlength` caps (long phone annotations, verbose surface descriptions, etc.). Validators stay enforced for API-time inserts; just not for bulk import.
- The image manifest (`venue_images.csv`) populates `mainImageUrl`/`galleryImageUrls` with `/images/venues/<slug>/<file>` URLs. The actual JPEGs are **not currently on disk** — when they arrive at `real-data/handoff/images/venues/...`, drop them into the importer and wire static-file serving (see TODO below).

## Auth

- JWT via `src/shared/lib/jwt.ts`, secret in `JWT_SECRET` env.
- Middleware: `requireAuth` (hard fail without token) and `optionalAuth` (attach user if present) from `src/shared/middleware/auth.js`.

## Git & deploy

- ⚠️ **This directory is NOT a separate git repo.** It has no `.git`, it is **not**
  gitignored by the parent, and the parent monorepo (`EunikaAgency/pickleplay-pwa`)
  tracks every file under `api/src`. Verify before trusting anything below:
  `git -C api rev-parse --show-toplevel` → `/var/public/pickleplay`.
  Commit `api/` changes from the parent repo, alongside `app/` and `web/`.
- (Historical) A standalone remote `https://github.com/jhonivancuaco/pickleballers-api.git`
  once existed; it is not wired up here.
- PM2 ecosystem: `ecosystem.config.json` (port, env, CORS origins). System autostart is via `pm2-eunika-blue.service` (already installed); run `pm2 save` after `pm2 start ecosystem.config.json` so reboots survive.

## Keeping the public roadmap current

The product's public progress page lives at **https://pickleballer.eunika.xyz/roadmap** and is rendered from `/var/public/pickleplay/web/src/features/marketing/RoadmapPage.jsx`. **Whenever you finish a meaningful task in this repo (new feature, removed feature, big refactor, infrastructure change, data import, etc.), you must add a Change Log entry to that file** with today's date and a one-line description.

How to do it from this repo:
1. Edit `/var/public/pickleplay/web/src/features/marketing/RoadmapPage.jsx` directly.
2. Update the `Last updated:` string in the hero (line ~81) to today's date.
3. Prepend a new entry at the top of the Change Log array (~line 970) — `{ date: 'YYYY-MM-DD', change: '…' }`.
4. If the task moves a phase status (e.g. Phase 2 going from "active" to "done"), update the relevant `TimelineItem` status and badges too.
5. Commit the roadmap edit to the **parent monorepo** (`/var/public/pickleplay/`), not this api repo — they're separate git remotes (the api/ dir is gitignored in the parent).

Skipping the roadmap update is treated like skipping a test in CI: the work isn't done.

> Editing the web-repo roadmap from `api/` is a **sanctioned exception** to the
> frontend-isolation rule (`../AGENTS.md` → "Stay in your lane") — only `web` can
> render it. Don't touch any other `web` or `app` file from an api task.

## Keeping the file-map (`FILEMAP.md`) current

[`FILEMAP.md`](FILEMAP.md) is this repo's file-map — skim it before scanning
`src/`. **Whenever you add, remove, rename, or move a file/folder, or change a
file's primary responsibility, update it in the same change** (the directory
tree comments, the key-modules list, and the "Where to look first" table — e.g.
a new feature slice must appear there). Don't touch it for logic-only edits.
Commit it to this `api/` repo, same as the code. Full rule + rationale:
[`../AGENTS.md`](../AGENTS.md) → "Keep the file-map (`FILEMAP.md`) current".
Skipping it is treated like skipping a test: the work isn't done.

## Known TODOs

- **Static-file serving for `/images/...`** is not wired yet — `mainImageUrl` paths are stored in Mongo but no route resolves them. Add a `serveStatic({ root: './uploads' })` mount on `/images/*` once the JPEG payload lands.
- **Pricing import**: only the flat `priceFrom` lives on `Venue`. The richer `VenuePricing` rows (audiences, days, time windows) live in their own collection but no controller exposes them yet.
- ~~No write endpoints for `Coach`~~ — **done.** `POST /coaches` (`createMyCoach`),
  `GET|PATCH /coaches/me`, and the `coach-applications` slice all exist. Creating a
  coach profile or applying at a venue now requires an active **coach subscription**
  (`partner-subscriptions/`), which returns `402 SUBSCRIPTION_REQUIRED` otherwise.
