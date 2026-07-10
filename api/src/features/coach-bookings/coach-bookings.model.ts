import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';

/**
 * A player's request for a coaching session. Deliberately NOT the court
 * `Booking` model: that one hard-requires a venue + court + slot-conflict
 * guard against the venue's court pool, whereas a coaching session is a
 * request against a *person's* time and may not involve a court at all.
 *
 * Lifecycle: player creates 'pending' → coach accepts ('confirmed') or
 * declines ('declined'); either side may 'cancelled' a confirmed session.
 */
export type CoachBookingStatus = 'pending' | 'confirmed' | 'declined' | 'cancelled' | 'completed';

export interface ICoachBooking {
  _id: Types.ObjectId;
  coachId: Types.ObjectId;
  coachUserId?: Types.ObjectId;
  playerUserId: Types.ObjectId;
  serviceId?: Types.ObjectId;
  venueId?: Types.ObjectId;
  date: string;
  startTime: string;
  endTime?: string;
  durationMinutes?: number;
  amount: number;
  currency: string;
  status: CoachBookingStatus;
  notes?: string;
  declineReason?: string;
  paymentId?: Types.ObjectId;
  decidedAt?: Date;
  cancelledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const coachBookingSchema = new Schema({
  coachId:      { type: Schema.Types.ObjectId, ref: 'Coach', required: true, index: true },
  // Denormalised so the coach's inbox is a single indexed lookup by account.
  coachUserId:  { type: Schema.Types.ObjectId, ref: 'User', index: true },
  playerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  serviceId:    { type: Schema.Types.ObjectId, ref: 'CoachService' },
  venueId:      { type: Schema.Types.ObjectId, ref: 'Venue' },
  date:         { type: String, required: true, maxlength: 10 },  // YYYY-MM-DD
  startTime:    { type: String, required: true, maxlength: 5 },   // HH:mm
  endTime:      { type: String, maxlength: 5 },
  durationMinutes: Number,
  amount:       { type: Number, required: true, min: 0 },
  currency:     { type: String, default: 'PHP', maxlength: 10 },
  status:       { type: String, enum: ['pending', 'confirmed', 'declined', 'cancelled', 'completed'], default: 'pending' },
  notes:        { type: String, maxlength: 2000 },
  declineReason:{ type: String, maxlength: 500 },
  paymentId:    { type: Schema.Types.ObjectId, ref: 'Payment' },
  decidedAt:    Date,
  cancelledAt:  Date,
}, { timestamps: true });

// Coach inbox + player list, both newest-first.
coachBookingSchema.index({ coachUserId: 1, createdAt: -1 });
coachBookingSchema.index({ playerUserId: 1, createdAt: -1 });
// Double-book guard: one live session per coach per exact slot.
coachBookingSchema.index({ coachId: 1, date: 1, startTime: 1, status: 1 });

export const CoachBooking = model('CoachBooking', coachBookingSchema);
