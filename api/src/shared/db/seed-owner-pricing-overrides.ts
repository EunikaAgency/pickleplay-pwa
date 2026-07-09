// Pickleballers API — Pricing-override seed for the two test owners' venues
//
// Replicates The Dink Lab's SlotPriceOverride pattern across every venue owned
// by our two test owners (Nicolas Garrido & Oscar Walker), so the owner Pricing
// screen and the player booking flow both have real per-day pricing to show.
//
// Pattern (per venue, per day, venue-wide — courtId null), from TODAY forward
// DAYS days:
//   Weekdays: 04:00-08:00 = early-bird, 08:00-22:00 = peak
//   Weekends: 04:00-06:00 = early-bird, 06:00-22:00 = weekend prime
// Base prices mirror Dink Lab (150 / 350 / 450) with a small per-venue jitter so
// venues aren't all identical.
//
// Idempotent: wipes existing overrides for these venues within the date window
// first, then reinserts. Safe to re-run. Re-run after db:import/seed:users.
//
// Usage: npx tsx src/shared/db/seed-owner-pricing-overrides.ts

import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDb } from './index.js';
import { User } from '../../features/auth/auth.model.js';
import { Venue, SlotPriceOverride } from '../../features/venues/venues.model.js';

const OWNER_NAMES = ['Nicolas Garrido', 'Oscar Walker'];
const DAYS = 14; // seed today + next 13 days

// Local YYYY-MM-DD (avoids UTC shift — same helper the pricing screen uses).
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

async function main() {
  await connectDb();

  const owners = await User.find({ displayName: { $in: OWNER_NAMES }, roleDefault: 'owner' })
    .select('_id displayName')
    .lean();
  if (!owners.length) throw new Error(`No owners found for ${OWNER_NAMES.join(', ')}`);
  const ownerIds = owners.map((o: any) => o._id);

  const venues = await Venue.find({ ownerUserId: { $in: ownerIds }, deletedAt: null })
    .select('_id displayName ownerUserId')
    .sort({ _id: 1 })
    .lean();
  console.log(`Owners: ${owners.length}  Owned venues: ${venues.length}`);

  // Build the date window (today .. today+DAYS-1) as YYYY-MM-DD.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dates: { str: string; weekend: boolean }[] = [];
  for (let i = 0; i < DAYS; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dow = d.getDay(); // 0 Sun .. 6 Sat
    dates.push({ str: ymd(d), weekend: dow === 0 || dow === 6 });
  }
  const dateStrs = dates.map((d) => d.str);

  // 1) Wipe existing overrides for these venues in the window (idempotent).
  const del = await SlotPriceOverride.deleteMany({
    venueId: { $in: venues.map((v: any) => v._id) },
    date: { $in: dateStrs },
  });
  console.log(`Cleared ${del.deletedCount} existing override(s) in the window.`);

  // 2) Reinsert the Dink-Lab-style pattern per venue.
  const rows: Record<string, unknown>[] = [];
  let vIdx = 0;
  for (const v of venues as any[]) {
    // Small deterministic per-venue jitter (0 / +25 / +50) so prices vary.
    const bump = (vIdx % 3) * 25;
    const early = 150 + bump;      // early-bird
    const peak = 350 + bump;       // weekday peak
    const weekend = 450 + bump;    // weekend prime
    vIdx++;

    for (const d of dates) {
      if (d.weekend) {
        rows.push(
          { venueId: v._id, courtId: null, date: d.str, startTime: '04:00', endTime: '06:00', price: early, createdByUserId: v.ownerUserId },
          { venueId: v._id, courtId: null, date: d.str, startTime: '06:00', endTime: '22:00', price: weekend, createdByUserId: v.ownerUserId },
        );
      } else {
        rows.push(
          { venueId: v._id, courtId: null, date: d.str, startTime: '04:00', endTime: '08:00', price: early, createdByUserId: v.ownerUserId },
          { venueId: v._id, courtId: null, date: d.str, startTime: '08:00', endTime: '22:00', price: peak, createdByUserId: v.ownerUserId },
        );
      }
    }
  }
  if (rows.length) await SlotPriceOverride.insertMany(rows);

  console.log('---SUMMARY---');
  console.log(`Venues seeded:        ${venues.length}`);
  console.log(`Date window:          ${dateStrs[0]} .. ${dateStrs[dateStrs.length - 1]} (${DAYS} days)`);
  console.log(`Overrides inserted:   ${rows.length}`);
  console.log(`Per venue:            ${rows.length / (venues.length || 1)} rows`);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Pricing-override seed failed:', err);
  process.exit(1);
});
