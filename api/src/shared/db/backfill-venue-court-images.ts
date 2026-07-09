// Pickleballers API — Backfill missing venue + court images
//
// Some venues (and their courts) have no photo, so the app shows a bare
// gradient. This fills every venue without a mainImageUrl using a rotating set
// of stock pickleball/court photos, and every court without one from its
// venue's image (or the same stock pool as a fallback).
//
// Uses external Unsplash stock URLs (the app's apiImageUrl passes https:// URLs
// through as-is). ADDITIVE + idempotent: only fills docs still missing an image;
// existing images are never overwritten.
//
// Usage: npx tsx src/shared/db/backfill-venue-court-images.ts

import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDb } from './index.js';
import { Venue, Court } from '../../features/venues/venues.model.js';

// Stock pickleball / racket-court photos (Unsplash direct image URLs, sized).
const STOCK = [
  'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=1200&q=70',
  'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=1200&q=70',
  'https://images.unsplash.com/photo-1595435742656-5272d0b3fa82?auto=format&fit=crop&w=1200&q=70',
  'https://images.unsplash.com/photo-1613918431703-aa50889e3be9?auto=format&fit=crop&w=1200&q=70',
  'https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?auto=format&fit=crop&w=1200&q=70',
  'https://images.unsplash.com/photo-1519861531473-9200262188bf?auto=format&fit=crop&w=1200&q=70',
  'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=1200&q=70',
  'https://images.unsplash.com/photo-1626248801379-51a0748a5f96?auto=format&fit=crop&w=1200&q=70',
];

const hasImg = (v: any) => typeof v?.mainImageUrl === 'string' && v.mainImageUrl.trim() !== '';

async function main() {
  await connectDb();

  // ── 1) Venues without an image ───────────────────────────────────────────────
  const venuesNoImg = await Venue.find({
    deletedAt: null,
    $or: [{ mainImageUrl: null }, { mainImageUrl: { $exists: false } }, { mainImageUrl: '' }],
  }).select('_id').lean() as any[];

  const venueOps = venuesNoImg.map((v, i) => {
    const img = STOCK[i % STOCK.length];
    // Give a small gallery too (the hero + two more) so the detail strip isn't bare.
    const gallery = [img, STOCK[(i + 1) % STOCK.length], STOCK[(i + 2) % STOCK.length]];
    return { updateOne: { filter: { _id: v._id }, update: { $set: { mainImageUrl: img, galleryImageUrls: gallery } } } };
  });
  if (venueOps.length) await Venue.bulkWrite(venueOps);

  // ── 2) Courts without an image ───────────────────────────────────────────────
  // Prefer the court's own venue image (now that step 1 filled venues); fall back
  // to the stock pool rotated by court index.
  const courtsNoImg = await Court.find({
    $or: [{ mainImageUrl: null }, { mainImageUrl: { $exists: false } }, { mainImageUrl: '' }],
  }).select('_id venueId').lean() as any[];

  // Batch-load the venues these courts belong to (for their now-set image).
  const venueIds = [...new Set(courtsNoImg.map((c) => String(c.venueId)))];
  const venues = await Venue.find({ _id: { $in: venueIds } }).select('_id mainImageUrl galleryImageUrls').lean() as any[];
  const venueById = new Map(venues.map((v) => [String(v._id), v]));

  const courtOps = courtsNoImg.map((c, i) => {
    const v = venueById.get(String(c.venueId));
    const hero = hasImg(v) ? v.mainImageUrl : STOCK[i % STOCK.length];
    const gallery = (v?.galleryImageUrls?.length ? v.galleryImageUrls : [hero, STOCK[(i + 1) % STOCK.length]]);
    return { updateOne: { filter: { _id: c._id }, update: { $set: { mainImageUrl: hero, galleryImageUrls: gallery } } } };
  });
  if (courtOps.length) await Court.bulkWrite(courtOps);

  console.log('---SUMMARY---');
  console.log(`Venues imaged: ${venueOps.length}`);
  console.log(`Courts imaged: ${courtOps.length}`);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Image backfill failed:', err);
  process.exit(1);
});
