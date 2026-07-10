// Pickleballers API — Re-link games to their venues
//
// Games carry a `venueId`, but many point at venue documents that no longer
// exist (the venues collection was re-seeded with fresh _ids, orphaning them).
// Mongoose's .populate() turns an unresolvable ref into `null`, so the API
// reports `venue: null` and the app silently loses the venue's image, its
// coordinates (breaking distance ranking) and its price — with no error anywhere.
//
// This re-points each dangling `venueId` at the venue whose `displayName` equals
// the game's free-text `venueName`. Games whose venueId already resolves are left
// alone, so the script is safe to re-run.
//
// Dry run by default — it overwrites existing values, so it will not touch the
// database unless you pass --apply.
//
// Usage: npx tsx src/shared/db/relink-game-venues.ts [--apply]

import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDb } from './index.js';
import { Game } from '../../features/games/games.model.js';
import { Venue } from '../../features/venues/venues.model.js';

const norm = (s: unknown) => String(s ?? '').trim().toLowerCase();

async function main() {
  const apply = process.argv.includes('--apply');
  await connectDb();

  const games = await Game.find({ venueId: { $ne: null } }).select('_id venueId venueName').lean() as any[];
  const venues = await Venue.find({}).select('_id displayName mainImageUrl lat lng').lean() as any[];

  // Only the refs that actually fail to resolve need repointing.
  const liveVenueIds = new Set(venues.map((v) => String(v._id)));
  const byName = new Map(venues.map((v) => [norm(v.displayName), v]));

  const ops: any[] = [];
  let healthy = 0;
  const unmatched: string[] = [];

  for (const g of games) {
    if (liveVenueIds.has(String(g.venueId))) { healthy++; continue; }
    const venue = byName.get(norm(g.venueName));
    if (!venue) { unmatched.push(g.venueName ?? '(no venueName)'); continue; }
    ops.push({ updateOne: { filter: { _id: g._id }, update: { $set: { venueId: venue._id } } } });
  }

  if (apply && ops.length) await Game.bulkWrite(ops);

  console.log('---SUMMARY---');
  console.log(`Games with a venueId      : ${games.length}`);
  console.log(`  already resolving       : ${healthy}`);
  console.log(`  re-linked by venueName  : ${ops.length}${apply ? '' : ' (dry run — nothing written)'}`);
  console.log(`  unmatched, left as-is   : ${unmatched.length}`);
  if (unmatched.length) console.log(`    e.g. ${unmatched.slice(0, 5).map((n) => JSON.stringify(n)).join(', ')}`);
  if (!apply && ops.length) console.log('\nRe-run with --apply to write these changes.');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Re-link failed:', err);
  process.exit(1);
});
