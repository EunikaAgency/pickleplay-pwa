// One-off: give EVERY venue that still has no map location a RANDOM location
// inside Cavite / Metro Manila / Laguna. Real geographic accuracy is not wanted
// here — the goal is that all venues show up on the map clustered in that area.
// Only touches venues missing lat/lng (the ones already located earlier stay put).
//
// Each venue gets a random city/town centroid (Metro Manila, Cavite, or Laguna) +
// a small random jitter, so points scatter across populated land (not into water).
// Backs up prior (null) coords first. Run: `npx tsx src/shared/db/randomize-missing-venue-locations.ts`
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { connectDb, disconnectDb } from './index.js';
import { Venue } from '../../features/venues/venues.model.js';

// Metro Manila + Cavite + Laguna city/town centroids (decimal degrees). Random pick per venue.
const SPOTS: Array<[string, number, number]> = [
  // Metro Manila
  ['Quezon City', 14.6760, 121.0437], ['Manila', 14.5995, 120.9842], ['Makati', 14.5547, 121.0244],
  ['Pasig', 14.5764, 121.0851], ['Taguig', 14.5176, 121.0509], ['Parañaque', 14.4793, 121.0198],
  ['Marikina', 14.6507, 121.1029], ['Mandaluyong', 14.5794, 121.0359], ['Muntinlupa', 14.4081, 121.0415],
  ['Las Piñas', 14.4499, 120.9829], ['Pasay', 14.5378, 121.0014], ['Caloocan', 14.6510, 120.9720],
  ['San Juan', 14.6019, 121.0355], ['Valenzuela', 14.7000, 120.9830], ['Malabon', 14.6620, 120.9570],
  ['Pateros', 14.5410, 121.0670],
  // Cavite
  ['Cavite City', 14.4791, 120.8970], ['Bacoor', 14.4590, 120.9445], ['Kawit', 14.4437, 120.9058],
  ['Imus', 14.4297, 120.9367], ['Dasmariñas', 14.3294, 120.9367], ['Noveleta', 14.4319, 120.8790],
  ['General Trias', 14.3869, 120.8817], ['Silang', 14.2306, 120.9750], ['Trece Martires', 14.2820, 120.8664],
  ['Tanza', 14.3949, 120.8508], ['Rosario', 14.4157, 120.8556], ['Naic', 14.3167, 120.7667],
  ['Carmona', 14.3132, 121.0575], ['Indang', 14.1950, 120.8770], ['Amadeo', 14.1690, 120.9230],
  // Laguna
  ['Santa Rosa', 14.3122, 121.1114], ['Calamba', 14.2117, 121.1653], ['San Pedro', 14.3583, 121.0475],
  ['Biñan', 14.3427, 121.0807], ['Cabuyao', 14.2726, 121.1256], ['Los Baños', 14.1699, 121.2411],
  ['San Pablo', 14.0683, 121.3256], ['Santa Cruz', 14.2794, 121.4160], ['Bay', 14.1817, 121.2833],
  ['Alaminos', 14.0636, 121.2464], ['Pila', 14.2333, 121.3667], ['Victoria', 14.2278, 121.3283],
];

// Random jitter up to ~±2.2 km, so venues at the same city don't stack.
const JIT = 0.02;
const rand = (span: number) => (Math.random() - 0.5) * 2 * span;

async function main() {
  await connectDb();

  const venues = await Venue.find({
    $or: [{ lat: null }, { lat: { $exists: false } }, { lng: null }, { lng: { $exists: false } }],
  }).select('_id displayName lat lng').lean();

  console.log(`Venues with no location: ${venues.length}`);

  const backup = venues.map((v: any) => ({ id: String(v._id), lat: v.lat ?? null, lng: v.lng ?? null }));
  const backupPath = new URL('./randomize-missing-venue-locations.backup.json', import.meta.url).pathname;
  writeFileSync(backupPath, JSON.stringify(backup, null, 2));
  console.log(`Backed up prior coords → ${backupPath}`);

  let updated = 0;
  for (const v of venues as any[]) {
    const spot = SPOTS[Math.floor(Math.random() * SPOTS.length)]!;
    const lat = Number((spot[1] + rand(JIT)).toFixed(6));
    const lng = Number((spot[2] + rand(JIT)).toFixed(6));
    await Venue.updateOne({ _id: v._id }, { $set: { lat, lng } });
    updated++;
    console.log(`  ${v.displayName.padEnd(44)} ${lat},${lng}  [${spot[0]}]`);
  }

  const total = await Venue.countDocuments({});
  const withLL = await Venue.countDocuments({ lat: { $ne: null }, lng: { $ne: null } });
  console.log(`\nDone. randomized=${updated}.  Venues with a location now: ${withLL}/${total}`);
  await disconnectDb();
}

main().catch((e) => { console.error(e); process.exit(1); });
