// Pickleballers API — Fix gendered avatars to match user names
//
// The earlier avatar backfill alternated men/women by index, ignoring the
// user's name — so some male users got a female portrait and vice-versa. This
// re-assigns EVERY randomuser.me avatar based on the first name's inferred
// gender, keeping the same randomuser.me source + a stable per-user photo index.
//
// Names are matched against curated female/male sets (covers the seeded data).
// Unknown / nonsense names (test accounts) fall back to male. Idempotent.
//
// Usage: npx tsx src/shared/db/fix-avatar-gender.ts

import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDb } from './index.js';
import { User } from '../../features/auth/auth.model.js';

const strip = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const FEMALE = new Set([
  'allyssa', 'aly', 'anna', 'anne', 'antonia', 'apolonia', 'aubree', 'avery', 'brooke',
  'carla', 'carol', 'cathy', 'chesney', 'clara', 'claudia', 'consuelo', 'eden', 'eliza',
  'elizabeth', 'ellen', 'ellie', 'emily', 'eunika', 'eva', 'felicia', 'fennie', 'gina',
  'giselle', 'graziella', 'hannah', 'harper', 'harley', 'heidi', 'ines', 'isabella', 'joyce',
  'judy', 'julia', 'katie', 'kristin', 'layla', 'leah', 'lena', 'louise', 'lourdes', 'madison',
  'malissa', 'margarita', 'mari', 'marie', 'martha', 'maya', 'mia', 'monica', 'nicole', 'nina',
  'noemie', 'pearl', 'piper', 'purificacion', 'rocio', 'ruby', 'sara', 'sarah', 'sydnee', 'tara',
  'thea', 'vicky', 'whitney', 'zoey', 'jojie', 'joy',
].map(strip));

const MALE = new Set([
  'abdelhakim', 'aitor', 'alberto', 'alexander', 'antoine', 'archie', 'armando', 'beau', 'benito',
  'benjo', 'billy', 'brad', 'bradley', 'brennan', 'cameron', 'carl', 'carter', 'charles', 'chris',
  'christian', 'cristian', 'cullen', 'dan', 'darrell', 'darren', 'dylan', 'edu', 'eduardo', 'eloy',
  'eric', 'ernesto', 'ethan', 'everett', 'federico', 'felix', 'fernando', 'glenn', 'herman',
  'hudson', 'hunter', 'ivan', 'jaime', 'jake', 'james', 'jarryd', 'javier', 'jeffrey', 'jeremy',
  'jesse', 'jobert', 'john', 'johnny', 'jonathan', 'joshua', 'julian', 'karl', 'kevin', 'kim',
  'lachlan', 'larry', 'leander', 'lee', 'lennon', 'lucas', 'manny', 'marco', 'mark', 'mason',
  'matthew', 'michael', 'micheal', 'mico', 'nathan', 'neil', 'nicolas', 'noah', 'noel', 'oscar',
  'owen', 'pao', 'paul', 'raphael', 'ray', 'rowan', 'russell', 'samuel', 'souhail', 'steve',
  'taran', 'tevin', 'thomas', 'timmothy', 'tony', 'troy', 'vicente', 'vittorio', 'willian',
  'xavier', 'yuri',
].map(strip));

function genderFor(firstName: string, displayName: string): 'women' | 'men' {
  const first = strip((firstName || displayName || '').split(/\s+/)[0] || '');
  if (FEMALE.has(first)) return 'women';
  if (MALE.has(first)) return 'men';
  return 'men'; // unknown / test accounts default to men
}

async function main() {
  await connectDb();

  const users = await User.find({ avatarUrl: /randomuser\.me/ })
    .select('_id firstName displayName avatarUrl')
    .lean() as any[];

  const unknown: string[] = [];
  let fixed = 0;
  const ops = users.map((u, i) => {
    const first = strip((u.firstName || u.displayName || '').split(/\s+/)[0] || '');
    if (!FEMALE.has(first) && !MALE.has(first)) unknown.push(u.displayName);
    const gender = genderFor(u.firstName, u.displayName);
    // Preserve the existing photo number if the URL already has one, else derive.
    const m = String(u.avatarUrl).match(/portraits\/(?:men|women)\/(\d+)\.jpg/);
    const num = m ? m[1] : String(i % 100);
    const next = `https://randomuser.me/api/portraits/${gender}/${num}.jpg`;
    if (next !== u.avatarUrl) fixed++;
    return { updateOne: { filter: { _id: u._id }, update: { $set: { avatarUrl: next } } } };
  });
  if (ops.length) await User.bulkWrite(ops);

  console.log('---SUMMARY---');
  console.log(`Avatars evaluated: ${users.length}`);
  console.log(`Avatars corrected: ${fixed}`);
  console.log(`Unknown names (defaulted to men): ${unknown.length}${unknown.length ? ' — ' + [...new Set(unknown)].join(', ') : ''}`);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Avatar-gender fix failed:', err);
  process.exit(1);
});
