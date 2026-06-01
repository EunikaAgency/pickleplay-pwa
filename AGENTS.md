# PickleBallers — Repo Conventions (for all AI agents)

> This is the canonical instruction file for every AI coding agent working in
> this repo (Claude Code, Codex, Continue, Cursor, etc.). Tool-specific files
> like `CLAUDE.md` just point here so there is a single source of truth.
>
> The repo folder is named `pickleplay/` for legacy reasons; the product brand
> is **PickleBallers**.

## Keep the workspace root clean

The repository root must stay tidy. Do **not** drop loose files there. The only
files allowed directly in the root are `README.md`, `AGENTS.md`, and `CLAUDE.md`
(plus tooling config and the top-level project directories like `app/`, `api/`,
`web/`, `docs/`, `mockup/`, `scripts/`).

When you create or generate a new file, put it in the right place from the start
instead of dropping it in root:

- **Markdown docs** (specs, plans, instructions, analyses, reports) → `docs/`
- **Screenshots / images** (incl. scratch captures from playwright-mcp,
  before/after comparisons) → `docs/screenshots/`
- **Scripts** (`.mjs`, `.sh`, helper utilities) → `scripts/`

Move tracked files with `git mv` so history is preserved.

## Generated / scratch output

`.playwright-mcp/` is gitignored scratch output (console logs + page snapshots)
and is safe to delete anytime — it regenerates when playwright-mcp runs. Don't
commit it and don't let it accumulate in root.

## Keep the API endpoint catalogue (`/lists`) current

The API self-documents every route at
**https://pickleballer-api.eunika.xyz/lists** — the single authoritative
endpoint catalogue, rendered from
`api/src/features/root/root.controller.ts` → `listEndpoints()`.

**Whenever you add, remove, or change an API route — new path, new method, new
sub-resource, changed auth requirement, changed prefix — you must update the
`endpoints` array in `listEndpoints()` as part of the same change** so `/lists`
never drifts from what the API actually exposes. Then restart the API
(`npm run pm2:restart` in `api/`) so the live page reflects it. Skipping the
`/lists` update is treated like skipping a test: the work isn't done.

This applies to every agent in every repo here — if your work touches an API
endpoint, keep `/lists` in sync. The `api/` repo's `CLAUDE.md` carries the full
checklist; this is the all-agents reminder so the rule is visible everywhere.

## Gate every new user-facing feature with a permission

The product uses permission-based access control. Permissions are
**code-defined** capability strings (`domain.resource.action`, e.g.
`player.games.create`, `owner.venues.manage`); the roles that hold them are a
**fixed set** (`admin`, `moderator`, `owner`, `organizer`, `coach`, `player`)
whose permission sets are editable from the admin **Roles & permissions** page.

**Whenever you build a new user-facing feature or capability in `app/` or
`web/` — a new screen, action, or area a user can reach — add a matching
permission and gate the feature with it, as part of the same change.** Treat it
like the `/lists` rule: a feature isn't done until its permission exists and
gates it. Do this every time, automatically, without being asked.

Checklist when adding a feature:

1. **Name the permission** `domain.resource.action`, following the existing
   entries (look at `ALL_PERMISSIONS`).
2. **Add the string to `ALL_PERMISSIONS` in all three copies, kept in sync:**
   - `api/src/shared/lib/permissions.ts` (source of truth)
   - `web/src/features/auth/permissions.js`
   - `app/src/shared/lib/permissions.ts`
3. **Describe it for the admin UI** — add a `{ key, group, label, description }`
   entry to `PERMISSION_CATALOGUE` in `api/src/shared/lib/permissions.ts` so it
   appears in the Roles & permissions matrix. Keep its order aligned with
   `ALL_PERMISSIONS`.
4. **Set sensible role defaults** — add the permission to the roles that should
   have it in `ROLE_PERMISSIONS` (all three copies).
5. **Gate the feature** with `userHasPermission(user, '<perm>')` in the web/app
   UI, and with `hasPermission(user, '<perm>')` on any API route that needs
   protection.
6. **Grant it on the live DB.** Role→permission mappings live in Mongo and are
   seeded **insert-only** (`$setOnInsert`), so a new code default does **not**
   reach already-seeded roles. Toggle the permission onto the relevant roles via
   the admin Roles & permissions page (or update the role docs). It then takes
   effect for each affected user on their next login / token refresh.

This keeps the permission catalogue in lockstep with the product's features, so
every new capability is governable from one place. Skipping it is treated like
skipping a test: the work isn't done.

## Git remotes and pushing

This workspace is **three independent git repos**, each with its own remote.
When you finish a meaningful change, **commit *and* push** it — don't leave work
sitting unpushed.

| Local path | What it is | Push to |
|---|---|---|
| `/` (this monorepo) | `pickleplay` | `origin` → `EunikaAgency/pickleplay-pwa` |
| `api/` | API (Hono + MongoDB) | `origin` → `jhonivancuaco/pickleballers-api` |
| `web/` | Responsive website | `origin` → `jhonivancuaco/pickleballers-web` |

`api/` and `web/` are nested repos managed independently — they are gitignored
here (see `/api/` and `/web/` in `.gitignore`) so the monorepo never
double-tracks them.

### Which GitHub account
- **jhonivancuaco** repos (`pickleballers-api`, `pickleballers-web`) are owned
  by you — push them with the **jhonivancuaco** account:
  `gh auth switch -u jhonivancuaco`.
- The **EunikaAgency** monorepo (`pickleplay-pwa`) → push with the
  **EunikaAgency** account.

Both accounts are already authenticated through `gh` (credentials live in the
gh keyring, **never** in this repo). If a `jhonivancuaco` repo is unreachable,
re-authenticate that account with `gh` — **do not paste access tokens into any
tracked file** (AGENTS.md, scripts, configs); they would leak on push.
