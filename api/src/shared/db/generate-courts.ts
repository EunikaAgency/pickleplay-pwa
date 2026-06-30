// Pickleballers API — Backfill individual Court docs from Venue.courtCount
//
// The real-data handoff shipped `court_count` (an aggregate number on each
// venue) but `venue_courts.csv` was EMPTY, so no per-court rows exist. As a
// result a venue can advertise `courtCount: 3` yet have zero documents in the
// `courts` collection — the count is set, but there's nothing to list or book.
//
// This script reconciles that: for every venue with `courtCount > 0` it ensures
// court docs numbered 1..courtCount exist, deriving surface/indoor from the
// venue's own `surfaceType` / `indoorOutdoor` fields and giving each court an
// image + gallery rotated from the venue's own `mainImageUrl`/`galleryImageUrls`
// (so Court 1, 2, 3 don't all show the same photo).
//
// ADDITIVE-ONLY by design: it only creates the court numbers that are missing
// and NEVER deletes. Existing court docs (some are referenced by bookings via
// `courtId`) are left untouched, except that courts still lacking an image get
// one backfilled. Safe and idempotent — re-running creates/changes nothing once
// every venue is full and imaged.
//
// Note: `npm run db:import` DROPS the `courts` collection, so re-run this after
// any real-data import. Generated docs are tagged `_importId: 'court-backfill'`
// so they can be told apart from CSV-imported courts later.
//
// Usage: npx tsx src/shared/db/generate-courts.ts   (or: npm run db:courts)

import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDb } from './index.js';
import { Venue, Court } from '../../features/venues/venues.model.js';

const BACKFILL_TAG = 'court-backfill';

// Map a venue's indoorOutdoor flag onto a per-court boolean.
// 'mixed' stays undefined — we don't know which courts are indoors.
function indoorFor(indoorOutdoor?: string | null): boolean | undefined {
  if (indoorOutdoor === 'indoor') return true;
  if (indoorOutdoor === 'outdoor') return false;
  return undefined;
}

// Reuse the venue's real surfaceType (capped to the schema's 50 chars).
// Drop the literal placeholder 'unknown' rather than store it on every court.
function surfaceFor(surfaceType?: string | null): string | undefined {
  const s = (surfaceType ?? '').trim();
  if (!s || s.toLowerCase() === 'unknown') return undefined;
  return s.slice(0, 50);
}

// The venue's full, de-duped image set (main first, then gallery). Each court
// gets one of these as its hero (rotated by court number) and the whole set as
// its gallery. Empty when the venue has no images on file yet.
function imagePool(mainImageUrl?: string | null, galleryImageUrls?: (string | null)[] | null): string[] {
  const all = [mainImageUrl, ...(galleryImageUrls ?? [])].filter(
    (u): u is string => typeof u === 'string' && u.length > 0,
  );
  return [...new Set(all)];
}

async function main() {
  await connectDb();

  const venues = await Venue.find({ courtCount: { $gt: 0 } })
    .sort({ _id: 1 })
    .select('_id slug displayName courtCount surfaceType indoorOutdoor mainImageUrl galleryImageUrls');

  console.log(`Venues with courtCount > 0: ${venues.length}`);

  const toInsert: Record<string, unknown>[] = [];
  const imageUpdates: { updateOne: { filter: object; update: object } }[] = [];
  let venuesTouched = 0;
  let alreadyFull = 0;

  for (const v of venues) {
    const target = v.courtCount ?? 0;
    const surfaceType = surfaceFor(v.surfaceType);
    const indoor = indoorFor(v.indoorOutdoor);
    const pool = imagePool(v.mainImageUrl, v.galleryImageUrls);

    // Hero image for court n (1-based), rotating through the venue's images.
    const heroFor = (n: number): string | undefined =>
      pool.length ? pool[(n - 1) % pool.length] : undefined;

    // Court numbers (and their image state) that already exist for this venue.
    const existing = await Court.find({ venueId: v._id }).select('courtNumber mainImageUrl');
    const have = new Set(existing.map((c) => String(c.courtNumber)));

    let created = 0;
    for (let n = 1; n <= target; n++) {
      if (have.has(String(n))) continue; // fill gaps only — never duplicate
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
      created++;
    }

    // Backfill an image onto any existing court that doesn't have one yet
    // (covers the dummy-seeded courts and earlier image-less backfill runs).
    if (pool.length) {
      for (const ex of existing) {
        if (ex.mainImageUrl) continue;
        const n = parseInt(String(ex.courtNumber), 10) || 1;
        imageUpdates.push({
          updateOne: {
            filter: { _id: ex._id },
            update: { $set: { mainImageUrl: heroFor(n), galleryImageUrls: pool } },
          },
        });
      }
    }

    if (created > 0) venuesTouched++;
    else alreadyFull++;
  }

  if (toInsert.length) await Court.insertMany(toInsert);
  if (imageUpdates.length) await Court.bulkWrite(imageUpdates);

  console.log('---SUMMARY---');
  console.log(`Court docs created:           ${toInsert.length}`);
  console.log(`Existing courts image-filled: ${imageUpdates.length}`);
  console.log(`Venues that got courts:       ${venuesTouched}`);
  console.log(`Venues already complete:      ${alreadyFull}`);
  console.log(`Total court docs now:         ${await Court.countDocuments()}`);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Court backfill failed:', err);
  process.exit(1);
});
