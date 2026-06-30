// Pickleballers API — Dummy User Seed
//
// Fetches profiles from randomuser.me and wires them up as test accounts.
// Coach login users are created from imported coach records, not randomuser.me:
//   - optionally, 1 user per existing Coach (links User.coachId <-> Coach.userId, claims coach)
//   - N venue owners (assigns Venue.ownerUserId on the first unowned venues)
//   - O organizer users
//   - M player users
//
// Owner, organizer, and player seed users get a `@example.com` email
// (randomuser's default domain), which is the marker used to identify and
// clean them on re-run. Coach login users use the imported coach email.
//
// Usage: npm run db:seed:users
//        SEED_PLAYERS=30 SEED_OWNERS=15 SEED_ORGANIZERS=10 npm run db:seed:users
//        SEED_COACHES=0 SEED_OWNERS=20 SEED_ORGANIZERS=30 SEED_PLAYERS=50 npm run db:seed:users

import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDb } from './index.js';
import { User } from '../../features/auth/auth.model.js';
import { Coach } from '../../features/coaches/coaches.model.js';
import { Venue } from '../../features/venues/venues.model.js';

const SEED_PASSWORD = 'password123';
const PLAYER_COUNT = Number(process.env.SEED_PLAYERS ?? 25);
const OWNER_COUNT  = Number(process.env.SEED_OWNERS  ?? 12);
const ORGANIZER_COUNT = Number(process.env.SEED_ORGANIZERS ?? 10);
const SEED_COACHES = !['0', 'false', 'no', 'off'].includes(String(process.env.SEED_COACHES ?? '1').toLowerCase());

interface RandomUser {
  gender: string;
  name: { first: string; last: string };
  email: string;
  login: { uuid: string };
  phone: string;
  cell: string;
  picture: { large: string; thumbnail: string };
  nat: string;
}

async function fetchRandomUsers(count: number): Promise<RandomUser[]> {
  const url = `https://randomuser.me/api/?results=${count}&nat=us,gb,au,ca,nz,ie,nl,es&password=upper,lower,number,8-12&noinfo`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`randomuser.me HTTP ${res.status}`);
  const json: any = await res.json();
  if (!Array.isArray(json.results)) throw new Error('randomuser.me: missing results');
  return json.results;
}

function uniqueEmail(ru: RandomUser): string {
  const slug = ru.login.uuid.slice(0, 8);
  const last = ru.name.last.toLowerCase().replace(/[^a-z]/g, '');
  return `${slug}.${last}@example.com`;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

async function seed() {
  await connectDb();
  console.log('🌱 Seeding dummy users from randomuser.me...\n');

  /* ─── 1. Clean previous seed (idempotent) ─────────────────────── */
  console.log('  Cleaning previous @example.com seed...');
  const prev = await User.find({ email: { $regex: /@example\.com$/i } }).select('_id');
  const prevIds = prev.map(u => u._id);
  if (prevIds.length) {
    await Coach.updateMany(
      { userId: { $in: prevIds } },
      { $unset: { userId: 1 }, $set: { claimStatus: 'unclaimed', isVerified: false } },
    );
    await Venue.updateMany(
      { ownerUserId: { $in: prevIds } },
      { $unset: { ownerUserId: 1 } },
    );
    await User.deleteMany({ _id: { $in: prevIds } });
    console.log(`    removed ${prevIds.length} previous dummy users + unlinked references`);
  } else {
    console.log('    nothing to clean');
  }

  /* ─── 2. Targets ──────────────────────────────────────────────── */
  const coaches = SEED_COACHES ? await Coach.find({}).sort({ _id: 1 }) : [];
  const venuesToOwn = await Venue.find({
    $or: [{ ownerUserId: { $exists: false } }, { ownerUserId: null }],
  }).sort({ _id: 1 }).limit(OWNER_COUNT);

  const COACH_COUNT = coaches.length;
  const RANDOM_PROFILE_COUNT = venuesToOwn.length + ORGANIZER_COUNT + PLAYER_COUNT;
  const TOTAL = COACH_COUNT + RANDOM_PROFILE_COUNT;
  console.log(`  Targets: ${COACH_COUNT} coach users + ${venuesToOwn.length} owner users + ${ORGANIZER_COUNT} organizer users + ${PLAYER_COUNT} player users = ${TOTAL} total\n`);
  if (!SEED_COACHES) console.log('  Skipping coach dummy users (SEED_COACHES=0). Existing coach records stay sourced from handoff CSV data.\n');

  /* ─── 3. Fetch from randomuser.me ─────────────────────────────── */
  console.log(`  Fetching ${RANDOM_PROFILE_COUNT} owner/organizer/player profiles from randomuser.me...`);
  const profiles = RANDOM_PROFILE_COUNT ? await fetchRandomUsers(RANDOM_PROFILE_COUNT) : [];
  if (profiles.length < RANDOM_PROFILE_COUNT) throw new Error(`randomuser.me returned ${profiles.length} (wanted ${RANDOM_PROFILE_COUNT})`);

  /* ─── 4. Hash password once ───────────────────────────────────── */
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 12);

  let idx = 0;

  /* ─── 5. Coach users ──────────────────────────────────────────── */
  console.log(`  Creating ${COACH_COUNT} coach users...`);
  let coachCreated = 0;
  for (const coach of coaches) {
    const email = coach.email || `${coach.slug || coach._id.toString()}@coach.pickleballers.local`;
    const [firstName, ...lastParts] = coach.displayName.split(/\s+/);
    const linkedUser = coach.userId ? await User.findById(coach.userId) : null;
    const emailUser = await User.findOne({ email });
    const coachUser = await User.findOne({ coachId: coach._id });
    const existingUser = linkedUser || emailUser || coachUser;

    if (emailUser && existingUser && emailUser._id.toString() !== existingUser._id.toString()) {
      throw new Error(`Cannot seed coach ${coach.displayName}: ${email} is already used by another user`);
    }

    const userData = {
      email,
      passwordHash,
      displayName:    coach.displayName,
      firstName:      firstName || coach.displayName,
      lastName:       lastParts.join(' ') || undefined,
      avatarUrl:      coach.avatarUrl || coach.imageUrl,
      phone:          coach.phone,
      roleDefault:    'coach',
      modePreference: 'coach',
      coachId:        coach._id,
      isVerified:     true,
      lastLoginAt:    new Date(),
    };

    const user = existingUser
      ? await User.findByIdAndUpdate(existingUser._id, { $set: userData }, { new: true, runValidators: true })
      : await User.create(userData);
    if (!user) throw new Error(`Failed to create or update coach user for ${coach.displayName}`);

    await Coach.updateOne({ _id: coach._id }, {
      $set: {
        userId:       user._id,
        claimStatus:  'claimed',
        isVerified:   true,
        email,
        phone:        coach.phone,
        avatarUrl:    coach.avatarUrl || coach.imageUrl,
      },
    });
    if (!existingUser) coachCreated++;
  }

  /* ─── 6. Venue owner users ────────────────────────────────────── */
  console.log(`  Creating ${venuesToOwn.length} venue owner users...`);
  let ownerCreated = 0;
  for (const venue of venuesToOwn) {
    const ru = profiles[idx++]!;
    const email = uniqueEmail(ru);
    const user = await User.create({
      email,
      passwordHash,
      displayName:    `${ru.name.first} ${ru.name.last}`,
      firstName:      ru.name.first,
      lastName:       ru.name.last,
      avatarUrl:      ru.picture.large,
      phone:          ru.cell,
      roleDefault:    'owner',
      modePreference: 'owner',
      isVerified:     true,
      lastLoginAt:    new Date(),
    });
    await Venue.updateOne({ _id: venue._id }, { $set: { ownerUserId: user._id } });
    ownerCreated++;
  }

  /* ─── 7. Organizer users ──────────────────────────────────────── */
  console.log(`  Creating ${ORGANIZER_COUNT} organizer users...`);
  let organizerCreated = 0;
  for (let i = 0; i < ORGANIZER_COUNT; i++) {
    const ru = profiles[idx++]!;
    const email = uniqueEmail(ru);
    await User.create({
      email,
      passwordHash,
      displayName:    `${ru.name.first} ${ru.name.last}`,
      firstName:      ru.name.first,
      lastName:       ru.name.last,
      avatarUrl:      ru.picture.large,
      phone:          ru.cell,
      roleDefault:    'organizer',
      modePreference: 'organizer',
      bio:            `Community organizer from ${ru.nat}. Hosts beginner-friendly games and social open play.`,
      isVerified:     true,
      lastLoginAt:    new Date(Date.now() - Math.floor(Math.random() * 14 * 24 * 3600_000)),
    });
    organizerCreated++;
  }

  /* ─── 8. Player users ─────────────────────────────────────────── */
  console.log(`  Creating ${PLAYER_COUNT} player users...`);
  const skillLabels = ['Beginner', 'Intermediate', 'Advanced', 'Pro'];
  let playerCreated = 0;
  for (let i = 0; i < PLAYER_COUNT; i++) {
    const ru = profiles[idx++]!;
    const email = uniqueEmail(ru);
    await User.create({
      email,
      passwordHash,
      displayName:    `${ru.name.first} ${ru.name.last}`,
      firstName:      ru.name.first,
      lastName:       ru.name.last,
      avatarUrl:      ru.picture.large,
      phone:          ru.cell,
      roleDefault:    'player',
      modePreference: 'player',
      skillLevel:     Math.round((2 + Math.random() * 3) * 10) / 10,
      skillLevelLabel: pick(skillLabels),
      isVerified:     Math.random() < 0.6,
      lastLoginAt:    Math.random() < 0.7 ? new Date(Date.now() - Math.floor(Math.random() * 30 * 24 * 3600_000)) : undefined,
    });
    playerCreated++;
  }

  /* ─── 9. Summary ──────────────────────────────────────────────── */
  const [admins, coachUsers, ownerUsers, organizerUsers, playerUsers, claimedCoaches, ownedVenues] = await Promise.all([
    User.countDocuments({ roleDefault: 'admin' }),
    User.countDocuments({ roleDefault: 'coach' }),
    User.countDocuments({ roleDefault: 'owner' }),
    User.countDocuments({ roleDefault: 'organizer' }),
    User.countDocuments({ roleDefault: 'player' }),
    Coach.countDocuments({ claimStatus: 'claimed' }),
    Venue.countDocuments({ ownerUserId: { $exists: true, $ne: null } }),
  ]);

  console.log('\n✅ Seed complete!');
  console.log(`   admin  users:  ${admins} (untouched)`);
  console.log(`   coach  users:  ${coachUsers}   (+${coachCreated} created, claimed ${claimedCoaches}/${COACH_COUNT} coaches)`);
  console.log(`   owner  users:  ${ownerUsers}   (+${ownerCreated} created, owns ${ownedVenues} venues)`);
  console.log(`   organizer users: ${organizerUsers} (+${organizerCreated} created)`);
  console.log(`   player users:  ${playerUsers}  (+${playerCreated} created)`);
  console.log(`   total seeded:  ${coachCreated + ownerCreated + organizerCreated + playerCreated}`);
  console.log(`\n   Login: any @example.com address, or imported coach email  /  password: ${SEED_PASSWORD}`);

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
