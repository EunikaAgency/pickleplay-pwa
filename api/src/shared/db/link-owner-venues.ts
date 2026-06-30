// Re-link venue owners to venues.
//
// `npm run db:import` drops + reimports the venue collection, which wipes the
// `Venue.ownerUserId` links that `db:seed:users` set. That leaves the owner
// users intact but pointing at nothing. This script repairs the links
// non-destructively: it pairs each owner user that doesn't yet own a venue with
// a venue that has no owner. It never touches user accounts (so seeded logins /
// TEST_CREDENTIALS stay valid) and is safe to re-run.
//
//   npm run db:link-owners

import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDb } from './index.js';
import { User } from '../../features/auth/auth.model.js';
import { Venue } from '../../features/venues/venues.model.js';

async function run() {
  await connectDb();

  const owners = await User.find({ roleDefault: 'owner' })
    .select('_id displayName')
    .sort({ createdAt: 1 })
    .lean();

  const ownedVenues = await Venue.find({ ownerUserId: { $ne: null } })
    .select('ownerUserId')
    .lean();
  const alreadyOwning = new Set(ownedVenues.map((v: any) => v.ownerUserId?.toString()));

  const unlinkedOwners = owners.filter((o: any) => !alreadyOwning.has(o._id.toString()));

  const freeVenues = await Venue.find({ $or: [{ ownerUserId: { $exists: false } }, { ownerUserId: null }] })
    .select('_id displayName')
    .sort({ displayName: 1 })
    .limit(unlinkedOwners.length)
    .lean();

  console.log(`Owners: ${owners.length} (${unlinkedOwners.length} unlinked) · free venues: ${freeVenues.length}\n`);

  let linked = 0;
  const pairs = Math.min(unlinkedOwners.length, freeVenues.length);
  for (let i = 0; i < pairs; i++) {
    const owner = unlinkedOwners[i]!;
    const venue = freeVenues[i]!;
    // A venue with an owner is, by definition, claimed — set the state alongside
    // the link so the owner console never shows their own venue as "unclaimed".
    await Venue.updateOne(
      { _id: venue._id },
      { $set: { ownerUserId: owner._id, state: 'claimed' } },
    );
    console.log(`  ${owner.displayName} → ${venue.displayName}`);
    linked++;
  }

  // Backfill sweep: repair any already-owned venue still carrying the default
  // 'unclaimed' state (e.g. linked by an older run of this script before it set
  // the state). Idempotent and safe to re-run.
  const repaired = await Venue.updateMany(
    { ownerUserId: { $exists: true, $ne: null }, state: { $ne: 'claimed' } },
    { $set: { state: 'claimed' } },
  );
  if (repaired.modifiedCount) {
    console.log(`Repaired ${repaired.modifiedCount} owned venue(s) stuck at state≠claimed.`);
  }

  const totalOwned = await Venue.countDocuments({ ownerUserId: { $exists: true, $ne: null } });
  console.log(`\nLinked ${linked} owner(s). ${totalOwned} venue(s) now have an owner.`);

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ Re-link failed:', err);
  process.exit(1);
});
