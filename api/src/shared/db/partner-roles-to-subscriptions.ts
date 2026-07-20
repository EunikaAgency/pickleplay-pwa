// Pickleballers API — Retire the coach/organizer ROLES; keep the capabilities.
//
// Coach and organiser are no longer account roles. Every partner is a `player`
// whose `coach.*` / `organizer.*` permissions come from a live PAID
// PartnerSubscription (see shared/lib/permissions.ts → SUBSCRIPTION_PERMISSIONS,
// resolved into /me + the access token by features/auth). This script moves the
// existing data onto that model:
//
//   1. Users whose roleDefault is 'coach'/'organizer'  -> 'player'.
//   2. GLOBAL UserRole grants of coach/organizer       -> deleted.
//   3. Anyone who held one of those (role or grant)    -> given an ACTIVE
//      subscription to the matching plan, so they keep the exact permissions
//      they had before. Users who already hold a live term are left alone.
//
// Venue-scoped grants (scopeType: 'venue') are NOT touched — those are what the
// "Coach at <venue>" / "Organiser at <venue>" profile badges are built from, and
// they no longer put the role on the account (getUserRoles skips them).
//
// Idempotent: re-running once every role is retired reports 0 changes.
//
// Usage: npx tsx src/shared/db/partner-roles-to-subscriptions.ts
//        npm run db:partner-roles

import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import mongoose from 'mongoose';
import { connectDb } from './index.js';
import { User, UserRole } from '../../features/auth/auth.model.js';
import { PartnerSubscription, type PartnerPlan } from '../../features/partner-subscriptions/partner-subscriptions.model.js';
import { Payment } from '../../features/payments/payments.model.js';
import { getPartnerSubscriptionPricing, isPaymentTestMode } from '../../features/settings/settings.controller.js';

const PLANS: PartnerPlan[] = ['coach', 'organizer'];
const BACKUP_URL = new URL('./partner-roles-to-subscriptions.backup.json', import.meta.url);

// Migrated accounts get a long term so demo/seed partners don't silently lapse
// and lose their surfaces mid-review. Real subscribers buy the 30-day term.
const TERM_DAYS = 365;

async function main() {
  await connectDb();

  const pricing = await getPartnerSubscriptionPricing();
  const testMode = await isPaymentTestMode();

  /* ─── Who holds what today ────────────────────────────────────── */
  const holders: Record<PartnerPlan, Set<string>> = { coach: new Set(), organizer: new Set() };

  const roleUsers = await User.find({ roleDefault: { $in: PLANS } })
    .select('_id email displayName roleDefault').lean() as any[];
  for (const u of roleUsers) holders[u.roleDefault as PartnerPlan].add(String(u._id));

  const globalGrants = await UserRole.find({ role: { $in: PLANS }, scopeType: null })
    .select('_id userId role').lean() as any[];
  for (const g of globalGrants) holders[g.role as PartnerPlan].add(String(g.userId));

  // Rollback list, written before anything is changed.
  writeFileSync(BACKUP_URL, JSON.stringify({
    roleUsers: roleUsers.map((u) => ({ id: String(u._id), email: u.email, roleDefault: u.roleDefault })),
    globalGrants: globalGrants.map((g) => ({ id: String(g._id), userId: String(g.userId), role: g.role })),
  }, null, 2));

  /* ─── 1 + 2. Retire the roles ─────────────────────────────────── */
  const demoted = await User.updateMany({ roleDefault: { $in: PLANS } }, { $set: { roleDefault: 'player' } });
  const revoked = await UserRole.deleteMany({ role: { $in: PLANS }, scopeType: null });

  /* ─── 3. Grant the matching subscription ──────────────────────── */
  const granted: Record<PartnerPlan, number> = { coach: 0, organizer: 0 };
  const alreadyLive: Record<PartnerPlan, number> = { coach: 0, organizer: 0 };

  for (const plan of PLANS) {
    for (const userId of holders[plan]) {
      const live = await PartnerSubscription.exists({
        userId, plan, status: 'active', expiresAt: { $gt: new Date() },
      });
      if (live) { alreadyLive[plan]++; continue; }

      const startedAt = new Date();
      const expiresAt = new Date(startedAt.getTime() + TERM_DAYS * 24 * 60 * 60 * 1000);
      const sub = await PartnerSubscription.create({
        userId, plan, status: 'active',
        priceAmount: pricing[plan], currency: pricing.currency,
        startedAt, expiresAt, autoRenew: false,
      });
      const payment = await Payment.create({
        userId,
        purpose: 'partner_subscription',
        subscriptionId: sub._id,
        amount: pricing[plan],
        currency: pricing.currency,
        method: testMode ? 'test_card' : null,
        provider: testMode ? 'test' : null,
        status: testMode ? 'completed' : 'pending',
      });
      sub.set('paymentId', payment._id);
      await sub.save();
      granted[plan]++;
    }
  }

  /* ─── Verify ──────────────────────────────────────────────────── */
  const roleCounts = await User.aggregate([{ $group: { _id: '$roleDefault', n: { $sum: 1 } } }, { $sort: { n: -1 } }]);
  const remainingGlobal = await UserRole.countDocuments({ role: { $in: PLANS }, scopeType: null });
  const venueScoped = await UserRole.countDocuments({ role: { $in: PLANS }, scopeType: 'venue' });

  console.log(JSON.stringify({
    demotedToPlayer: demoted.modifiedCount,
    globalGrantsRevoked: revoked.deletedCount,
    subscriptionsGranted: granted,
    alreadySubscribed: alreadyLive,
    remainingGlobalPartnerGrants: remainingGlobal,
    venueScopedGrantsKept: venueScoped,
    roleCounts: roleCounts.map((c) => `${c._id}: ${c.n}`),
    backup: BACKUP_URL.pathname,
  }, null, 2));

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error('❌ partner-role retirement failed:', e);
  process.exit(1);
});
