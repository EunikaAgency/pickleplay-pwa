// Pickleballers API — Backfill user location + avatars
//
// Two idempotent backfills for demo completeness:
//   1) Every PLAYER without a location (lat/lng) gets a random point inside the
//      Cavite → Manila corridor, so nearby-people / map discovery has data.
//   2) Every USER (any role) without an avatar gets a randomuser.me portrait
//      (same source the existing seeded avatars use), gender-agnostic rotation.
//
// Safe to re-run: only fills users that are still missing the field.
//
// Usage: npx tsx src/shared/db/backfill-user-location-avatars.ts

import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDb } from './index.js';
import { User } from '../../features/auth/auth.model.js';

// Cavite (south) → Manila (north) bounding box. Random points here land across
// Cavite, Parañaque/Las Piñas/Muntinlupa, and up into Manila proper.
const LAT_MIN = 14.24;  // ~Cavite (Bacoor/Imus)
const LAT_MAX = 14.62;  // ~Manila / Quezon City edge
const LNG_MIN = 120.90; // ~Cavite coast / Manila Bay side
const LNG_MAX = 121.06; // ~eastern Metro Manila

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const round5 = (n: number) => Math.round(n * 1e5) / 1e5;

async function main() {
  await connectDb();

  // ── 1) Player locations ─────────────────────────────────────────────────────
  const playersNoLoc = await User.find({
    roleDefault: 'player',
    $or: [{ lat: null }, { lat: { $exists: false } }, { lng: null }, { lng: { $exists: false } }],
  }).select('_id').lean() as any[];

  const locOps = playersNoLoc.map((u) => ({
    updateOne: {
      filter: { _id: u._id },
      update: { $set: { lat: round5(rand(LAT_MIN, LAT_MAX)), lng: round5(rand(LNG_MIN, LNG_MAX)) } },
    },
  }));
  if (locOps.length) await User.bulkWrite(locOps);

  // ── 2) Avatars (all roles) ──────────────────────────────────────────────────
  const noAvatar = await User.find({
    $or: [{ avatarUrl: null }, { avatarUrl: { $exists: false } }, { avatarUrl: '' }],
  }).select('_id firstName displayName').lean() as any[];

  // randomuser.me portraits: 0..99 per gender. Rotate deterministically per user
  // so re-runs are stable-ish and we don't collide too often.
  const avatarOps = noAvatar.map((u, i) => {
    const gender = i % 2 === 0 ? 'men' : 'women';
    const n = i % 100;
    return {
      updateOne: {
        filter: { _id: u._id },
        update: { $set: { avatarUrl: `https://randomuser.me/api/portraits/${gender}/${n}.jpg` } },
      },
    };
  });
  if (avatarOps.length) await User.bulkWrite(avatarOps);

  console.log('---SUMMARY---');
  console.log(`Players given a location: ${locOps.length}`);
  console.log(`  Box: lat ${LAT_MIN}..${LAT_MAX}, lng ${LNG_MIN}..${LNG_MAX} (Cavite → Manila)`);
  console.log(`Users given an avatar:    ${avatarOps.length}`);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Backfill failed:', err);
  process.exit(1);
});
