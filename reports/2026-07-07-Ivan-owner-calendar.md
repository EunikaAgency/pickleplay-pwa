# Ivan Report — 2026-07-07: New Court Calendar for venue owners (client / WhatsApp version)

- **Author:** Ivan
- **Date:** 2026-07-07
- **Area:** Venue Owner experience — new Court Calendar page (+ Pricing polish)
- **Audience:** Client (non-technical)
- **Try it:** https://pickleballer-pwa.eunika.xyz/owner/calendar

---

## WhatsApp message (copy-paste ready, no icons)

PickleBallers — Update

We've added a new Court Calendar for venue owners so you can see everything booked on your courts at a glance.

Pick your venue — a dropdown at the top switches between your venues in one tap.

Full-day grid — every court has its own row, with the full 24 hours (12 AM to 11 PM) across the top. Each booking shows as one continuous block with the customer name and time.

Two-week view — the day strip now shows two full weeks at once (two rows), so you see more ahead without clicking around. A red dot marks any day that has bookings. Use Prev / This week / Next to move the window.

Colour-coded slots — easy to read at a glance:
- Game / Event (purple) — public games, and it shows the format too: Bracketing, Round Robin, or Mini Tournament
- Private booking / Open Play (blue)
- Reserved (green)
- Blocked / Maintenance (red)
- Pending / awaiting payment (amber)

Summary cards — four cards up top (Games, Open Play / Private Game, Reserved, Blocked) show the counts, and tapping any card filters the table to just that type.

Hover for details — hover any booking to see the full info in a pop-up (name and time), even for short one-hour slots.

Tap to manage — tapping a real booking opens its details so you can approve or cancel right there.

Works with Pricing — on the Pricing page you can now paint Maintenance (blocks the slot) and Reserved time, and both show up on the Calendar automatically. We also renamed "Closed" to "Clear", and fixed the day/time so slots save on the exact date you painted (Philippine time).

Safer court deleting — you can no longer delete a court that still has upcoming bookings; the app asks you to reassign or cancel them first, so bookings never get lost.

You can try it here: https://pickleballer-pwa.eunika.xyz/owner/calendar

---

## What's included (feature list)

1. **Court Calendar page** (`/owner/calendar`) — venue picker + a per-court, 24-hour grid of booked slots.
2. **Continuous booking blocks** — consecutive hours of the same booking render as one spanned block (empty hours stay separate).
3. **Two-week window** — 14-day strip in two rows of seven; red-dot "has bookings" indicator; Prev/Next page by two weeks; full-width on desktop, no horizontal scroll on mobile.
4. **Instant hover tooltip** — dark pop-up with label + format + customer/time, not clipped by the table edge.
5. **4 summary cards** — Games · Open Play/Private Game · Reserved · Blocked; each is a one-tap filter for the grid.
6. **Colour + label system** — Game/Event (purple, with format sub-label), Private/Open Play (blue), Reserved (green), Blocked/Maintenance (red), Pending (amber).
7. **Clickable bookings** — real bookings open the owner booking detail sheet (approve / cancel).
8. **Pricing ↔ Calendar link** — Maintenance and Reserved painted on the Pricing schedule appear on the Calendar; "Closed" renamed "Clear".
9. **Game format** — public game cells show Bracketing / Round Robin / Mini Tournament, driven by the format chosen when the game is created.
10. **Court-delete guard** — deleting a court with current/upcoming bookings is blocked with a clear message; existing orphaned bookings were cleaned up.
11. **Venue dropdowns** — squared off to an 8px radius (no more pill shape) for a cleaner look.

## Fixes along the way

- **Timezone** — the whole app now runs on Philippine time (`Asia/Manila`); Pricing overrides no longer save one day early.
- **"Unassigned / Venue-wide" mystery** — traced to bookings pointing at a deleted court; cleaned up and prevented going forward (see court-delete guard).
- **Confusing labels** — game cells no longer read "Open play" for the format; they now show the real event format (Bracketing / Round Robin / Mini Tournament).

---

## Status

Built and running on the dev/preview server. Type-check clean; verified end-to-end
via API + the live calendar (Maintenance/Reserved show on the correct day and venue;
court-delete guard returns a clear message; game format surfaces as Bracketing /
Round Robin / Mini Tournament). The create-game "Game Format" picker itself was built
separately; this work surfaces and displays it on the owner Calendar.
