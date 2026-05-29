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

## Git remotes and pushing

This workspace is **three independent git repos**, each with its own remotes.
When you finish a meaningful change, **commit *and* push** it — don't leave work
sitting unpushed.

| Local path | What it is | Push to |
|---|---|---|
| `/` (this monorepo) | `pickleplay` | **both** `origin` → `EunikaAgency/pickleplay-pwa` **and** `jhonivancuaco` → `jhonivancuaco/pickleballers` |
| `api/` | API (Hono + MongoDB) | `origin` → `jhonivancuaco/pickleballers-api` |
| `web/` | Responsive website | `origin` → `jhonivancuaco/pickleballers-web` |

`api/` and `web/` are nested repos managed independently — they are gitignored
here (see `/api/` and `/web/` in `.gitignore`) so the monorepo never
double-tracks them.

### Which GitHub account
- **jhonivancuaco** repos (`pickleballers`, `pickleballers-api`,
  `pickleballers-web`) are owned by you — push them with the **jhonivancuaco**
  account: `gh auth switch -u jhonivancuaco`.
- The **EunikaAgency** mirror (`pickleplay-pwa`) → push with the
  **EunikaAgency** account.

Both accounts are already authenticated through `gh` (credentials live in the
gh keyring, **never** in this repo). If a `jhonivancuaco` repo is unreachable,
re-authenticate that account with `gh` — **do not paste access tokens into any
tracked file** (AGENTS.md, scripts, configs); they would leak on push.
