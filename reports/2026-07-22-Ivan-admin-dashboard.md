# Ivan Report — 2026-07-22: Admin Dashboard optimization & design fixes (client / WhatsApp version)

- **Author:** Ivan
- **Date:** 2026-07-22
- **Area:** Admin console (mobile PWA) — optimization, design fixes, cleanup
- **Audience:** Client (non-technical)
- **Try it:** https://pickleballer-pwa.eunika.xyz/admin

---

## WhatsApp message (copy-paste ready)

*PickleBallers — Admin Dashboard Update*

We did a full clean-up pass on the admin console. It's now faster to navigate, clearer to read, and free of a few broken or confusing bits.

*Removed a broken Analytics page* — it was showing near-zero fake numbers because of a data bug, and it just repeated the totals already shown on the admin home. Gone. The live totals stay on the dashboard home.

*Fixed two "dead ends"* — tapping a game, or "view post" on a reported post, used to throw the admin into the normal player screens with no way back to admin. That's fixed.

*Every screen now explains itself* — each admin page has a short description at the top telling you what it's for (before, most just showed a count).

*Search boxes work now* — the search bars across Players, Venues, Owners and Coaches were invisible/broken; they now render properly with the magnifier icon on the right.

*Cleaner Players list* — Coach and Organizer are memberships (paid subscriptions), not account types, so those filters were always empty and misleading. The Players list now shows players, and you can search by name or email. Tapping a player opens their profile; tapping a venue opens the venue page.

*Sidebar tidied up* — the menu sections (Directory / Moderation / System) start collapsed so you see everything at a glance and open only what you need. The mobile menu now matches the desktop sidebar exactly (Social, Notifications, Log out all in the same place).

*Removed duplicate menu items* — the moderation menu had an "All queues" item that just linked to the same queues already listed right below it. Removed.

Nothing was taken away that admins actually use — this was about removing clutter, fixing what was broken, and making the whole thing easier to read.

You can try it here: https://pickleballer-pwa.eunika.xyz/admin

---

## What changed (full list)

### Removed / fixed broken things
1. **Analytics page removed** — it fetched only 1 record per metric (a bug), so it always showed near-zero totals, and duplicated the dashboard-home KPIs. Removed from the page, the sidebar, the mobile drawer, and the routing.
2. **Games list no longer leaks to the player lobby** — tapping a game used to open the player-facing game lobby (Join/Chat/Share) with no way back to admin. Rows are now read-only, matching the other directory lists.
3. **Post Reports no longer leaks to the player post view** — the "View post" link dropped the admin into the player feed screen. Removed; the post content shows inline in the report card instead.
4. **Search boxes now render** — the shared search field was missing its wrapper class, so it appeared as an unstyled/invisible input on every admin list screen. Fixed; the magnifier icon sits on the right.

### Design / clarity
5. **Descriptive subtitles** added to every admin screen (Players, Venues, Owners, Coaches, Bookings, Games, all moderation queues, Roles, Feature flags, etc.) — previously most just showed a raw count.
6. **Mobile drawer label** fixed: "Overview" → "All queues" to match the desktop sidebar.
7. **Post-report card** corner radius tightened (was too rounded).

### Navigation & structure
8. **Redundant "All queues" removed** from the Moderation menu — it was a summary page linking to the same six queues already listed beneath it.
9. **Feature Flags** reduced from 3 entry points to 2 (removed the redundant dashboard-home card).
10. **Sidebar sections collapsed by default** (Directory / Moderation / System) — the admin opens only what they need.
11. **Sidebar no longer squeezes** — menu items keep their height and the list scrolls instead of compressing Overview / Social / Notifications when a section is expanded.
12. **Mobile drawer now matches the desktop sidebar** — Social, Notifications and Log out added, sections collapsed by default.

### Data correctness
13. **Players list shows players only** — Coach and Organizer are subscription-based, not account roles, so those role filters were always empty. Removed the misleading filters; kept name/email search.
14. **Drill-down added** — tapping a player opens their profile; tapping a venue opens the venue page.

### Small polish
15. **Moderation error messages** now show inline per row (4 screens) instead of a browser alert() pop-up.
16. **Suggested-edits JSON preview** expanded from 200 to 500 characters, nicely formatted.

---

## Status

Built and running on the live preview server (https://pickleballer-pwa.eunika.xyz).
Type-check clean for all admin files; PM2 restarted after each change. No API/backend
changes — this was entirely a front-end optimization and cleanup pass on the existing
admin console. All changes committed and pushed to the `lc-staff-revenue` branch.
