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

@AGENTS.md

The line above imports the shared, all-agents conventions from AGENTS.md (the
single source of truth). Keep instructions in AGENTS.md, not here.
