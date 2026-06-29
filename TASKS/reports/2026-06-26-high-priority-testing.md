# High-Priority Features — Testing Guide

**Date:** 2026-06-26
**Scope:** 7 post-demo near-term features (PWA + API)
**Status:** Implemented, not yet browser-tested

---

## Prerequisites

```sh
# Ensure the API is running
pm2 status                    # pickleballer-api should be online on 9002

# Start the PWA dev server
cd /var/public/pickleplay/app && npm run dev   # → http://localhost:9000

# Quick-login test credentials (from web/TEST_CREDENTIALS.txt)
# Owner:  owner@test.com / password123
# Player: player@test.com / password123
# Staff:  (create one via Owner → Profile → Staff)
```

---

## 1. Day-Based Pricing (weekend / weekend / holiday)

**What to test:** Weekend and holiday rates are applied at checkout.

### Setup (as owner)
1. Sign in as an owner → tap a venue → **Listing** tab
2. Scroll to **"Day-based pricing"** section
3. Set **Weekend rate** = 500 (₱/hr)
4. Set **Holiday rate** = 800 (₱/hr)
5. In the **Holiday dates** field, pick a date (e.g. a Monday) and tap **Add**
6. Scroll down and tap **Save**

### Verify (as player)
1. Open the venue's public page (tap the ↗ preview icon)
2. Tap **Book** → pick the **holiday date** you set
3. In the review step, the Rate line should show **"Holiday rate"** and ₱800/hr
4. Go back, pick a **Saturday/Sunday** → the Rate should show **"Weekend rate"** and ₱500/hr
5. Pick a regular weekday → the Rate should show the normal court/venue rate

### API check
```sh
# Verify the venue has the fields
curl -s http://localhost:9002/api/v1/venues/THE_VENUE_SLUG | jq '.data | {weekendPrice, holidayPrice, holidayDates}'
```

---

## 2. Member Pricing

**What to test:** Members get a discount at checkout.

### Setup (as owner)
1. Sign in as an owner → tap a venue → **Listing** tab
2. Scroll to **"Member pricing"** section
3. Set **Member discount** = 20 (%)
4. Tap **Save**

### Verify (as player)
1. Sign in as a **player** (different account)
2. Go to the venue's public page
3. Tap **"Join Membership"** → pick a plan → confirm
4. Tap **Book** → pick date/time → go to review
5. You should see a green **"Member rate — 20% off applied"** banner
6. The rate should be 20% lower than the normal rate

### API check
```sh
# Verify the player is a member
curl -s http://localhost:9002/api/v1/venues/THE_VENUE_SLUG \
  -H "Authorization: Bearer PLAYER_TOKEN" | jq '.data.viewerIsMember'
# Should be: true
```

---

## 3. Manual Surge Adjustment

**What to test:** Owner can raise/lower a specific time slot's rate.

### Setup (as owner)
1. Sign in as an owner → tap a venue → **Slot pricing** tab
2. Tap **Add override**
3. Pick a date (tomorrow), start time (e.g. 18:00), end time (20:00)
4. Set rate = 1200 (₱/hr) — much higher than normal
5. Add a note: "Friday night surge"
6. Save

### Verify (as player)
1. Sign in as a player → go to the venue's public page
2. Tap **Book** → pick the same date + 18:00 start time
3. In the review step, the Rate should show **"Adjusted rate"** and ₱1200/hr
4. Pick a different time on the same date → rate should be normal (no surge)

### API check
```sh
curl -s http://localhost:9002/api/v1/venues/THE_VENUE_ID/slot-overrides?date=TOMORROW \
  -H "Authorization: Bearer OWNER_TOKEN" | jq '.'
```

---

## 4. Per-Player Surcharge

**What to test:** Extra players above the threshold cost more.

### Setup (as owner)
1. Sign in as an owner → tap a venue → **Listing** tab
2. Scroll to **"Per-player surcharge"** section
3. Set **Fee per extra player** = 100 (₱)
4. Set **Players included** = 2
5. Tap **Save**

### Verify (as player)
1. Sign in as a player → go to the venue → tap **Book**
2. Set the player count to **4** (tap + button)
3. Go to review step
4. You should see an **"Extra players"** line showing "2 × ₱100" = ₱200
5. Change player count to **1** → the surcharge line should disappear
6. Change to **6** → surcharge should be "4 × ₱100" = ₱400

---

## 5. Recurring Bookings

**What to test:** Owner can create a weekly series.

### Verify (as owner)
1. Sign in as an owner → tap **Front desk** (from the owner home quick actions)
2. Pick a venue → tap **Add booking**
3. Fill in: court, date (next Monday), start/end time
4. Check **"Repeat weekly"** → set to **4** weeks
5. Fill in customer name (optional: "Weekly regular test")
6. Tap **Create 4-week series**
7. You should see a success summary: "4 weeks booked · 0 skipped"
8. Below the schedule, the **"Recurring bookings"** section should list the series
9. Tap **Cancel** on the series → confirm → it should disappear

### API check
```sh
curl -s http://localhost:9002/api/v1/venues/THE_VENUE_ID/recurring-bookings \
  -H "Authorization: Bearer OWNER_TOKEN" | jq '.'
```

---

## 6. Demand Data Capture

**What to test:** Demand events are logged (fire-and-forget, best-effort).

### Verify (view event)
1. Open the browser DevTools → **Network** tab
2. Navigate to any venue's public page
3. You should see a `POST` to `/api/v1/demand/events` with `type: "venue_view"`
4. Go through the booking flow and submit
5. You should see two more events: `type: "booking_attempt"` and `type: "booking_completed"`

### API check
```sh
# View demand data for a venue (owner/staff only)
curl -s http://localhost:9002/api/v1/demand/venues/THE_VENUE_ID \
  -H "Authorization: Bearer OWNER_TOKEN" | jq '.'
```

---

## 7. Staff Role-Tailored Views

**What to test:** Front-desk staff see a reduced tab set.

### Setup (as owner)
1. Sign in as an owner → Profile → **Staff** → **Create staff account**
2. Fill in name, email, password → create
3. Open the new staff member → add them to a venue as **Front desk** role
   (or verify the default: if they already have venue access, the venue's Staff tab controls their per-venue role)

### Verify (as staff)
1. Sign out → sign in as the new staff member
2. Go to **My venues** → tap a venue
3. The header should show **"Front desk"** badge (if role is front_desk)
4. The tab strip should show only: **Overview, Insights, Bookings, Membership, Reviews**
5. These tabs should be **hidden**: Listing, Location, Courts, Slot pricing, Closures, FAQs, Photos, Staff
6. Tap **Bookings** → should work normally (see bookings, approve/decline)
7. Try to navigate directly to a hidden tab by URL (e.g. add `?tab=listing`) → the tab should not render

### API check
```sh
# Sign in as staff, then:
curl -s http://localhost:9002/api/v1/venues/THE_VENUE_ID \
  -H "Authorization: Bearer STAFF_TOKEN" | jq '.data.viewerStaffRole'
# Should be: "front_desk" or "manager"
```

---

## Bonus: Payment Options

These were shipped earlier today but worth verifying alongside the pricing features.

1. As **owner**: Listing tab → **Payment options at checkout** → enable Deposit + Pay at venue
2. As **player**: Book a court at that venue → in the review step, you should see 3 payment options as styled radio cards
3. Select **Deposit** → verify the "Pay now" amount is the deposit % and "Balance at the venue" is shown
4. Select **Pay at venue** → verify no card form appears, CTA says "Reserve court"

---

## Things NOT covered by these tests

- **Search demand events** — currently not wired from the nearby search (search events are logged on the nearby screen if implemented later)
- **Cancellation demand events** — logged server-side in the bookings controller (no app-side call needed)
- **Empty-slot demand events** — logged server-side when a booking attempt hits a clash
- **Monday–Friday weekday rate** — there's no separate weekday tier; the base rate IS the weekday rate (weekend/holiday are the overrides)
