import { z } from 'zod';
import { User } from '../auth/auth.model.js';
import { Payment } from '../payments/payments.model.js';
import { isPaymentTestMode, getPartnerSubscriptionPricing } from '../settings/settings.controller.js';
import {
  PartnerSubscription, expireLapsedSubscriptions, type PartnerPlan,
} from './partner-subscriptions.model.js';

const subscribeSchema = z.object({
  plan: z.enum(['coach', 'organizer']),
  autoRenew: z.boolean().optional(),
  // Card credentials the client collects at the payment step. Never stored or
  // charged — in test mode they gate on the demo card exactly like booking
  // checkout; in live mode the Payment stays pending until a gateway lands.
  // Includes cardholder name + billing address so the form matches a real
  // gateway; those fields are accepted but not persisted.
  card: z.object({
    number: z.string(),
    expiry: z.string(),
    cvc: z.string(),
    name: z.string(),
    billingAddress1: z.string(),
    billingAddress2: z.string(),
    billingCity: z.string(),
    billingProvince: z.string(),
    billingZip: z.string(),
  }).partial().optional(),
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
    cancelAtPeriodEnd: !!s.cancelAtPeriodEnd,
    cancelledAt: s.cancelledAt ?? null,
    // Derived so clients never have to compare clocks themselves.
    isActive: s.status === 'active' && new Date(s.expiresAt).getTime() > Date.now(),
  };
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

  // Demo card gate — same behaviour as booking checkout: in test mode the card
  // must be the canonical demo card, so the payment step behaves like a real
  // gateway (right card → subscribed, wrong card → declined). Expiry/CVC aren't
  // checked. No subscription or role is granted until the payment clears.
  if (testMode && body.card?.number) {
    const entered = body.card.number.replace(/\D/g, '');
    if (entered !== '4242424242424242') {
      return c.json({ error: { code: 'CARD_DECLINED', message: 'Card declined. Use the demo test card 4242 4242 4242 4242 (any future expiry, any CVC).' } }, 402);
    }
  }

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

  // No role changes hands: the subscriber stays a `player`, and the live term is
  // what carries `coach.*` / `organizer.*` (SUBSCRIPTION_PERMISSIONS, resolved
  // into /me and the access token). Re-login (or refresh) to pick them up.

  return c.json({ data: { ...subscriptionPayload(sub), paymentId: payment._id } }, 201);
}

/**
 * DELETE /partner-subscriptions/:id — cancel at the END of the paid term.
 *
 * The coach already paid for this period, so access (and the role) survive until
 * `expiresAt`; only auto-renew is switched off. `expireLapsedSubscriptions` then
 * flips the row to `expired` and revokes the role on the first read after the
 * deadline. Nothing is refunded, and nothing is revoked today.
 */
export async function cancelSubscription(c: any) {
  const tokenUser = c.get('user');
  const id = c.req.param('id');

  const sub = await PartnerSubscription.findOne({ _id: id, userId: tokenUser.sub });
  if (!sub) return c.json({ error: { code: 'NOT_FOUND', message: 'Subscription not found' } }, 404);
  if (sub.get('status') !== 'active') {
    return c.json({ error: { code: 'CONFLICT', message: 'This subscription is not active.' } }, 409);
  }
  if (sub.get('cancelAtPeriodEnd')) {
    return c.json({ error: { code: 'ALREADY_CANCELLED', message: 'This subscription is already set to end at the term.' } }, 409);
  }

  sub.set('cancelAtPeriodEnd', true);
  sub.set('autoRenew', false);
  sub.set('cancelledAt', new Date());   // when it was REQUESTED, not when access ends
  await sub.save();

  return c.json({ data: subscriptionPayload(sub) });
}

/** POST /partner-subscriptions/:id/resume — undo a scheduled cancellation while
 *  the term is still running. */
export async function resumeSubscription(c: any) {
  const tokenUser = c.get('user');
  const sub = await PartnerSubscription.findOne({ _id: c.req.param('id'), userId: tokenUser.sub });
  if (!sub) return c.json({ error: { code: 'NOT_FOUND', message: 'Subscription not found' } }, 404);
  if (sub.get('status') !== 'active' || new Date(sub.get('expiresAt')).getTime() <= Date.now()) {
    return c.json({ error: { code: 'CONFLICT', message: 'This subscription has already ended.' } }, 409);
  }
  if (!sub.get('cancelAtPeriodEnd')) {
    return c.json({ error: { code: 'CONFLICT', message: 'This subscription is not scheduled to end.' } }, 409);
  }

  sub.set('cancelAtPeriodEnd', false);
  sub.set('cancelledAt', undefined);
  await sub.save();
  // The role was never revoked, so there is nothing to re-grant.
  return c.json({ data: subscriptionPayload(sub) });
}
