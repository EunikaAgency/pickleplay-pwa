import { Schema, model } from 'mongoose';

const bookingSchema = new Schema({
  userId:             { type: Schema.Types.ObjectId, ref: 'User', required: true },
  bookingType:        { type: String, maxlength: 20 },
  venueId:            { type: Schema.Types.ObjectId, ref: 'Venue', required: true },
  courtId:            { type: Schema.Types.ObjectId, ref: 'Court' },
  // Half-court / split-court: 0-based sub-unit index. When set, this booking
  // occupies only that sub-unit of a splittable court (not the whole court).
  subUnitIndex:       Number,
  sessionId:          { type: Schema.Types.ObjectId, ref: 'OpenPlaySession' },
  eventId:            { type: Schema.Types.ObjectId, ref: 'Event' },
  tournamentId:       { type: Schema.Types.ObjectId, ref: 'Tournament' },
  coachServiceId:     { type: Schema.Types.ObjectId, ref: 'CoachService' },
  date:               { type: String, required: true },
  startTime:          String,
  endTime:            String,
  playerCount:        { type: Number, default: 1 },
  amount:             { type: Number, required: true },
  // 'pending_approval' (awaiting owner) → 'awaiting_payment' (approved; pay before
  // paymentDueAt) → 'confirmed' (paid) | 'cancelled'. In live/manual-GCash mode,
  // instant-book venues also use awaiting_payment; test mode and pay-at-venue
  // bookings can still confirm at creation.
  status:             { type: String, default: 'pending_approval' },
  referenceCode:      { type: String, maxlength: 50 },
  paymentMethod:      { type: String, maxlength: 50 },
  paymentProofUrl:    String,
  // Deadline to pay once the owner approves a request-to-book (else it expires).
  paymentDueAt:       Date,
  // When a `pending_approval` request auto-cancels because the owner never
  // answered. Set at creation by `bookingDeadlines.computeApprovalDeadline`.
  // NOT merely a display field: together with paymentDueAt it is the source of
  // truth for whether this booking still occupies its slot — the occupancy
  // queries compare it against `now` directly, so a lapsed request frees the
  // court even if the sweeper never runs. Absent on rows predating the feature,
  // which therefore never expire (see `blockingFilter`).
  approvalDeadline:   Date,
  // Which owner nudges have already gone out for this request ('50' | '80', at
  // those fractions of the approval window). Claimed atomically before sending so
  // restarts and multiple API instances can't double-notify.
  remindersSent:      { type: [String], default: undefined },
  // Card captured at request time so paying after approval is one tap. Masked
  // only (brand + last4) — never the full PAN/CVC; a real gateway tokenises.
  savedCard:          { brand: { type: String, maxlength: 20 }, last4: { type: String, maxlength: 4 } },
  cancellationReason: String,
  cancelledAt:        Date,
  // Why this booking's status is 'cancelled' — lets reports/UI tell an owner
  // rejection apart from a player cancellation WITHOUT a new top-level status
  // (which would break the many `$ne:'cancelled'` occupancy/revenue filters that
  // treat 'cancelled' as "dead / frees its slot / not counted"). Absent on
  // non-cancelled and legacy rows (see shared/db/backfill-cancellation-type.ts).
  //   owner_rejected   — owner declined a pending request-to-book
  //   owner_removed    — owner cancelled an already-live booking / recurring series
  //   player_cancelled — the booker cancelled their own booking
  //   system_expired   — auto-cancelled (approval/pay deadline lapsed, game released)
  cancellationType:   { type: String, enum: ['owner_rejected', 'player_cancelled', 'system_expired', 'owner_removed'], default: undefined },
  // Equipment rental add-on (V2): when true, equipmentRentalAmount was added to
  // the booking total at checkout.
  hasEquipmentRental:  Boolean,
  equipmentRentalAmount: Number,
  // Free-text note (player request, or front-desk remark on a manual booking).
  notes:               { type: String, maxlength: 500 },
  // ── Payment breakdown (deposit / full / pay-at-venue + service fee) ──
  // `amount` above stays the venue's price (court × hours + equipment) so revenue
  // analytics are unchanged. These split how the player pays it + the platform fee.
  // 7% platform service fee the player pays on top of `amount`.
  serviceFeeAmount:    Number,
  // How the player chose to pay: 'full' | 'deposit' | 'pay_at_venue'.
  paymentOption:       { type: String, maxlength: 20 },
  // Charged online now (full+fee, the deposit+fee, or 0 for pay-at-venue).
  amountPaid:          Number,
  // Still owed at the venue on arrival (0 when paid in full online).
  balanceDue:          Number,
  // Recurring series link: set on every generated occurrence to the primary
  // booking's _id, so a weekly/MWF series can be grouped or cancelled together.
  // Null on a one-off booking (and on the primary itself).
  recurrenceGroupId:   { type: Schema.Types.ObjectId, ref: 'Booking' },
  // ── Pricing audit trail ── which rate source resolved the amount + the breakdown
  // (populated by server-side validation on create; null for blocked/open-play).
  rateSource:          { type: String, maxlength: 20 },   // 'surge'|'timeBlock'|'holiday'|'weekend'|'subUnit'|'court'|'venue'|'manual'
  overrideId:          { type: Schema.Types.ObjectId, ref: 'SlotPriceOverride' },  // set when rateSource='surge'
  baseRate:            Number,    // resolved rate before member discount
  memberDiscountPercent: Number,  // 0–100
  // ── Owner-entered (off-platform) bookings: manual reservations + slot blocks ──
  // The staff/owner who created a manual or blocked booking (the platform `userId`
  // is set to them so the required ref is satisfied — they're not the customer).
  createdByUserId:     { type: Schema.Types.ObjectId, ref: 'User' },
  // The off-platform customer for a 'manual' booking (phone/walk-in — no account).
  customerName:        { type: String, maxlength: 120 },
  customerPhone:       { type: String, maxlength: 40 },
  // Where the manual booking came from: 'walk_in' | 'phone' | 'messenger' | 'instagram' | 'other'.
  bookingSource:       { type: String, maxlength: 20 },
  // Why a 'blocked' slot is unavailable (maintenance, private event, …).
  blockReason:         { type: String, maxlength: 200 },
  // ── Recurring bookings (weekly regulars / leagues) ── all the weekly instances
  // generated from one recurring rule share this id, so the series can be listed
  // and cancelled together. Null for one-off bookings.
  recurringId:         { type: Schema.Types.ObjectId, index: true },
}, { timestamps: true });

bookingSchema.index({ venueId: 1, date: 1 });
bookingSchema.index({ userId: 1 });
bookingSchema.index({ courtId: 1, date: 1, subUnitIndex: 1 });
// Drives the expiry sweeper and the reminder pass, both of which query
// outstanding requests by deadline.
bookingSchema.index({ status: 1, approvalDeadline: 1 });
// A1 — hard DB guard against overselling the exact same court-slot. Partial +
// unique so only CONFIRMED bookings on a real (non-pooled) court are constrained:
// two near-simultaneous instant-books on the same court/date/start/sub-unit can't
// both persist — the loser hits E11000, which the central handler maps to 409.
// (Overlap conflicts across different start times are still caught by
// findSlotConflict; this closes the exact-slot double-tap race.)
bookingSchema.index(
  { courtId: 1, date: 1, startTime: 1, subUnitIndex: 1 },
  { unique: true, partialFilterExpression: { status: 'confirmed', courtId: { $type: 'objectId' } } },
);

export const Booking = model('Booking', bookingSchema);

// ── Booking modification audit log ─────────────────────────────────────
// Every date/time/court change is recorded so owners and players can see the
// history, and price deltas are tracked for financial reconciliation.
const bookingModificationSchema = new Schema({
  bookingId:    { type: Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
  userId:       { type: Schema.Types.ObjectId, ref: 'User', required: true },
  // Old→new for each changed field. Example: { date: ['2026-06-26','2026-06-27'], startTime: ['10:00','11:00'] }
  changes:      { type: Schema.Types.Mixed, required: true },
  // Financial impact: positive = player owes more, negative = credit, 0 = no change.
  priceDelta:   { type: Number, default: 0 },
}, { timestamps: true });

export const BookingModification = model('BookingModification', bookingModificationSchema);

// ── Waitlist for fully-booked time slots ───────────────────────────────
// When every court at a venue is taken for a slot, a player can join the
// waitlist. On cancellation, the first entry is promoted and notified.
const waitlistEntrySchema = new Schema({
  userId:       { type: Schema.Types.ObjectId, ref: 'User', required: true },
  venueId:      { type: Schema.Types.ObjectId, ref: 'Venue', required: true },
  courtId:      { type: Schema.Types.ObjectId, ref: 'Court' },  // null = any court at venue
  date:         { type: String, required: true },                // YYYY-MM-DD
  startTime:    { type: String, required: true },                // "HH:MM"
  endTime:      { type: String, required: true },
  playerCount:  { type: Number, default: 1 },
  // 'waiting' | 'promoted' | 'claimed' | 'expired' | 'cancelled'
  status:       { type: String, default: 'waiting' },
  promotedAt:   Date,
  claimExpiresAt: Date,
}, { timestamps: true });

waitlistEntrySchema.index({ venueId: 1, date: 1, startTime: 1 });
waitlistEntrySchema.index({ userId: 1, status: 1 });

export const WaitlistEntry = model('WaitlistEntry', waitlistEntrySchema);
