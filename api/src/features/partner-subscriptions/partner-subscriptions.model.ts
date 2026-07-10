import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';

/**
 * A PAID, PLATFORM-LEVEL subscription that unlocks the coach (or organizer)
 * partner surfaces. Distinct from:
 *  - `Subscription` (features/subscriptions) — a newsletter mailing list.
 *  - `VenueSubscription` (features/venues) — a player's membership at ONE venue.
 *
 * Subscribing does NOT make someone a coach at a venue. It grants the global
 * `coach` role (so they may create a coach profile and apply to venues); the
 * venue owner still approves each CoachApplication, which is what mints the
 * venue-scoped UserRole rows the profile badges read.
 */
export type PartnerPlan = 'coach' | 'organizer';
export type PartnerSubscriptionStatus = 'active' | 'expired' | 'cancelled';

export interface IPartnerSubscription {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  plan: PartnerPlan;
  status: PartnerSubscriptionStatus;
  priceAmount: number;
  currency: string;
  startedAt: Date;
  expiresAt: Date;
  autoRenew: boolean;
  paymentId?: Types.ObjectId;
  cancelledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const partnerSubscriptionSchema = new Schema({
  userId:      { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  plan:        { type: String, enum: ['coach', 'organizer'], required: true },
  status:      { type: String, enum: ['active', 'expired', 'cancelled'], default: 'active' },
  priceAmount: { type: Number, required: true },
  currency:    { type: String, default: 'PHP', maxlength: 10 },
  startedAt:   { type: Date, default: () => new Date() },
  expiresAt:   { type: Date, required: true },
  autoRenew:   { type: Boolean, default: false },
  paymentId:   { type: Schema.Types.ObjectId, ref: 'Payment' },
  cancelledAt: Date,
}, { timestamps: true });

// The hot path: "does this user hold a live subscription to this plan?"
partnerSubscriptionSchema.index({ userId: 1, plan: 1, status: 1 });
// Lazy-expiry sweeps read by deadline.
partnerSubscriptionSchema.index({ expiresAt: 1 });

export const PartnerSubscription = model('PartnerSubscription', partnerSubscriptionSchema);

/**
 * Flip any `active` row whose deadline has passed to `expired`. Called on read
 * (there is no cron), mirroring how bookings lazily expire overdue payment
 * holds. Scoped to one user so a profile read never sweeps the whole table.
 */
export async function expireLapsedSubscriptions(userId: Types.ObjectId | string): Promise<void> {
  await PartnerSubscription.updateMany(
    { userId, status: 'active', expiresAt: { $lte: new Date() } },
    { status: 'expired' },
  );
}

/** Is this user currently subscribed to `plan`? Expires lapsed rows first, so
 *  a stale `active` row can never wave someone through. */
export async function hasActivePartnerSubscription(
  userId: Types.ObjectId | string,
  plan: PartnerPlan,
): Promise<boolean> {
  await expireLapsedSubscriptions(userId);
  const row = await PartnerSubscription.exists({
    userId, plan, status: 'active', expiresAt: { $gt: new Date() },
  });
  return !!row;
}

/** The user ids holding a live subscription to `plan`, out of `userIds`.
 *  Batched so a coach list doesn't issue one query per coach. */
export async function activeSubscriberIds(
  userIds: (Types.ObjectId | string)[],
  plan: PartnerPlan,
): Promise<Set<string>> {
  if (!userIds.length) return new Set();
  const rows = await PartnerSubscription.find({
    userId: { $in: userIds }, plan, status: 'active', expiresAt: { $gt: new Date() },
  }).select('userId').lean();
  return new Set((rows as any[]).map((r) => r.userId?.toString()).filter(Boolean));
}
