// Restore the documented test users + venue ownership from
// web/TEST_CREDENTIALS.txt back into the DB (a re-seed regenerated random
// emails, so the documented accounts — incl. "Oscar Walker" who owns 5 venues —
// went missing). Idempotent: upserts by email, reassigns venues by slug.
//
//   npx tsx src/shared/db/restore-test-credentials.ts
import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { User } from '../../features/auth/auth.model.js';
import { Venue } from '../../features/venues/venues.model.js';

const MONGO = process.env.MONGODB_URI || 'mongodb://localhost:27017/pickleballers';
// Resolved from this file, not hardcoded: the absolute path this used to carry
// (/var/public/pickleplay/…) died when the monorepo moved, which silently broke
// the step of the seed pipeline that restores the admin + the two test owners.
const CRED_FILE = path.resolve(import.meta.dirname, '../../../../web/TEST_CREDENTIALS.txt');
const ADMIN_PASSWORD = 'justinianthegreat!';
const SEED_PASSWORD = 'password123';

type ParsedUser = { email: string; password: string; name: string; role: string };

function parse(text: string) {
  const lines = text.split('\n');
  const users: ParsedUser[] = [];
  const ownerVenues: { owner: string; slug: string }[] = [];
  let role = '';
  let inOwnerVenues = false;
  let currentOwner = '';

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    const banner = line.match(/^(ADMIN|OWNER|ORGANIZER|COACH|PLAYER)\b/);
    if (banner) { role = banner[1].toLowerCase(); inOwnerVenues = false; continue; }
    if (/^\s+Owner → venues/.test(line)) { inOwnerVenues = true; continue; }

    if (inOwnerVenues) {
      // Owner header:  "  Oscar Walker (5 venues, 13 courts):"
      const oh = line.match(/^ {2}(\S.*?) \(\d+ venues?,/);
      if (oh) { currentOwner = oh[1].trim(); continue; }
      // Venue line:  "    - Name (…) (/slug) — N courts"
      const vm = line.match(/^\s+-\s+.*\(\/([a-z0-9-]+)\)/);
      if (vm && currentOwner) ownerVenues.push({ owner: currentOwner, slug: vm[1] });
      continue;
    }

    // User row: split on 2+ spaces → [email, password, name, ...extra]
    const cols = line.trim().split(/\s{2,}/);
    if (cols.length >= 3 && /^[^\s@]+@[^\s@]+$/.test(cols[0]) && role) {
      users.push({ email: cols[0], password: cols[1], name: cols[2], role });
    }
  }
  return { users, ownerVenues };
}

async function main() {
  // Skip cleanly rather than crashing: this runs as a step of the seed
  // pipeline, and a missing credentials file shouldn't take the whole run down.
  if (!existsSync(CRED_FILE)) {
    console.warn(`⚠️  ${CRED_FILE} not found — skipping test-credential restore.`);
    return;
  }

  await mongoose.connect(MONGO);
  const { users, ownerVenues } = parse(readFileSync(CRED_FILE, 'utf8'));

  const seedHash = await bcrypt.hash(SEED_PASSWORD, 12);
  const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

  let created = 0, updated = 0;
  for (const u of users) {
    const [firstName, ...rest] = u.name.split(/\s+/);
    const set: Record<string, unknown> = {
      displayName: u.name,
      firstName: firstName || u.name,
      lastName: rest.join(' ') || undefined,
      roleDefault: u.role,
      modePreference: u.role,
      passwordHash: u.role === 'admin' ? adminHash : seedHash,
      isVerified: true,
    };
    const res = await User.updateOne({ email: u.email }, { $set: set }, { upsert: true });
    if (res.upsertedCount) created++; else updated++;
  }

  // Reassign venue ownership by slug.
  const byName = new Map<string, mongoose.Types.ObjectId>();
  for (const u of users) {
    if (u.role !== 'owner') continue;
    const doc = await User.findOne({ email: u.email }).select('_id').lean();
    if (doc) byName.set(u.name, doc._id as mongoose.Types.ObjectId);
  }
  let assigned = 0, missingSlug = 0, missingOwner = 0;
  for (const ov of ownerVenues) {
    const ownerId = byName.get(ov.owner);
    if (!ownerId) { missingOwner++; continue; }
    const r = await Venue.updateOne({ slug: ov.slug }, { $set: { ownerUserId: ownerId } });
    if (r.matchedCount) assigned++; else missingSlug++;
  }

  console.log(`Users: ${created} created, ${updated} updated (total ${users.length})`);
  console.log(`Venues: ${assigned} assigned, ${missingSlug} slug-not-found, ${missingOwner} owner-not-found`);
  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
