import { connectDb } from './index.js';
import mongoose from 'mongoose';

(async () => {
  await connectDb();
  const col = mongoose.connection.db!.collection('feedposts');

  const now = Date.now();
  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

  const posts = await col.find({}).project({ _id: 1 }).toArray();
  console.log(`Found ${posts.length} feed posts`);

  let updated = 0;
  for (const p of posts) {
    // Random moment in the last 30 days.
    const rand = new Date(now - Math.floor(Math.random() * THIRTY_DAYS));
    await col.updateOne({ _id: p._id }, { $set: { createdAt: rand, updatedAt: rand } });
    updated++;
  }
  console.log(`Updated ${updated} posts with random dates (last 30 days)`);
  process.exit(0);
})();
