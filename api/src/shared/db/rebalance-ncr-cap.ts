// Corrective pass: (1) pin "The Dink Lab" back to its real Kawit, Cavite location
// (an earlier 3-region redistribution wrongly moved it), and (2) cap NCR at ~20
// venues — move the excess NCR venues out to Region IV-A (CALABARZON). Region III
// is left as-is. Backs up affected venues first. Run:
// `npx tsx src/shared/db/rebalance-ncr-cap.ts`
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { connectDb, disconnectDb } from './index.js';
import { Venue } from '../../features/venues/venues.model.js';

const NCR_CAP = 20;

// The Dink Lab's true location + address (Kawit, Cavite) — never randomized.
const DINK = { slug: 'the-dink-lab', lat: 14.434796, lng: 120.902025, region: 'Cavite', town: 'Kawit', fullAddress: 'Antero Soriano Highway, Kawit, Cavite, 4104' };

// Region IV-A (CALABARZON) city/town centroids — [town, province, lat, lng].
const REGION_IVA: Array<[string, string, number, number]> = [
  ['Bacoor', 'Cavite', 14.4590, 120.9445], ['Imus', 'Cavite', 14.4297, 120.9367],
  ['Dasmariñas', 'Cavite', 14.3294, 120.9367], ['General Trias', 'Cavite', 14.3869, 120.8817],
  ['Silang', 'Cavite', 14.2306, 120.9750], ['Tanza', 'Cavite', 14.3949, 120.8508],
  ['Cavite City', 'Cavite', 14.4791, 120.8970], ['Trece Martires', 'Cavite', 14.2820, 120.8664],
  ['Santa Rosa', 'Laguna', 14.3122, 121.1114], ['Calamba', 'Laguna', 14.2117, 121.1653],
  ['San Pedro', 'Laguna', 14.3583, 121.0475], ['Biñan', 'Laguna', 14.3427, 121.0807],
  ['Cabuyao', 'Laguna', 14.2726, 121.1256], ['Los Baños', 'Laguna', 14.1699, 121.2411],
  ['San Pablo', 'Laguna', 14.0683, 121.3256], ['Batangas City', 'Batangas', 13.7565, 121.0583],
  ['Lipa', 'Batangas', 13.9411, 121.1624], ['Tanauan', 'Batangas', 14.0863, 121.1487],
  ['Nasugbu', 'Batangas', 14.0722, 120.6320], ['Antipolo', 'Rizal', 14.5878, 121.1759],
  ['Cainta', 'Rizal', 14.5786, 121.1222], ['Taytay', 'Rizal', 14.5692, 121.1329],
  ['Angono', 'Rizal', 14.5266, 121.1531], ['Binangonan', 'Rizal', 14.4655, 121.1919],
  ['Rodriguez', 'Rizal', 14.7281, 121.1447], ['Lucena', 'Quezon', 13.9373, 121.6170],
  ['Tayabas', 'Quezon', 14.0258, 121.5928], ['Sariaya', 'Quezon', 13.9631, 121.5267],
];

const jitter = () => (Math.random() - 0.5) * 0.02;
const ri = (n: number) => Math.floor(Math.random() * n);

async function main() {
  await connectDb();

  // 1) Pin The Dink Lab to Kawit, Cavite.
  const dink = await Venue.updateOne(
    { slug: DINK.slug },
    { $set: { lat: DINK.lat, lng: DINK.lng, region: DINK.region, cityName: DINK.town, area: DINK.town, fullAddress: DINK.fullAddress } },
  );
  console.log(`Pinned The Dink Lab → Kawit, Cavite (matched ${dink.matchedCount}).`);

  // 2) Cap NCR at NCR_CAP; move the rest to Region IV-A. (The Dink Lab is Cavite now,
  //    so it's excluded from the NCR set automatically.)
  const ncr = await Venue.find({ region: 'Metro Manila' }).select('_id displayName lat lng region cityName area fullAddress').lean() as any[];
  console.log(`NCR venues before: ${ncr.length}  (cap ${NCR_CAP})`);

  // Fisher-Yates shuffle so which 20 stay is arbitrary.
  for (let i = ncr.length - 1; i > 0; i--) { const j = ri(i + 1); [ncr[i], ncr[j]] = [ncr[j], ncr[i]]; }
  const move = ncr.slice(NCR_CAP);

  const backup = move.map((v) => ({ id: String(v._id), lat: v.lat, lng: v.lng, region: v.region, cityName: v.cityName, area: v.area, fullAddress: v.fullAddress }));
  const backupPath = new URL('./rebalance-ncr-cap.backup.json', import.meta.url).pathname;
  writeFileSync(backupPath, JSON.stringify(backup, null, 2));
  console.log(`Backed up ${backup.length} venues being moved → ${backupPath}`);

  const tally: Record<string, number> = {};
  for (const v of move) {
    const [town, region, lat, lng] = REGION_IVA[ri(REGION_IVA.length)]!;
    tally[region] = (tally[region] || 0) + 1;
    await Venue.updateOne({ _id: v._id }, {
      $set: {
        lat: Number((lat + jitter()).toFixed(6)), lng: Number((lng + jitter()).toFixed(6)),
        region, cityName: town, area: town, fullAddress: `${town}, ${region}`,
      },
    });
  }
  console.log(`Moved ${move.length} venues NCR → Region IV-A. By province: ${JSON.stringify(tally)}`);

  const ncrNow = await Venue.countDocuments({ region: 'Metro Manila' });
  console.log(`\nDone. NCR now: ${ncrNow}.`);
  await disconnectDb();
}

main().catch((e) => { console.error(e); process.exit(1); });
