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
  updatedBy:       { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

export const AppSettings = model('AppSettings', appSettingsSchema);
