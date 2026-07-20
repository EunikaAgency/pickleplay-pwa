// Backfill `capacity` on pre-merge open-play games that never stored one.
//
// Two generations of the same mistake, same fix: the lobby size the host asked for
// never reached `capacity`, which is the field every guard and `spotsLeft` reads.
//
//   (a) Oldest rows predate `capacity` having a schema default, so it's absent.
//   (b) Newer rows were posted by the book-a-court Open Play form, which sent the
//       host's chosen size as `targetPlayers` only — so `capacity` fell back to the
//       schema default of 4 while the form promised 8 or 12. The 5th player got
//       "This game is full" on a lobby advertising 8. (The form now sends
//       `capacity`; this repairs the rows it already wrote.)
//
// In both cases `targetPlayers` holds what the host actually wanted.
//
// Additive and reversible: writes the untouched rows to a backup first, and only
// ever sets a field that was absent.
//
// Usage: npx tsx src/shared/db/backfill-open-play-capacity.ts [--apply]
//        (dry-run by default — pass --apply to write)

import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import mongoose from 'mongoose';
import { connectDb } from './index.js';
import { Game } from '../../features/games/games.model.js';

const BACKUP_URL = new URL('./backfill-open-play-capacity.backup.json', import.meta.url);
const APPLY = process.argv.includes('--apply');

// Mirrors DEFAULT_CAPACITY in games.controller.ts — the value `seats()` would
// otherwise hand these rows.
const FALLBACK = 4;

async function main() {
  await connectDb();

  const missing = await Game.find({
    $or: [
      // (a) never had a capacity at all
      { capacity: { $exists: false } },
      // (b) capacity is the untouched default while targetPlayers says otherwise —
      //     only possible via the form that didn't send capacity.
      { targetPlayers: { $ne: null }, capacity: 4, $expr: { $ne: ['$targetPlayers', 4] } },
    ],
  })
    .select('_id title gameType capacity targetPlayers participantIds')
    .lean() as any[];

  if (missing.length === 0) {
    console.log(JSON.stringify({ backfilled: 0, note: 'no games missing capacity — nothing to do' }, null, 2));
    await mongoose.disconnect();
    process.exit(0);
  }

  const plan = missing.map((g) => {
    const players = (g.participantIds ?? []).length;
    // Never set a cap below the people already in the lobby, and never below the
    // schema minimum of 2 — that would make an existing roster instantly invalid.
    const wanted = g.targetPlayers ?? FALLBACK;
    const capacity = Math.max(2, players, Math.min(wanted, 16)); // 16 = createSchema max
    return {
      id: String(g._id),
      title: g.title ?? '(untitled)',
      gameType: g.gameType,
      targetPlayers: g.targetPlayers ?? null,
      participants: players,
      capacityBefore: g.capacity ?? null,
      capacityAfter: capacity,
      clampedToSchemaMax: (g.targetPlayers ?? FALLBACK) > 16,
    };
  });

  // Rollback list, written before any update. `capacityBefore: null` means the field
  // was absent (revert = $unset); a number means restore that value.
  if (APPLY) writeFileSync(BACKUP_URL, JSON.stringify(plan, null, 2));

  let backfilled = 0;
  if (APPLY) {
    for (const p of plan) {
      await Game.updateOne({ _id: p.id }, { $set: { capacity: p.capacityAfter } });
      backfilled++;
    }
  }

  console.log(JSON.stringify({
    mode: APPLY ? 'APPLIED' : 'DRY RUN (pass --apply to write)',
    found: missing.length,
    backfilled,
    backup: APPLY ? BACKUP_URL.pathname : null,
    plan,
  }, null, 2));

  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
