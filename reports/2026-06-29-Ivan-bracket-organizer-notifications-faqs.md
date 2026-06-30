# Ivan's Report — Bracket, Organizer Gates, Notifications & FAQs (June 29, 2026 — continued)

## 1. Bracket View Rewrite (App → Web Parity)

**Before:** Simple vertical list grouped by round using `OrganizerSection`. Flat cards
with `bg-[var(--surface-2)]`, no connector lines, no canvas, no zoom/pan.

**After:** Full rewrite matching the web bracket design:

- **Elimination tree** — column-per-round with connector lines between rounds
  (halving elbows + straight pass-through). Round labels: Final, Semifinals,
  Quarterfinals, Round of 16, Round of 32.
- **Match cards** — white bordered cards, slot A/B rows, game scores, winner
  highlighting (lime bg + W badge), "Enter score" / "Edit" footer.
- **Format badge header** — pill + entrant count + match format info
- **Champion banner** — trophy icon + champion name
- **Horizontal/Vertical toggle** — orientation switcher
- **Standings table** — #, Entrant, W, L columns for round-robin/pools
- **Match list** — A vs B with scores for round-robin/pool play
- **PanCanvas** — Figma-style pan/zoom board:
  - Gray dotted background (`#d9dee8` + radial-gradient dots)
  - Drag to pan (native DOM pointer listeners — React synthetic events don't
    work with `setPointerCapture`)
  - Scroll/pinch to zoom (cursor-anchored, 12% per step)
  - +/- zoom buttons + percentage + fit button (white glassmorphism overlay)
  - Auto-fit content on mount; re-fits on orientation toggle via `key={orientation}`
  - 4px drag threshold so match card taps still work

**Files changed:** `app/src/features/organizer/tournaments/bracket/BracketView.tsx`
(complete rewrite, ~450 lines)

**Build:** clean (no new TS errors)

---

## 2. Organizer Role Gate — Games, Tournaments & Game On FAB

Organizers manage tournaments and events — they are not players. They should not
see join/discover surfaces or be able to join games/tournaments.

### Games

- **`GamesScreenV2.tsx`** — `isOrganizer` detection via `userHasPermission(me, 'organizer.access')`.
  - Discover tab **hidden**; default tab = `mine` (My Games)
  - Player/coach tabs unchanged
- **`GameDetailsScreen.tsx`** — join button replaced with disabled "Organizer account"
  (shield icon); `handleJoin` early-returns for organizers
- **`CreateChoiceSheet.tsx`** — Game On FAB skips the choice step for organizers;
  lands directly on "Host a lobby." Back button on empty bookings says "Close"
  instead of "Back" (prevents leaking the choice view)
- **API `joinGame`** — `hasPermission(user, 'organizer.access')` → 403 FORBIDDEN

### Tournaments

- **`TournamentsScreenV2.tsx`** — Open tab **hidden**; default = `mine` (Managing)
- **`TournamentDetailScreen.tsx`** — `canJoin` = false if organizer
- **API `registerForTournament`** — organizer guard → 403 FORBIDDEN

### Server-side guards

Both `joinGame` (games controller) and `registerForTournament` (content controller)
now block organizers at the API level. Client-side guards are UI-only defense-in-depth.

**No new permissions.** Guards reuse the existing `organizer.access` permission.

---

## 3. Notifications — Multiple Fixes

### "Mark all read" button design
Changed from plain text `<button className="more">Mark read</button>` to a proper
dark pill button: `rounded-xl bg-[var(--ink)] text-white px-3.5 py-1.5`, "Mark all read" label.

### Delete notification
- **API:** `DELETE /notifications/:id` — `deleteNotification` controller (interactions
  feature), self-scoped (user can only delete their own).
- **App client:** `deleteNotification(id)` → `DELETE /notifications/:id`.
- **UI:** ✕ button on every notification row, top-right. `stopPropagation` so delete
  doesn't navigate. Hover → coral. Optimistic remove from list.

### Notification clickable links — club posts
- **API:** club post/reply notifications now carry `linkUrl: /clubs/${slug}/posts/${postId}`
  (was just `/clubs/${slug}` — didn't link to the specific post).
- **App:** `navigateFromLink` now handles:
  - `/clubs/<slug>/posts/<id>` → `club-post` screen
  - `/clubs/<slug>` → `club-details` screen
- `hasTarget` regex updated to include club URLs so they render as tappable rows.

### Unified notification screen (owner + player)
**Problem:** Two separate notification screens existed:
1. `NotificationsScreen` (player, API-backed, kumpleto — mark-read, delete, unread filter)
2. `OwnerNotificationsScreen` (owner, client-side derived from bookings/games/reviews,
   walang mark-read, walang delete, walang unread filter — different data source!)

**Root cause:** OwnerHomeScreen bell navigated to `'owner-notifications'`;
OwnerProfileScreen bell navigated to `'notifications'` (header) vs
`'owner-notifications'` (profile row). The two screen IDs rendered different components.

**Fix:**
- `owner-notifications` case → now renders `NotificationsScreen`
- `OwnerHomeScreen` bell → `'notifications'`
- `OwnerProfileScreen` notif row → `'notifications'`
- `OwnerNotificationsScreen` import removed
- All bells point to one screen; one data source (`listNotifications` API)

### Sticky header with visible border
- ScreenHeader + filter chips + push banner = `position: sticky; top: 0; z-index: 10`
- `border-b border-[var(--field-border)]` (solid `#cbd2dc` instead of faint hairline)
- Content below = independent scroll (`overflow-y-auto`)

---

## 4. Owner Venues Map — Missing Location UX

- Alert banner now clickable → `scrollIntoView({ behavior: 'smooth' })` to venue list
- "Add location" badge on venue cards → solid coral button (was faint coral-soft chip)
- Tapping "Add location" opens the Location editor tab directly (`stopPropagation`)
- Text simplified: "1 venue isn't on the map yet" (no "X of Y" prefix)
- `venueCoords` uses `!= null` — correct for 0-value lat/lng

---

## 5. Insights Tab Consolidation

**Problem:** Three separate analytics tabs (Insights, Demand, Leakage) — all
showing venue data in different slices, all looking similar.

**Fix:**
- Demand + Leakage merged into **Insights** tab as additional segmented sections
- Insights segmented control: Revenue | Bookings | Usage | Courts | **Demand** | **Leakage**
- `DemandTab` + `LeakageTab` rendered inside InsightsTab section blocks
- Removed as separate top-level tabs from OwnerVenueScreen (down to 13 tabs)
- `TabId` type, `TABS` array, `TAB_TITLE`, render cases all updated

---

## 6. FAQs — Public Display & Owner Accordion

- **Public page** (`CourtDetailsScreen`): FAQ accordion section at the bottom —
  native `<details>` + `<summary>`, expand/collapse chevron, using `venue.faqs` from API
- **Owner editor** (`FaqsEditorTab`): replaced inline form cards with accordion
  preview — same visual as public page, with Edit (prompt) and Delete buttons
  inside expanded state. "Add FAQ" form stays at the top.
- **`ApiVenueDetail`** type: added `faqs?: { id: string; question: string; answer: string }[]`
- **Seeded data:** 7 dummy FAQs added to The Dink Lab via mongosh (operating hours,
  booking, equipment, parking, cancellation, beginners, court surface)
- **Reviews tab:** hidden from owner venue screen (temporarily)

---

## 7. Minor Fixes

- **Tab icons:** `leak` → `leak_add`, `paddle` → `sports_tennis` (were invalid
  Material Symbols names — rendered as blank/broken glyphs)
- **Tab CSS:** `.chip-tab.active` border-color now `var(--ink)` (was overridden
  by `.chip-tab`'s later `border` shorthand)

---

## Files Changed

### App
- `BracketView.tsx` — full rewrite (elimination tree + PanCanvas)
- `GamesScreenV2.tsx` — organizer gate: hide Discover tab, default Mine
- `GameDetailsScreen.tsx` — organizer guard: block join, hide join button
- `CreateChoiceSheet.tsx` — organizer: skip choice, host-only
- `TournamentsScreenV2.tsx` — organizer gate: hide Open tab, default Managing
- `TournamentDetailScreen.tsx` — organizer: canJoin=false
- `NotificationsScreen.tsx` — mark-all button design, delete notification,
  club link navigation, sticky header + border
- `OwnerVenueScreen.tsx` — removed demand/leakage/reviews tabs, fixed icons,
  tab strip from 15→13
- `OwnerNearbyScreen.tsx` — clickable missing-venue alert, better "Add location" button
- `OwnerHomeScreen.tsx` — bell → `notifications`
- `OwnerProfileScreen.tsx` — notif row → `notifications`
- `FaqsEditorTab.tsx` — accordion preview with inline Edit/Delete
- `InsightsTab.tsx` — added Demand + Leakage sections
- `CourtDetailsScreen.tsx` — FAQ accordion section at bottom
- `App.tsx` — unified notification screen, removed OwnerNotificationsScreen import
- `api.ts` — `deleteNotification`, `ApiVenueDetail.faqs`

### API
- `games.controller.ts` — `joinGame` organizer guard
- `content.controller.ts` — `registerForTournament` organizer guard
- `clubs.controller.ts` — post/reply notification `linkUrl` now includes `posts/:postId`
- `interactions.controller.ts` — `deleteNotification`
- `interactions.routes.ts` — `DELETE /notifications/:id`

### Data
- 7 FAQs added to The Dink Lab via mongosh
- 6 FAQs added to Test PB Arena via API

**Build:** clean (no errors from changed files; 1 pre-existing error in
CourtDetailsScreen.tsx — `onRealtime` not found, unrelated)
