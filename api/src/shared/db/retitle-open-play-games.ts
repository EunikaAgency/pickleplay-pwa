// Give the converted Open Play Games names a human would have written, and drop
// the test rows that should never have become Games at all.
//
// WHY
// Two separate accidents made the Bookings screen look generated:
//
//   1. `seed-dummy-data.ts` named every session `${level} Open Play`, so four
//      labels covered sixty rows. 30 of 86 Games were "Advanced Open Play",
//      "Intermediate Open Play", "Beginner Open Play", or the truly unfortunate
//      "Open / All levels Open Play" — the same handful repeating down the list.
//
//   2. `retire-open-play-sessions.ts` filtered its input on date alone and wrote
//      `status: 'published'` unconditionally, so 25 CANCELLED occurrences left
//      behind by five runs of `e2e/owner-recurring-openplay.sh` came back as live
//      Games. All 25 sat at one venue, all at 18:00, all titled "E2E Owner Weekly
//      Open Play". (That filter is fixed at the source, so a re-apply won't
//      resurrect them again.)
//
// WHAT IT DOES
//   - Deletes the 25 E2E Games and the Bookings created alongside them. They are
//     cancelled test data; renaming them would only disguise them, and three pairs
//     collide on the same venue/date/time anyway.
//   - Retitles the generically-named Games via `openPlayTitle()`, which composes a
//     name from the row's own day and start hour. Titles are de-duplicated against
//     the hand-written ones already in the collection, so nothing repeats.
//
// Rows a person named ("Friday Night Fire", "Sunday Mini Tourney + Merienda") and
// rows with no title at all are left exactly as they are.
//
// REVERSIBILITY
// Backs up the deleted Games/Bookings in full and records every old→new title
// before writing. `--revert` restores both.
//
// Usage: npx tsx src/shared/db/retitle-open-play-games.ts            (dry run)
//        npx tsx src/shared/db/retitle-open-play-games.ts --apply
//        npx tsx src/shared/db/retitle-open-play-games.ts --revert

import 'dotenv/config';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import mongoose from 'mongoose';
import { connectDb } from './index.js';
import { Game } from '../../features/games/games.model.js';
import { Booking } from '../../features/bookings/bookings.model.js';
import { openPlayTitle } from './open-play-titles.js';

const BACKUP_URL = new URL('./retitle-open-play-games.backup.json', import.meta.url);
const APPLY = process.argv.includes('--apply');
const REVERT = process.argv.includes('--revert');

/** The seed's `${level} Open Play` shape — the only titles this script rewrites. */
const GENERIC_TITLE = /^(Beginner|Intermediate|Advanced|Open \/ All levels) Open Play$/;
/** Left behind by e2e/owner-recurring-openplay.sh. */
const E2E_TITLE = 'E2E Owner Weekly Open Play';

async function revert() {
  if (!existsSync(BACKUP_URL)) {
    console.error('No backup file — nothing to revert.');
    process.exit(1);
  }
  const backup = JSON.parse(readFileSync(BACKUP_URL, 'utf8'));

  // Put the titles back first — cheap, and independent of the re-inserts.
  let restoredTitles = 0;
  for (const r of backup.retitled ?? []) {
    const res = await Game.updateOne({ _id: new mongoose.Types.ObjectId(r.gameId) }, { $set: { title: r.from } });
    restoredTitles += res.modifiedCount;
  }

  // Re-insert only what is actually missing, so a partial revert is safe.
  const hydrate = (doc: any) => {
    const out: any = { ...doc };
    for (const k of Object.keys(out)) {
      if (/^(_id|.*Id)$/.test(k) && typeof out[k] === 'string' && /^[a-f0-9]{24}$/.test(out[k])) {
        out[k] = new mongoose.Types.ObjectId(out[k]);
      }
      if (Array.isArray(out[k])) {
        out[k] = out[k].map((v: any) => (typeof v === 'string' && /^[a-f0-9]{24}$/.test(v) ? new mongoose.Types.ObjectId(v) : v));
      }
    }
    return out;
  };
  const reinsert = async (Model: any, docs: any[]) => {
    if (!docs?.length) return 0;
    const ids = docs.map((d) => new mongoose.Types.ObjectId(d._id));
    const have = new Set((await Model.find({ _id: { $in: ids } }).select({ _id: 1 }).lean()).map((d: any) => String(d._id)));
    const missing = docs.filter((d) => !have.has(String(d._id))).map(hydrate);
    if (missing.length) await Model.collection.insertMany(missing);
    return missing.length;
  };

  const gamesRestored = await reinsert(Game, backup.deletedGames ?? []);
  const bookingsRestored = await reinsert(Booking, backup.deletedBookings ?? []);

  console.log(JSON.stringify({ reverted: true, restoredTitles, gamesRestored, bookingsRestored }, null, 2));
}

async function main() {
  await connectDb();
  if (REVERT) { await revert(); await mongoose.disconnect(); return; }

  const all = await Game.find({}).lean();

  const e2e = all.filter((g: any) => g.title === E2E_TITLE);
  const generic = all.filter((g: any) => typeof g.title === 'string' && GENERIC_TITLE.test(g.title));

  // Seed the de-dup set with every title we are NOT touching, so a generated name
  // can never collide with one a person wrote.
  const untouched = new Set<string>(
    all.filter((g: any) => !e2e.includes(g) && !generic.includes(g))
      .map((g: any) => g.title).filter((t: any): t is string => typeof t === 'string'),
  );

  const retitled = generic.map((g: any) => ({
    gameId: String(g._id),
    from: g.title,
    // skillLabel carries the level the seed put in the title; date and startTime
    // keep the new name honest about when the game actually is.
    to: openPlayTitle({ date: g.date, startTime: g.startTime, levelLabel: g.skillLabel ?? undefined }, untouched),
  }));

  const e2eBookingIds = e2e.map((g: any) => g.bookingId).filter(Boolean);
  const e2eBookings = e2eBookingIds.length ? await Booking.find({ _id: { $in: e2eBookingIds } }).lean() : [];

  const plan = {
    mode: APPLY ? 'APPLIED' : 'DRY RUN (pass --apply to write)',
    gamesTotal: all.length,
    e2eGamesToDelete: e2e.length,
    e2eBookingsToDelete: e2eBookings.length,
    genericTitlesToRewrite: retitled.length,
    leftAlone: all.length - e2e.length - retitled.length,
    sampleRewrites: retitled.slice(0, 12).map((r) => `${r.from}  →  ${r.to}`),
    // A generated name repeating would mean the composed pool ran dry; surfaced
    // rather than assumed, since the whole point of this script is no repeats.
    duplicateNewTitles: retitled.length - new Set(retitled.map((r) => r.to)).size,
  };
  console.log(JSON.stringify(plan, null, 2));

  if (!APPLY) { await mongoose.disconnect(); return; }

  // Backup BEFORE writing — full rows for the deletions, old→new for the renames.
  writeFileSync(BACKUP_URL, JSON.stringify({
    takenAt: new Date().toISOString(),
    note: 'E2E Games/Bookings deleted and generic Open Play titles rewritten by retitle-open-play-games.ts. Revert with --revert.',
    deletedGames: e2e,
    deletedBookings: e2eBookings,
    retitled,
  }, null, 2));

  const delGames = await Game.deleteMany({ _id: { $in: e2e.map((g: any) => g._id) } });
  const delBookings = e2eBookingIds.length ? await Booking.deleteMany({ _id: { $in: e2eBookingIds } }) : { deletedCount: 0 };

  let renamed = 0;
  for (const r of retitled) {
    const res = await Game.updateOne({ _id: new mongoose.Types.ObjectId(r.gameId) }, { $set: { title: r.to } });
    renamed += res.modifiedCount;
  }

  console.log(JSON.stringify({
    applied: true,
    gamesDeleted: delGames.deletedCount,
    bookingsDeleted: delBookings.deletedCount,
    gamesRetitled: renamed,
    backup: BACKUP_URL.pathname,
  }, null, 2));

  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
