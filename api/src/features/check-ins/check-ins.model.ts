import { Schema, model } from 'mongoose';

// A check-in = a player marking themselves present at a venue ("I'm here now").
// Presence is time-bounded: a check-in counts as active for a few hours, after
// which it's stale (see ACTIVE_MS in the controller). One row per user+venue —
// re-checking-in just refreshes `lastSeenAt`.
const checkInSchema = new Schema({
  userId:     { type: Schema.Types.ObjectId, ref: 'User', required: true },
  venueId:    { type: Schema.Types.ObjectId, ref: 'Venue', required: true },
  lastSeenAt: { type: Date, default: Date.now },
}, { timestamps: true });

checkInSchema.index({ userId: 1, venueId: 1 }, { unique: true });
checkInSchema.index({ venueId: 1, lastSeenAt: -1 });

export const CheckIn = model('CheckIn', checkInSchema);
