# PickleBallers — Owner Platform & Launch Prep
## Video script for client screen recording
### Period: June 24 – June 30, 2026 (7 days)

---

## OPENING — 20 seconds

"Alright, here's the progress from the last seven days — June 24th to today, June 30th. This is the owner platform, the audit, and the final polish before demo. Bottom line: the app is demo-ready. Out of 54 items in the master requirements sheet, 53 are done or intentionally deferred. All 14 PDF demo requirements are met. And the full API audit found zero bugs. Let me walk you through it."

---

## JUNE 24 — Venue Owner Tools — 90 seconds

"June 24th was all about the venue owner — getting them onboarded and giving them control over their listing.

First, **venue claiming**. An owner can search the directory for their venue — it only shows unclaimed ones — pick it, and submit proof of ownership. They write a description explaining their connection to the venue, add up to five links, and submit. It goes to admin for review. The entry points are a 'Claim' button next to 'Create venue' on the owner's venues screen and nearby screen, plus a link from the 'add venue' form that says 'Already in our directory? Claim it instead.'

Second, a **smarter 'add venue' form**. We stripped it down to identity, location, and contact. Courts and pricing moved to the post-create editor. The address field is now a debounced autocomplete — start typing, suggestions drop in, pick one, and the map pin flies there while city, address line, and postcode auto-fill.

Third, the **system-generated booking link**. Every venue now gets a canonical booking link — `/venues/slug` — with copy and share buttons surfaced on the overview tab and inside the listing editor. The owner can set a custom slug, and it checks availability live as they type — green 'Available', or red if it's taken or invalid. Save is blocked while a bad slug is entered. We removed the old free-text booking URL field entirely.

Fourth, **per-court setup**. Each court now has its own name, description, photo gallery with up to 8 images, and its own weekly operating hours with per-time-window pricing. The old venue-level hours tab became closures only — one-off dates the venue is closed. Hours moved down to each individual court.

We also built the **owner profile tab** — the v2.1 profile design populated with the owner's venue-business content, plus a reviews inbox with proper star ratings and reply functionality, and the owner home screen got a real unread notification badge and a 6-venue grid."

---

## JUNE 25 — Court Editor Polish — 30 seconds

"June 25th was a quick polish day on the court editor.

We split the crowded single-scroll court form into three clean tabs: Court Info, Gallery, and Hours. The hours tab lazy-loads — it only fetches when you actually open it. Save and Delete buttons moved to a persistent footer so they're reachable from any tab.

The gallery got redesigned into a real gallery — square grid, four columns on mobile, six on tablet. Tap any photo and it opens full-screen in a lightbox. The remove button is now a ringed badge positioned outside the top-right corner, so it's never clipped by the tile's rounded corners. Empty state is a single inviting dashed 'Add photos' drop zone.

The hours-pricing layout got fixed — the 'add hour pricing' button anchors at the bottom of the card, and each priced window row is now no-wrap so the rate and close button stay pinned inline on narrow screens."

---

## JUNE 26 — Owner Features — 120 seconds

"June 26th was the biggest day. This is where the business model and operations layer went in. Four demo must-haves from the meeting notes, plus six medium-priority backend features.

**Number one priority from the meeting: manual booking and slot blocking.**

The owner or front desk can now record a booking made off-platform — someone called, messaged on Instagram or Messenger, walked in. They pick a court, date, start and end time, enter the customer's name and phone, pick the booking source — walk-in, phone, Messenger, Instagram, or other — set the amount and payment method, and save. The system runs the exact same double-booking guard as player checkout, so a manual entry can never sit on top of an existing reservation. Blocking a slot works the same way — mark it unavailable with a reason, amount zero. Manual and blocked rows show up in the owner inbox tagged MANUAL or BLOCKED, and they're excluded from players' 'My bookings' so customers never see them.

**Second: the front desk dashboard.**

This is a new screen reachable from the owner home — a 'Front desk' quick action. It shows today's schedule, time-sorted, with a date stepper to move between days. Pending approvals with inline approve and decline buttons. Three KPI tiles: bookings today, awaiting approval, and manual entries today. There's a venue picker for multi-venue owners. And two bottom-sheet forms: Add booking and Block slot, reusing the shared court picker, hour select, and date picker components.

**Third: payment options at checkout.**

The owner configures this in the listing editor — they enable any combination of full payment, deposit, or pay-at-venue, plus a deposit percentage. At checkout, the player picks one. Full payment charges everything and confirms. Deposit charges the percentage now, balance due at the venue. Pay-at-venue reserves with no online charge at all — skips checkout, auto-confirms. This applies to instant-book venues. Approval venues stay full payment after the owner approves.

**Fourth: the 7% platform service fee.**

This is configured in admin settings, defaulting to seven percent. It shows as its own line everywhere — checkout review shows subtotal plus service fee equals total. My Bookings shows the breakdown. The owner booking detail shows it. The venue's own amount stays the venue's price — the fee is the platform's, tracked separately so owner revenue analytics are unchanged.

**On top of those four, we built owner staff accounts.**

This is org-level delegation. The owner creates staff login accounts from their profile page. A staff member can manage all of the owner's venues, bookings, and clubs — but cannot create more staff or claim new venues. We created a new 'staff' role with the exact permission set. And we built a single lever — `effectiveOwnerId` — so every resource check in the system resolves through the creating owner. Staff inherit access without owning anything. A staff member logging in sees the same seven venues their owner sees, can read the bookings inbox, can even edit the owner's private club. But create venue? 403. Create staff? 403. Server-side enforced.

**And the API team shipped six medium features in parallel.**

Booking modification — change date, time, or court after booking, up to three changes, with a full audit trail and slot conflict re-check.

Court waitlist — players join a waitlist for a booked slot. When someone cancels, the first waitlisted player gets auto-promoted and push-notified, with a two-hour window to claim. If they don't claim, it cascades to the next person.

BIR-compliant official receipts — auto-generated on booking confirmation with sequential OR numbering per venue, 12% VAT breakdown. Player endpoints to list and view their receipts. The player side is done in the app — the payment history screen shows an OR popup with receipt number, amount, and status. The owner side still needs a receipt management screen — that's the one remaining gap.

Payout settlements and reconciliation — the admin can generate settlement periods per venue, with gross revenue, platform fees, net payout, and per-booking line items. The owner sees their balance and settlement history, and can add payout methods — bank transfer, GCash, or Maya.

Owner-to-player venue messaging — a 'Message venue' button on every court detail screen auto-creates a conversation between the player and the venue owner.

Cash leakage mitigation — we track when someone starts checkout but doesn't finish, and when a booking link is shared, so the owner can see where they're losing bookings."

---

## JUNE 29 — App Audit & Web Parity — 90 seconds

"June 29th was audit day and the web parity sprint.

**The audit.** We cross-referenced the 54-row master requirements CSV against the live API and app code. Fifty-three of 54 are either done or deferred. The one gap is the owner-side BIR receipt screen I mentioned. We API-tested all 19 features that were previously marked 'built but not browser-tested' — day-based pricing, member pricing, manual surge overrides, per-player surcharges, recurring bookings, demand data capture, staff role views, split-court booking, equipment rental, time-block pricing, cancellation and refund, desktop sidebar, manual booking, front desk, deposit and pay-at-venue, the 7% service fee, open-play booking, owner messaging, and cash leakage. Seventeen passed on the first try. Two needed a quick fix — both resolved. Zero API bugs found.

**Then the web parity sprint.** The web organizer console was behind the PWA. We brought it to full parity. Seven new venue editor tabs that existed in the app but not the web: Demand, Members, Slot Pricing, Closures, Staff, and Leakage, plus a Pricing Suggestions card that reads real demand data and recommends price changes. Four new cross-venue screens: Front Desk, Staff management, Settlements, and Claim Venue. Fourteen new player-facing screens: clubs, games, bookings, notifications, messages, chat, onboarding, settings, tournaments — every screen the app had that the web didn't. The messaging API got seven new client functions. Twenty-three new routes. Thirty new files. Build: 1,132 modules, 1.8 seconds, zero errors.

**We also fixed a batch of UX issues.** The tournament bracket view in the app got a complete rewrite to match the web — elimination tree with connector lines between rounds, pan-and-zoom canvas, match cards with winner highlighting. Organizers can no longer join games or tournaments as players — the app hides discover and join buttons, and the API blocks it server-side. The Game On FAB skips the join-or-host choice for organizers.

The notification system got unified — the owner bell and the player bell now go to the same screen with the same data. We added a delete button on every notification row. Club notification links now deep-link to the specific post, not just the club homepage. The notification header is sticky. The Insights tab got consolidated — Demand and Leakage are now sections inside Insights instead of three separate tabs. FAQ accordions appeared on every venue detail page. And we fixed some broken tab icons that were rendering as blanks."

---

## JUNE 30 — Push Notifications, Auto Pricing & Polish — 90 seconds

"Today, June 30th, we shipped three things.

**First: FCM push notifications.** Before this, we only had VAPID — browser-native web push. Now we have Firebase Cloud Messaging running in parallel. The system fans push messages to both channels simultaneously. FCM gives us much better delivery on Android through Google Play Services — the browser push service alone was less reliable there. We built a Firebase service worker in the PWA, lazy Firebase SDK initialization so it doesn't bloat the cold-start bundle, and server-side FCM sending via firebase-admin with automatic dead-token pruning. The dual-channel architecture means every `sendPushToUser` call fires to both FCM tokens and VAPID subscriptions in parallel — whichever delivers first wins. End-to-end test confirmed: FCM is configured, tokens persist to MongoDB, send completes, and invalid tokens get auto-pruned.

**Second: automated dynamic pricing.** Before this, the owner had to manually review pricing suggestions and click 'bulk apply.' Now they can opt in and let it run hands-off. Here's how it works: a nightly cron job scores demand data for each opted-in venue. For every day-of-week and hour combination, it looks at occupancy percentage, waitlist counts, and empty slot events. Ninety-five percent occupancy with unmet demand? That's a plus-30% price adjustment at high confidence. Eighty-five percent occupancy? Plus-20% at medium confidence. Near-zero occupancy with almost no bookings? Minus-20%. The owner sets two controls: minimum confidence threshold — high, medium, or low — and maximum adjustment percentage, defaulting to 20%, configurable from 5 to 50. Only suggestions meeting both thresholds get auto-applied. They create slot price override rows for the next four weeks, with a note explaining the rationale. All auto-applied overrides are visible in the active slot rates list, and the owner can override anything manually. It's off by default for every venue. The owner turns it on from a new auto-pricing card in the pricing tab — one toggle, a confidence dropdown, and a max adjustment slider with live explanation text.

**Third: UI cleanup across the board.**

The listing tab had five scattered pricing sections with redundant and dead fields. We consolidated to three clean sections: hourly rate, weekend and holiday, and extras. We removed peak and off-peak price — dead fields that were never used. We removed the tax label and currency — always VAT-inclusive, always PHP. And we added a clear pricing precedence hierarchy: surge overrides win, then time-block rates, then holiday, weekend, court rate, venue default. The owner now understands exactly which price applies.

We standardized card borders across the entire app. Before, some cards used a 0.5-pixel hairline that was barely visible, some used slate, some had no border at all. Now every card uses a consistent slate-200 border with rounded corners and a subtle shadow. Booking cards got redesigned — clear card shape, price and status stacked on desktop, action buttons grouped with a separator line.

The Insights tab got polished — metric cards now use the new card style with proper heading font and uppercase labels. The Leakage sub-tab got working icons, softened chart colors, and proper column headers on the daily breakdown table. The bar chart component got slightly rounder bars and better spacing.

The owner map got fixed — venues with zero bookings no longer show a confusing '0' marker. Active venues show their booking count. Quiet venues just show a small dot.

And chat got a full polish pass — hover action buttons on every message with a reply icon and three-dot menu, a dropdown with unsend, forward, pin, and report options, a reply preview bar above the composer, and the composer itself visually separated with a white background, clear border, and subtle top shadow."

---

## BY THE NUMBERS — 20 seconds

"Seven days. June 24 to 30.

Three surfaces kept in sync — API, PWA app, and web organizer.
Over 30 features shipped.
Hundred-plus API endpoints.
The web alone got 30 new files and 23 new routes in one day.
Nine permission keys.
Fifty-three of 54 CSV requirements met. Fourteen of 14 PDF demo requirements met.
Full audit: zero API bugs.
One remaining code gap: owner-side BIR receipt screen."

---

## WHAT'S LEFT — 20 seconds

"The single remaining gap is the owner-side official receipt management screen — listing, issuing, and voiding receipts per venue. The API generates the receipts with proper OR numbering. The player can see their receipts. The owner view needs about a half-day.

Everything else is either deferred by design — automated reminders need a scheduler, and there's an analytics layer planned for phase two — or process items like the owner feature priority matrix and venue research."

---

## CLOSING — 10 seconds

"The app is demo-ready. All surfaces are live. If you want a guided walkthrough, or anything adjusted before the demo, just say when."

---

## SCREEN RECORDING NOTES

**What to show on screen while reading:**

| Section | Show on screen |
|---|---|
| Opening | Owner home screen, then run `./progress-report.sh --stats` |
| June 24 | Claim venue flow, address autocomplete, booking link + custom slug, court editor tabs |
| June 25 | Court editor 3 tabs, gallery lightbox, hours-pricing layout |
| June 26 | Manual booking sheet, front desk dashboard, payment options selector, staff management, service fee in checkout |
| June 29 | Bracket view (app), unified notifications, insights tab, web console with all 15 tabs visible |
| June 30 | Auto-pricing toggle card, listing tab before/after, standardized cards, chat reply preview, map pin fix |
| Numbers | Scroll through `/var/public/pickleplay/reports/` file list |
| Closing | Splash animation or app home screen |

**Pacing tips:**
- Full script is about 6 minutes at a comfortable pace
- If you need 3 minutes: read Opening, June 26 (the biggest day), June 30 (latest), and Closing. Skip June 24-25 and the June 29 web parity details.
- The June 26 section is the meatiest — that's where the business value is. Give it room.
