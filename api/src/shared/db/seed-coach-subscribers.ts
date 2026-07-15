// Pickleballers API — Coach-subscriber seed
//
// Creates N (default 12) PLAYER accounts that have each:
//   • a complete postal address (address1/city/province/zipcode) — the gate the
//     real subscribe flow enforces (ADDRESS_REQUIRED), and
//   • an ACTIVE coach partner-subscription,
// so `/me` reports `coachSubscriptionActive: true` and the global `coach` role
// is granted — exactly what the `subscribe()` controller produces, just seeded.
//
// It does NOT create Coach *directory* profiles (that's a separate step — a coach
// creates a profile via POST /coaches and a venue owner approves an application),
// so these players won't appear in Find Coach until they list themselves.
//
// Idempotent: identifies its own accounts by the `@coachseed.pickleballers.local`
// email domain and rebuilds them (plus their subscriptions/payments/role grants)
// on every run — so the coach-subscriber count lands on exactly N, never drifting.
//
// Usage: npm run db:seed:coach-subs
//        SEED_COACH_SUBSCRIBERS=20 npm run db:seed:coach-subs

import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDb } from './index.js';
import { User, UserRole } from '../../features/auth/auth.model.js';
import { PartnerSubscription } from '../../features/partner-subscriptions/partner-subscriptions.model.js';
import { Payment } from '../../features/payments/payments.model.js';
import { getPartnerSubscriptionPricing, isPaymentTestMode } from '../../features/settings/settings.controller.js';

const SEED_PASSWORD = 'password123';
const MARKER_DOMAIN = 'coachseed.pickleballers.local';
const COUNT = Number(process.env.SEED_COACH_SUBSCRIBERS ?? 12);

// A demo term long enough that these accounts stay subscribed between demos
// (the real flow uses the 30-day pricing term; seed data gets a year so it
// doesn't silently lapse and revoke the coach role mid-demo). Re-run to refresh.
const SEED_TERM_DAYS = 365;

interface SeedCoach {
  first: string;
  last: string;
  skillLevel: number;
  skillLevelLabel: string;
  address1: string;
  address2?: string;
  city: string;
  province: string;
  zipcode: string;
}

// 12 realistic PH-based players with complete addresses across Metro Manila +
// nearby provinces. Add more rows if COUNT is raised past this list length.
const COACHES: SeedCoach[] = [
  { first: 'Miguel',   last: 'Santos',      skillLevel: 4.5, skillLevelLabel: 'Advanced', address1: '128 Jupiter St., Bel-Air',            city: 'Makati',       province: 'Metro Manila', zipcode: '1209' },
  { first: 'Andrea',   last: 'Reyes',       skillLevel: 4.8, skillLevelLabel: 'Pro',      address1: '45 Scout Rallos St., Laging Handa',  city: 'Quezon City',  province: 'Metro Manila', zipcode: '1103' },
  { first: 'Paolo',    last: 'Mendoza',     skillLevel: 4.0, skillLevelLabel: 'Advanced', address1: '7 McKinley Rd., Forbes Park',        city: 'Taguig',       province: 'Metro Manila', zipcode: '1630' },
  { first: 'Bianca',   last: 'Cruz',        skillLevel: 4.2, skillLevelLabel: 'Advanced', address1: '210 Shaw Blvd., Wack-Wack',          city: 'Mandaluyong',  province: 'Metro Manila', zipcode: '1552' },
  { first: 'Rafael',   last: 'Dela Cruz',   skillLevel: 5.0, skillLevelLabel: 'Pro',      address1: '33 Ortigas Ave., San Antonio',      address2: 'Unit 12B', city: 'Pasig',   province: 'Metro Manila', zipcode: '1605' },
  { first: 'Camille',  last: 'Bautista',    skillLevel: 3.8, skillLevelLabel: 'Advanced', address1: '9 Roxas Blvd., Malate',             city: 'Manila',       province: 'Metro Manila', zipcode: '1004' },
  { first: 'Joshua',   last: 'Garcia',      skillLevel: 4.6, skillLevelLabel: 'Pro',      address1: '88 Dr. A. Santos Ave., BF Homes',   city: 'Parañaque',    province: 'Metro Manila', zipcode: '1720' },
  { first: 'Patricia', last: 'Ramos',       skillLevel: 4.1, skillLevelLabel: 'Advanced', address1: '15 Alabang-Zapote Rd., Talon Uno',  city: 'Las Piñas',    province: 'Metro Manila', zipcode: '1747' },
  { first: 'Marco',    last: 'Villanueva',  skillLevel: 4.4, skillLevelLabel: 'Advanced', address1: '52 Aguinaldo Highway, Anabu I-A',   city: 'Imus',         province: 'Cavite',       zipcode: '4103' },
  { first: 'Isabel',   last: 'Torres',      skillLevel: 4.9, skillLevelLabel: 'Pro',      address1: '3 Antero Soriano Highway, Daang Amaya', city: 'Tanza',    province: 'Cavite',       zipcode: '4108' },
  { first: 'Gabriel',  last: 'Aquino',      skillLevel: 4.3, skillLevelLabel: 'Advanced', address1: '77 Marcos Highway, Mayamot',        city: 'Antipolo',     province: 'Rizal',        zipcode: '1870' },
  { first: 'Nicole',   last: 'Fernandez',   skillLevel: 4.7, skillLevelLabel: 'Pro',      address1: '19 Governor\'s Drive, Burol Main',  city: 'Dasmariñas',   province: 'Cavite',       zipcode: '4114' },
];

function emailFor(c: SeedCoach, i: number): string {
  const slug = `${c.first}.${c.last}`.toLowerCase().replace(/[^a-z.]/g, '');
  return `${slug}.${String(i + 1).padStart(2, '0')}@${MARKER_DOMAIN}`;
}

async function seed() {
  await connectDb();
  console.log(`🌱 Seeding ${COUNT} coach-subscriber players (marker: @${MARKER_DOMAIN})...\n`);

  if (COUNT > COACHES.length) {
    throw new Error(`SEED_COACH_SUBSCRIBERS=${COUNT} exceeds the ${COACHES.length} defined profiles — add more rows to COACHES[].`);
  }

  /* ─── 1. Clean previous seed (idempotent) ─────────────────────── */
  console.log('  Cleaning previous coach-subscriber seed...');
  const prev = await User.find({ email: { $regex: new RegExp(`@${MARKER_DOMAIN.replace(/\./g, '\\.')}$`, 'i') } }).select('_id');
  const prevIds = prev.map((u) => u._id);
  if (prevIds.length) {
    const subs = await PartnerSubscription.find({ userId: { $in: prevIds } }).select('_id');
    const subIds = subs.map((s) => s._id);
    await Payment.deleteMany({ $or: [{ userId: { $in: prevIds } }, { subscriptionId: { $in: subIds } }] });
    await PartnerSubscription.deleteMany({ userId: { $in: prevIds } });
    await UserRole.deleteMany({ userId: { $in: prevIds } });
    await User.deleteMany({ _id: { $in: prevIds } });
    console.log(`    removed ${prevIds.length} previous seed users + their subscriptions/payments/roles`);
  } else {
    console.log('    nothing to clean');
  }

  /* ─── 2. Pricing + mode (mirrors subscribe()) ─────────────────── */
  const pricing = await getPartnerSubscriptionPricing();
  const testMode = await isPaymentTestMode();
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 12);
  console.log(`  Coach plan: ₱${pricing.coach.toLocaleString('en-PH')} ${pricing.currency} · term seeded at ${SEED_TERM_DAYS} days · payment mode: ${testMode ? 'test' : 'live'}\n`);

  /* ─── 3. Create N subscribed coach players ────────────────────── */
  let created = 0;
  for (let i = 0; i < COUNT; i++) {
    const c = COACHES[i]!;
    const email = emailFor(c, i);
    const displayName = `${c.first} ${c.last}`;

    const user = await User.create({
      email,
      passwordHash,
      displayName,
      firstName: c.first,
      lastName: c.last,
      avatarUrl: `https://i.pravatar.cc/300?u=${encodeURIComponent(email)}`,
      roleDefault: 'player',
      modePreference: 'player',
      skillLevel: c.skillLevel,
      skillLevelLabel: c.skillLevelLabel,
      bio: `Pickleball coach based in ${c.city}. Subscribed on PickleBallers.`,
      address1: c.address1,
      address2: c.address2,
      city: c.city,
      province: c.province,
      zipcode: c.zipcode,
      isVerified: true,
      lastLoginAt: new Date(),
    });

    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + SEED_TERM_DAYS * 24 * 60 * 60 * 1000);

    const sub = await PartnerSubscription.create({
      userId: user._id,
      plan: 'coach',
      status: 'active',
      priceAmount: pricing.coach,
      currency: pricing.currency,
      startedAt,
      expiresAt,
      autoRenew: false,
    });

    const payment = await Payment.create({
      userId: user._id,
      purpose: 'partner_subscription',
      subscriptionId: sub._id,
      amount: pricing.coach,
      currency: pricing.currency,
      method: testMode ? 'test_card' : null,
      provider: testMode ? 'test' : null,
      status: testMode ? 'completed' : 'pending',
    });
    sub.set('paymentId', payment._id);
    await sub.save();

    // The global grant that unlocks the coach partner surfaces (mirrors
    // grantGlobalRole() in the subscribe controller).
    await UserRole.updateOne(
      { userId: user._id, role: 'coach', scopeType: null, scopeId: null },
      { $setOnInsert: { userId: user._id, role: 'coach', scopeType: null, scopeId: null } },
      { upsert: true },
    );

    created++;
    console.log(`    ✓ ${displayName.padEnd(20)} ${email}`);
  }

  /* ─── 4. Verify + summary ─────────────────────────────────────── */
  const now = new Date();
  const activeCoachUsers = await PartnerSubscription.distinct('userId', {
    plan: 'coach', status: 'active', expiresAt: { $gt: now },
  });

  console.log('\n✅ Coach-subscriber seed complete!');
  console.log(`   created:                 ${created} players (all with a complete address + active coach subscription)`);
  console.log(`   active coach subscribers (whole DB): ${activeCoachUsers.length}`);
  console.log(`\n   Login: any @${MARKER_DOMAIN} address  /  password: ${SEED_PASSWORD}`);

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Coach-subscriber seed failed:', err);
  process.exit(1);
});
