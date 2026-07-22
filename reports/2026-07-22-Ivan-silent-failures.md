# Ivan — Silent failures now surface an error (22 July 2026)
**Task C, Item 6 of 7: "Silent failures swallow errors"**
**Status: ✅ DONE (code-complete) — club join + onboarding save now give feedback on failure; deploy pending**

## What was wrong
Three player actions caught their API failures and then **threw the error
away** — no toast, no message. The action just silently didn't happen, which
reads as a broken app (a live-demo hazard). Report wording: *"Club join
(`ClubsPanel.tsx:75`), onboarding save (`OnboardingScreen.tsx:59`), open-play
cancel fail with no feedback. Fix: Catch → error toast + keep the failed state
on screen."*

1. **Club join** — `features/social/ClubsPanel.tsx`. `doJoin` optimistically
   flipped the chip to "Joined", then on failure did
   `.catch(() => setJoined(... delete ...))` — a **silent optimistic rollback**.
   The button flickered Join → Joined → Join with no explanation. The sibling
   `loadMore` was worse: `.catch(() => {})` swallowed the error whole.

2. **Onboarding save** — `features/auth/OnboardingScreen.tsx` → `finish()` →
   `authStore.completeOnboarding()`. The store's `updateMe` call was wrapped in
   `try { … } catch {}` (best-effort, so onboarding never traps the user) and
   the screen always navigated away via `onComplete()`. On a transient failure
   the user's **skill tier + postal address were dropped silently** and they
   landed in the app as if it had saved.

3. **Open-play cancel** — `features/games/v2/OpenPlayDetailScreen.tsx` →
   `toggleInterest()`. **This one was already handled**: the leave/cancel path
   is inside a `try/catch` that sets `error` state, rendered inline in a coral
   notice above the sticky CTA (`OpenPlayDetailScreen.tsx:367`). The report was
   stale here — no change needed, verified in place.

## What was done
Chose the report's fix pattern: **catch → error feedback + keep the failed
state visible so the user can retry.**

**Shared primitive** — `shared/components/ui/Toast.tsx` gained an optional
`tone?: 'success' | 'error'` prop (default `success`). Error tone swaps the
leading icon (check → `error`) and colours it coral via a new
`.toast-error .check { color: var(--coral) }` rule in `index.css`. Purely
additive — every existing `<Toast>` call keeps the green-check success look.

**Club join** — `ClubsPanel` now holds a `{ show, message }` toast + a
`showError()` helper. The `doJoin` catch still rolls the optimistic chip back
**and** shows *"Couldn't join that club. Please try again."*; `loadMore`'s empty
catch became *"Couldn't load more clubs. Try again."* A single
`<Toast tone="error" …>` renders at the end of the panel fragment (the toast is
`position: fixed`, so rendering inside the body-only panel is fine).

**Onboarding save** — `authStore.completeOnboarding()` now **returns a boolean**
(`true` when the `PATCH /me` landed, `false` on the caught failure) instead of
`Promise<void>`; it still never throws, so it can't trap the user.
`OnboardingScreen.finish()` reads that result: on success it navigates as
before; on failure it sets a `finishError` flag and **keeps the user on the
screen** with a coral notice — *"We couldn't save your preferences"* — the
primary button relabels to **"Try again"**, and a **"Continue anyway →"** link
lets them proceed and set things later in their profile. So the failure is
visible and recoverable, without the old hard block-free silent data loss.

## Files changed
- `app/src/shared/components/ui/Toast.tsx` — optional `tone` (success/error)
- `app/src/shared/styles/index.css` — `.toast-error .check` coral rule
- `app/src/features/social/ClubsPanel.tsx` — error toast on join + load-more
  failure (was a silent rollback / empty catch)
- `app/src/shared/lib/authStore.ts` — `completeOnboarding` returns success/failure
- `app/src/features/auth/OnboardingScreen.tsx` — retry / continue-anyway notice
  on a failed save (keeps the user on-screen with feedback)

Logic + one small shared-primitive prop: no new screen, permission, API/route,
or `/lists` change. FILEMAP unchanged (Toast keeps its responsibility; it just
gained a variant prop).

## Verification
- `npx tsc --noEmit` (root config): **0 errors**
- `eslint` on all five changed files: **0 errors / 0 warnings**
- The full `npm run build` has **pre-existing** TS errors in unrelated committed
  files (MembersScreen, SettingsScreenV2, the social Feed* WIP, CourtPicker) —
  none of my five files appear in that list; baseline was already red.
- Open-play cancel: confirmed the existing inline coral error at
  `OpenPlayDetailScreen.tsx:367` covers the leave/cancel path — left as-is.

## Commit
`7377b17` — *fix(reliability): silent failures now surface an error (club join +
onboarding save)* — pushed to `lc-staff-revenue`.

## Related
- Task C lane: Items 1–2 (map clustering, "Book Court" nav) + Item 4 (Open-Play
  invite endpoint) done; this is Item 6. Item 3 (filter persistence), Item 5
  (player-created game price), Item 7 (email verification) still open.
- Kenneth's `team-split.html` lane C — marked Done (4 of 7) in the same pass.
