# Ivan — Open-Play invite no longer posts to the Game endpoint (22 July 2026)
**Task C, Item 4 of 7: "Open-Play invite posts to the Game endpoint"**
**Status: ✅ DONE (removed) — the invite affordance is gone from the session screen; sharing still works**

## What was wrong
The **Open-Play session** detail screen (`OrganizerOpenPlayDetail` in
`features/games/v2/OpenPlayDetailScreen.tsx`) mounted `InvitePlayersSheet` with
`gameId={id}` — but that `id` is an **Open-Play session id**, not a game id.

`InvitePlayersSheet` calls `inviteToGame(gameId, userIds)`, which POSTs to the
**Games** route:

```
POST /api/v1/games/{id}/invite
```

So tapping "Invite" on an Open-Play session sent the **session id to the games
invite endpoint** — a different entity. There is no Game with that id, so the
invite **fails** (the client has no session-invite endpoint at all: the
`/api/v1/open-play/...` surface has join / leave / messages / chat, but no
`/invite`). Report wording: *"Session invite calls `inviteToGame` with a session
id (`OpenPlayDetailScreen.tsx:403`)."*

## What was done
Chose the report's **"Remove it"** option (over "repoint"). Removing was the
correct call: there is no session-invite backend to point at, and the API repo
isn't in this checkout to add one — while a working invite path already exists
via **`ShareLobbySheet`** (copy link / native share), which is untouched.

Removed the broken invite affordance from the **session path only**:
- Dropped the `InvitePlayersSheet` import.
- Dropped the `inviteOpen` state.
- Dropped `onInvite={() => setInviteOpen(true)}` from `ShareLobbySheet` (its
  `onInvite` is optional — without it, the sheet simply doesn't render the
  "Invite" row, so no dead button remains).
- Removed the `<InvitePlayersSheet>` mount.

This turned out to already be committed in HEAD (`1344e9f`, an 8-line removal);
the working state now matches it.

## Orphan cleanup
`OrganizerOpenPlayDetail` was the **only** consumer of
`features/games/InvitePlayersSheet.tsx`. The legitimate game-path invite uses a
**different** file — `InvitePlayersScreen.tsx` (the routed `/games/:id/invite`
screen) — which is untouched. With its sole consumer gone, the sheet was dead
code, so it was **deleted** (commit `0675947`, pushed).

## Files changed
- `app/src/features/games/v2/OpenPlayDetailScreen.tsx` — removed the session
  invite affordance (already in HEAD `1344e9f`)
- `app/src/features/games/InvitePlayersSheet.tsx` — **deleted** (orphaned;
  commit `0675947`)

Logic-only + dead-code deletion: no new screen, permission, API/route, or
`/lists` change. FILEMAP unchanged (the sheet was not listed in it).

## Verification
- `npx tsc --noEmit`: **0 errors**
- Confirmed `InvitePlayersSheet` has **0 external importers** after the change
  (game-path invite = `InvitePlayersScreen`, a separate file, still wired)
- The one lint error in `OpenPlayDetailScreen.tsx` (`set-state-in-effect` at
  :100) is in the **game-kind branch** (`getGame(id)`), pre-existing and
  untouched by this change

## Related
- Task C, Items 1–2 done (map clustering, "Book Court" nav); Item 3 (filter
  persistence), Items 5–7 still open
- Kenneth's `team-split.html` lane C — marked Done in the same pass
