// Pickleballers API — Backfill Game.startTime
//
// Games historically stored only a free-text `timeLabel` ('6:30 PM'), which can't
// be sorted or indexed. `startTime` materializes a sortable 24h 'HH:MM' so games
// and OpenPlaySessions share one {date, startTime} sort shape.
//
// Resolution order, matching createGame():
//   1) The linked Booking's `startTime` (authoritative — it's the reserved slot).
//   2) A best-effort parse of the game's own `timeLabel`.
// Games with neither keep `startTime: null` and sort last within their date.
//
// Safe to re-run: only fills games that are still missing the field.
//
// Usage: npx tsx src/shared/db/backfill-game-start-time.ts

import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDb } from './index.js';
import { Game } from '../../features/games/games.model.js';
import { Booking } from '../../features/bookings/bookings.model.js';
import { parseTimeLabel } from '../../features/games/gameTime.js';

async function main() {
  await connectDb();

  const games = await Game.find({
    $or: [{ startTime: null }, { startTime: { $exists: false } }],
  }).select('_id bookingId timeLabel').lean() as any[];

  // One query for every referenced booking, rather than one per game.
  const bookingIds = games.map((g) => g.bookingId).filter(Boolean);
  const bookings = bookingIds.length
    ? await Booking.find({ _id: { $in: bookingIds } }).select('_id startTime').lean() as any[]
    : [];
  const startTimeByBooking = new Map(bookings.map((b) => [String(b._id), b.startTime]));

  let fromBooking = 0;
  let fromLabel = 0;
  let unresolved = 0;

  const ops = games.flatMap((g) => {
    const booked = g.bookingId ? startTimeByBooking.get(String(g.bookingId)) : null;
    const startTime = booked ?? parseTimeLabel(g.timeLabel);
    if (!startTime) { unresolved++; return []; }
    if (booked) fromBooking++; else fromLabel++;
    return [{ updateOne: { filter: { _id: g._id }, update: { $set: { startTime } } } }];
  });

  if (ops.length) await Game.bulkWrite(ops);

  console.log('---SUMMARY---');
  console.log(`Games missing startTime:  ${games.length}`);
  console.log(`  Filled from booking:    ${fromBooking}`);
  console.log(`  Filled from timeLabel:  ${fromLabel}`);
  console.log(`  Left null (no time):    ${unresolved}`);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Backfill failed:', err);
  process.exit(1);
});
