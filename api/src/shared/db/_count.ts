import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDb } from './index.js';
import { Venue } from '../../features/venues/venues.model.js';
async function main() {
  await connectDb();
  const all = await Venue.countDocuments({});
  const live = await Venue.countDocuments({ deletedAt: null });
  const notDink = await Venue.countDocuments({ slug: { $ne: 'the-dink-lab' } });
  const owned = await Venue.countDocuments({ ownerUserId: { $exists: true, $ne: null } });
  const dink = await Venue.findOne({ slug: 'the-dink-lab' }).select('slug lat lng cityName area region fullAddress').lean() as any;
  console.log(JSON.stringify({ all, live, notDink, owned, dink }, null, 2));
  await mongoose.disconnect(); process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
