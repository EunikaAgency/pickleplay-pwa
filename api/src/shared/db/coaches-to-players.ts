// Pickleballers API — Reassign every coach user to the player role.
//
// Flips User.roleDefault 'coach' -> 'player'. Nothing else: `coachId` still
// points at the user's Coach document, so their coach profile keeps rendering
// and the change is reversible by flipping the flag back. The Coach collection
// is untouched.
//
// Idempotent — re-running is a no-op once no coach users remain.
//
// Usage: npx tsx src/shared/db/coaches-to-players.ts

import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import mongoose from 'mongoose';
import { connectDb } from './index.js';
import { User } from '../../features/auth/auth.model.js';

const BACKUP_URL = new URL('./coaches-to-players.backup.json', import.meta.url);

async function main() {
  await connectDb();

  const coaches = await User.find({ roleDefault: 'coach' })
    .select('_id email displayName roleDefault coachId')
    .lean() as any[];

  if (coaches.length === 0) {
    console.log(JSON.stringify({ converted: 0, note: 'no coach users left — nothing to do' }, null, 2));
    await mongoose.disconnect();
    process.exit(0);
  }

  // Rollback list, written before the update.
  writeFileSync(BACKUP_URL, JSON.stringify(
    coaches.map((u) => ({ id: String(u._id), email: u.email, displayName: u.displayName, roleDefault: u.roleDefault })),
    null, 2,
  ));

  const res = await User.updateMany({ roleDefault: 'coach' }, { $set: { roleDefault: 'player' } });

  const remaining = await User.countDocuments({ roleDefault: 'coach' });
  const counts = await User.aggregate([{ $group: { _id: '$roleDefault', n: { $sum: 1 } } }, { $sort: { n: -1 } }]);

  console.log(JSON.stringify({
    converted: res.modifiedCount,
    coachUsersRemaining: remaining,
    backup: BACKUP_URL.pathname,
    roleCounts: counts.map((c) => `${c._id}: ${c.n}`),
    sample: coaches.slice(0, 5).map((u) => ({ email: u.email, displayName: u.displayName })),
  }, null, 2));

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error('❌ coach→player conversion failed:', e);
  process.exit(1);
});
