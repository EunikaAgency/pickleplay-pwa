// One-off (demo data): spread ALL venues across three regions — NCR, Region III
// (Central Luzon), and Region IV-A (CALABARZON) — by relocating every venue to a
// random city/town in one of them (evenly weighted per region). Then add 24 new
// venues split 12/12 between Oscar Walker and Nicolas Garrido, also spread across
// the three regions. Backs up prior locations first (reversible).
// Run: `npx tsx src/shared/db/redistribute-venues-three-regions.ts`
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { connectDb, disconnectDb } from './index.js';
import { Venue } from '../../features/venues/venues.model.js';
import { User } from '../../features/auth/auth.model.js';

const BATANGAS_TAG = 'batangas-demo-2026-07-09'; // the earlier 16 — kept in place (already Region IV-A)
const NEW_TAG = 'owner-demo-2026-07-09b';        // the 24 added here (re-run replaces just these)

// [town, provinceRegion, lat, lng] — provinceRegion goes into venue.region (matches
// existing data which stores province/area names like "Metro Manila", "Bulacan").
type Spot = [string, string, number, number];

const NCR: Spot[] = [
  ['Quezon City', 'Metro Manila', 14.6760, 121.0437], ['Manila', 'Metro Manila', 14.5995, 120.9842],
  ['Makati', 'Metro Manila', 14.5547, 121.0244], ['Pasig', 'Metro Manila', 14.5764, 121.0851],
  ['Taguig', 'Metro Manila', 14.5176, 121.0509], ['Parañaque', 'Metro Manila', 14.4793, 121.0198],
  ['Marikina', 'Metro Manila', 14.6507, 121.1029], ['Mandaluyong', 'Metro Manila', 14.5794, 121.0359],
  ['Muntinlupa', 'Metro Manila', 14.4081, 121.0415], ['Las Piñas', 'Metro Manila', 14.4499, 120.9829],
  ['Pasay', 'Metro Manila', 14.5378, 121.0014], ['Caloocan', 'Metro Manila', 14.6510, 120.9720],
  ['San Juan', 'Metro Manila', 14.6019, 121.0355], ['Valenzuela', 'Metro Manila', 14.7000, 120.9830],
  ['Malabon', 'Metro Manila', 14.6620, 120.9570], ['Navotas', 'Metro Manila', 14.6660, 120.9420],
  ['Pateros', 'Metro Manila', 14.5410, 121.0670],
];
const REGION_III: Spot[] = [
  ['San Fernando', 'Pampanga', 15.0286, 120.6898], ['Angeles', 'Pampanga', 15.1450, 120.5887],
  ['Mabalacat', 'Pampanga', 15.2216, 120.5736], ['Mexico', 'Pampanga', 15.0631, 120.7228],
  ['Guagua', 'Pampanga', 14.9667, 120.6333], ['Malolos', 'Bulacan', 14.8433, 120.8114],
  ['Meycauayan', 'Bulacan', 14.7369, 120.9611], ['San Jose del Monte', 'Bulacan', 14.8139, 121.0453],
  ['Baliuag', 'Bulacan', 14.9548, 120.8969], ['Marilao', 'Bulacan', 14.7583, 120.9481],
  ['Santa Maria', 'Bulacan', 14.8189, 120.9569], ['Cabanatuan', 'Nueva Ecija', 15.4869, 120.9675],
  ['Gapan', 'Nueva Ecija', 15.3072, 120.9469], ['San Jose', 'Nueva Ecija', 15.7906, 120.9944],
  ['Tarlac City', 'Tarlac', 15.4755, 120.5963], ['Balanga', 'Bataan', 14.6768, 120.5362],
  ['Olongapo', 'Zambales', 14.8296, 120.2828], ['Iba', 'Zambales', 15.3277, 119.9782],
  ['Baler', 'Aurora', 15.7597, 121.5628],
];
const REGION_IVA: Spot[] = [
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
const GROUPS: Spot[][] = [NCR, REGION_III, REGION_IVA];

const TEMPLATES = ['Pickleball Arena', 'Smash Pickleball Club', 'Pickle Courts', 'Paddle Park',
  'Dinkers Hub', 'Rally Pickleball Center', 'Pickleball Pavilion', 'Court Central', 'Pickleball Grounds', 'Ace Pickleball Court'];

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const jitter = () => (Math.random() - 0.5) * 0.02;
const ri = (n: number) => Math.floor(Math.random() * n);
const pickSpot = (): Spot => { const g = GROUPS[ri(GROUPS.length)]!; return g[ri(g.length)]!; };
const rate = () => 200 + ri(5) * 50;

async function main() {
  await connectDb();

  const oscar = await User.findOne({ email: /ccdfa3b7\.walker@example/ }).select('_id displayName').lean() as any;
  const nic = await User.findOne({ email: /a15e6e3e\.garrido@example/ }).select('_id displayName').lean() as any;
  if (!oscar || !nic) throw new Error('Owner accounts not found');

  // ── 1) Backup, then relocate existing venues across the three regions. Keep the
  //    earlier 16 Batangas demo venues where they are (their names are town-specific
  //    and Batangas is already in Region IV-A). ──
  const all = await Venue.find({ _importId: { $ne: BATANGAS_TAG }, slug: { $ne: 'the-dink-lab' } }).select('_id slug displayName lat lng region cityName area fullAddress').lean() as any[];
  const backup = all.map((v) => ({ id: String(v._id), lat: v.lat ?? null, lng: v.lng ?? null, region: v.region ?? null, cityName: v.cityName ?? null, area: v.area ?? null, fullAddress: v.fullAddress ?? null }));
  const backupPath = new URL('./redistribute-venues-three-regions.backup.json', import.meta.url).pathname;
  writeFileSync(backupPath, JSON.stringify(backup, null, 2));
  console.log(`Backed up ${backup.length} venues → ${backupPath}`);

  const tally: Record<string, number> = {};
  for (const v of all) {
    const [town, region, lat, lng] = pickSpot();
    tally[region] = (tally[region] || 0) + 1;
    await Venue.updateOne({ _id: v._id }, {
      $set: {
        lat: Number((lat + jitter()).toFixed(6)), lng: Number((lng + jitter()).toFixed(6)),
        region, cityName: town, area: town, fullAddress: `${town}, ${region}`,
      },
    });
  }
  console.log(`Relocated ${all.length} venues. By province: ${JSON.stringify(tally)}`);

  // ── 2) Add 24 new venues, 12 per owner, spread across the three regions ──
  await Venue.deleteMany({ _importId: NEW_TAG }); // idempotent: drop only this batch on re-run
  const usedSlugs = new Set((await Venue.find({}).select('slug').lean() as any[]).map((v) => v.slug));

  let inserted = 0; const owners = [oscar, nic];
  for (let i = 0; i < 24; i++) {
    const group = GROUPS[i % GROUPS.length]!;      // round-robin region → even 8/8/8 spread
    const [town, region, lat, lng] = group[ri(group.length)]!;
    let name = '', slug = ''; let t = i;
    do { name = `${town} ${TEMPLATES[t % TEMPLATES.length]}`; slug = slugify(name); t++; } while (usedSlugs.has(slug));
    usedSlugs.add(slug);
    const owner = owners[i % 2]!;                   // alternate → 12 each
    await Venue.create({
      slug, displayName: name, venueId: `ph-${slug}`,
      ownerUserId: owner._id, state: 'claimed', region, cityName: town, area: town,
      fullAddress: `${town}, ${region}`,
      lat: Number((lat + jitter()).toFixed(6)), lng: Number((lng + jitter()).toFixed(6)),
      priceFrom: rate(), pricingCurrency: 'PHP', isVerified: false, _importId: NEW_TAG,
    });
    inserted++;
    console.log(`  + ${name.padEnd(40)} ${region.padEnd(13)} → ${owner.displayName}`);
  }

  const total = await Venue.countDocuments({});
  console.log(`\nDone. Relocated ${all.length}, inserted ${inserted} new (12 ${oscar.displayName} / 12 ${nic.displayName}). Total venues: ${total}.`);
  await disconnectDb();
}

main().catch((e) => { console.error(e); process.exit(1); });
