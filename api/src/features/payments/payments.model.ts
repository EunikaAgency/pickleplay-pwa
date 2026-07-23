import { Schema, model } from 'mongoose';

const paymentSchema = new Schema({
  bookingId:  { type: Schema.Types.ObjectId, ref: 'Booking' },
  // What this payment bought. Every Payment used to be a court booking, so an
  // absent `purpose` reads as 'booking' — partner (coach/organizer)
  // subscriptions are the first non-booking charge on the platform.
  purpose:    { type: String, enum: ['booking', 'partner_subscription'], default: 'booking' },
  subscriptionId: { type: Schema.Types.ObjectId, ref: 'PartnerSubscription' },
  userId:     { type: Schema.Types.ObjectId, ref: 'User', required: true },
  amount:     { type: Number, required: true },
  currency:   { type: String, default: 'PHP' },
  method:     { type: String, maxlength: 50 },
  provider:   { type: String, maxlength: 50 },
  providerRef:{ type: String, maxlength: 255 },
  proofUrl:   String,
  // 'pending' → 'completed' | 'failed', then optionally 'refund_pending' → 'refunded'.
  // 'refund_pending' is the state a live-mode refund sits in between the player
  // cancelling and the money actually leaving the account: before it existed a
  // cancelled booking's payment stayed 'completed' forever, so the app said
  // "processing" with nothing behind it and no way to ever settle it.
  status:     { type: String, default: 'pending' },
  // ── Refund settlement ── set when a cancellation (or a downward reschedule)
  // owes the player money back. `refundAmount` is what they get, `refundFeeAmount`
  // the transaction fee kept under the 3-day-window policy.
  refundAmount:     Number,
  refundFeeAmount:  Number,
  refundRequestedAt: Date,
  refundedAt:        Date,
  refundReference:  { type: String, maxlength: 120 },
  notes:      String,
}, { timestamps: true });

// The refund queue: every payment still owing money back, oldest first.
paymentSchema.index({ status: 1, refundRequestedAt: 1 });

export const Payment = model('Payment', paymentSchema);

const venuePricingSchema = new Schema({
  pricingId:       { type: String, maxlength: 120, index: true },
  venueId:         { type: Schema.Types.ObjectId, ref: 'Venue', required: true, index: true },
  pricingModel:    { type: String, required: true, maxlength: 30 },
  label:           { type: String, required: true, maxlength: 200 },
  price:           Number,
  currency:        { type: String, default: 'PHP' },
  days:            [String],
  timeStart:       String,
  timeEnd:         String,
  durationMinutes: Number,
  courtId:         { type: Schema.Types.ObjectId, ref: 'Court' },
  tierAudience:    { type: String, maxlength: 20 },
  groupSizeMin:    Number,
  groupSizeMax:    Number,
  sourceUrl:       String,
  notes:           String,
  _importId:       { type: String, index: true },
}, { timestamps: true });

venuePricingSchema.index({ _importId: 1 });
venuePricingSchema.index({ pricingId: 1 });

export const VenuePricing = model('VenuePricing', venuePricingSchema);

// ── Official receipts (BIR-compliant) ───────────────────────────────
// Auto-generated when a booking is confirmed. Sequential OR numbering per venue.
// Structured data for print/PDF export — amounts include the 12% VAT breakdown.
const officialReceiptSchema = new Schema({
  receiptNumber: { type: String, required: true, unique: true },  // OR-{venueCode}-{seq}
  bookingId:     { type: Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
  paymentId:     { type: Schema.Types.ObjectId, ref: 'Payment' },
  userId:        { type: Schema.Types.ObjectId, ref: 'User', required: true },
  venueId:       { type: Schema.Types.ObjectId, ref: 'Venue', required: true },
  payorName:     { type: String, maxlength: 200 },
  payorTIN:      { type: String, maxlength: 20 },
  payorAddress:  { type: String, maxlength: 300 },
  amount:        { type: Number, required: true },       // gross total (player paid)
  vatAmount:     { type: Number, default: 0 },           // 12% VAT portion
  vatRate:       { type: Number, default: 12 },
  netAmount:     { type: Number, default: 0 },           // amount - vatAmount
  discountAmount: { type: Number, default: 0 },
  discountCategory: { type: String, enum: ['senior', 'pwd'] },
  discountIdNumber: { type: String, maxlength: 80 },
  vatExempt:     { type: Boolean, default: false },
  description:   { type: String, maxlength: 500 },
  status:        { type: String, default: 'draft' },     // draft | issued | voided
  issuedAt:      Date,
  voidedAt:      Date,
  voidReason:    { type: String, maxlength: 300 },
}, { timestamps: true });

officialReceiptSchema.index({ venueId: 1, receiptNumber: 1 });
officialReceiptSchema.index({ userId: 1, createdAt: -1 });

export const OfficialReceipt = model('OfficialReceipt', officialReceiptSchema);

// Atomic auto-increment counter for receipt numbers per venue.
const receiptCounterSchema = new Schema({
  venueId:  { type: Schema.Types.ObjectId, ref: 'Venue', required: true, unique: true },
  seq:      { type: Number, default: 1 },
});

export const ReceiptCounter = model('ReceiptCounter', receiptCounterSchema);

// ── Settlement / payout ledger ──────────────────────────────────────
// Tracks what the platform owes each venue owner from completed bookings.
// Money movement is manual/off-platform for now, matching test-mode payments.
const settlementSchema = new Schema({
  settlementRef:  { type: String, required: true, unique: true },  // SET-{year}-{seq}
  venueId:        { type: Schema.Types.ObjectId, ref: 'Venue', required: true },
  ownerUserId:    { type: Schema.Types.ObjectId, ref: 'User', required: true },
  periodStart:    { type: String, required: true },   // YYYY-MM-DD
  periodEnd:      { type: String, required: true },   // YYYY-MM-DD
  totalBookings:  { type: Number, default: 0 },
  grossRevenue:   { type: Number, default: 0 },       // sum of venue subtotals
  platformFees:   { type: Number, default: 0 },       // sum of serviceFeeAmount
  netPayout:      { type: Number, default: 0 },       // gross - fees
  status:         { type: String, default: 'draft' }, // draft | pending | processing | paid | disputed
  payoutMethod:   { type: String, maxlength: 50 },    // bank_transfer | gcash | maya | other
  payoutRef:      { type: String, maxlength: 255 },   // external reference
  notes:          String,
  paidAt:         Date,
}, { timestamps: true });

settlementSchema.index({ venueId: 1, periodStart: 1, periodEnd: 1 }, { unique: true });

export const Settlement = model('Settlement', settlementSchema);

// Per-booking breakdown within a settlement.
const settlementLineItemSchema = new Schema({
  settlementId: { type: Schema.Types.ObjectId, ref: 'Settlement', required: true },
  bookingId:    { type: Schema.Types.ObjectId, ref: 'Booking', required: true },
  amount:       { type: Number, required: true },      // venue subtotal
  serviceFee:   { type: Number, default: 0 },          // platform's cut
  discountAmount: { type: Number, default: 0 },
  paymentId:    { type: Schema.Types.ObjectId, ref: 'Payment' },
});

settlementLineItemSchema.index({ settlementId: 1 });

export const SettlementLineItem = model('SettlementLineItem', settlementLineItemSchema);

// Owner's bank/e-wallet details for payouts.
const ownerPayoutMethodSchema = new Schema({
  venueId:       { type: Schema.Types.ObjectId, ref: 'Venue', required: true },
  method:        { type: String, required: true, enum: ['bank_transfer', 'gcash', 'maya', 'other'] },
  accountName:   { type: String, required: true, maxlength: 200 },
  accountNumber: { type: String, required: true, maxlength: 100 },
  bankName:      { type: String, maxlength: 200 },
  isDefault:     { type: Boolean, default: false },
}, { timestamps: true });

ownerPayoutMethodSchema.index({ venueId: 1 });

export const OwnerPayoutMethod = model('OwnerPayoutMethod', ownerPayoutMethodSchema);
