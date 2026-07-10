// Pickleballers API — Re-address + re-coordinate every venue except The Dink Lab.
//
// Locations come from `luzon-basketball-court-locations.json`: real basketball
// courts mapped in OpenStreetMap across the Luzon island group, each one
// reverse-geocoded through Nominatim and kept only if it resolved to a
// Philippine locality. Two properties fall out of that:
//
//   * No venue can land in the sea. A point in open water either fails to
//     reverse-geocode at all or resolves to a foreign maritime boundary, and
//     both were rejected when the dataset was built.
//   * The address always matches the coordinate, because the address IS the
//     reverse-geocode of that coordinate (the old seed file paired a
//     municipality's address with a point offset up to ~2km away from it).
//
// The points were chosen by farthest-point sampling, so they spread across the
// whole island group instead of clumping in Metro Manila where court density is
// highest.
//
// The Dink Lab keeps its real Kawit, Cavite location — it is the fixture other
// demo data is pinned to.
//
// Re-runnable: writes a rollback file (scatter-venues-real-courts.backup.json)
// before touching anything.
//
// Usage: npx tsx src/shared/db/scatter-venues-real-courts.ts

import 'dotenv/config';
import { readFileSync, writeFileSync } from 'node:fs';
import { connectDb, disconnectDb } from './index.js';
import { Venue } from '../../features/venues/venues.model.js';

type Point = {
  lat: number;
  lng: number;
  osm: string;
  name: string | null;
  country: string;
  cityName: string;
  area: string;
  region: string;
  addressLine1: string;
  postalCode: string;
  fullAddress: string;
  googleMapsUrl: string;
};

const POINTS_URL = new URL('./luzon-basketball-court-locations.json', import.meta.url);
const BACKUP_URL = new URL('./scatter-venues-real-courts.backup.json', import.meta.url);
const DINK_SLUG = 'the-dink-lab';

// Luzon island group, generous bounds. A sanity net, not the real land check —
// that already happened when the dataset was built.
const BOUNDS = { minLat: 11.9, maxLat: 19.0, minLng: 119.2, maxLng: 124.5 };

function shuffle<T>(arr: T[], seed: number): T[] {
  // Deterministic (mulberry32) so a re-run is reproducible.
  let s = seed >>> 0;
  const rand = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function loadPoints(): Point[] {
  const points = JSON.parse(readFileSync(POINTS_URL, 'utf8')) as Point[];
  if (!Array.isArray(points) || points.length === 0) {
    throw new Error('Location dataset is empty or invalid');
  }
  for (const p of points) {
    if (typeof p.lat !== 'number' || typeof p.lng !== 'number') {
      throw new Error(`Point missing coordinates: ${JSON.stringify(p)}`);
    }
    if (p.lat < BOUNDS.minLat || p.lat > BOUNDS.maxLat || p.lng < BOUNDS.minLng || p.lng > BOUNDS.maxLng) {
      throw new Error(`Point outside Luzon bounds: ${p.lat},${p.lng} (${p.fullAddress})`);
    }
    if (p.country !== 'Philippines') {
      throw new Error(`Point outside the Philippines: ${p.fullAddress}`);
    }
  }
  return points;
}

async function main() {
  await connectDb();

  const dink = await Venue.findOne({ slug: DINK_SLUG })
    .select('_id slug displayName lat lng cityName area region fullAddress')
    .lean() as any;
  if (!dink) throw new Error('The Dink Lab not found — refusing to run.');

  const venues = await Venue.find({ slug: { $ne: DINK_SLUG } })
    .sort({ _id: 1 })
    .select('_id slug displayName lat lng cityName area region country addressLine1 addressLine2 postalCode fullAddress googleMapsUrl')
    .lean() as any[];

  const points = loadPoints();
  if (points.length < venues.length) {
    throw new Error(`Not enough verified locations: have ${points.length}, need ${venues.length}`);
  }

  // Rollback file, written before the first write.
  writeFileSync(BACKUP_URL, JSON.stringify(
    venues.map((v) => ({
      id: String(v._id),
      slug: v.slug,
      displayName: v.displayName,
      lat: v.lat ?? null,
      lng: v.lng ?? null,
      cityName: v.cityName ?? null,
      area: v.area ?? null,
      region: v.region ?? null,
      country: v.country ?? null,
      addressLine1: v.addressLine1 ?? null,
      addressLine2: v.addressLine2 ?? null,
      postalCode: v.postalCode ?? null,
      fullAddress: v.fullAddress ?? null,
      googleMapsUrl: v.googleMapsUrl ?? null,
    })),
    null, 2,
  ));

  const shuffled = shuffle(points, 20260710);
  const assignments = venues.map((venue, i) => ({ venue, point: shuffled[i]! }));

  for (const { venue, point } of assignments) {
    const set: Record<string, unknown> = {
      lat: point.lat,
      lng: point.lng,
      country: point.country,
      cityName: point.cityName,
      area: point.area,
      region: point.region,
      addressLine1: point.addressLine1,
      fullAddress: point.fullAddress,
      googleMapsUrl: point.googleMapsUrl,
    };
    const unset: Record<string, 1> = { cityId: 1, addressLine2: 1 };
    // Postcode is optional in OSM; carry it when the reverse-geocode had one.
    if (point.postalCode) set.postalCode = point.postalCode;
    else unset.postalCode = 1;

    await Venue.updateOne({ _id: venue._id }, { $set: set, $unset: unset });
  }

  const regions = new Map<string, number>();
  for (const { point } of assignments) {
    regions.set(point.region || '(none)', (regions.get(point.region || '(none)') ?? 0) + 1);
  }

  console.log(JSON.stringify({
    relocated: assignments.length,
    pointsAvailable: points.length,
    backup: BACKUP_URL.pathname,
    pinned: {
      displayName: dink.displayName,
      slug: dink.slug,
      cityName: dink.cityName,
      region: dink.region,
      lat: dink.lat,
      lng: dink.lng,
    },
    regionsCovered: [...regions.entries()].sort((a, b) => b[1] - a[1]).map(([r, n]) => `${r}: ${n}`),
    sample: assignments.slice(0, 5).map(({ venue, point }) => ({
      venue: venue.displayName,
      lat: point.lat,
      lng: point.lng,
      address: point.fullAddress,
    })),
  }, null, 2));

  await disconnectDb();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
