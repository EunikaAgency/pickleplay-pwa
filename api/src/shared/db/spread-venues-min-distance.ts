// Ensure every venue is at least 3 km from every other venue. Runs a repulsion
// loop: for each venue whose nearest neighbor is closer than 3 km, push it in a
// random direction by ~3 km. Loops until all pairs pass. "The Dink Lab" stays
// pinned at its real Kawit location. Backs up first.
// Run: `npx tsx src/shared/db/spread-venues-min-distance.ts`
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { connectDb, disconnectDb } from './index.js';
import { Venue } from '../../features/venues/venues.model.js';

const MIN_KM = 3;
const DEG_PER_KM = 1 / 111.0;          // 1° lat ≈ 111 km
const STEP_DEG = (MIN_KM + 0.5) * DEG_PER_KM; // push ~3.5 km each iteration
const MAX_ITER = 200;

// Luzon land bounding box — keep pushes inside this.
const BOX = { latMin: 12.5, latMax: 18.8, lngMin: 119.8, lngMax: 124.5 };

const distSq = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const dLat = (a.lat - b.lat) / DEG_PER_KM;
  const dLng = ((a.lng - b.lng) * Math.cos((a.lat + b.lat) / 2 * Math.PI / 180)) / DEG_PER_KM;
  return dLat * dLat + dLng * dLng;
};

const randDir = (): [number, number] => {
  const angle = Math.random() * 2 * Math.PI;
  return [Math.cos(angle), Math.sin(angle)];
};

const clamp = (v: number, lo: number, hi: number) => v < lo ? lo : v > hi ? hi : v;

async function main() {
  await connectDb();

  const all = await Venue.find({ lat: { $ne: null }, slug: { $ne: 'the-dink-lab' } }).select('_id lat lng displayName').lean() as any[];
  const pinned = await Venue.findOne({ slug: 'the-dink-lab' }).select('_id lat lng').lean() as any;
  const pts: { id: string; lat: number; lng: number; name: string }[] = all.map((v: any) => ({ id: String(v._id), lat: v.lat!, lng: v.lng!, name: v.displayName }));
  // Include Dink Lab as a fixed obstacle (never moved).
  if (pinned) pts.push({ id: String(pinned._id), lat: pinned.lat!, lng: pinned.lng!, name: 'The Dink Lab (pinned)' });

  // Backup.
  writeFileSync(new URL('./spread-venues-min-distance.backup.json', import.meta.url).pathname,
    JSON.stringify(pts.map((p) => ({ id: p.id, lat: p.lat, lng: p.lng })), null, 2));

  const minSq = MIN_KM * MIN_KM; // 3² = 9 km²
  let iter = 0, totalPushes = 0;

  while (iter < MAX_ITER) {
    const pushMap = new Map<string, [number, number]>(); // id → [Δlat, Δlng]
    for (const pt of pts) {
      let nearestSq = Infinity;
      for (const other of pts) {
        if (other.id === pt.id) continue;
        const d = distSq(pt, other);
        if (d < nearestSq) nearestSq = d;
      }
      if (nearestSq < minSq) {
        const [dLat, dLng] = randDir();
        pushMap.set(pt.id, [dLat * STEP_DEG, dLng * STEP_DEG]);
      }
    }
    if (pushMap.size === 0) break; // all clear
    iter++;
    for (const [id, [dLat, dLng]] of pushMap) {
      const pt = pts.find((p) => p.id === id);
      if (!pt) continue;
      pt.lat = clamp(pt.lat + dLat, BOX.latMin, BOX.latMax);
      pt.lng = clamp(pt.lng + dLng, BOX.lngMin, BOX.lngMax);
    }
    totalPushes += pushMap.size;
  }

  // Write back all non-pinned venues.
  let updated = 0;
  for (const pt of pts) {
    if (pt.name === 'The Dink Lab (pinned)') continue;
    await Venue.updateOne({ _id: pt.id }, { $set: { lat: Number(pt.lat.toFixed(6)), lng: Number(pt.lng.toFixed(6)) } });
    updated++;
  }

  // Final check.
  let minFound = Infinity;
  for (const a of pts) { for (const b of pts) { if (a.id !== b.id) { const d = Math.sqrt(distSq(a, b)); if (d < minFound) minFound = d; } } }
  console.log(`Done. ${iter} iterations, ${totalPushes} pushes. Updated ${updated}. Min pairwise distance: ${minFound.toFixed(2)} km. The Dink Lab pinned.`);
  await disconnectDb();
}

main().catch((e) => { console.error(e); process.exit(1); });
