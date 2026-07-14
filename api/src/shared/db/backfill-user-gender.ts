// Pickleballers API — Backfill `gender` onto accounts that predate the field
//
// The profile editor + sign-up form now require a gender, but every account
// created before the field existed has none. This fills them in from the two
// signals already in the data, strongest first:
//
//   1. avatarUrl — randomuser.me portraits are served under /men/ or /women/,
//      and fix-avatar-gender.ts already aligned every one of them to the user's
//      name. This is the most reliable signal we have, so it wins.
//   2. first name — matched against the shared curated lists (name-gender.ts).
//
// A user matching NEITHER is left unset on purpose. Writing a guessed gender
// onto a real account is worse than leaving it blank: the profile editor now
// requires one, so the account self-heals the next time its owner opens it, with
// the truth rather than our guess.
//
// Idempotent (only touches users with no gender) and safe to re-run.
//
// Usage: npx tsx src/shared/db/backfill-user-gender.ts [--apply]
//        Without --apply it's a DRY RUN and writes nothing.

import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDb } from './index.js';
import { User } from '../../features/auth/auth.model.js';
import { genderFromName } from './name-gender.js';

const APPLY = process.argv.includes('--apply');

/** randomuser.me portraits live under /portraits/men/ or /portraits/women/. */
function genderFromAvatar(avatarUrl?: string | null): 'male' | 'female' | null {
  if (!avatarUrl) return null;
  if (/\/portraits\/men\//.test(avatarUrl)) return 'male';
  if (/\/portraits\/women\//.test(avatarUrl)) return 'female';
  return null;
}

async function main() {
  await connectDb();

  // `{ gender: null }` matches both an explicit null AND a missing field.
  const users = await User.find({ gender: null })
    .select('_id email displayName firstName avatarUrl')
    .lean() as any[];

  const ops: any[] = [];
  const skipped: string[] = [];
  let fromAvatar = 0;
  let fromName = 0;

  for (const u of users) {
    const gender = genderFromAvatar(u.avatarUrl) ?? genderFromName(u.firstName, u.displayName);
    if (!gender) {
      skipped.push(`${u.displayName} <${u.email}>`);
      continue;
    }
    if (genderFromAvatar(u.avatarUrl)) fromAvatar++;
    else fromName++;
    ops.push({ updateOne: { filter: { _id: u._id }, update: { $set: { gender } } } });
  }

  if (APPLY && ops.length) await User.bulkWrite(ops);

  console.log('---SUMMARY---');
  console.log(`Mode:                 ${APPLY ? 'APPLY (written)' : 'DRY RUN (nothing written — pass --apply)'}`);
  console.log(`Accounts with no gender: ${users.length}`);
  console.log(`  resolved via avatar:   ${fromAvatar}`);
  console.log(`  resolved via name:     ${fromName}`);
  console.log(`  left unset (unknown):  ${skipped.length}`);
  if (skipped.length) {
    console.log('\nLeft unset — the profile editor will ask these users directly:');
    for (const s of skipped) console.log(`  - ${s}`);
  }

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Gender backfill failed:', err);
  process.exit(1);
});
