// Pickleballers API — Migrate partner-role users to player + a subscription.
//
// The role model moved on: nobody's PRIMARY role should be `coach`/`organizer`
// any more — those are earned by holding a live partner subscription (which
// mints the global UserRole grant), exactly like the real subscribe() flow.
// This script brings the seed data in line:
//
//   For every user whose roleDefault is 'coach' or 'organizer':
//     1. roleDefault            -> 'player'      (their role becomes player)
//     2. modePreference         -> desired plan  (so their active view is unchanged)
//     3. an ACTIVE PartnerSubscription (+ completed test Payment) for the plan
//     4. the global `coach`/`organizer` UserRole grant  (mirrors grantGlobalRole)
//     5. a placeholder postal address if theirs is blank (the subscribe flow's
//        ADDRESS_REQUIRED precondition — keep the subscribed state coherent)
//
// The desired plan is the user's ORIGINAL role, except two demo quick-login
// accounts are pinned explicitly:
//     Organizer 1 (556b9e79.matthews@example.com) -> organizer
//     Organizer 2 (637fa51b.reyes@example.com)     -> coach
//
// Only GLOBAL partner grants/subs are touched; venue-scoped coach/organizer
// grants (from owner-approved applications) are left alone. Idempotent — any
// stray partner sub/grant that isn't the user's desired plan is cleared first,
// and re-running lands the same state.
//
// Usage: npx tsx src/shared/db/organizers-to-players-subscribe.ts

import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import mongoose from 'mongoose';
import { connectDb } from './index.js';
import { User, UserRole } from '../../features/auth/auth.model.js';
import { PartnerSubscription } from '../../features/partner-subscriptions/partner-subscriptions.model.js';
import { Payment } from '../../features/payments/payments.model.js';
import { getPartnerSubscriptionPricing, isPaymentTestMode } from '../../features/settings/settings.controller.js';

type PartnerPlan = 'coach' | 'organizer';

const BACKUP_URL = new URL('./organizers-to-players-subscribe.backup.json', import.meta.url);

// Demo quick-login accounts pinned to a specific plan (overrides original role).
const PLAN_OVERRIDES: Record<string, PartnerPlan> = {
  '556b9e79.matthews@example.com': 'organizer', // Organizer 1
  '637fa51b.reyes@example.com': 'coach',         // Organizer 2 -> coach
};

// A demo term long enough that these accounts don't silently lapse between
// demos (the real flow uses the 30-day term; seed data gets a year).
const SEED_TERM_DAYS = 365;

// Placeholder address only applied when the user has none — a subscription
// without an address is a state the real subscribe() flow can't produce.
const PLACEHOLDER_ADDRESS = {
  address1: '1 Bonifacio High Street',
  city: 'Taguig',
  province: 'Metro Manila',
  zipcode: '1634',
};

function isAddressComplete(u: any): boolean {
  return !!(u.address1 && u.city && u.province && u.zipcode);
}

async function main() {
  await connectDb();

  const targets = await User.find({ roleDefault: { $in: ['coach', 'organizer'] } })
    .select('_id email displayName roleDefault modePreference address1 city province zipcode')
    .lean() as any[];

  if (targets.length === 0) {
    console.log(JSON.stringify({ migrated: 0, note: 'no coach/organizer-role users left — nothing to do' }, null, 2));
    await mongoose.disconnect();
    process.exit(0);
  }

  // Rollback list, written before any mutation.
  writeFileSync(BACKUP_URL, JSON.stringify(
    targets.map((u) => ({
      id: String(u._id),
      email: u.email,
      displayName: u.displayName,
      roleDefault: u.roleDefault,
      modePreference: u.modePreference,
      hadAddress: isAddressComplete(u),
    })),
    null, 2,
  ));

  const pricing = await getPartnerSubscriptionPricing();
  const testMode = await isPaymentTestMode();
  const priceFor = (plan: PartnerPlan) => (plan === 'coach' ? pricing.coach : pricing.organizer);

  console.log(`Migrating ${targets.length} partner-role users -> player + subscription`);
  console.log(`  term: ${SEED_TERM_DAYS} days · payment mode: ${testMode ? 'test' : 'live'} · coach ₱${pricing.coach} / organizer ₱${pricing.organizer}\n`);

  const results: any[] = [];

  for (const u of targets) {
    const desiredPlan: PartnerPlan = PLAN_OVERRIDES[u.email] ?? (u.roleDefault as PartnerPlan);
    const otherPlan: PartnerPlan = desiredPlan === 'coach' ? 'organizer' : 'coach';

    /* 1 + 2 + 5: user fields (role -> player, mode -> plan, backfill address) */
    const set: Record<string, any> = { roleDefault: 'player', modePreference: desiredPlan };
    if (!isAddressComplete(u)) Object.assign(set, PLACEHOLDER_ADDRESS);
    await User.updateOne({ _id: u._id }, { $set: set });

    /* Clear any GLOBAL partner sub/grant that isn't the desired plan (e.g. the
       Organizer 2 -> coach switch). Venue-scoped grants are untouched. */
    await UserRole.deleteOne({ userId: u._id, role: otherPlan, scopeType: null, scopeId: null });
    await PartnerSubscription.updateMany(
      { userId: u._id, plan: otherPlan, status: 'active' },
      { $set: { status: 'cancelled', cancelledAt: new Date() } },
    );

    /* 3: active subscription for the desired plan (skip if one already lives) */
    const live = await PartnerSubscription.findOne({
      userId: u._id, plan: desiredPlan, status: 'active', expiresAt: { $gt: new Date() },
    });
    let subState: 'existing' | 'created' = 'existing';
    if (!live) {
      const startedAt = new Date();
      const expiresAt = new Date(startedAt.getTime() + SEED_TERM_DAYS * 24 * 60 * 60 * 1000);
      const sub = await PartnerSubscription.create({
        userId: u._id, plan: desiredPlan, status: 'active',
        priceAmount: priceFor(desiredPlan), currency: pricing.currency,
        startedAt, expiresAt, autoRenew: false,
      });
      const payment = await Payment.create({
        userId: u._id,
        purpose: 'partner_subscription',
        subscriptionId: sub._id,
        amount: priceFor(desiredPlan),
        currency: pricing.currency,
        method: testMode ? 'test_card' : null,
        provider: testMode ? 'test' : null,
        status: testMode ? 'completed' : 'pending',
      });
      sub.set('paymentId', payment._id);
      await sub.save();
      subState = 'created';
    }

    /* 4: the global grant that unlocks the partner surfaces (grantGlobalRole) */
    await UserRole.updateOne(
      { userId: u._id, role: desiredPlan, scopeType: null, scopeId: null },
      { $setOnInsert: { userId: u._id, role: desiredPlan, scopeType: null, scopeId: null } },
      { upsert: true },
    );

    const overridden = !!PLAN_OVERRIDES[u.email];
    results.push({ email: u.email, from: u.roleDefault, plan: desiredPlan, sub: subState, overridden });
    console.log(`  ✓ ${u.email.padEnd(38)} ${u.roleDefault} -> player · ${desiredPlan} sub (${subState})${overridden ? '  [override]' : ''}`);
  }

  /* Verify */
  const now = new Date();
  const [activeCoach, activeOrg, roleCounts, remaining] = await Promise.all([
    PartnerSubscription.distinct('userId', { plan: 'coach', status: 'active', expiresAt: { $gt: now } }),
    PartnerSubscription.distinct('userId', { plan: 'organizer', status: 'active', expiresAt: { $gt: now } }),
    User.aggregate([{ $group: { _id: '$roleDefault', n: { $sum: 1 } } }, { $sort: { n: -1 } }]),
    User.countDocuments({ roleDefault: { $in: ['coach', 'organizer'] } }),
  ]);

  console.log('\n✅ Migration complete');
  console.log(JSON.stringify({
    migrated: results.length,
    overrides: results.filter((r) => r.overridden),
    partnerRoleUsersRemaining: remaining,
    activeCoachSubscribers: activeCoach.length,
    activeOrganizerSubscribers: activeOrg.length,
    roleCounts: roleCounts.map((c: any) => `${c._id}: ${c.n}`),
    backup: BACKUP_URL.pathname,
  }, null, 2));

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error('❌ organizer/coach -> player+subscription migration failed:', e);
  process.exit(1);
});
