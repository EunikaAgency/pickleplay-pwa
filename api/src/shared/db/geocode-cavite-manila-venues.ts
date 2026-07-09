// One-off backfill: give every venue in Metro Manila + Cavite a map location
// (lat/lng). 178 of 179 venues had no coordinates, so they never appeared on the
// Nearby map. This scopes to Cavite + Metro Manila only (per request).
//
// Strategy per venue:
//   1. Geocode its real `fullAddress` via Nominatim (throttled to Nominatim's
//      ≤1 req/sec policy, with a descriptive User-Agent, restricted to PH).
//   2. Accept the hit only if it lands inside the Metro-Manila/Cavite bounding box
//      AND near the venue's known city centroid — otherwise fall back to the city
//      centroid + a small deterministic jitter (so same-city venues don't stack).
//
// Idempotent-ish: only touches venues in scope; backs up prior lat/lng to a JSON
// file first so the change is reversible. Run: `npx tsx src/shared/db/geocode-cavite-manila-venues.ts`
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import mongoose from 'mongoose';
import { connectDb, disconnectDb } from './index.js';
import { Venue } from '../../features/venues/venues.model.js';
import { City } from '../../features/cities/cities.model.js';

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'PickleBallers/1.0 (venue geocoding backfill; admin@eunika.agency)';

// City / town centroids for Metro Manila + Cavite (decimal degrees). Used to
// validate geocodes and as the fallback when a geocode misses.
const CENTROIDS: Record<string, [number, number]> = {
  // Metro Manila (NCR)
  'quezon city': [14.6760, 121.0437], manila: [14.5995, 120.9842], makati: [14.5547, 121.0244],
  pasig: [14.5764, 121.0851], taguig: [14.5176, 121.0509], 'parañaque': [14.4793, 121.0198],
  paranaque: [14.4793, 121.0198], marikina: [14.6507, 121.1029], mandaluyong: [14.5794, 121.0359],
  muntinlupa: [14.4081, 121.0415], 'las piñas': [14.4499, 120.9829], 'las pinas': [14.4499, 120.9829],
  pasay: [14.5378, 121.0014], caloocan: [14.6510, 120.9720], 'san juan': [14.6019, 121.0355],
  valenzuela: [14.7000, 120.9830], malabon: [14.6620, 120.9570], navotas: [14.6660, 120.9420],
  pateros: [14.5410, 121.0670],
  // Cavite
  cavite: [14.4791, 120.8970], 'cavite city': [14.4791, 120.8970], bacoor: [14.4590, 120.9445],
  kawit: [14.4437, 120.9058], imus: [14.4297, 120.9367], 'dasmariñas': [14.3294, 120.9367],
  dasmarinas: [14.3294, 120.9367], noveleta: [14.4319, 120.8790], 'general trias': [14.3869, 120.8817],
  'gen. trias': [14.3869, 120.8817], silang: [14.2306, 120.9750], 'trece martires': [14.2820, 120.8664],
  tanza: [14.3949, 120.8508], rosario: [14.4157, 120.8556], naic: [14.3167, 120.7667],
  carmona: [14.3132, 121.0575], indang: [14.1950, 120.8770], amadeo: [14.1690, 120.9230],
  mendez: [14.1290, 120.9060], alfonso: [14.1400, 120.8540], magallanes: [14.1880, 120.7570],
  ternate: [14.2870, 120.7180], maragondon: [14.2740, 120.7370],
};

// Rough bounding box covering Metro Manila + Cavite.
const BOX = { latMin: 13.9, latMax: 15.05, lngMin: 120.35, lngMax: 121.35 };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Deterministic small offset (±~0.9km) from a venue id, so same-city venues spread. */
function jitter(id: string): [number, number] {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const dLat = ((h % 1000) / 1000 - 0.5) * 0.016;
  const dLng = (((h >> 10) % 1000) / 1000 - 0.5) * 0.016;
  return [dLat, dLng];
}

function centroidKey(name: string | undefined | null): string | null {
  if (!name) return null;
  const k = name.trim().toLowerCase();
  return CENTROIDS[k] ? k : null;
}

/** Find a centroid for a venue via its city name or by scanning its address. */
function resolveCentroid(cityName: string | null, address: string): { key: string; coord: [number, number] } | null {
  const direct = centroidKey(cityName);
  if (direct) { const c = CENTROIDS[direct]; if (c) return { key: direct, coord: c }; }
  const lower = (address || '').toLowerCase();
  // Longest keys first so "cavite city" beats "cavite", "las piñas" beats a stray token.
  for (const key of Object.keys(CENTROIDS).sort((a, b) => b.length - a.length)) {
    const c = CENTROIDS[key];
    if (c && lower.includes(key)) return { key, coord: c };
  }
  return null;
}

const inBox = (lat: number, lng: number) =>
  lat >= BOX.latMin && lat <= BOX.latMax && lng >= BOX.lngMin && lng <= BOX.lngMax;

async function geocode(q: string): Promise<[number, number] | null> {
  const params = new URLSearchParams({ format: 'jsonv2', limit: '1', countrycodes: 'ph', q });
  try {
    const res = await fetch(`${NOMINATIM}?${params}`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', 'Accept-Language': 'en' },
    });
    if (!res.ok) return null;
    const arr = (await res.json()) as Array<{ lat: string; lon: string }>;
    const first = arr[0];
    if (!first) return null;
    const lat = Number(first.lat), lng = Number(first.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return [lat, lng];
  } catch {
    return null;
  }
}

async function main() {
  await connectDb();

  const caviteRx = /cavite|bacoor|imus|dasma|kawit|noveleta|tanza|trece|silang|general trias|gen\. trias|carmona|cavite city|maragondon|naic|indang|amadeo|mendez|alfonso|magallanes|ternate|rosario/i;
  const venues = await Venue.find({
    $or: [{ region: 'Metro Manila' }, { region: /cavite/i }, { fullAddress: caviteRx }],
  }).select('_id displayName cityId cityName region fullAddress lat lng').lean();

  console.log(`Target venues (Metro Manila + Cavite): ${venues.length}`);

  // Resolve city names via cityId where cityName is absent.
  const cityIds = [...new Set(venues.map((v: any) => v.cityId).filter(Boolean).map(String))];
  const cities = await City.find({ _id: { $in: cityIds } }).select('_id name').lean();
  const cityNameById = new Map(cities.map((c: any) => [String(c._id), c.name as string]));

  // Backup current coords for reversibility.
  const backup = venues.map((v: any) => ({ id: String(v._id), lat: v.lat ?? null, lng: v.lng ?? null }));
  const backupPath = new URL('./geocode-cavite-manila.backup.json', import.meta.url).pathname;
  writeFileSync(backupPath, JSON.stringify(backup, null, 2));
  console.log(`Backed up prior coords → ${backupPath}`);

  let geocoded = 0, centroided = 0, skipped = 0;

  for (const v of venues as any[]) {
    const cityName = v.cityName || cityNameById.get(String(v.cityId)) || null;
    const fallback = resolveCentroid(cityName, v.fullAddress || '');

    let coord: [number, number] | null = null;
    let source = '';

    if (v.fullAddress && v.fullAddress.trim().length >= 6) {
      const hit = await geocode(v.fullAddress);
      if (hit && inBox(hit[0], hit[1])) {
        // If we know the city centroid, reject hits that are absurdly far (>~0.45°, ~50km).
        const near = !fallback || (Math.abs(hit[0] - fallback.coord[0]) < 0.45 && Math.abs(hit[1] - fallback.coord[1]) < 0.45);
        if (near) { coord = hit; source = 'geocode'; }
      }
      await sleep(1100); // Nominatim ≤1 req/sec
    }

    if (!coord && fallback) {
      const [dLat, dLng] = jitter(String(v._id));
      coord = [fallback.coord[0] + dLat, fallback.coord[1] + dLng];
      source = `centroid:${fallback.key}`;
    }

    if (!coord) { skipped++; console.log(`  SKIP  ${v.displayName} (no city match, addr="${v.fullAddress ?? ''}")`); continue; }

    await Venue.updateOne({ _id: v._id }, { $set: { lat: Number(coord[0].toFixed(6)), lng: Number(coord[1].toFixed(6)) } });
    if (source === 'geocode') geocoded++; else centroided++;
    console.log(`  OK   ${v.displayName.padEnd(38)} ${coord[0].toFixed(5)},${coord[1].toFixed(5)}  [${source}]`);
  }

  console.log(`\nDone. geocoded=${geocoded}  centroid=${centroided}  skipped=${skipped}  total=${venues.length}`);
  await disconnectDb();
}

main().catch((e) => { console.error(e); process.exit(1); });
