// Backfill `cancellationType` on booking rows that were cancelled before the
// discriminator field existed.
//
// A rejection ("owner declined this request") is now stored as status
// 'cancelled' + cancellationType 'owner_rejected', distinct from a player's own
// cancellation or a system expiry — so reports can tell them apart. Rows
// cancelled before the field landed have no `cancellationType`; this infers one
// from the FIXED `cancellationReason` strings each historical path wrote.
//
// ⚠️ Honest limitation: the owner-decline path (updateBookingStatus) stored the
// owner's FREE-TEXT reason (or null), never a fixed marker — so historical
// `owner_rejected` rows generally CANNOT be recovered here and fall through to
// the `player_cancelled` fallback. Only the ~pre-existing rows are affected; all
// NEW rejections are labelled correctly at write time. If under-counting
// cancellations is preferable to mislabelling, run with --leave-unmatched to
// skip rows that don't match a known reason instead of defaulting them.
//
// Idempotent: only touches rows missing `cancellationType`, so re-runs (and rows
// already labelled by the new write-site code) are no-ops. Writes a
// .backup.json first, matching the other one-off scripts here.
//
//   npm run db:backfill-cancellation-type -- --dry-run
//   npm run db:backfill-cancellation-type
//   npm run db:backfill-cancellation-type -- --leave-unmatched

import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import mongoose from 'mongoose';
import { connectDb } from './index.js';
import { Booking } from '../../features/bookings/bookings.model.js';

// Map the fixed reason strings each historical cancel path wrote → a type.
const REASON_TO_TYPE: Record<string, string> = {
  'Owner did not respond in time': 'system_expired',        // cancelExpired (pending_approval)
  'Payment window expired': 'system_expired',               // cancelExpired (awaiting_payment)
  'Request expired (closed during deadline migration)': 'system_expired', // expire-legacy-pending
  'Recurring series cancelled': 'owner_removed',            // cancelRecurringBooking
  'Removed by owner': 'owner_removed',                      // owner manual-reservation removal
  'Game cancelled': 'system_expired',                       // game release
};

function inferType(reason: string | null | undefined): string | null {
  if (reason && REASON_TO_TYPE[reason]) return REASON_TO_TYPE[reason];
  // Best-effort: a free-text reason mentioning "declin" is very likely a decline.
  if (reason && /declin/i.test(reason)) return 'owner_rejected';
  return null;  // unknown → caller decides fallback
}

async function run() {
  const dryRun = process.argv.includes('--dry-run');
  const leaveUnmatched = process.argv.includes('--leave-unmatched');
  await connectDb();

  const rows = await Booking.find({
    status: 'cancelled',
    cancellationType: { $exists: false },
  }).select('_id cancellationReason cancelledAt date').lean();

  if (!rows.length) {
    console.log('No cancelled bookings missing cancellationType. Nothing to do.');
    await mongoose.disconnect();
    return;
  }

  // Bucket rows by the type we'll assign.
  const plan = new Map<string, string[]>();  // type -> [ids]
  let skipped = 0;
  for (const b of rows) {
    let type = inferType((b as any).cancellationReason);
    if (!type) {
      if (leaveUnmatched) { skipped++; continue; }
      type = 'player_cancelled';  // fallback: most unmatched rows are self-cancels
    }
    (plan.get(type) ?? plan.set(type, []).get(type)!).push(String(b._id));
  }

  console.log(`Found ${rows.length} cancelled booking(s) with no cancellationType.`);
  for (const [type, ids] of plan) console.log(`  ${type}: ${ids.length}`);
  if (leaveUnmatched) console.log(`  (skipped, unmatched: ${skipped})`);
  console.log('Note: historical owner rejections stored free-text reasons and may be counted as player_cancelled — see the script header.');

  if (dryRun) {
    console.log('\n--dry-run: nothing was written.');
    await mongoose.disconnect();
    return;
  }

  const backup = new URL('./backfill-cancellation-type.backup.json', import.meta.url).pathname;
  writeFileSync(backup, JSON.stringify(rows, null, 2));
  console.log(`\nBackup written to ${backup}`);

  let total = 0;
  for (const [type, ids] of plan) {
    const res = await Booking.updateMany({ _id: { $in: ids } }, { cancellationType: type });
    total += res.modifiedCount ?? 0;
  }
  console.log(`Backfilled cancellationType on ${total} booking(s).`);

  await mongoose.disconnect();
}

run().catch((err) => { console.error(err); process.exit(1); });
