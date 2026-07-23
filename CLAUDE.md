# PickleBallers

> [!IMPORTANT]
> ## 🔴 FIRST RULE — DO THIS BEFORE ANYTHING ELSE
> **At the very start of EVERY new session / new conversation, before doing any
> other work, `git commit` and `git push` EVERYTHING first.**
> - Applies to all repos in scope (root/app, `api/`, `web/`).
> - Stage all changes, commit with a sensible message, and push — even if the
>   user's first request is about something else. Do this FIRST, then proceed.
> - See [GitHub multi-account push] memory: per-repo credential helpers make
>   `git push` work regardless of the active `gh` account.
> - ⛔ NEVER add a `Co-Authored-By: Claude` trailer (or any Claude/AI
>   attribution) to commit messages. Plain commit messages only.

> [!IMPORTANT]
> ## 🔴 `reports/` IS IVAN'S REPORT DIR — DO NOT WRITE THERE
> **Never create, move, or save any file into `reports/` unless the user
> explicitly says to put it in "Ivan's report dir".**
> - `reports/` holds hand-written `.md` reports only. No screenshots, scripts,
>   HTML, PDFs, or generated output.
> - Scratch files, screenshots, capture/build scripts, generated galleries →
>   the session scratchpad dir, or `report-assets/` if they must be kept.
> - Applies to every agent and subagent.

> [!IMPORTANT]
> ## 🔴 EVERY NEW FEATURE = SEEDER + TRUNCATE COVERAGE
> **When a change adds a Mongoose model / collection (or a feature slice that
> stores data), the work is NOT done until both of these hold:**
> - **Seed** — a step in `api/src/shared/db/pipeline.ts` populates it (usually
>   by extending `seed-dummy-data.ts` or `seed-social-graph.ts`), or the model
>   is a deliberate exception (real device tokens, boot-time bootstraps like
>   `roles`) — in which case say so in the change.
> - **Truncate** — decide its wipe disposition. The default is automatic
>   (`data-ops` enumerates all collections and wipes them), so the only real
>   question is: **must it survive a wipe?** If yes, add it to `KEEP_WHOLE` or
>   `SCOPE_TO_KEPT_USERS` in `api/src/features/data-ops/data-ops.policy.ts`
>   **and** to the "Never deleted" card in
>   `app/src/features/admin/AdminDataToolsScreen.tsx`.
>
> Verify with a dry run (`POST /api/v1/admin/data/truncate` with
> `dryRun: true`, or the Preview toggle in Admin console → System → Data
> tools) — the new collection must appear in the report with the intended
> disposition. Skipping this is treated like skipping a test: the work isn't
> done. Applies to every agent and subagent.

@AGENTS.md

The line above imports the shared, all-agents conventions from AGENTS.md (the
single source of truth). Keep instructions in AGENTS.md, not here.
