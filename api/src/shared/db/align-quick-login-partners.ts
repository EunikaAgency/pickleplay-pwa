// Pickleballers API — Give the PWA's "Quick test login" accounts a clean shape.
//
// The login screen offers one-tap logins so any surface can be reviewed fast.
// Since coach/organizer stopped being roles (see partner-roles-to-subscriptions),
// what distinguishes those buttons is which PAID plan the account subscribes to —
// and repeated demo/seed runs had left several of them holding BOTH plans (a
// "Player" who could open the organiser console, an "Organizer" who was also a
// coach), which makes the buttons useless for reviewing one surface at a time.
//
// This script makes each quick-login account hold exactly the plans below:
// missing ones are granted an active term, extra ones are expired. Everyone
// stays a `player`; no roles are touched.
//
// Idempotent — re-run any time the demo data drifts.
//
// Usage: npx tsx src/shared/db/align-quick-login-partners.ts
//        npm run db:quick-logins

import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDb } from './index.js';
import { User } from '../../features/auth/auth.model.js';
import { PartnerSubscription, type PartnerPlan } from '../../features/partner-subscriptions/partner-subscriptions.model.js';
import { Payment } from '../../features/payments/payments.model.js';
import { getPartnerSubscriptionPricing, isPaymentTestMode } from '../../features/settings/settings.controller.js';

const TERM_DAYS = 365;   // long, so demo accounts don't lapse mid-review

// Keep in lock-step with TEST_ACCOUNTS in app/src/features/auth/LoginScreen.tsx.
const QUICK_LOGINS: Array<{ button: string; email: string; plans: PartnerPlan[] }> = [
  { button: 'Player 1',  email: '84a3be4a.hernandez@example.com', plans: [] },
  { button: 'Player 2',  email: '389b0d83.fuentes@example.com',   plans: [] },
  { button: 'Owner 1',   email: 'ccdfa3b7.walker@example.com',    plans: [] },
  { button: 'Owner 2',   email: 'a15e6e3e.garrido@example.com',   plans: [] },
  { button: 'Organizer', email: '556b9e79.matthews@example.com',  plans: ['organizer'] },
  { button: 'Coach',     email: '637fa51b.reyes@example.com',     plans: ['coach'] },
];

async function main() {
  await connectDb();
  const pricing = await getPartnerSubscriptionPricing();
  const testMode = await isPaymentTestMode();
  const report: any[] = [];

  for (const { button, email, plans } of QUICK_LOGINS) {
    const user = await User.findOne({ email }).select('_id displayName roleDefault').lean() as any;
    if (!user) { report.push({ button, email, error: 'account not found' }); continue; }

    const wanted = new Set(plans);
    const granted: string[] = [];
    const expired: string[] = [];

    // Drop every live term the button shouldn't have.
    const live = await PartnerSubscription.find({
      userId: user._id, status: 'active', expiresAt: { $gt: new Date() },
    }).select('_id plan').lean() as any[];
    for (const s of live) {
      if (wanted.has(s.plan)) continue;
      await PartnerSubscription.updateOne({ _id: s._id }, { $set: { status: 'expired', autoRenew: false } });
      expired.push(s.plan);
    }

    // Grant whatever is missing.
    for (const plan of wanted) {
      if (live.some((s) => s.plan === plan)) continue;
      const startedAt = new Date();
      const expiresAt = new Date(startedAt.getTime() + TERM_DAYS * 24 * 60 * 60 * 1000);
      const sub = await PartnerSubscription.create({
        userId: user._id, plan, status: 'active',
        priceAmount: pricing[plan], currency: pricing.currency,
        startedAt, expiresAt, autoRenew: false,
      });
      const payment = await Payment.create({
        userId: user._id,
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
      granted.push(plan);
    }

    const after = await PartnerSubscription.find({
      userId: user._id, status: 'active', expiresAt: { $gt: new Date() },
    }).select('plan').lean() as any[];

    report.push({
      button,
      name: user.displayName,
      role: user.roleDefault,
      livePlans: after.map((s) => s.plan).sort(),
      granted, expired,
    });
  }

  console.log(JSON.stringify(report, null, 2));
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error('❌ quick-login alignment failed:', e);
  process.exit(1);
});
