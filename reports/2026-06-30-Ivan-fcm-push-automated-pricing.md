# Ivan Report — 2026-06-30: Push Notifications & Automated Dynamic Pricing

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
