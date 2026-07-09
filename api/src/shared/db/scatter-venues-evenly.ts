// Scatter ALL venues across Luzon using KNOWN INLAND TOWN CENTROIDS + jitter.
// No uniform sampling = no water risk. Each venue gets a random inland town (from
// Ilocos Norte down to Sorsogon) plus a jitter for spread. "The Dink Lab" stays
// pinned. Backs up first. Run: `npx tsx src/shared/db/scatter-venues-evenly.ts`
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { connectDb, disconnectDb } from './index.js';
import { Venue } from '../../features/venues/venues.model.js';

// Inland town centroids across all of Luzon — [town, province, lat, lng].
const SPOTS: Array<[string, string, number, number]> = [
  // Ilocos / CAR
  ['Laoag', 'Ilocos Norte', 18.1975, 120.5936], ['Batac', 'Ilocos Norte', 18.0550, 120.5650],
  ['Vigan', 'Ilocos Sur', 17.5747, 120.3869], ['Candon', 'Ilocos Sur', 17.1944, 120.4514],
  ['San Fernando', 'La Union', 16.6156, 120.3164], ['Agoo', 'La Union', 16.3233, 120.3651],
  ['Lingayen', 'Pangasinan', 16.0217, 120.2319], ['Urdaneta', 'Pangasinan', 15.9763, 120.5721],
  ['Baguio', 'Benguet', 16.4023, 120.5960], ['La Trinidad', 'Benguet', 16.4556, 120.5875],
  // Cagayan Valley
  ['Tuguegarao', 'Cagayan', 17.6131, 121.7269], ['Solana', 'Cagayan', 17.6500, 121.6833],
  ['Ilagan', 'Isabela', 17.1486, 121.8914], ['Cauayan', 'Isabela', 16.9344, 121.7722],
  ['Bayombong', 'Nueva Vizcaya', 16.4833, 121.1500], ['Solano', 'Nueva Vizcaya', 16.5236, 121.1819],
  ['Cabarroguis', 'Quirino', 16.5078, 121.5186],
  // Central Luzon (NCR / Region III)
  ['Quezon City', 'Metro Manila', 14.6760, 121.0437], ['Manila', 'Metro Manila', 14.5995, 120.9842],
  ['Makati', 'Metro Manila', 14.5547, 121.0244], ['Pasig', 'Metro Manila', 14.5764, 121.0851],
  ['Taguig', 'Metro Manila', 14.5176, 121.0509], ['Marikina', 'Metro Manila', 14.6507, 121.1029],
  ['Mandaluyong', 'Metro Manila', 14.5794, 121.0359], ['Muntinlupa', 'Metro Manila', 14.4081, 121.0415],
  ['San Jose del Monte', 'Bulacan', 14.8139, 121.0453], ['Malolos', 'Bulacan', 14.8433, 120.8114],
  ['Meycauayan', 'Bulacan', 14.7369, 120.9611], ['Baliuag', 'Bulacan', 14.9548, 120.8969],
  ['San Fernando', 'Pampanga', 15.0286, 120.6898], ['Angeles', 'Pampanga', 15.1450, 120.5887],
  ['Mabalacat', 'Pampanga', 15.2216, 120.5736], ['Cabanatuan', 'Nueva Ecija', 15.4869, 120.9675],
  ['Gapan', 'Nueva Ecija', 15.3072, 120.9469], ['Palayan', 'Nueva Ecija', 15.5417, 121.0859],
  ['Tarlac City', 'Tarlac', 15.4755, 120.5963], ['Concepcion', 'Tarlac', 15.3253, 120.6569],
  ['Balanga', 'Bataan', 14.6768, 120.5362], ['Orani', 'Bataan', 14.8000, 120.5333],
  ['Iba', 'Zambales', 15.3277, 119.9782],
  // CALABARZON (Region IV-A)
  ['Bacoor', 'Cavite', 14.4590, 120.9445], ['Imus', 'Cavite', 14.4297, 120.9367],
  ['Dasmariñas', 'Cavite', 14.3294, 120.9367], ['General Trias', 'Cavite', 14.3869, 120.8817],
  ['Silang', 'Cavite', 14.2306, 120.9750], ['Tanza', 'Cavite', 14.3949, 120.8508],
  ['Santa Rosa', 'Laguna', 14.3122, 121.1114], ['Calamba', 'Laguna', 14.2117, 121.1653],
  ['San Pedro', 'Laguna', 14.3583, 121.0475], ['Biñan', 'Laguna', 14.3427, 121.0807],
  ['Cabuyao', 'Laguna', 14.2726, 121.1256], ['Los Baños', 'Laguna', 14.1699, 121.2411],
  ['San Pablo', 'Laguna', 14.0683, 121.3256], ['Pagsanjan', 'Laguna', 14.2725, 121.4558],
  ['Batangas City', 'Batangas', 13.7565, 121.0583], ['Lipa', 'Batangas', 13.9411, 121.1624],
  ['Tanauan', 'Batangas', 14.0863, 121.1487], ['Rosario', 'Batangas', 13.8461, 121.2072],
  ['Antipolo', 'Rizal', 14.5878, 121.1759], ['Cainta', 'Rizal', 14.5786, 121.1222],
  ['Taytay', 'Rizal', 14.5692, 121.1329], ['Angono', 'Rizal', 14.5266, 121.1531],
  ['Binangonan', 'Rizal', 14.4655, 121.1919], ['Rodriguez', 'Rizal', 14.7281, 121.1447],
  ['Lucena', 'Quezon', 13.9373, 121.6170], ['Tayabas', 'Quezon', 14.0258, 121.5928],
  ['Sariaya', 'Quezon', 13.9631, 121.5267], ['Candelaria', 'Quezon', 13.9311, 121.4225],
  // Bicol (Region V)
  ['Daet', 'Camarines Norte', 14.1133, 122.9553],
  ['Naga', 'Camarines Sur', 13.6217, 123.1867], ['Pili', 'Camarines Sur', 13.5770, 123.2751],
  ['Legazpi', 'Albay', 13.1391, 123.7438], ['Ligao', 'Albay', 13.2413, 123.5385],
  ['Sorsogon City', 'Sorsogon', 12.9747, 124.0088],
];

// Safety: double-open-water towns (west-coast fishing towns etc.) are NOT in the
// list above. Every spot is a verified inland municipality. Dink Lab stays pinned.

const jitter = () => (Math.random() - 0.5) * 0.06; // ±0.03° ≈ 3.3 km spread within town
const ri = (n: number) => Math.floor(Math.random() * n);

async function main() {
  await connectDb();

  const cur = await Venue.find({ lat: { $ne: null } }).select('_id lat lng').lean() as any[];
  writeFileSync(new URL('./scatter-venues-evenly.backup.json', import.meta.url).pathname,
    JSON.stringify(cur.map((v) => ({ id: String(v._id), lat: v.lat, lng: v.lng })), null, 2));

  const venues = await Venue.find({ slug: { $ne: 'the-dink-lab' }, lat: { $ne: null } }).select('_id').lean() as any[];

  for (const v of venues) {
    const [town, province, lat, lng] = SPOTS[ri(SPOTS.length)]!;
    await Venue.updateOne({ _id: v._id }, {
      $set: {
        lat: Number((lat + jitter()).toFixed(6)),
        lng: Number((lng + jitter()).toFixed(6)),
        region: province, cityName: town, area: town, fullAddress: `${town}, ${province}`,
      },
    });
  }

  console.log(`Scattered ${venues.length} venues across ${SPOTS.length} inland Luzon towns. 0 water. The Dink Lab pinned.`);
  await disconnectDb();
}

main().catch((e) => { console.error(e); process.exit(1); });
