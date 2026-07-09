// One-off: add 16 demo venues spread across Batangas, split 8/8 between two
// owners — Oscar Walker (ccdfa3b7.walker@example.com) and Nicolas Garrido
// (a15e6e3e.garrido@example.com). Re-runnable: it first removes any rows tagged
// with this import id, then re-inserts. Run: `npx tsx src/shared/db/seed-batangas-venues.ts`
import 'dotenv/config';
import { connectDb, disconnectDb } from './index.js';
import { Venue } from '../../features/venues/venues.model.js';
import { User } from '../../features/auth/auth.model.js';

const IMPORT_TAG = 'batangas-demo-2026-07-09';

// [displayName, town, lat, lng] — 16 spots across Batangas province.
const SPOTS: Array<[string, string, number, number]> = [
  ['Batangas City Pickleball Arena', 'Batangas City', 13.7565, 121.0583],
  ['Lipa Smash Pickleball Club', 'Lipa City', 13.9411, 121.1624],
  ['Tanauan Pickle Courts', 'Tanauan', 14.0863, 121.1487],
  ['Santo Tomas Paddle Park', 'Santo Tomas', 14.1078, 121.1416],
  ['Nasugbu Beach Pickleball', 'Nasugbu', 14.0722, 120.6320],
  ['Lemery Rally Pickleball Center', 'Lemery', 13.8811, 120.9147],
  ['Taal Heritage Pickleball Club', 'Taal', 13.8790, 120.9233],
  ['San Juan Coastline Pickle Courts', 'San Juan', 13.8272, 121.3960],
  ['Bauan Community Pickleball Hub', 'Bauan', 13.7917, 121.0083],
  ['Calaca Dinkers Court', 'Calaca', 13.9320, 120.8130],
  ['Balayan Bay Pickleball Club', 'Balayan', 13.9469, 120.7325],
  ['Malvar Sports Pickleball Court', 'Malvar', 14.0439, 121.1583],
  ['Cuenca Highland Pickleball', 'Cuenca', 13.9075, 121.0503],
  ['Rosario Pickle Grounds', 'Rosario', 13.8461, 121.2072],
  ['San Jose Pickleball Pavilion', 'San Jose', 13.8781, 121.1017],
  ['Ibaan Town Pickleball Court', 'Ibaan', 13.8211, 121.1330],
];

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const jitter = () => (Math.random() - 0.5) * 0.02;
const rate = () => 200 + Math.floor(Math.random() * 5) * 50; // 200..400 in 50s

async function main() {
  await connectDb();

  const oscar = await User.findOne({ email: /ccdfa3b7\.walker@example/ }).select('_id displayName').lean() as any;
  const nic = await User.findOne({ email: /a15e6e3e\.garrido@example/ }).select('_id displayName').lean() as any;
  if (!oscar || !nic) throw new Error('Owner accounts not found');
  console.log(`Owners: ${oscar.displayName} (${oscar._id}) + ${nic.displayName} (${nic._id})`);

  const removed = await Venue.deleteMany({ _importId: IMPORT_TAG });
  if (removed.deletedCount) console.log(`Removed ${removed.deletedCount} prior "${IMPORT_TAG}" venues (re-run).`);

  const docs = SPOTS.map(([name, town, lat, lng], i) => {
    const owner = i % 2 === 0 ? oscar : nic; // alternate → 8 each
    const slug = slugify(name);
    return {
      slug,
      displayName: name,
      venueId: `ph-${slug}-batangas`,
      ownerUserId: owner._id,
      state: 'claimed',
      region: 'Batangas',
      cityName: town,
      area: town,
      fullAddress: `${town}, Batangas`,
      lat: Number((lat + jitter()).toFixed(6)),
      lng: Number((lng + jitter()).toFixed(6)),
      priceFrom: rate(),
      pricingCurrency: 'PHP',
      isVerified: false,
      _importId: IMPORT_TAG,
      _ownerName: owner.displayName as string,
    };
  });

  for (const d of docs) {
    const { _ownerName, ...doc } = d;
    await Venue.create(doc);
    console.log(`  + ${doc.displayName.padEnd(38)} ${doc.cityName.padEnd(14)} ${doc.lat},${doc.lng}  → ${_ownerName}`);
  }

  const oCount = docs.filter((d) => d._ownerName === oscar.displayName).length;
  const nCount = docs.length - oCount;
  console.log(`\nDone. Inserted ${docs.length} Batangas venues — ${oscar.displayName}: ${oCount}, ${nic.displayName}: ${nCount}.`);
  await disconnectDb();
}

main().catch((e) => { console.error(e); process.exit(1); });
