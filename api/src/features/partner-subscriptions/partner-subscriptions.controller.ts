import { z } from 'zod';
import { User, UserRole } from '../auth/auth.model.js';
import { Payment } from '../payments/payments.model.js';
import { isPaymentTestMode, getPartnerSubscriptionPricing } from '../settings/settings.controller.js';
import {
  PartnerSubscription, expireLapsedSubscriptions, type PartnerPlan,
} from './partner-subscriptions.model.js';

const subscribeSchema = z.object({
  plan: z.enum(['coach', 'organizer']),
  autoRenew: z.boolean().optional(),
});

/** The postal-address fields a partner must have on file before subscribing.
 *  `address2` is deliberately excluded — it's the optional unit/landmark line. */
const REQUIRED_ADDRESS_FIELDS = ['address1', 'city', 'province', 'zipcode'] as const;

/** Which required address fields are still blank on this account. */
function missingAddressFields(user: Record<string, any>): string[] {
  return REQUIRED_ADDRESS_FIELDS.filter((f) => !String(user?.[f] ?? '').trim());
}

function subscriptionPayload(s: any) {
  return {
    id: s._id,
    plan: s.plan,
    status: s.status,
    priceAmount: s.priceAmount,
    currency: s.currency,
    startedAt: s.startedAt,
    expiresAt: s.expiresAt,
    autoRenew: s.autoRenew,
    // Derived so clients never have to compare clocks themselves.
    isActive: s.status === 'active' && new Date(s.expiresAt).getTime() > Date.now(),
  };
}

/**
 * Subscribing grants the GLOBAL `coach` (or `organizer`) role, which is what
 * unlocks `coach.profile.manage` / `coach.applications.manage` — i.e. the
 * ability to create a coach profile and apply to venues. Venue-scoped grants
 * are separate and still come from an owner approving a CoachApplication.
 */
async function grantGlobalRole(userId: string, role: PartnerPlan): Promise<void> {
  await UserRole.updateOne(
    { userId, role, scopeType: null, scopeId: null },
    { $setOnInsert: { userId, role, scopeType: null, scopeId: null } },
    { upsert: true },
  );
}

/** Revoke the global grant. Venue-scoped rows (from approved applications) are
 *  left alone — losing the subscription shouldn't erase an owner's decision. */
async function revokeGlobalRole(userId: string, role: PartnerPlan): Promise<void> {
  await UserRole.deleteOne({ userId, role, scopeType: null, scopeId: null });
}

/** GET /partner-subscriptions/me — every subscription this user holds, the
 *  live status per plan, the current pricing, and whether their profile is
 *  complete enough to subscribe. Drives the whole subscribe screen in one call. */
export async function getMySubscriptions(c: any) {
  const tokenUser = c.get('user');
  await expireLapsedSubscriptions(tokenUser.sub);

  const [rows, pricing, account] = await Promise.all([
    PartnerSubscription.find({ userId: tokenUser.sub }).sort({ createdAt: -1 }).lean(),
    getPartnerSubscriptionPricing(),
    User.findById(tokenUser.sub).select('address1 address2 city province zipcode').lean(),
  ]);

  const subscriptions = (rows as any[]).map(subscriptionPayload);
  const liveFor = (plan: PartnerPlan) => subscriptions.find((s) => s.plan === plan && s.isActive) ?? null;
  const missing = missingAddressFields(account ?? {});

  return c.json({
    data: {
      subscriptions,
      coach: liveFor('coach'),
      organizer: liveFor('organizer'),
      pricing,
      // The subscribe screen uses this to send the user to Edit Profile first.
      addressComplete: missing.length === 0,
      missingAddressFields: missing,
    },
  });
}

/** POST /partner-subscriptions — buy a term of the coach/organizer plan. */
export async function subscribe(c: any) {
  const tokenUser = c.get('user');
  const body = subscribeSchema.parse(await c.req.json());
  const plan = body.plan as PartnerPlan;

  const account = await User.findById(tokenUser.sub).select('address1 city province zipcode').lean();
  if (!account) return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);

  // A partner is a real business contact — we require a postal address on file
  // before they can list themselves or take bookings.
  const missing = missingAddressFields(account);
  if (missing.length) {
    return c.json({
      error: {
        code: 'ADDRESS_REQUIRED',
        message: 'Add your address in Edit Profile before subscribing.',
        missingAddressFields: missing,
      },
    }, 400);
  }

  await expireLapsedSubscriptions(tokenUser.sub);
  const live = await PartnerSubscription.findOne({
    userId: tokenUser.sub, plan, status: 'active', expiresAt: { $gt: new Date() },
  }).lean();
  if (live) {
    return c.json({ error: { code: 'ALREADY_SUBSCRIBED', message: `You already have an active ${plan} subscription.` } }, 409);
  }

  const pricing = await getPartnerSubscriptionPricing();
  const priceAmount = plan === 'coach' ? pricing.coach : pricing.organizer;
  const testMode = await isPaymentTestMode();

  const startedAt = new Date();
  const expiresAt = new Date(startedAt.getTime() + pricing.durationDays * 24 * 60 * 60 * 1000);

  const sub = await PartnerSubscription.create({
    userId: tokenUser.sub, plan, status: 'active',
    priceAmount, currency: pricing.currency,
    startedAt, expiresAt, autoRenew: body.autoRenew ?? false,
  });

  // Mirrors the booking flow: in test mode the charge completes immediately; in
  // live mode the Payment stays 'pending' until a real gateway lands, and the
  // subscription is honoured meanwhile (same as bookings, which auto-confirm).
  const payment = await Payment.create({
    userId: tokenUser.sub,
    purpose: 'partner_subscription',
    subscriptionId: sub._id,
    amount: priceAmount,
    currency: pricing.currency,
    method: testMode ? 'test_card' : null,
    provider: testMode ? 'test' : null,
    status: testMode ? 'completed' : 'pending',
  });
  sub.set('paymentId', payment._id);
  await sub.save();

  await grantGlobalRole(tokenUser.sub, plan);

  return c.json({ data: { ...subscriptionPayload(sub), paymentId: payment._id } }, 201);
}

/** DELETE /partner-subscriptions/:id — cancel. The term is NOT refunded and the
 *  row keeps its `expiresAt`, but the role grant is revoked immediately. */
export async function cancelSubscription(c: any) {
  const tokenUser = c.get('user');
  const id = c.req.param('id');

  const sub = await PartnerSubscription.findOne({ _id: id, userId: tokenUser.sub });
  if (!sub) return c.json({ error: { code: 'NOT_FOUND', message: 'Subscription not found' } }, 404);
  if (sub.get('status') !== 'active') {
    return c.json({ error: { code: 'CONFLICT', message: 'This subscription is not active.' } }, 409);
  }

  sub.set('status', 'cancelled');
  sub.set('cancelledAt', new Date());
  await sub.save();

  await revokeGlobalRole(tokenUser.sub, sub.get('plan') as PartnerPlan);
  return c.json({ data: subscriptionPayload(sub) });
}
