// Pickleballers API — Test-owner venue setup (Nicolas Garrido & Oscar Walker)
//
// Sets up a clean owner test-fixture: our two owner test users each end up with
// exactly 100 venues, and NO other owner holds any venue. Venues are picked
// randomly from ALL live venues (not region-filtered) so lat/lng/city stay
// coherent — and each gets a random courtCount in 6..12 with matching Court docs.
//
// What it does (idempotent — re-running reshuffles):
//   1) Wipes Venue.ownerUserId on ALL venues and resets their state to
//      'unclaimed' (so only the two target owners end up owning anything).
//   2) Builds a pool from ALL live (non-deleted) venues — picks 200 at random.
//      The Dink Lab is pinned (always included, assigned to Oscar Walker).
//   3) Assigns 100 to Nicolas Garrido and 100 to Oscar Walker (state → 'claimed').
//   4) Sets each assigned venue's courtCount to a random 6..12.
//   5) Reconciles Court docs per venue: deletes courts numbered above the new
//      count, then creates the missing ones (1..courtCount), imaged from the
//      venue's own photos (mirrors generate-courts.ts).
//
// Usage: npx tsx src/shared/db/assign-two-owners-test-venues.ts

import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDb } from './index.js';
import { User } from '../../features/auth/auth.model.js';
import { Venue, Court } from '../../features/venues/venues.model.js';

const OWNER_NAMES = ['Nicolas Garrido', 'Oscar Walker'];
const VENUES_PER_OWNER = 100;
const COURTS_MIN = 6;
const COURTS_MAX = 12;
const BACKFILL_TAG = 'court-backfill';
const DINK_LAB_SLUG = 'the-dink-lab';

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

const randInt = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));

function indoorFor(indoorOutdoor?: string | null): boolean | undefined {
  if (indoorOutdoor === 'indoor') return true;
  if (indoorOutdoor === 'outdoor') return false;
  return undefined;
}

function surfaceFor(surfaceType?: string | null): string | undefined {
  const s = (surfaceType ?? '').trim();
  if (!s || s.toLowerCase() === 'unknown') return undefined;
  return s.slice(0, 50);
}

function imagePool(mainImageUrl?: string | null, galleryImageUrls?: (string | null)[] | null): string[] {
  const all = [mainImageUrl, ...(galleryImageUrls ?? [])].filter(
    (u): u is string => typeof u === 'string' && u.length > 0,
  );
  return [...new Set(all)];
}

// Rebuild Court docs so a venue has exactly courts 1..count. Deletes any court
// numbered above `count`, creates the missing ones (imaged from the venue).
async function reconcileCourts(v: any, count: number) {
  const surfaceType = surfaceFor(v.surfaceType);
  const indoor = indoorFor(v.indoorOutdoor);
  const pool = imagePool(v.mainImageUrl, v.galleryImageUrls);
  const heroFor = (n: number): string | undefined => (pool.length ? pool[(n - 1) % pool.length] : undefined);

  const existing = await Court.find({ venueId: v._id }).select('courtNumber mainImageUrl');
  const have = new Set(existing.map((c) => String(c.courtNumber)));

  // Drop courts numbered above the new count (numeric-only numbers).
  const overflow = existing.filter((c) => {
    const n = parseInt(String(c.courtNumber), 10);
    return Number.isFinite(n) && n > count;
  });
  if (overflow.length) await Court.deleteMany({ _id: { $in: overflow.map((c) => c._id) } });

  const toInsert: Record<string, unknown>[] = [];
  for (let n = 1; n <= count; n++) {
    if (have.has(String(n))) continue;
    const hero = heroFor(n);
    toInsert.push({
      venueId: v._id,
      courtNumber: String(n),
      courtName: `Court ${n}`,
      ...(surfaceType ? { surfaceType } : {}),
      ...(indoor !== undefined ? { indoor } : {}),
      ...(hero ? { mainImageUrl: hero, galleryImageUrls: pool } : {}),
      isActive: true,
      _importId: BACKFILL_TAG,
    });
  }
  if (toInsert.length) await Court.insertMany(toInsert);
  return { created: toInsert.length, removed: overflow.length };
}

async function main() {
  await connectDb();

  const owners = await User.find({ displayName: { $in: OWNER_NAMES }, roleDefault: 'owner' })
    .select('_id displayName email')
    .lean();
  if (owners.length !== OWNER_NAMES.length) {
    throw new Error(`Expected owners [${OWNER_NAMES.join(', ')}], found: ${owners.map((o: any) => o.displayName).join(', ')}`);
  }

  const NEED = VENUES_PER_OWNER * OWNER_NAMES.length; // 200

  // Pool: ALL live venues. Pin The Dink Lab so it's always included.
  const allVenues = await Venue.find({ deletedAt: null })
    .select('_id displayName slug region surfaceType indoorOutdoor mainImageUrl galleryImageUrls')
    .lean();

  if (allVenues.length < NEED) {
    throw new Error(`Only ${allVenues.length} live venues available, need ${NEED}.`);
  }

  const dink = allVenues.find((v: any) => v.slug === DINK_LAB_SLUG);
  const rest = shuffle(allVenues.filter((v: any) => v.slug !== DINK_LAB_SLUG));

  // Build pool: The Dink Lab first, then fill the rest randomly.
  const pool = dink ? [dink, ...rest.slice(0, NEED - 1)] : rest.slice(0, NEED);
  if (pool.length < NEED) {
    throw new Error(`Only ${pool.length} venues in pool, need ${NEED}.`);
  }

  if (!dink) {
    console.warn('⚠ The Dink Lab not found in the database — proceeding without it.');
  }

  // 1) Wipe ALL ownership so only the two target owners hold venues.
  await Venue.updateMany({}, { $unset: { ownerUserId: 1 }, $set: { state: 'unclaimed' } });

  // 2) Split the pool 100/100 across the two owners.
  const byName = new Map(owners.map((o: any) => [o.displayName, o]));
  const assignments = OWNER_NAMES.map((name, i) => ({
    owner: byName.get(name)!,
    venues: pool.slice(i * VENUES_PER_OWNER, (i + 1) * VENUES_PER_OWNER),
  }));

  const summary: any[] = [];
  for (const a of assignments) {
    const rows: any[] = [];
    for (const v of a.venues) {
      const courtCount = randInt(COURTS_MIN, COURTS_MAX);
      await Venue.updateOne(
        { _id: v._id },
        { $set: { ownerUserId: a.owner._id, state: 'claimed', courtCount } },
      );
      const { created, removed } = await reconcileCourts(v, courtCount);
      rows.push({ name: v.displayName, region: v.region, courtCount, courtsCreated: created, courtsRemoved: removed });
    }
    summary.push({ owner: a.owner.displayName, email: a.owner.email, count: a.venues.length, venues: rows });
  }

  // 3) Sanity: no venue outside the two owners is owned.
  const strayOwned = await Venue.countDocuments({
    ownerUserId: { $exists: true, $ne: null, $nin: assignments.map((a) => a.owner._id) },
  });

  console.log('---SUMMARY-JSON-START---');
  console.log(JSON.stringify({
    ownersConfigured: assignments.map((a) => ({ name: a.owner.displayName, venues: a.venues.length })),
    totalAssigned: assignments.reduce((s, a) => s + a.venues.length, 0),
    strayOwnedVenues: strayOwned,
    courtCountRange: [COURTS_MIN, COURTS_MAX],
    detail: summary,
  }, null, 2));
  console.log('---SUMMARY-JSON-END---');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Test-owner setup failed:', err);
  process.exit(1);
});
