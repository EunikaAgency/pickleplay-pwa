import { Schema, model } from 'mongoose';

// Global, single-document app configuration. We keep one row keyed `global`
// (a classic singleton) rather than a row-per-key table — there's currently
// just one setting and reads happen on every checkout, so a single upserted
// document is the simplest thing that works.
const appSettingsSchema = new Schema({
  key:             { type: String, required: true, unique: true, default: 'global' },
  // When true, checkout runs in demo mode: no real charge, bookings auto-confirm.
  paymentTestMode: { type: Boolean, default: true },
  // Platform service fee charged to the player on top of the venue's price, shown
  // as a line item at checkout. A single global percentage (the meeting's "7%").
  serviceFeePercent: { type: Number, default: 7, min: 0, max: 100 },
  // Payment-gateway transaction fee charged to the PLAYER at checkout (tax +
  // processing). Default 0 until PayMongo is wired — the admin sets the real
  // number here, never hard-coded, so the demo never shows a guessed fee.
  transactionFeePercent: { type: Number, default: 0, min: 0, max: 100 },
  // BCC a copy of every transactional email to a monitoring address (e.g. info@).
  emailBccEnabled: { type: Boolean, default: false },
  emailBccAddress: { type: String, default: 'info@eunika.agency', maxlength: 255 },
  // Pricing mode: 'start' = rate based on booking start time only (default);
  // 'blend' = resolve per clock hour for bookings that cross override boundaries.
  pricingMode:    { type: String, enum: ['start', 'blend'], default: 'start' },
  // Price of the paid partner subscriptions that unlock the coach / organizer
  // surfaces, and how long one term runs. Configured here (not hard-coded) so
  // the price can move without a deploy.
  coachSubscriptionPrice:     { type: Number, default: 499, min: 0 },
  organizerSubscriptionPrice: { type: Number, default: 999, min: 0 },
  partnerSubscriptionDays:    { type: Number, default: 30, min: 1, max: 3650 },
  // Player-capability switches. Both ship ON — the decision was to launch the
  // capability and keep a kill switch, rather than gate it behind more discussion.
  // Turning either off is a hard gate: the server rejects the action and the app
  // hides the control (it reads these from the public GET /settings).
  //
  // Can a player without an organizer subscription create a 'public' (event/
  // competitive-format) game? Off → only subscribed organizers can.
  allowNonOrganizerEvents:    { type: Boolean, default: true },
  // Can a host mark their own lobby "requires my approval to join"? Off → new and
  // edited games are forced open-join. Existing queues are left alone: a global
  // switch must not silently drop players who are already waiting.
  allowPlayerApprovalLobbies: { type: Boolean, default: true },
  updatedBy:       { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

export const AppSettings = model('AppSettings', appSettingsSchema);
