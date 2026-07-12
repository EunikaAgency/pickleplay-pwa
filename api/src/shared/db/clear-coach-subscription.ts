// Pickleballers API — Wipe a user's coach subscription (current + history).
//
// Mirrors what the app itself does when a term lapses
// (`expireLapsedSubscriptions`): once no live coach term remains, the GLOBAL
// `coach` UserRole grant is dropped too. Deleting the subscription rows while
// leaving that grant behind would put the account in a state the app can never
// reach on its own — a coach role with nothing backing it.
//
// Left alone on purpose:
//   * venue-scoped `coach` grants (an owner approved them; a lapsed
//     subscription is not the owner withdrawing that approval),
//   * the Coach profile + coach bookings + reviews (the subscription gates
//     visibility, it does not own that data).
//
// Writes a rollback file before touching anything.
//
// Usage: npx tsx src/shared/db/clear-coach-subscription.ts "Steve Hernandez"

import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import mongoose from 'mongoose';
import { connectDb } from './index.js';
import { User, UserRole } from '../../features/auth/auth.model.js';
import { PartnerSubscription } from '../../features/partner-subscriptions/partner-subscriptions.model.js';

const PLAN = 'coach';

async function main() {
  const name = process.argv[2];
  if (!name) throw new Error('Usage: clear-coach-subscription.ts "<display name>"');

  await connectDb();

  const users = await User.find({ displayName: new RegExp(`^${name.trim()}$`, 'i') })
    .select('_id email displayName').lean() as any[];
  if (users.length === 0) throw new Error(`No user named "${name}"`);
  if (users.length > 1) throw new Error(`"${name}" is ambiguous — ${users.length} users match.`);
  const user = users[0];

  const subs = await PartnerSubscription.find({ userId: user._id, plan: PLAN }).lean() as any[];
  // Only the GLOBAL grant — a venue-scoped one is the owner's call, not ours.
  const globalRole = await UserRole.findOne({ userId: user._id, role: PLAN, scopeType: null, scopeId: null }).lean() as any;

  const backupUrl = new URL('./clear-coach-subscription.backup.json', import.meta.url);
  writeFileSync(backupUrl, JSON.stringify({
    clearedAt: new Date().toISOString(),
    user: { id: String(user._id), email: user.email, displayName: user.displayName },
    partnerSubscriptions: subs,
    globalCoachRole: globalRole ?? null,
  }, null, 2));

  const subResult = await PartnerSubscription.deleteMany({ userId: user._id, plan: PLAN });
  const roleResult = globalRole
    ? await UserRole.deleteOne({ _id: globalRole._id })
    : { deletedCount: 0 };

  // What survives, so the caller can see the account really is clean.
  const remainingSubs = await PartnerSubscription.countDocuments({ userId: user._id, plan: PLAN });
  const remainingRoles = await UserRole.find({ userId: user._id }).select('role scopeType').lean() as any[];

  console.log(JSON.stringify({
    user: { displayName: user.displayName, email: user.email },
    deleted: {
      subscriptions: subResult.deletedCount,
      globalCoachRole: roleResult.deletedCount,
    },
    subscriptionsDeleted: subs.map((s) => ({
      status: s.status,
      startedAt: new Date(s.startedAt).toISOString().slice(0, 10),
      expiresAt: new Date(s.expiresAt).toISOString().slice(0, 10),
    })),
    remaining: {
      coachSubscriptions: remainingSubs,
      roles: remainingRoles.map((r) => `${r.role}${r.scopeType ? `@${r.scopeType}` : ' (global)'}`),
    },
    backup: backupUrl.pathname,
    note: 'A signed-in session keeps `coach` in its JWT until the token refreshes.',
  }, null, 2));

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((e) => { console.error('❌ clear failed:', e.message); process.exit(1); });
