# Ivan Report — 2026-06-30: Push Notifications, Automated Dynamic Pricing & Pricing UI Cleanup

## 1. FCM Push Notifications (Dual-Channel)

**Before:** Web Push via VAPID only — browser-native, works on all platforms but delivery on Android was less reliable (depends on browser push service, no Play Services integration).

**Now:** FCM (Firebase Cloud Messaging) + VAPID dual-channel. The system fans push messages to both channels in parallel.

### What changed

| Layer | File | What |
|---|---|---|
| PWA | `public/firebase-messaging-sw.js` | FCM service worker — handles background push arrival + notification click deep-linking via Google's infrastructure |
| PWA | `src/shared/lib/firebase.ts` | Lazy Firebase SDK init — only loads when push is enabled, keeps cold-start bundle small |
| PWA | `src/shared/lib/push.ts` | Dual-channel: `enablePush()` tries FCM first (better Android), falls back to VAPID. `refreshPushSubscription()` rebinds both channels after login |
| PWA | `src/shared/lib/api.ts` | `subscribeFcmToken()` / `unsubscribeFcmToken()` — registers FCM device tokens with the API |
| API | `src/shared/lib/firebase.ts` | `firebase-admin` init + `sendFcm()` / `sendFcmToUser()` — server-side sender, auto-prunes dead tokens |
| API | `src/features/push/push.model.ts` | `FcmToken` collection — one row per device (alongside existing `PushSubscription`) |
| API | `src/features/push/push.controller.ts` | `subscribeFcm` / `unsubscribeFcm` — register/remove FCM device tokens |
| API | `src/shared/lib/push.ts` | `sendPushToUser()` fans to FCM + VAPID in parallel; dead tokens auto-pruned |

### Architecture

```
                 sendPushToUser(userId, payload)
                         │
            ┌────────────┴────────────┐
            ▼                         ▼
     sendFcmToUser()           webpush.sendNotification()
     (firebase-admin)          (VAPID)
            │                         │
      FCM tokens in DB         PushSubscription in DB
            │                         │
    Google's servers           Browser push service
            │                         │
      Android (Play           Chrome/Edge/Firefox/
      Services priority)      Safari/iOS 16.4+
```

- Dead FCM tokens (invalid, expired, malformed) are pruned automatically
- Both channels tried in parallel — whichever delivers first wins
- Firebase project: `pickleballers-da675`
- Service account: `firebase-adminsdk-fbsvc@pickleballers-da675.iam.gserviceaccount.com`

### E2E test result
```
FCM configured: YES
Token inserted → MongoDB
sendPushToUser completed
Token pruned: YES ✓ (FCM rejected invalid token = connection working)
```

---

## 2. Automated Dynamic Pricing (Opt-in)

**Before:** Owner had to manually review `PricingSuggestionsCard` and click "Bulk apply" for each set of suggestions. No background automation.

**Now:** Venues can opt into hands-off pricing. A nightly cron scores demand data and auto-applies high-confidence price adjustments.

### What changed

| Layer | File | What |
|---|---|---|
| API | `venues.model.ts` | `autoDynamicPricing` (bool), `autoDynamicPricingMinConfidence` (low/medium/high), `autoDynamicPricingMaxAdjustment` (5–50%) — new fields on Venue |
| API | `venues.controller.ts` | Update schema accepts the three new fields |
| API | `demand.controller.ts` | `runAutoDynamicPricing()` — iterates all opted-in venues, scores demand per day×hour (occupancy % + waitlist counts + empty slot events), computes adjustment %, filters by confidence threshold, upserts `SlotPriceOverride` rows |
| API | `demand.routes.ts` | `POST /demand/auto-dynamic-pricing` — admin-only cron endpoint |
| API | `index.ts` | `setInterval` cron — first run at next 3am, then every 24h |
| PWA | `api.ts` | `autoDynamicPricing*` fields on `ApiVenue` type |
| PWA | `SlotPricingTab.tsx` | `AutoPricingToggle` component — master on/off toggle, confidence selector (High/Medium/Low), max adjustment slider (5–50%), live explanation text |

### How it scores demand

For each venue, for each day-of-week × hour combination:

| Condition | Adjustment | Confidence |
|---|---|---|
| Occupancy ≥ 95% + unmet demand | +30% (capped) | High |
| Occupancy ≥ 85% | +20% (capped) | Medium |
| Waitlist ≥ N weeks | +15% (capped) | Medium |
| Some unmet demand (empty slots) | +10% | Low |
| Occupancy ≤ 10%, almost no bookings | -20% (capped) | Medium |

- Max adjustment per change is owner-configurable (default 20%, min 5%, max 50%)
- Only suggestions meeting the owner's confidence threshold are auto-applied
- Creates `SlotPriceOverride` rows for the next 4 weeks (upsert — existing overrides are updated)
- Note on each override: "Auto dynamic pricing — <rationale> (<confidence>)"

### Owner UX

**Venue → Pricing tab → "Auto pricing" card:**

```
┌─────────────────────────────────────────┐
│ Auto pricing                            │
│ Let the system automatically adjust...  │
│                                         │
│ [✓] Enable automatic adjustments        │
│                                         │
│ ── (when enabled) ─────────────────────  │
│ Minimum confidence: [High ▾]            │
│ Max adjustment:    [20%]                │
│                                         │
│ The engine runs daily. Prices never     │
│ move more than 20% in one adjustment.   │
│ Only suggestions at high confidence     │
│ or above are applied. You can always    │
│ override any slot manually.             │
└─────────────────────────────────────────┘
```

- **Off by default** for every venue
- Manual review-and-apply via `PricingSuggestionsCard` still works
- All auto-applied overrides are visible in "Active slot rates" list

---

## 3. Files Changed This Session

### App (PWA)
- `app/public/firebase-messaging-sw.js` — new
- `app/src/shared/lib/firebase.ts` — new
- `app/src/shared/lib/push.ts` — dual-channel rewrite
- `app/src/shared/lib/api.ts` — FCM client functions + auto-pricing types
- `app/src/features/owner/tabs/SlotPricingTab.tsx` — AutoPricingToggle
- `app/.env` — VITE_FCM_VAPID_KEY
- `app/package.json` — firebase dependency
- `TASKS/Copy of Standardised Pickleballers - Pickleballers Questions.csv` — updated statuses

### API (Backend)
- `api/.gitignore` — tsbuildinfo
- `api/package.json` — firebase-admin dependency
- `api/src/shared/lib/firebase.ts` — new: firebase-admin init + FCM send
- `api/src/shared/lib/push.ts` — FCM + VAPID parallel send
- `api/src/features/push/push.model.ts` — FcmToken model
- `api/src/features/push/push.controller.ts` — FCM subscribe/unsubscribe
- `api/src/features/push/push.routes.ts` — FCM routes
- `api/src/features/demand/demand.controller.ts` — runAutoDynamicPricing()
- `api/src/features/demand/demand.routes.ts` — auto-dynamic-pricing route
- `api/src/features/venues/venues.model.ts` — autoDynamicPricing fields
- `api/src/features/venues/venues.controller.ts` — update schema
- `api/src/features/root/root.controller.ts` — /lists updated
- `api/src/index.ts` — daily auto-pricing cron
- `api/.env` — FIREBASE_SERVICE_ACCOUNT_JSON

### Infrastructure
- PM2 restarted with `--update-env` for both services
- PM2 saved for reboot persistence
- `.gitignore` — removed `/api/` exclusion (now tracked in monorepo)

---

## 3. Pricing UI Cleanup — Listing Tab

**Problem:** The Listing tab had 5 scattered pricing sections with redundant fields, dead fields, and misleading descriptions. Owners were confused about which pricing applied where.

### Removed

| Field | Reason |
|---|---|
| `peakPrice` / `offPeakPrice` | Dead fields — never used by the pricing engine. Replaced by the Hours tab's per-time-window pricing. |
| `pricingTaxLabel` | Always "VAT inclusive" in PH. Unnecessary per-venue config. |
| `pricingCurrency` | Always PHP. System-wide default, not per-venue. |

### Before (5 scattered sections)

```
"Pricing"              → priceFrom, peak, off-peak, open play, equipment, notes, tax label
"Day-based pricing"    → weekend rate, holiday rate, holiday dates
"Member pricing"       → member discount % (1 field, whole section)
"Per-player surcharge" → fee + threshold (2 fields, whole section)
+ "Booking policy"     → approval, payment options, deposit
```

### After (3 clean sections)

```
"Hourly rate"          → default rate + hint about court/time overrides
"Weekend & holiday"    → weekend rate, holiday rate, holiday dates
"Extras"               → equipment, open play, per-player, member discount, notes
```

### Pricing precedence (now clear in the UI)

The Listing tab's sections are the **venue-wide defaults**. They apply only when no more specific rate is set:

| Priority | Where set | What |
|---|---|---|
| 1 (highest) | **Pricing** tab | Surge — manual slot override for a specific date+time |
| 2 | **Hours** tab | Time-block rate — per-day, per-hour pricing window |
| 3 | Listing tab ↑ | Holiday rate (if date is a holiday) |
| 4 | Listing tab ↑ | Weekend rate (Sat/Sun) |
| 5 | **Courts** tab | Sub-unit rate (half-court) |
| 6 | **Courts** tab | Court's own hourly rate |
| 7 (fallback) | Listing tab ↑ | Venue default rate |

After the rate resolves, **Extras** (per-player, equipment, member discount) are added independently.

### File changed
- `app/src/features/owner/tabs/ListingEditorTab.tsx` — 25 insertions, 42 deletions

---

## 4. Card Border Standardization

**Problem:** Card borders were inconsistent across the app — some used `0.5px` hairline (`rgba(15,23,42,0.08)`), some used `#cbd2dc`, some had no visible border at all. Cards blended together with no visual separation.

### What changed

- **CSS token** — `--field-border` stays at `#cbd2dc` (slate-toned, visible but not harsh)
- **`OwnerStat` metric cards** — `.card` class → `rounded-2xl border border-slate-200 bg-white p-4 shadow-sm`
- **`OwnerBookingRow` booking cards** — `rounded-xl border-[0.5px] border-[var(--hairline)] p-3` → `rounded-2xl border border-slate-200 bg-white p-4 shadow-sm`
- **Inner dividers** — kept `border-slate-100` (lighter, for row separators only)

**Design principle:** Two-tier border visibility — outer panels use `--field-border` (`#cbd2dc`, slightly stronger), inner cards use `slate-200` (`#e2e8f0`, lighter and subtler). Both are clearly visible but not shouting — "visible pero hindi sobrang visible, hindi sobrang hindi visible."

### Files changed
- `app/src/shared/styles/index.css` — `--field-border` token
- `app/src/features/owner/components/OwnerStat.tsx` — card classes + typography
- `app/src/features/owner/components/OwnerBookingRow.tsx` — card classes

---

## 5. Owner Venue Bookings — Card Design

**Problem:** Booking items in the Bookings tab (`/owner/venues/:slug?tab=bookings`) looked merged together — no borders, no shadows, no visual separation between rows. Hard to scan.

### What changed

**`OwnerBookingRow.tsx` — each booking is now a clear card:**
- Card: `rounded-2xl border border-slate-200 bg-white p-4 shadow-sm`
- Top row: `flex flex-col sm:flex-row` — stacks price below info on mobile, side-by-side on desktop
- Price + status: `sm:flex-col sm:items-end` — stacked right-aligned on desktop, side-by-side on mobile
- Action buttons: grouped in `flex flex-wrap gap-2` with a `border-t border-slate-100` separator line above (no more `flex-1` spacer pushing Decline far right)

**`BookingsInboxTab.tsx` — list spacing:**
- List wrapper: `space-y-3` → `flex flex-col gap-3 mt-1`

### Files changed
- `app/src/features/owner/components/OwnerBookingRow.tsx`
- `app/src/features/owner/tabs/BookingsInboxTab.tsx`

---

## 6. Owner Insights Tab — UI Polish

**Problem:** `/owner/venues/:slug?tab=insights` — metric cards looked plain (`.card` class), the Leakage sub-tab had a broken `"LEAK"` icon, the funnel chart had harsh colors, the daily breakdown table was plain text with no column headers, and the 6 sub-tabs could overflow on mobile.

### What changed

**`OwnerStat.tsx` — metric cards:**
- Card wrapper: `rounded-2xl border border-slate-200 bg-white p-4 shadow-sm`
- Value: `font-heading font-bold text-2xl` (was `font-semibold text-[22px]`)
- Label: `text-xs font-semibold uppercase tracking-wide text-slate-500` (was `t-eyebrow`)

**`LeakageTab.tsx` — multiple fixes:**
- Date filters: raw `<button className="chip">` → `<Chip className="chip-tab">` (consistent with DemandTab)
- Leakage icon: `"leak"` (broken — not a valid Material Symbol) → `"trending_down"` + `tone="coral"`
- Checkout drop-off: added `tone="neutral"` for visual distinction
- Funnel chart colors: softened — coral → amber (`#f59e0b`), lime → indigo (`#6366f1`)
- Daily breakdown table: added column headers, `tabular-nums` alignment, proper row separators, semantic color on the online column

**`InsightsTab.tsx` — sub-tabs scroll:**
- Wrapped `Segmented` in `scroll-x` + `min-w-[560px]` for mobile horizontal scroll
- Vertical rhythm: `space-y-4` → `space-y-5`

**`Chart.tsx` — bar chart polish (shared, affects all charts):**
- Bar rounded corners: `4px` → `6px`
- Bar gap: `1px` → `3px`
- X-axis label gap: `1px` → `3px`, margin-top: `1.5` → `2`

### Files changed
- `app/src/features/owner/components/OwnerStat.tsx`
- `app/src/features/owner/tabs/LeakageTab.tsx`
- `app/src/features/owner/tabs/InsightsTab.tsx`
- `app/src/shared/components/ui/Chart.tsx`

---

## 7. Owner Venues Map — Fix Confusing "0" Markers

**Problem:** On `/owner/venues`, the map markers showed `0` on quiet venues. Users couldn't understand what `0` meant (zero bookings? zero venues? broken?). The orange markers with pending counts made sense, but gray markers with a big `0` looked broken.

### What changed

**`OwnerNearbyScreen.tsx` — new `pinLabel()` logic:**

| Status | Shows | Pin size |
|---|---|---|
| **Pending** (amber) | Pending count (e.g. `2`) | 32px circle |
| **Active** (green) | Today's booking count (e.g. `3`) | 32px circle |
| **Quiet** (slate) | Empty — small dot | 18px dot |
| **Unknown** (blue) | Empty — small dot | 18px dot |

Zero never renders — if pending count or today count is `0`, falls back to the empty dot.

### Files changed
- `app/src/features/owner/OwnerNearbyScreen.tsx`

---

## 8. Messages — Hover Actions + Reply

**Problem:** Messages had no inline actions. No way to reply, no per-message options menu beyond the existing tap-to-delete on own messages.

### What changed

**`ChatScreen.tsx` — hover action buttons:**
- Each message row gets `group` on the outer wrapper → hover on the whole row triggers the actions
- Two floating buttons beside the bubble: **reply** (`CornerUpLeft` from lucide-react) + **3-dot** (`more` icon)
- Positioning: `absolute top-1/2 -translate-y-1/2` centered vertically on the bubble
  - Sent (blue): `right-full mr-2` — actions on the left
  - Received (white): `left-full ml-2` — actions on the right
- Visibility: `opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto`
- Buttons: `h-7 w-7 rounded-full bg-neutral-700 text-white shadow hover:bg-neutral-600`

**3-dot dropdown menu:**
- Dark floating menu: `rounded-xl bg-neutral-800 text-white shadow-xl border border-white/10`
- Options: Unsend (own only), Forward, Pin, Report (others only)
- Escape + outside-click dismiss

**Reply preview bar:**
- Clicking the reply icon sets `replyTo` state (does NOT send a message)
- Preview bar above composer: `[↩️] REPlying to {name} → message snippet → [✕]`
- Composer placeholder changes to "Type a reply…"
- Sending clears the reply state; on failure, restores it
- Switching conversations clears reply state

### Files changed
- `app/src/features/messages/ChatScreen.tsx`
- `app/package.json` — added `lucide-react` dependency

---

## 9. Messages — Composer Visual Separation

**Problem:** The bottom composer section blended into the message area — same background (`--bg`), a barely-visible `0.5px` hairline top border, and no visual distinction between messages, reply preview, and input row. The reply preview used the same surface background as the input, so it all felt like one flat block.

### What changed

**Sticky composer wrapper:**
- Wraps reply preview + error + input row in a single `sticky bottom-0 z-30` container
- Background: `bg-white` (whiter than the `--bg` message area)
- Top border: `border-t border-slate-300` (clearly visible, replaces the old `0.5px hairline`)
- Subtle top shadow: `shadow-[0_-2px_8px_rgba(0,0,0,0.04)]`

**Reply preview:**
- Background: `bg-slate-50` (distinct from the white input area)
- Bottom border: `border-b border-slate-200` (separates preview from input row)
- Label: `text-[11px] font-semibold uppercase tracking-wide text-slate-500`
- Snippet: `mt-1 text-sm text-slate-700`
- Close button: `rounded-full p-1 text-slate-500 hover:bg-slate-100` — cleaner, larger tap target

**Input field:**
- Background: `bg-white` (was `--surface`)
- Border: `border border-slate-300` (was `0.5px hairline`)
- Placeholder: `placeholder:text-slate-400`
- Padding: `px-4` (was `px-3.5`)

### Before vs After

| Element | Before | After |
|---|---|---|
| Composer bg | `bg-[var(--bg)]` (matches chat) | `bg-white` (stands out) |
| Top border | `0.5px hairline` (barely visible) | `1px slate-300` (clear) |
| Shadow | none | `0_-2px_8px_rgba(0,0,0,0.04)` |
| Reply preview bg | `bg-[var(--surface)]` (same as input) | `bg-slate-50` (distinct) |
| Input border | `0.5px hairline` | `border border-slate-300` |
| Input bg | `bg-[var(--surface)]` | `bg-white` |

### Files changed
- `app/src/features/messages/ChatScreen.tsx`

---

## 10. Messages — Reply Preview in Message List

**Problem:** After sending a reply, the sent message showed no indication of what it was replying to. The reply context was only visible in the composer preview (before sending), then disappeared. This made conversations confusing — you'd see "we got pro" with no connection to the question it answered.

### What changed

**Local reply tracking** — since the backend doesn't return `replyTo` metadata on messages, the client tracks it locally:
- New `replyMeta` state: `Record<string, ApiChatMessage>` — maps sent message ID → the message it replied to
- On send: after `sendMessage` returns the new message, the `replyTo` message is stored in `replyMeta[msg.id]`
- On conversation switch: `replyMeta` is cleared

**Reply preview in the message list:**

Sent reply (blue bubble, right-aligned):
```
                    You replied to Kenneth Hernandez
 ┌──────────────────────────────────────────┐
 │ July 4th 8–10 AM works. Hold it for me  │ ← quoted preview (slate-200 bg, line-clamp-2)
 │ please — I'll pay right now...           │
 └──────────────────────────────────────────┘
                    ┌──────────────────────┐
                    │      we got pro      │ ← blue bubble
                    └──────────────────────┘
                              4:31 PM
```

Received reply (white bubble, left-aligned) — structure ready, renders when backend adds reply support:
```
 Kenneth Hernandez replied to you
 ┌──────────────────────────────────┐
 │ Original message preview...      │
 └──────────────────────────────────┘
 ┌──────────────────────────────────┐
 │ Reply text here                  │ ← white bubble
 └──────────────────────────────────┘
```

**Reply preview styling:**
- Label: `text-xs text-slate-500`, right-aligned for sent, left-aligned for received
- Quoted bubble: `line-clamp-2 rounded-2xl bg-slate-200 px-3 py-2 text-sm text-slate-700 break-words`
- Label text: "You replied to {name}" / "{name} replied to you"

### Files changed
- `app/src/features/messages/ChatScreen.tsx`

---

## 11. Files Changed This Session (continued)

### App (PWA) — from sections 4–10
- `app/src/shared/styles/index.css` — `--field-border` token
- `app/src/shared/components/ui/Chart.tsx` — bar rounding + spacing
- `app/src/features/owner/components/OwnerStat.tsx` — metric card design
- `app/src/features/owner/components/OwnerBookingRow.tsx` — booking card design
- `app/src/features/owner/tabs/BookingsInboxTab.tsx` — list gap
- `app/src/features/owner/tabs/InsightsTab.tsx` — sub-tab scroll
- `app/src/features/owner/tabs/LeakageTab.tsx` — date filters, icons, charts, table
- `app/src/features/owner/OwnerNearbyScreen.tsx` — map pin labels
- `app/src/features/messages/ChatScreen.tsx` — hover actions + reply + composer separation + reply display
- `app/package.json` — lucide-react

---

## 12. Reply Messages — Backend Support

**Problem:** The backend had no concept of reply messages. `sendMessage` only accepted `body`. The `Message` model had no `replyToMessageId` field. Neither the REST response nor SSE realtime events included reply metadata.

### What changed

**API (`api/`)** — `messages.model.ts`:
- `Message` schema gained `replyToMessageId: { type: ObjectId, ref: 'Message', default: null }`

**API (`api/`)** — `messages.controller.ts`:
- `sendSchema` now accepts `replyToMessageId?: string | null`
- `sendMessage`: saves `replyToMessageId`, fetches the replied-to message + its sender, returns `replyTo` populated in the response AND in the SSE `message.created` realtime event
- `getConversation`: batch-fetches all referenced `replyToMessageId` messages + their senders, populates `replyTo` on each message in the response

**App** — `api.ts`:
- `ApiChatMessage` gained `replyToMessageId?: string | null` and `replyTo?: ApiChatMessage | null`
- `sendMessage(id, body, replyToMessageId?)` passes the third param to the API

**App** — `ChatScreen.tsx`:
- Send order: `setReplyTo(null)` now fires AFTER `await sendMessage()` completes, not before
- Render uses triple fallback: `_replyTo` (inline from send) → `replyTo` (API response) → `replyToMessageId` lookup in local messages

### Files changed
- `api/src/features/messages/messages.model.ts`
- `api/src/features/messages/messages.controller.ts`
- `app/src/shared/lib/api.ts`
- `app/src/features/messages/ChatScreen.tsx`

---

## 13. Dev Infrastructure — User Re-seed & Quick Login Fix

**Problem:** After re-seeding users (`npm run db:seed:users`), the old `@example.com` emails in `TEST_CREDENTIALS.txt` no longer worked (randomuser.me generates new emails each run). The quick-login buttons on both LoginScreen (PWA) and LoginPage (web) referenced stale emails. The admin account password was also corrupt (wrong hash field + cost factor).

### What changed

- **Admin password reset** — fixed `passwordHash` field (was `password`) with correct bcrypt cost factor 12
- **Re-seeded all test users** via `SEED_COACHES=1 SEED_OWNERS=20 SEED_ORGANIZERS=30 SEED_PLAYERS=50 npm run db:seed:users`
- **Updated quick login** in both `app/LoginScreen.tsx` and `web/LoginPage.jsx` with current working emails
- **Renamed quick-login owner** to Oscar Walker (`037de3f0.gardner@example.com`) per user preference
- **Fixed Mari Sullivan's password** for the Oscar↔Mari dummy conversation

### Files changed
- `app/src/features/auth/LoginScreen.tsx`
- `web/src/features/auth/LoginPage.jsx`

---

## 14. Court Hours — Simplified Hour Pricing UX

**Problem:** The Hour Pricing section always showed editable time fields alongside the rate, even when the owner just wanted a single full-day rate. This was confusing — most owners use one rate for the entire day.

### What changed

**`WeeklyHoursEditor.tsx` — two-mode system:**

| Mode | Trigger | Time fields | Rate | Remove |
|---|---|---|---|---|
| **Simple** (default) | 1 pricing row | Read-only, mirror operating hours | Editable | Hidden |
| **Multi** | User clicks "Add hour pricing" | Editable with min/max bounds | Editable | ✕ on rows 2+ |

- Helper text in simple mode: *"Need different rates for different times? Click 'Add hour pricing' to split the operating hours."*
- Removing the last extra row returns to simple mode
- Rate field sizing: `shrink-0 w-12` → `flex-1 min-w-0` (proportional with time fields)
- All time & rate fields now use `border border-slate-300` (visible, was `border-[0.5px] border-[var(--hairline)]`)
- Time fields gain `onClick={openPicker}` → `showPicker()` for full-field clickability

### Files changed
- `app/src/features/owner/components/WeeklyHoursEditor.tsx`

---

## 15. Messages — Quick Fixes

- **Removed delete confirmation** — `window.confirm('Delete this message?')` removed; tapping own bubble deletes immediately
- **Dummy conversation** — 20-message Oscar Walker ↔ Mari Sullivan thread seeded for testing

### Files changed
- `app/src/features/messages/ChatScreen.tsx`

---

## 16. Messages — Reply Display Polish

**Problem:** After sending a reply, the sent message showed no indication of what it was replying to until the next full conversation reload. The reply metadata wasn't rendering immediately after send because `replyTo` was nulled before the API returned, and debug `console.log` calls were left in.

### What changed

**Send order fix:**
- `setReplyTo(null)` now fires AFTER `await sendMessage()` completes, so the new message's `replyTo` metadata is available at render time

**Reply preview in message list:**
- Sent reply renders as a compact right-aligned stack:
  - Small "You replied to {name}" label (`text-xs text-slate-500`)
  - Gray quoted bubble (`line-clamp-2 rounded-2xl bg-slate-200 px-3 py-2 text-sm`)
  - Blue message bubble below
- Received reply structure mirror-ready for when backend adds reply support
- Removed all reply debug `console.log` calls
- Delete confirmation kept intact

### Files changed
- `app/src/features/messages/ChatScreen.tsx`

---

## 17. Messages — Remove Tap-to-Delete on Own Bubble

**Problem:** Tapping your own blue message bubble opened a `window.confirm('Delete this message?')` dialog. This was the primary tap action on your own messages — easy to trigger accidentally, and delete is already available through the `...` menu.

### What changed

- Clicking your own blue message bubble no longer opens the delete alert
- Delete is still available only through `...` menu → **Unsend**

### Files changed
- `app/src/features/messages/ChatScreen.tsx`

---

## 18. Messages — Clickable Reply Previews (Scroll-to-Original)

**Problem:** The gray quoted reply bubble inside a sent message was purely visual — tapping it did nothing. Users couldn't jump back to see the original message being replied to, forcing manual scroll through potentially long conversations.

### What changed

- Reply preview bubbles are now **clickable**
- Tapping the gray quoted reply:
  1. Scrolls to the original message's position in the thread (`scrollIntoView({ behavior: 'smooth', block: 'center' })`)
  2. Briefly highlights the original message with a pulse animation (amber ring → fade over 2s)
- Uses the `replyToMessageId` to find the original message in the flatlist

### Files changed
- `app/src/features/messages/ChatScreen.tsx`

---

## 19. Messages — Sent/Seen Read Receipts

**Problem:** No way to know if your sent message had been read by the other person. Messages just sat there with no delivery or read status.

### What changed

**Checkmark indicators on sent bubbles:**
| State | Icon | Meaning |
|---|---|---|
| **Sent** | `✓` (single check, slate) | Message delivered to server |
| **Seen** | `✓✓` (double check, lime) | Other user has read the thread |

**Backend support:**
- `Message` model: new `readBy` array + `readAt` timestamps per reader
- `GET /messages/:conversationId/read` — marks the open thread as read by the current user
- SSE `message.read` realtime event — when user A reads, user B's bubble updates from Sent → Seen live
- `getConversation` now includes `readByOther` / `readAtByOther` per sent message

**Client behavior:**
- Opening a conversation auto-fires the read endpoint
- Incoming messages while the chat is open are marked read immediately
- Incoming `message.read` realtime event updates the sender's bubble without refresh

### Files changed
- `api/src/features/messages/messages.model.ts` — readBy, readAt fields
- `api/src/features/messages/messages.controller.ts` — read endpoint + readByOther population
- `api/src/features/messages/messages.routes.ts` — read route
- `api/src/shared/middleware/auth.ts` — route auth
- `app/src/shared/lib/api.ts` — ApiChatMessage read fields
- `app/src/features/messages/ChatScreen.tsx` — checkmark UI + auto-read + realtime listener

---

## 20. Messages — Active Status Indication (Presence)

**Problem:** No way to tell if the other person was online or recently active. You'd send a message into the void with no indication whether they were around to see it.

### What changed

**Presence infrastructure (`lastActiveAt`):**
- `User` model: new `lastActiveAt: Date` field
- `requireAuth` middleware: fire-and-forget `User.updateOne({ lastActiveAt: new Date() })` on every authenticated request — bumps the timestamp without blocking the response
- Returned in: `personView()` (chat participants), `searchPlayers()` (player search), `listConversations` (conversation list), `OwnerPlayerSuggestion` (organizer suggestions)

**Active dot on avatars:**
- Green dot (`bg-[var(--lime)]`) on the avatar's bottom-right corner when `lastActiveAt` is within 5 minutes
- Gray dot (`bg-[var(--muted)]`) when inactive
- Appears on: conversation list rows, player search results, organizer suggestions, chat screen avatar

**"Active now" subtitle in chat header:**
- Chat screen header shows `subtitle={active ? 'Active now' : 'Inactive'}` below the name
- Updates on every conversation open (fresh `lastActiveAt` from API)

**Active window:** 5 minutes — if `lastActiveAt` is within the last 5 minutes, the user is considered active.

### Files changed
- `api/src/features/auth/auth.model.ts` — `lastActiveAt` field on User
- `api/src/shared/middleware/auth.ts` — auto-bump lastActiveAt on every auth'd request
- `api/src/features/messages/messages.controller.ts` — include lastActiveAt in personView, listConversations, getConversation, startConversation
- `api/src/features/search/search.controller.ts` — include lastActiveAt in searchPlayers
- `app/src/shared/lib/api.ts` — lastActiveAt on ApiChatParticipant, ApiPlayer, OwnerPlayerSuggestion
- `app/src/features/messages/ChatScreen.tsx` — active dot on avatar + "Active now" subtitle
- `app/src/features/messages/ConversationsScreen.tsx` — active dot on all avatar rows

---

## 21. Conversations List — Preview Cleanup

**Problem:** Conversation previews showed raw notification-metadata prefixes like `"chat Kenneth Hernandez — Hey, are you free?"` instead of just the actual message `"Hey, are you free?"`. The `lastBody` stored on the conversation was polluted by notification routing prefixes.

### What changed

- `cleanPreview()` function strips known notification type prefixes (`chat`, `forum`, `message`, `alert`, `game_full`, `game_open`, `venue_membership_invite`, `booking_pending_approval`, etc.) plus the `SenderName — ` separator
- Only strips the `" — "` separator when a notification prefix was already removed — normal messages like `"Got it — see you there"` are left intact
- Tennis icon fixed: `"tennis"` → `"sports_tennis"` (valid Material Symbol name)

### Files changed
- `app/src/features/messages/ConversationsScreen.tsx`

---

## 22. Venue Detail — Fix Missing `viewerIsMember`

**Problem:** The "Join Membership" button never hid for logged-in members viewing a venue. `getVenue()` was called without `auth: true`, so the server saw every request as a guest and never populated `viewerIsMember` / `viewerMembershipTier`.

### What changed

- `getVenue(idOrSlug)` now passes `{ auth: true }` — the server can identify the viewer and correctly populate membership status
- One-line fix, zero UI changes needed

### Files changed
- `app/src/shared/lib/api.ts` — `getVenue()` now sends auth

---

## 23. Complete File Index — All Changes This Session

### App (PWA)
- `app/public/firebase-messaging-sw.js` — new: FCM service worker
- `app/src/shared/lib/firebase.ts` — new: lazy Firebase SDK init
- `app/src/shared/lib/push.ts` — dual-channel FCM+VAPID rewrite
- `app/src/shared/lib/api.ts` — FCM client + auto-pricing types + reply/read fields + lastActiveAt + getVenue auth fix
- `app/src/shared/styles/index.css` — `--field-border` token
- `app/src/shared/components/ui/Chart.tsx` — bar rounding + spacing
- `app/src/features/auth/LoginScreen.tsx` — quick login emails
- `app/src/features/messages/ChatScreen.tsx` — hover actions + reply + composer + reply display + clickable reply + read receipts + active status
- `app/src/features/messages/ConversationsScreen.tsx` — active dots + preview cleanup
- `app/src/features/owner/OwnerNearbyScreen.tsx` — map pin labels
- `app/src/features/owner/components/OwnerStat.tsx` — metric card design
- `app/src/features/owner/components/OwnerBookingRow.tsx` — booking card design
- `app/src/features/owner/components/WeeklyHoursEditor.tsx` — simplified hour pricing
- `app/src/features/owner/tabs/BookingsInboxTab.tsx` — list gap
- `app/src/features/owner/tabs/InsightsTab.tsx` — sub-tab scroll
- `app/src/features/owner/tabs/LeakageTab.tsx` — date filters, icons, charts, table
- `app/src/features/owner/tabs/SlotPricingTab.tsx` — AutoPricingToggle
- `app/src/features/owner/tabs/ListingEditorTab.tsx` — pricing UI cleanup
- `app/.env` — VITE_FCM_VAPID_KEY
- `app/package.json` — firebase + lucide-react

### API (Backend)
- `api/src/shared/lib/firebase.ts` — new: firebase-admin init + FCM send
- `api/src/shared/lib/push.ts` — FCM + VAPID parallel send
- `api/src/shared/middleware/auth.ts` — lastActiveAt auto-bump
- `api/src/features/auth/auth.model.ts` — lastActiveAt field
- `api/src/features/push/push.model.ts` — FcmToken model
- `api/src/features/push/push.controller.ts` — FCM subscribe/unsubscribe
- `api/src/features/push/push.routes.ts` — FCM routes
- `api/src/features/messages/messages.model.ts` — replyToMessageId field
- `api/src/features/messages/messages.controller.ts` — replyTo population + read endpoint + readByOther + lastActiveAt in personView
- `api/src/features/messages/messages.routes.ts` — read route
- `api/src/features/demand/demand.controller.ts` — runAutoDynamicPricing()
- `api/src/features/demand/demand.routes.ts` — auto-dynamic-pricing route
- `api/src/features/venues/venues.model.ts` — autoDynamicPricing fields
- `api/src/features/venues/venues.controller.ts` — update schema
- `api/src/features/search/search.controller.ts` — lastActiveAt in searchPlayers
- `api/src/features/root/root.controller.ts` — /lists updated
- `api/src/index.ts` — daily auto-pricing cron
- `api/.env` — FIREBASE_SERVICE_ACCOUNT_JSON
- `api/package.json` — firebase-admin

### Web
- `web/src/features/auth/LoginPage.jsx` — quick login emails

### Infrastructure
- PM2 restarted with `--update-env` for both services
- PM2 saved for reboot persistence
- `.gitignore` — removed `/api/` exclusion (now tracked in monorepo)
