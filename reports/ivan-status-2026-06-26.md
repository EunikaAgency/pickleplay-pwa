# Ivan's Status Report — June 26, 2026

## Completed: Medium/Strategic Features (API)

All 6 medium-priority items from the master requirements sheet have their
backend (API) implementation complete. The app-side UI wiring for features 3–6
is the next phase.

### 1. In-App Owner↔Player Messaging ✅ (API + App)
- Venue-scoped conversations: `contextType`/`contextId` on the Conversation model
- `GET /messages/venue/:venueId` — find-or-create a thread between player and venue owner
- Auto intro message: "Hi, I have a question about {venue name}."
- "Message venue" button on CourtDetailsScreen (Contact section)
- Venue context labels in conversation list and chat header

### 2. Cash Booking Leakage Mitigation ✅ (API + App)
- 3 new demand event types: `checkout_started`, `checkout_abandoned`, `booking_link_shared`
- `GET /demand/venues/:id/leakage` — owner leakage report with funnel + daily timeseries
- LeakageTab in owner venue console (funnel bar chart, daily breakdown, KPI cards)
- Demand events wired in BookCourtScreen (checkout steps) and BookingLinkShare (share/copy)
- Fixed pre-existing TS errors in demand.controller.ts

### 3. Booking Modification ✅ (API)
- `BookingModification` audit model (bookingId, userId, changes, priceDelta)
- `PATCH /bookings/:id/modify` — player-scoped; accepts date/startTime/endTime/courtId changes
- Re-checks slot availability via `findSlotConflict()`
- Max 3 modifications per booking; rejects past/cancelled bookings
- Modification audit log tracks old→new values

### 4. Waitlist System ✅ (API)
- `WaitlistEntry` model (userId, venueId, courtId, date, startTime, endTime, playerCount, status)
- Status flow: waiting → promoted → claimed | expired | cancelled
- `POST /waitlist` join, `GET /waitlist/mine`, `DELETE /waitlist/:id` leave, `POST /waitlist/:id/claim`
- Auto-promotion on booking cancellation: first waitlisted player gets promoted + push notified
- 2-hour claim window; expired promotions cascade to next in line

### 5. BIR-Compliant Official Receipts ✅ (API)
- `OfficialReceipt` model with sequential OR numbering per venue (OR-{code}-{year}-{seq})
- `ReceiptCounter` for atomic auto-increment
- Auto-generates draft receipt on booking confirmation (12% VAT breakdown)
- Player endpoints: `GET /receipts/mine`, `GET /receipts/:id`
- Owner endpoints: `GET /venues/:id/receipts`, `PATCH /receipts/:id` (issue/void, payor info)

### 6. Payout Schedule & Reconciliation ✅ (API)
- `Settlement` model (settlementRef, venueId, periodStart/End, grossRevenue, platformFees, netPayout, status)
- `SettlementLineItem` per-booking breakdown
- `OwnerPayoutMethod` model (bank_transfer/gcash/maya/other)
- Admin: `POST /admin/settlements/generate`, `GET /admin/settlements`, `PATCH /admin/settlements/:id`
- Owner: `GET /owner/settlements`, `GET /owner/settlements/balance`, payout methods CRUD

## Remaining Work

- **App UI** for features 3–6: ModifyBookingSheet, waitlist UI in BookCourtScreen/MyBookings, ReceiptScreen/ReceiptsScreen, OwnerPayoutsScreen/AdminSettlementsScreen
- **Permissions**: `owner.finance.view` and `admin.finance.manage` need syncing across api/app/web
- **Documentation**: `/lists` endpoint catalogue, FILEMAPs, testing
- **Testing**: API curl verification + Playwright browser tests

## New Files Created

### API
- `api/src/features/waitlist/waitlist.controller.ts`
- `api/src/features/waitlist/waitlist.routes.ts`

### App
- `app/src/features/owner/tabs/LeakageTab.tsx`

### Modified Files (key)
- `api/src/features/messages/messages.model.ts` — +contextType/contextId
- `api/src/features/messages/messages.controller.ts` — +getVenueConversation
- `api/src/features/messages/messages.routes.ts` — +venue route
- `api/src/features/demand/demand.model.ts` — +3 event types
- `api/src/features/demand/demand.controller.ts` — +leakage report, fixed TS errors
- `api/src/features/demand/demand.routes.ts` — +leakage route
- `api/src/features/bookings/bookings.model.ts` — +BookingModification, +WaitlistEntry
- `api/src/features/bookings/bookings.controller.ts` — +modifyBooking, waitlist promotion on cancel
- `api/src/features/bookings/bookings.routes.ts` — +modify route
- `api/src/features/payments/payments.model.ts` — +OfficialReceipt, +ReceiptCounter, +Settlement, +SettlementLineItem, +OwnerPayoutMethod
- `api/src/features/payments/payments.controller.ts` — +receipt CRUD, +settlement CRUD, +payout methods
- `api/src/features/payments/payments.routes.ts` — +receipt/settlement/owner routes
- `api/src/routes/index.ts` — +waitlist routes
- `app/src/shared/lib/api.ts` — +types and client functions for all features
- `app/src/features/venues/CourtDetailsScreen.tsx` — +"Message venue" button
- `app/src/features/messages/ConversationsScreen.tsx` — venue context labels
- `app/src/features/messages/ChatScreen.tsx` — venue context in header
- `app/src/features/bookings/BookCourtScreen.tsx` — demand events for checkout steps
- `app/src/features/owner/components/BookingLinkShare.tsx` — demand events on share
- `app/src/features/owner/OwnerVenueScreen.tsx` — +leakage tab
- `web/src/features/marketing/RoadmapPage.jsx` — updated changelog + date
- `TASKS/task.md` — marked all 6 medium items done
