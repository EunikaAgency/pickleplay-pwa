// Close out booking requests that were stuck before approval deadlines existed.
//
// Until `approvalDeadline` landed, a `pending_approval` booking had no expiry of
// any kind: if the venue owner never answered, the request sat there forever and
// its court stayed off sale. Rows created before that change carry no deadline,
// and a missing deadline means "never expires" — so they would go on blocking
// their slots indefinitely unless something closes them.
//
// This cancels them directly rather than backfilling a deadline and letting the
// sweeper find them. Backfilling would hand the next sweep a whole backlog at
// once, firing a push and an email at every affected player and owner
// simultaneously — for requests most of them have long forgotten. One reviewed,
// silent cleanup is the kinder shape.
//
// Deliberately silent: no notifications are sent. Safe to re-run (rows it has
// already cancelled no longer match). Writes a .backup.json first, matching the
// other one-off scripts here.
//
//   npm run db:expire-legacy-pending -- --dry-run
//   npm run db:expire-legacy-pending

import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import mongoose from 'mongoose';
import { connectDb } from './index.js';
import { Booking } from '../../features/bookings/bookings.model.js';

const REASON = 'Request expired (closed during deadline migration)';

async function run() {
  const dryRun = process.argv.includes('--dry-run');
  await connectDb();

  // Only rows with no deadline at all. Anything created since the feature landed
  // has one and is the sweeper's business, not ours.
  const stuck = await Booking.find({
    status: 'pending_approval',
    $or: [{ approvalDeadline: null }, { approvalDeadline: { $exists: false } }],
  }).select('_id venueId courtId date startTime endTime amount userId createdAt').lean();

  if (!stuck.length) {
    console.log('No legacy pending_approval bookings found. Nothing to do.');
    await mongoose.disconnect();
    return;
  }

  console.log(`Found ${stuck.length} legacy pending_approval booking(s) with no deadline:`);
  for (const b of stuck) {
    const age = Math.floor((Date.now() - new Date((b as any).createdAt).getTime()) / 86_400_000);
    console.log(`  ${String(b._id)}  ${(b as any).date} ${(b as any).startTime ?? '--:--'}  requested ${age}d ago`);
  }

  if (dryRun) {
    console.log('\n--dry-run: nothing was written.');
    await mongoose.disconnect();
    return;
  }

  const backup = new URL('./expire-legacy-pending-bookings.backup.json', import.meta.url).pathname;
  writeFileSync(backup, JSON.stringify(stuck, null, 2));
  console.log(`\nBackup written to ${backup}`);

  const res = await Booking.updateMany(
    { _id: { $in: stuck.map((b) => b._id) } },
    { status: 'cancelled', cancellationReason: REASON, cancelledAt: new Date() },
  );
  console.log(`Cancelled ${res.modifiedCount} booking(s). Their courts are back on sale.`);
  console.log('No notifications were sent — this is a silent migration by design.');

  await mongoose.disconnect();
}

run().catch((err) => { console.error(err); process.exit(1); });
