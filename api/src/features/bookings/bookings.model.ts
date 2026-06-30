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
  // paymentDueAt) → 'confirmed' (paid) | 'cancelled'. Instant-book venues skip
  // straight to 'confirmed' at creation.
  status:             { type: String, default: 'pending_approval' },
  referenceCode:      { type: String, maxlength: 50 },
  paymentMethod:      { type: String, maxlength: 50 },
  paymentProofUrl:    String,
  // Deadline to pay once the owner approves a request-to-book (else it expires).
  paymentDueAt:       Date,
  // Card captured at request time so paying after approval is one tap. Masked
  // only (brand + last4) — never the full PAN/CVC; a real gateway tokenises.
  savedCard:          { brand: { type: String, maxlength: 20 }, last4: { type: String, maxlength: 4 } },
  cancellationReason: String,
  cancelledAt:        Date,
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
