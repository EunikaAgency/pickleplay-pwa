import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';
import { UserRole } from '../auth/auth.model.js';

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
export type PartnerSubscriptionStatus = 'pending' | 'active' | 'expired' | 'cancelled';

export interface IPartnerSubscription {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  plan: PartnerPlan;
  status: PartnerSubscriptionStatus;
  priceAmount: number;
  currency: string;
  tierKey?: string;
  durationDays?: number;
  startedAt?: Date;
  expiresAt?: Date;
  autoRenew: boolean;
  /** Cancellation is scheduled, not immediate: the coach keeps access (and the
   *  role) until `expiresAt`, then lapses. */
  cancelAtPeriodEnd: boolean;
  paymentId?: Types.ObjectId;
  /** When the coach REQUESTED the cancellation, not when access ends. */
  cancelledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const partnerSubscriptionSchema = new Schema({
  userId:      { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  plan:        { type: String, enum: ['coach', 'organizer'], required: true },
  status:      { type: String, enum: ['pending', 'active', 'expired', 'cancelled'], default: 'pending' },
  priceAmount: { type: Number, required: true },
  currency:    { type: String, default: 'PHP', maxlength: 10 },
  // Snapshot the selected term at purchase time. Admin tiers may change before
  // a manual GCash payment is reconciled, so activation must not recalculate a
  // pending subscription from today's settings.
  tierKey:     { type: String, maxlength: 40 },
  durationDays:{ type: Number, min: 1, max: 3650 },
  // A live/manual payment creates a pending row first. The paid term starts only
  // when that payment is verified, so these dates deliberately stay empty until
  // activation instead of silently burning subscription time while GCash is
  // being reconciled.
  startedAt:   Date,
  expiresAt:   Date,
  autoRenew:   { type: Boolean, default: false },
  cancelAtPeriodEnd: { type: Boolean, default: false },
  paymentId:   { type: Schema.Types.ObjectId, ref: 'Payment' },
  cancelledAt: Date,
}, { timestamps: true });

// The hot path: "does this user hold a live subscription to this plan?"
partnerSubscriptionSchema.index({ userId: 1, plan: 1, status: 1 });
// Lazy-expiry sweeps read by deadline.
partnerSubscriptionSchema.index({ expiresAt: 1 });

export const PartnerSubscription = model('PartnerSubscription', partnerSubscriptionSchema);

/**
 * Flip any `active` row whose deadline has passed to `expired`, and revoke the
 * global role it granted. Called on read (there is no cron), mirroring how
 * bookings lazily expire overdue payment holds. Scoped to one user so a profile
 * read never sweeps the whole table.
 *
 * Revoking here is what makes "cancel at period end" work: cancelling only sets
 * `cancelAtPeriodEnd`, leaving the row active until its deadline passes.
 */
export async function expireLapsedSubscriptions(userId: Types.ObjectId | string): Promise<void> {
  const now = new Date();
  const lapsed = await PartnerSubscription.find({
    userId, status: 'active', expiresAt: { $lte: now },
  }).select('plan').lean() as any[];
  if (!lapsed.length) return;

  await PartnerSubscription.updateMany(
    { userId, status: 'active', expiresAt: { $lte: now } },
    { status: 'expired' },
  );

  for (const plan of new Set(lapsed.map((r) => r.plan))) {
    await revokeGlobalRoleIfLapsed(userId, plan);
  }
}

/**
 * Drop the global `plan` grant, but only when NO other live term of that plan
 * remains (e.g. the coach re-subscribed before the old one lapsed).
 *
 * Shared by lazy expiry and the admin hard-deactivation: both end a single term
 * and neither may revoke a role that a second, still-running term paid for.
 */
export async function revokeGlobalRoleIfLapsed(
  userId: Types.ObjectId | string,
  plan: PartnerPlan,
): Promise<void> {
  const stillLive = await PartnerSubscription.exists({
    userId, plan, status: 'active', expiresAt: { $gt: new Date() },
  });
  if (!stillLive) {
    await UserRole.deleteOne({ userId, role: plan, scopeType: null, scopeId: null });
  }
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
