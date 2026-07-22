# Admin Dashboard Optimization Plan

## Context

The PickleBallers admin dashboard (PWA at `app/src/features/admin/`) has 17 screen files built over time without a unified design system. Recent commits cleaned up tab visibility (hiding Games, Profile, Messages from admin chrome), but deeper issues remain: player-only screens leak into admin flows, the Analytics page duplicates the Hub KPIs, 3 screens bypass the shared `AdminScaffold` component, most screens lack descriptive help text, row cards are read-only with no drill-down, and navigation patterns are inconsistent.

This plan addresses: **player screen leaks**, **redundant screens/buttons**, **scaffolding inconsistency**, **missing help text**, **missing drill-down actions**, **unclear admin user journey**, and **polish issues**.

---

## Phase 1: Fix Player Screen Leaks (CRITICAL)

These are the most damaging issues — admin users land on player-facing screens with no return path.

### 1.1 Fix AdminGamesScreen → game-details leak
**File:** `app/src/features/admin/AdminGamesScreen.tsx`
**Problem:** Tapping a game row navigates to `game-details` (player lobby with Join/Chat/Share/Delete). Back goes to player Games tab, not admin console.
**Fix:** Change the row tap to navigate to a new read-only admin game detail view, OR remove the tap action and make rows read-only (consistent with Users/Venues/Coaches). Alternatively, create a bare `admin-game-detail` screen that shows game info without player actions.
**Existing patterns:** `deepLinkParent` in `navigation.ts` maps `game-details` → `games` (player tab). A new `admin-game-detail` screen would need a back-to-admin-hub parent.

### 1.2 Fix AdminPostReportsScreen → feed-post leak
**File:** `app/src/features/admin/AdminPostReportsScreen.tsx`
**Problem:** "View post" link navigates to `feed-post` (player-facing post detail). No admin return path.
**Fix:** Either (a) show post content inline in an expanded card within the admin screen, or (b) remove the "View post" link entirely and show enough context inline to review the report. The report already shows post preview with author — expand it.

---

## Phase 2: Eliminate Redundancy (CRITICAL)

### 2.1 Remove AdminAnalyticsScreen (BROKEN + redundant)
**Files:** 7 files, ~10 locations (see precise list below)
**Problem:** AdminAnalyticsScreen is worse than just redundant — it has a **`pageSize: 1` bug**. It calls `listAdminUsers({ pageSize: 1 })`, `listVenues({ pageSize: 1 })`, `listAdminBookings({ limit: 1 })` — returning at most 1 record each. The `.length` is always 0 or 1, never the real platform total. The Hub correctly uses `pageSize: 500`. This screen has been showing near-zero fake data since it was built. Plus: no charts, no trends, no time-series — just the same 4 counters the Hub already shows.
**Fix:** Remove AdminAnalyticsScreen entirely. Precise touch points:
1. `app/src/features/admin/AdminAnalyticsScreen.tsx` — DELETE file
2. `app/src/shared/lib/navigation.ts` — remove Screen union member (line ~118), pathFromScreen case (~250), screenFromLocation case (~412), deepLinkParent fallthrough (~469)
3. `app/src/App.tsx` — remove import, SCREEN_PERMISSIONS entry (~216), SCREEN_AUTH_INTENT entry, render case (~897-898)
4. `app/src/shared/components/layout/Sidebar.tsx` — remove Analytics from System section (~144)
5. `app/src/features/admin/AdminDrawer.tsx` — remove Analytics from System section (~51)
6. `app/src/features/admin/AdminHubScreen.tsx` — remove Analytics from Reports section (~49-53)
7. `app/src/features/admin/AdminModerationScreen.tsx` — no change (Analytics not listed here)

### 2.2 Reduce AdminHub section card redundancy
**File:** `app/src/features/admin/AdminHubScreen.tsx`
**Problem:** Every section navigation card on the Hub is duplicated by the always-available AdminDrawer sidebar items. The section cards are pure navigation duplication.
**Fix:** Keep the KPI tiles at top (unique value). Replace the section card grid with a single "Navigate to..." prompt or a compact quick-actions row (e.g., 4 most-used shortcuts: Players, Moderation, Settings, Bookings). The full navigation lives in the Drawer/Sidebar.

---

## Phase 3: Standardize Scaffolding (MEDIUM)

### 3.1 Refactor AdminPostReportsScreen to use AdminScaffold
**File:** `app/src/features/admin/AdminPostReportsScreen.tsx`
**Problem:** Builds its own ScreenHeader and inline loading/error/empty states. Does NOT use `AdminScreen` or `AdminStates` from `AdminScaffold.tsx`. Also: `onBack` prop used instead of hard-navigate to `admin-moderation`.
**Fix:** Wrap in `<AdminScreen title="Post Reports" subtitle="Review PickleFeed posts players have reported." onBack={() => onNavigate('admin-moderation')} onRefresh={...}>`. Replace manual states with `<AdminStates state={loadState} isEmpty={...} emptyTitle="..." emptyDescription="...">`. The actual `AdminStates` API uses a single `state` discriminator (`'loading' | 'idle' | 'error'`) + `isEmpty` flag, NOT separate loading/error props. Keep existing per-report inline error messages (they're better than the `alert()` pattern used elsewhere). Since "View post" links will be removed in Phase 1.2, the `onNavigate` prop may still be needed if we add other drill-downs.

### 3.2 Refactor AdminClaimsScreen to use AdminScaffold
**File:** `app/src/features/admin/AdminClaimsScreen.tsx`
**Problem:** Same as above — manual ScreenHeader, inline states.
**Fix:** Same pattern as 3.1. Wrap in `AdminScreen`, use `AdminStates`. Keep the existing reviewer note textarea and 404-specific error handling.

### 3.3 Refactor AdminSettingsScreen to use AdminScaffold
**File:** `app/src/features/admin/AdminSettingsScreen.tsx`
**Problem:** Builds its own ScreenHeader and uses `ErrorState` with `onRetry` instead of `AdminStates`. This is the most complex admin screen (419 lines, 8 state variables, 3 BottomSheets, custom Toast). Uses early-return pattern (`if (loadState === 'loading') return <div>...</div>`) with a manually-built ScreenHeader in each branch.
**Fix:** Restructure the render function — `AdminScreen` must be the outer shell, with loading/error/content rendered as children. This means inverting the early-returns so the header always renders via `AdminScreen` and only the body content changes per state. Keep the existing BottomSheet forms and Toast system. Pass `onRefresh={() => void load()}` to enable refresh button. **Note:** This refactor is NOT mechanical — requires restructuring the entire render function. Handle with extra care.

### 3.4 Fix AdminDrawer "Overview" → "All queues"
**File:** `app/src/features/admin/AdminDrawer.tsx` (~line 38)
**Problem:** The Moderation overview item still reads "Overview" while `Sidebar.tsx` was already renamed to "All queues" in commit `885ba78`. Drift between mobile and desktop.
**Fix:** Change the label from "Overview" to "All queues" to match the desktop sidebar.

---

## Phase 4: Add Descriptive Help Text (MEDIUM)

Every admin screen should have a human-readable subtitle explaining its purpose. Currently most subtitles are purely quantitative (`"5 of 12 venues"`, `"3 pending"`).

### Pattern to follow (from screens that already do this well):
```tsx
<AdminScreen
  title="Post Reports"
  subtitle="Review PickleFeed posts players have reported."
  ...
>
```

### Screens to fix:

| Screen | Current Subtitle | New Subtitle |
|---|---|---|
| AdminUsersScreen | `"N players"` (counts only) | `"Player and coach accounts. Search by name or email, filter by role."` |
| AdminVenuesScreen | `"N of M venues"` | `"Every venue on the platform. Search by name, city, or slug."` |
| AdminOwnersScreen | counts only | `"Venue owners and their associated venues."` |
| AdminCoachesScreen | counts only | `"Coaches listed on the platform. Filter by verification status."` |
| AdminBookingsScreen | counts + revenue | `"All court bookings across the platform with revenue totals."` |
| AdminGamesScreen | counts only | `"Published and cancelled games. Tap a row to view details."` (if we keep tap) |
| AdminReviewsScreen | `"N pending"` | `"User-submitted venue reviews. Approve, reject, or hide."` |
| AdminReviewReportsScreen | counts only | `"User-flagged reviews that need moderation."` |
| AdminVenueApprovalsScreen | `"N awaiting review"` | `"Owner-submitted venues waiting for listing approval."` |
| AdminSuggestedEditsScreen | `"N total"` | `"User-submitted venue corrections. Accept or reject."` |
| AdminAnalyticsScreen | **NO subtitle** | `"Platform-wide totals."` (or remove per Phase 2.1) |
| AdminRolesScreen | `"N roles"` | `"Manage role permissions. Select a role to edit its access."` |
| AdminFeatureFlagsScreen | **NO subtitle** | `"Per-feature kill switches for player capabilities. Changes apply instantly."` |
| AdminHubScreen | `"Manage the platform."` (weak) | `"Platform overview — live totals and quick access to every admin surface."` |

**Implementation:** Each screen's `<AdminScreen>` component gets a static `subtitle` string prop. The quantitative counts (if useful) can be prepended: `"3 pending · User-submitted venue reviews. Approve, reject, or hide."`

**Hint:** `AdminModerationScreen.tsx` already has good queue-card descriptions for each moderation leaf screen: "Awaiting moderation" (Reviews), "User-flagged reviews" (Review Reports), "Reported PickleFeed posts" (Post Reports), "Ownership to verify" (Claims), "Venue corrections" (Suggested Edits). These can be copied directly as the corresponding leaf screen subtitles.

---

## Phase 5: Add Drill-Down Actions (MEDIUM)

### 5.1 AdminUsersScreen — Add "View Profile" tap
**File:** `app/src/features/admin/AdminUsersScreen.tsx`
**Problem:** Row cards are completely read-only. Admin cannot view a user's details.
**Fix:** Make each row tappable — navigate to a read-only admin user detail view, OR reuse the player profile screen but in admin-context mode (hide Edit Profile, hide partner sections — which is already done via `showPartnerSections` gate in `ProfileScreenV2.tsx`). The simplest approach: navigate to the existing profile screen with a prop/param that keeps back-navigation in admin context.

### 5.2 AdminVenuesScreen — Add "View Venue" link
**File:** `app/src/features/admin/AdminVenuesScreen.tsx`
**Problem:** Row cards are read-only. Web version links venue name to `/venues/:slug` in new tab.
**Fix:** Add a tap action that opens the venue's public page OR a simple detail modal. The web version's `target="_blank"` approach (opening the public venue page in a new tab) is simplest and doesn't require building new admin detail screens.

### 5.3 AdminVenueApprovalsScreen — Add detail view before approve/reject
**File:** `app/src/features/admin/AdminVenueApprovalsScreen.tsx`
**Problem:** Admin must approve/reject based on name + location + owner only. No venue detail preview.
**Fix:** Add an expandable card section or a tap-to-preview that shows full venue details before the Approve/Reject action.

---

## Phase 6: Polish & Low-Priority Fixes

### 6.1 Normalize back navigation
**Files:** `AdminUsersScreen.tsx`, `AdminPostReportsScreen.tsx`, `AdminClaimsScreen.tsx`
**Problem:** Some screens use raw `onBack` prop (depends on how screen was pushed), others hard-navigate `onNavigate('admin-hub')` or `onNavigate('admin-moderation')`. The correct pattern is hard-navigation to the canonical parent (per `deepLinkParent` in `navigation.ts`).
**Fix:** Standardize: all Directory screens → `onNavigate('admin-hub')`, all Moderation leaf screens → `onNavigate('admin-moderation')`.

### 6.2 Fix AdminBookingsScreen "Declined" filter
**File:** `app/src/features/admin/AdminBookingsScreen.tsx`
**Problem:** "Declined" is client-side synthetic — fetches all "cancelled" then filters by `cancellationType === 'owner_rejected'`. This is fragile and mixes concerns.
**Fix:** If the API doesn't support a "declined" status, add client-side filtering as a derived chip (keep the existing approach but document it clearly). If possible, request the API team add a native "declined" status.

### 6.3 Replace alert() with inline error messages (4 screens, not 2)
**Files:** `AdminVenueApprovalsScreen.tsx`, `AdminSuggestedEditsScreen.tsx`, `AdminReviewsScreen.tsx`, `AdminReviewReportsScreen.tsx`
**Problem:** These 4 screens use `alert()` for errors. Two screens already use inline error messages per-row: `AdminPostReportsScreen` and `AdminClaimsScreen` — follow that pattern.
**Fix:** Replace `alert(error.message)` with inline error state within the affected row card. Use `alert()` only for unrecoverable errors that should block the entire screen.

### 6.4 Expand AdminSuggestedEditsScreen JSON preview
**File:** `app/src/features/admin/AdminSuggestedEditsScreen.tsx`
**Problem:** JSON payload preview is truncated to 200 chars.
**Fix:** Increase to 500 chars or add an expand/collapse toggle for full payload.

### 6.5 Reduce Feature Flags entry points from 3 to 2
**Files:** `AdminHubScreen.tsx`, `AdminSettingsScreen.tsx`
**Problem:** Feature Flags is reachable from: Hub card, Drawer item, Settings "Player capabilities" link = 3 entry points.
**Fix:** Remove the Hub card link for Feature Flags (keep in Drawer under System and in Settings as a cross-link). System config items don't need to be top-level Hub shortcuts.

### 6.6 AdminDrawer mobile FAB position polish
**File:** `app/src/shared/styles/v2.css` (`.admin-drawer-fab`)
**Problem:** The floating hamburger FAB may overlap with content on some screens. Verify position and z-index.
**Fix:** Ensure the FAB has adequate bottom margin and doesn't obscure list items or action buttons.

### 6.7 Clean up dead `onMenuToggle` prop in AdminScreen
**File:** `app/src/features/admin/AdminScaffold.tsx` (~line 23)
**Problem:** `AdminScreen` accepts `onMenuToggle?: () => void` — the JSDoc says "When provided, a hamburger menu button renders beside the back arrow." But **not a single admin screen passes `onMenuToggle`**. The hamburger FAB in `AdminDrawer.tsx` is self-contained and renders itself. The prop is dead code.
**Fix:** Either remove the `onMenuToggle` prop from `AdminScreen` entirely, OR wire it through every admin screen (fitting the FAB into the header rather than as a floating button). Removing the dead prop is simpler and lower risk.

### 6.8 Remove unused `onNavigate` from AdminClaimsScreen
**File:** `app/src/features/admin/AdminClaimsScreen.tsx`
**Problem:** `AdminClaimsScreen` declares `onNavigate: Navigate` in its Props but never calls it (unlike `AdminPostReportsScreen` which uses it for "View post").
**Fix:** Remove the unused `onNavigate` from the Props interface. (Only relevant if Phase 1.2 removes "View post" from PostReportsScreen — then that screen's `onNavigate` stays but Claims' can go.)

---

## Verification Plan

### Per-phase verification:
1. **Phase 1:** Navigate admin console → Games → tap a game. Verify you land on an admin-context screen, not player lobby. Verify back returns to admin games list. Same for Post Reports → View Post.
2. **Phase 2:** Verify AdminAnalytics is removed (or replaced with real charts). Verify Hub shows KPIs without duplicate section nav.
3. **Phase 3:** Open Post Reports, Claims, Settings. Verify they use `AdminScreen` wrapper with consistent header, back button, and states. Verify AdminDrawer says "All queues".
4. **Phase 4:** Open every admin screen. Verify each has a descriptive subtitle.
5. **Phase 5:** Tap a user row → verify drill-down. Tap a venue row → verify link opens. Tap a venue approval → verify detail preview.
6. **Phase 6:** Verify no `alert()` calls in admin screens. Verify JSON preview shows more content. Verify Feature Flags has exactly 2 entry points.

### End-to-end: 
Log in as admin, navigate every screen via both desktop Sidebar and mobile AdminDrawer. Verify consistent headers, back navigation, and no player-screen leaks.

---

## Files Summary

### Files to modify:
| Phase | File | Changes |
|---|---|---|
| 1.1 | `app/src/features/admin/AdminGamesScreen.tsx` | Remove tap-to-player-lobby; make rows read-only |
| 1.2 | `app/src/features/admin/AdminPostReportsScreen.tsx` | Remove "View post" → `feed-post` link; show content inline |
| 2.1 | `app/src/features/admin/AdminAnalyticsScreen.tsx` | **DELETE** (broken `pageSize: 1` + redundant) |
| 2.1 | `app/src/shared/lib/navigation.ts` | Remove admin-analytics: Screen union, pathFromScreen, screenFromLocation, deepLinkParent (4 locations) |
| 2.1 | `app/src/App.tsx` | Remove admin-analytics: import, SCREEN_PERMISSIONS, render case |
| 2.1 | `app/src/shared/components/layout/Sidebar.tsx` | Remove Analytics from System section |
| 2.1 | `app/src/features/admin/AdminDrawer.tsx` | Remove Analytics from System section |
| 2.1 | `app/src/features/admin/AdminHubScreen.tsx` | Remove Analytics from Reports section |
| 2.2 | `app/src/features/admin/AdminHubScreen.tsx` | Compact section nav to quick-actions row, keep KPI tiles |
| 3.1 | `app/src/features/admin/AdminPostReportsScreen.tsx` | Wrap in AdminScreen + AdminStates; normalize back nav |
| 3.2 | `app/src/features/admin/AdminClaimsScreen.tsx` | Wrap in AdminScreen + AdminStates; normalize back nav |
| 3.3 | `app/src/features/admin/AdminSettingsScreen.tsx` | Restructure render for AdminScreen wrapper (complex) |
| 3.4 | `app/src/features/admin/AdminDrawer.tsx` | "Overview" → "All queues" (~line 38) |
| 4 | 14 screen files | Add descriptive `subtitle` prop to AdminScreen |
| 5.1 | `app/src/features/admin/AdminUsersScreen.tsx` | Add tap-to-view-profile |
| 5.2 | `app/src/features/admin/AdminVenuesScreen.tsx` | Add tap-to-view-venue |
| 5.3 | `app/src/features/admin/AdminVenueApprovalsScreen.tsx` | Add detail expand/preview before approve/reject |
| 6.1 | `AdminUsersScreen`, `AdminPostReportsScreen`, `AdminClaimsScreen`, `AdminSettingsScreen` | Replace `onBack()` with hard-navigate to canonical parent |
| 6.2 | `app/src/features/admin/AdminBookingsScreen.tsx` | Document/fix Declined client-side synthetic filter |
| 6.3 | 4 screen files | Replace `alert()` with inline error per row |
| 6.4 | `app/src/features/admin/AdminSuggestedEditsScreen.tsx` | Expand JSON preview from 200 → 500 chars or add toggle |
| 6.5 | `app/src/features/admin/AdminHubScreen.tsx` | Remove Feature Flags card (keep Drawer + Settings link = 2 entry points) |
| 6.7 | `app/src/features/admin/AdminScaffold.tsx` | Remove dead `onMenuToggle` prop or wire through screens |
| 6.8 | `app/src/features/admin/AdminClaimsScreen.tsx` | Remove unused `onNavigate` from Props |
