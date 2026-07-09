// Spread venue pins farther apart so they don't stack on top of each other. Adds
// a larger random offset (up to ~±5.5 km) to every venue's current location,
// keeping its region/city labels and leaving "The Dink Lab" pinned. Backs up first.
// Run: `npx tsx src/shared/db/spread-out-venues.ts`
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { connectDb, disconnectDb } from './index.js';
import { Venue } from '../../features/venues/venues.model.js';

const SPREAD = 0.05; // ±0.05° ≈ ±5.5 km added to the existing city jitter

async function main() {
  await connectDb();

  const venues = await Venue.find({ slug: { $ne: 'the-dink-lab' }, lat: { $ne: null }, lng: { $ne: null } })
    .select('_id lat lng').lean() as any[];
  console.log(`Spreading ${venues.length} venues (The Dink Lab left pinned).`);

  const backup = venues.map((v) => ({ id: String(v._id), lat: v.lat, lng: v.lng }));
  const backupPath = new URL('./spread-out-venues.backup.json', import.meta.url).pathname;
  writeFileSync(backupPath, JSON.stringify(backup, null, 2));
  console.log(`Backed up → ${backupPath}`);

  const off = () => (Math.random() - 0.5) * 2 * SPREAD;
  for (const v of venues) {
    await Venue.updateOne({ _id: v._id }, {
      $set: { lat: Number((v.lat + off()).toFixed(6)), lng: Number((v.lng + off()).toFixed(6)) },
    });
  }
  console.log(`Done. Spread ${venues.length} venues by up to ±${SPREAD}°.`);
  await disconnectDb();
}

main().catch((e) => { console.error(e); process.exit(1); });
