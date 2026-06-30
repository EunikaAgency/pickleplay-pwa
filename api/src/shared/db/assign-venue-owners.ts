// Pickleballers API — Random venue → owner assignment
//
// Re-distributes venue ownership across the existing `owner` users:
//   - exactly ONE owner is left with 0 venues
//   - every other owner gets a random 1..5 venues (hard cap: 5)
//   - the remaining venues are left UNOWNED on purpose, so they can be
//     used as samples for the "claim a venue" flow
//
// Idempotent: clears all Venue.ownerUserId first, then reassigns. Re-running
// produces a fresh random distribution. db:seed:users will overwrite this.
//
// Usage: npx tsx src/shared/db/assign-venue-owners.ts

import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDb } from './index.js';
import { User } from '../../features/auth/auth.model.js';
import { Venue } from '../../features/venues/venues.model.js';

const MAX_PER_OWNER = 5;

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

async function main() {
  await connectDb();

  // Sorted by _id so the order matches creation order (and TEST_CREDENTIALS).
  const owners = await User.find({ roleDefault: 'owner' }).sort({ _id: 1 });
  const venues = await Venue.find({}).sort({ _id: 1 }).select('_id displayName slug');

  if (!owners.length) throw new Error('No owner users found (roleDefault: owner).');
  console.log(`Owners: ${owners.length}  Venues: ${venues.length}`);

  // 1) Wipe existing ownership.
  await Venue.updateMany({}, { $unset: { ownerUserId: 1 } });

  // 2) Randomise the venue pool and pick which single owner gets 0.
  const pool = shuffle([...venues]);
  const zeroIdx = Math.floor(Math.random() * owners.length);

  const assignments: { owner: (typeof owners)[number]; venues: typeof venues }[] = [];
  let cursor = 0;
  for (let i = 0; i < owners.length; i++) {
    let count = i === zeroIdx ? 0 : 1 + Math.floor(Math.random() * MAX_PER_OWNER); // 1..5
    count = Math.min(count, pool.length - cursor); // never run past the pool
    const slice = pool.slice(cursor, cursor + count);
    cursor += count;
    assignments.push({ owner: owners[i]!, venues: slice });
  }

  // 3) Persist.
  for (const a of assignments) {
    if (a.venues.length) {
      await Venue.updateMany(
        { _id: { $in: a.venues.map((v) => v._id) } },
        // A venue with an owner is, by definition, claimed — flip the state too,
        // otherwise the owner console shows their own venues as "unclaimed".
        { $set: { ownerUserId: a.owner._id, state: 'claimed' } },
      );
    }
  }

  // 4) Emit a machine-readable summary (used to update TEST_CREDENTIALS.txt).
  const ownedTotal = assignments.reduce((s, a) => s + a.venues.length, 0);
  const summary = {
    totalVenues: venues.length,
    ownedTotal,
    unowned: venues.length - ownedTotal,
    ownersWithZero: assignments.filter((a) => !a.venues.length).length,
    maxPerOwner: Math.max(...assignments.map((a) => a.venues.length)),
    owners: assignments.map((a) => ({
      email: a.owner.email,
      name: a.owner.displayName,
      count: a.venues.length,
      venues: a.venues.map((v) => ({ name: v.displayName, slug: v.slug })),
    })),
  };
  console.log('---SUMMARY-JSON-START---');
  console.log(JSON.stringify(summary, null, 2));
  console.log('---SUMMARY-JSON-END---');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Assignment failed:', err);
  process.exit(1);
});
