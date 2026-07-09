// Pickleballers API — Shop + Partners dummy data for the two test owners
//
// Seeds realistic data behind two owner-console screens that were empty for our
// test owners (Nicolas Garrido & Oscar Walker):
//   • /shop           → RentalInventoryItem docs (equipment stock)
//   • /owner/partners → CoachApplication + OrganizerApplication docs at their venues
//
// Idempotent: clears the two owners' rental items + their venues' applications
// first, then reseeds. Safe to re-run. Re-run after db:import / seed:users.
//
// Usage: npx tsx src/shared/db/seed-owner-shop-partners.ts

import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDb } from './index.js';
import { User } from '../../features/auth/auth.model.js';
import { Venue } from '../../features/venues/venues.model.js';
import { RentalInventoryItem } from '../../features/rental-inventory/rental-inventory.model.js';
import { CoachApplication } from '../../features/coach-applications/coach-applications.model.js';
import { OrganizerApplication } from '../../features/organizer-applications/organizer-applications.model.js';

const OWNER_NAMES = ['Nicolas Garrido', 'Oscar Walker'];

const randInt = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]!;
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

// ── Rental catalogue (name, brand, category) ─────────────────────────────────
const CATALOGUE: { name: string; brand: string; category: 'paddle' | 'ball' | 'gear' | 'apparel' | 'other' }[] = [
  { name: 'Carbon Pro Paddle', brand: 'JOOLA', category: 'paddle' },
  { name: 'Ben Johns Hyperion', brand: 'JOOLA', category: 'paddle' },
  { name: 'Selkirk AMPED Epic', brand: 'Selkirk', category: 'paddle' },
  { name: 'CRBN 1X Power Series', brand: 'CRBN', category: 'paddle' },
  { name: 'Engage Pursuit Pro', brand: 'Engage', category: 'paddle' },
  { name: 'Franklin X-40 Balls (3-pack)', brand: 'Franklin', category: 'ball' },
  { name: 'Onix Fuse G2 Balls (6-pack)', brand: 'Onix', category: 'ball' },
  { name: 'Dura Fast 40 Balls (12-pack)', brand: 'Dura', category: 'ball' },
  { name: 'Portable Net System', brand: 'Gamma', category: 'gear' },
  { name: 'Court Line Marker Set', brand: 'Generic', category: 'gear' },
  { name: 'Ball Hopper / Caddy', brand: 'Tourna', category: 'gear' },
  { name: 'Overgrip Roll (30-pack)', brand: 'Tourna', category: 'gear' },
  { name: 'Performance Dri-Fit Shirt', brand: 'Nike', category: 'apparel' },
  { name: 'Athletic Court Shorts', brand: 'Adidas', category: 'apparel' },
  { name: 'Court Shoes (rental)', brand: 'ASICS', category: 'apparel' },
  { name: 'Sweatband Set', brand: 'Nike', category: 'apparel' },
  { name: 'First Aid Kit', brand: 'Generic', category: 'other' },
  { name: 'Cooler Water Dispenser', brand: 'Coleman', category: 'other' },
];

const CONDITIONS = ['excellent', 'good', 'good', 'good', 'fair', 'needs_repair'] as const;
const PRICE_BY_CATEGORY: Record<string, [number, number]> = {
  paddle: [80, 200], ball: [30, 80], gear: [50, 150], apparel: [40, 120], other: [60, 250],
};

function statusFor(available: number, total: number): 'available' | 'partially_rented' | 'fully_rented' | 'maintenance' {
  if (available === 0) return 'fully_rented';
  if (available < total) return 'partially_rented';
  return 'available';
}

async function main() {
  await connectDb();

  const owners = await User.find({ displayName: { $in: OWNER_NAMES }, roleDefault: 'owner' })
    .select('_id displayName')
    .lean() as any[];
  if (owners.length !== OWNER_NAMES.length) {
    throw new Error(`Expected owners [${OWNER_NAMES.join(', ')}], found: ${owners.map((o) => o.displayName).join(', ')}`);
  }

  // Applicant pools: coaches for coach apps, organizers for organizer apps.
  const coaches = await User.find({ roleDefault: 'coach' }).select('_id displayName').lean() as any[];
  const organizers = await User.find({ roleDefault: 'organizer' }).select('_id displayName').lean() as any[];

  const ownerIds = owners.map((o) => o._id);
  const venuesByOwner = new Map<string, any[]>();
  for (const o of owners) {
    venuesByOwner.set(String(o._id), await Venue.find({ ownerUserId: o._id, deletedAt: null }).select('_id displayName').lean() as any[]);
  }

  // ── Wipe prior seed (idempotent) ───────────────────────────────────────────
  const delItems = await RentalInventoryItem.deleteMany({ ownerId: { $in: ownerIds } });
  const allVenueIds = [...venuesByOwner.values()].flat().map((v) => v._id);
  const delCoach = await CoachApplication.deleteMany({ venueId: { $in: allVenueIds } });
  const delOrg = await OrganizerApplication.deleteMany({ venueId: { $in: allVenueIds } });
  console.log(`Cleared: ${delItems.deletedCount} items, ${delCoach.deletedCount} coach apps, ${delOrg.deletedCount} organizer apps`);

  // ── 1) Rental inventory (Shop) ─────────────────────────────────────────────
  const itemRows: Record<string, unknown>[] = [];
  for (const o of owners) {
    const venues = venuesByOwner.get(String(o._id)) ?? [];
    const initials = o.displayName.split(' ').map((s: string) => s[0]).join('').toUpperCase();
    // 12–16 items per owner, spread across their venues.
    const catalogue = shuffle([...CATALOGUE]).slice(0, randInt(12, 16));
    catalogue.forEach((c, i) => {
      const total = randInt(4, 30);
      const rented = randInt(0, Math.min(total, 8));
      const available = total - rented;
      const [lo, hi] = PRICE_BY_CATEGORY[c.category]!;
      const venue = venues.length ? pick(venues) : null;
      itemRows.push({
        ownerId: o._id,
        venueId: venue?._id ?? null,
        name: c.name,
        brand: c.brand,
        sku: `${initials}-${c.category.slice(0, 3).toUpperCase()}-${String(i + 1).padStart(3, '0')}`,
        category: c.category,
        rentalPricePerHour: randInt(lo, hi),
        totalStock: total,
        availableStock: available,
        rentedCount: rented,
        lowStockThreshold: 3,
        condition: pick([...CONDITIONS]),
        status: statusFor(available, total),
        description: `${c.brand} ${c.name} — available for hourly rental.`,
      });
    });
  }
  if (itemRows.length) await RentalInventoryItem.insertMany(itemRows);

  // ── 2) Partner applications (Partners) ─────────────────────────────────────
  // Give each owner a handful of coaches + organizers spread across their venues,
  // with a realistic status mix (mostly approved, a few pending, one rejected).
  const STATUS_MIX = ['approved', 'approved', 'approved', 'pending', 'pending', 'rejected'] as const;
  const COACH_MSG = 'I run beginner & intermediate clinics and would love to coach at your venue.';
  const ORG_MSG = 'I organise weekend round-robins and would like to host events at your venue.';

  const coachRows: Record<string, unknown>[] = [];
  const orgRows: Record<string, unknown>[] = [];
  // Track uniqueness (applicant+venue) to respect the unique index.
  const seenCoach = new Set<string>();
  const seenOrg = new Set<string>();

  for (const o of owners) {
    const venues = venuesByOwner.get(String(o._id)) ?? [];
    if (!venues.length) continue;

    // 5 coaches, each at 1–3 of this owner's venues.
    for (const coach of shuffle([...coaches]).slice(0, 5)) {
      for (const v of shuffle([...venues]).slice(0, randInt(1, 3))) {
        const key = `${coach._id}|${v._id}`;
        if (seenCoach.has(key)) continue;
        seenCoach.add(key);
        const status = pick([...STATUS_MIX]);
        coachRows.push({
          coachUserId: coach._id,
          venueId: v._id,
          status,
          message: COACH_MSG,
          ...(status !== 'pending' ? { decidedByUserId: o._id, decidedAt: new Date() } : {}),
        });
      }
    }

    // 4 organizers, each at 1–2 of this owner's venues.
    for (const org of shuffle([...organizers]).slice(0, 4)) {
      for (const v of shuffle([...venues]).slice(0, randInt(1, 2))) {
        const key = `${org._id}|${v._id}`;
        if (seenOrg.has(key)) continue;
        seenOrg.add(key);
        const status = pick([...STATUS_MIX]);
        orgRows.push({
          organizerUserId: org._id,
          venueId: v._id,
          status,
          message: ORG_MSG,
          ...(status !== 'pending' ? { decidedByUserId: o._id, decidedAt: new Date() } : {}),
        });
      }
    }
  }
  if (coachRows.length) await CoachApplication.insertMany(coachRows);
  if (orgRows.length) await OrganizerApplication.insertMany(orgRows);

  console.log('---SUMMARY---');
  console.log(`Rental items inserted:        ${itemRows.length}`);
  console.log(`Coach applications inserted:  ${coachRows.length}`);
  console.log(`Organizer applications:       ${orgRows.length}`);
  for (const o of owners) {
    const venues = venuesByOwner.get(String(o._id)) ?? [];
    console.log(`  ${o.displayName}: ${venues.length} venues`);
  }

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Shop/Partners seed failed:', err);
  process.exit(1);
});
