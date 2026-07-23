// Pickleballers API — Dummy Data Seed (fills empty collections)
//
// Populates every collection that is currently EMPTY with >= 50 realistic
// dummy records each, reusing the existing cities / coaches / users / venues
// as foreign keys. Collections that already hold data (venues, coaches,
// users, cities, venuehours, venuepricings, …) are left untouched.
//
// Idempotent: a collection is only seeded when it has 0 documents. Re-running
// after a partial run fills whatever is still empty and reuses what's there.
//
// Usage: npm run db:seed:dummy
//        SEED_N=80 npm run db:seed:dummy   # bump the per-collection target

import 'dotenv/config';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { connectDb } from './index.js';
import { openPlayTitle } from './open-play-titles.js';

import { User, UserRole, UserDevice, PasswordResetToken, EmailVerificationToken } from '../../features/auth/auth.model.js';
import { City } from '../../features/cities/cities.model.js';
import { Venue, Court, Faq, HolidayClosure, VenueStaff, Amenity } from '../../features/venues/venues.model.js';
import { VenueClaim, SuggestedEdit } from '../../features/venues/venue-management.model.js';
import { Coach, CoachService } from '../../features/coaches/coaches.model.js';
import { CoachReview } from '../../features/coaches/coach-reviews.model.js';
import { OpenPlaySession, Tournament, Event, TournamentRegistration, EventRegistration, Post, Series, PostRelation } from '../../features/content/content.model.js';
import { Review, ReviewReply, ReviewReport, Favorite, Notification } from '../../features/interactions/interactions.model.js';
import { Booking } from '../../features/bookings/bookings.model.js';
import { Payment } from '../../features/payments/payments.model.js';
import { Subscription, AuditLog } from '../../features/subscriptions/subscriptions.model.js';
import { Media } from '../../features/media/media.model.js';
import { Tag } from '../../features/tags/tags.model.js';

const N = Number(process.env.SEED_N ?? 60); // per-collection target (>= 50)

type Id = mongoose.Types.ObjectId;

/* ─── Random helpers ───────────────────────────────────────────── */
const rng = () => Math.random();
const pick = <T>(a: T[]): T => a[Math.floor(rng() * a.length)]!;
const pickN = <T>(a: T[], n: number): T[] => [...a].sort(() => rng() - 0.5).slice(0, n);
const randInt = (lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));
const chance = (p: number) => rng() < p;
const token = () => crypto.randomBytes(24).toString('hex');
const ymd = (d: Date) => d.toISOString().split('T')[0]!;
const dayOffset = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d; };
const hhmm = (h: number, m = 0) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
const peso = (lo: number, hi: number, step = 50) => Math.round(randInt(lo, hi) / step) * step;

/* ─── Idempotent insert helper ─────────────────────────────────── */
async function ensure<T extends mongoose.Model<any>>(
  Model: T,
  label: string,
  generate: () => any[] | Promise<any[]>,
): Promise<any[]> {
  const have = await Model.countDocuments();
  if (have > 0) {
    console.log(`  ⏭  ${label.padEnd(22)} already has ${have} — skipping`);
    return Model.find().lean();
  }
  const docs = await generate();
  if (!docs.length) { console.log(`  ⚠  ${label.padEnd(22)} generated 0`); return []; }
  const inserted = await Model.insertMany(docs, { ordered: false });
  console.log(`  ✅ ${label.padEnd(22)} inserted ${inserted.length}`);
  return inserted;
}

/* ─── Content pools ────────────────────────────────────────────── */
const SURFACES = ['Acrylic hard court', 'Cushioned acrylic', 'Concrete', 'Asphalt', 'Sport tiles', 'Wooden indoor'];
const LEVELS = [
  { label: 'Beginner', color: '#22c55e', min: 1.0, max: 2.5 },
  { label: 'Intermediate', color: '#eab308', min: 2.5, max: 3.5 },
  { label: 'Advanced', color: '#ef4444', min: 3.5, max: 4.5 },
  { label: 'Open / All levels', color: '#3b82f6', min: 1.0, max: 5.0 },
];
const REVIEW_TEXTS = [
  'Great courts and a friendly community. Will definitely come back.',
  'Well maintained lines and nets, plenty of parking too.',
  'Fun open play sessions, organizers keep games balanced.',
  'A bit crowded on weekends but the vibe is excellent.',
  'Lighting is fantastic for night games. Highly recommended.',
  'Clean restrooms and a nice waiting area. Solid venue.',
  'Loved the coaching drills here, very beginner friendly.',
  'Courts can get hot midday — go early or in the evening.',
  'Affordable rates and easy online booking. Five stars.',
  'Good surface, true bounce. Staff were welcoming.',
];
const COACH_REVIEW_TEXTS = [
  'Patient coach who breaks down every shot clearly.',
  'My dinks improved massively after just a few sessions.',
  'Tailors drills to your level. Worth every peso.',
  'High energy and encouraging — made learning fun.',
  'Knows the game inside out, great strategy tips.',
  'Punctual, prepared, and genuinely cares about progress.',
];
const FAQ_PAIRS = [
  { q: 'Do I need to reserve a court in advance?', a: 'We recommend booking ahead, especially for evenings and weekends.' },
  { q: 'Is equipment available to rent?', a: 'Yes, paddles and balls can be rented at the front desk.' },
  { q: 'Are walk-ins welcome for open play?', a: 'Walk-ins are welcome subject to available slots.' },
  { q: 'Is there parking on site?', a: 'Free parking is available for all players.' },
  { q: 'Do you offer beginner lessons?', a: 'Yes, certified coaches run beginner clinics weekly.' },
  { q: 'What are your peak hours?', a: 'Peak hours are 6–9pm on weekdays and mornings on weekends.' },
];
const NOTIF = [
  { type: 'booking', title: 'Booking confirmed', body: 'Your court reservation is confirmed. See you on the court!', icon: 'calendar_month' },
  { type: 'session', title: 'Open play reminder', body: 'Your open play session starts in 2 hours.', icon: 'alarm' },
  { type: 'review', title: 'New reply to your review', body: 'A venue owner responded to your review.', icon: 'reviews' },
  { type: 'promo', title: 'Weekend special', body: 'Get 20% off off-peak court rentals this weekend.', icon: 'sell' },
  { type: 'system', title: 'Welcome to PickleBallers', body: 'Find venues, coaches, and open play near you.', icon: 'campaign' },
  { type: 'coach', title: 'New coaching slot', body: 'A coach you follow opened new private lesson slots.', icon: 'school' },
];
const TAG_GROUPS: Record<string, string[]> = {
  vibe: ['Competitive', 'Casual', 'Social', 'Family friendly', 'Beginner friendly', 'Pro level', 'High energy', 'Relaxed'],
  surface: ['Acrylic', 'Cushioned', 'Concrete', 'Wooden', 'Sport tiles', 'Outdoor', 'Indoor', 'Covered'],
  amenity: ['Parking', 'Showers', 'Lockers', 'Cafe', 'Pro shop', 'Aircon', 'WiFi', 'Seating', 'Water refill', 'Paddle rental'],
  feature: ['Night lighting', 'Tournament ready', 'Coaching', 'Open play', 'Court rental', 'Leagues', 'Clinics', 'Round robin'],
  region: ['Metro Manila', 'North Luzon', 'South Luzon', 'Visayas', 'Mindanao', 'Cebu', 'Davao', 'Pampanga'],
};
const AMENITIES: Array<[string, string]> = [
  ['Free Parking', 'parking'], ['Paid Parking', 'parking'], ['Valet Parking', 'parking'],
  ['Air Conditioning', 'comfort'], ['Covered Courts', 'comfort'], ['Shaded Seating', 'comfort'],
  ['Spectator Seating', 'comfort'], ['Lounge Area', 'comfort'], ['Misting Fans', 'comfort'],
  ['Tournament Lighting', 'courts'], ['Night Lighting', 'courts'], ['Permanent Nets', 'courts'],
  ['Dedicated Lines', 'courts'], ['Practice Wall', 'courts'], ['Ball Machine', 'courts'],
  ['Showers', 'facilities'], ['Lockers', 'facilities'], ['Changing Rooms', 'facilities'],
  ['Restrooms', 'facilities'], ['First Aid Station', 'facilities'], ['Drinking Fountain', 'facilities'],
  ['Water Refill Station', 'food'], ['Cafe', 'food'], ['Snack Bar', 'food'],
  ['Vending Machines', 'food'], ['Restaurant', 'food'], ['Juice Bar', 'food'],
  ['Paddle Rental', 'equipment'], ['Ball Rental', 'equipment'], ['Pro Shop', 'equipment'],
  ['Stringing Service', 'equipment'], ['Equipment Storage', 'equipment'],
  ['Free WiFi', 'tech'], ['Live Scoreboards', 'tech'], ['Online Booking', 'tech'],
  ['Cashless Payments', 'tech'], ['Member App', 'tech'],
  ['Group Coaching', 'programs'], ['Private Coaching', 'programs'], ['Beginner Clinics', 'programs'],
  ['Junior Programs', 'programs'], ['Leagues', 'programs'], ['Round Robin', 'programs'],
  ['Tournaments', 'programs'], ['Open Play', 'programs'],
  ['Wheelchair Accessible', 'access'], ['Kids Play Area', 'access'], ['Bike Racks', 'access'],
  ['Prayer Room', 'access'], ['Smoking Area', 'access'],
];
const COACH_SERVICES = [
  { name: 'Private 1-on-1 Lesson', dur: 60, lo: 800, hi: 1800, desc: 'One-on-one coaching tailored to your goals.' },
  { name: 'Semi-Private (2 players)', dur: 60, lo: 600, hi: 1200, desc: 'Shared session for two players of similar level.' },
  { name: 'Beginner Clinic', dur: 90, lo: 400, hi: 800, desc: 'Group clinic covering grips, dinks, and serves.' },
  { name: 'Strategy & Drills', dur: 75, lo: 700, hi: 1500, desc: 'Match strategy, court positioning, and live drills.' },
  { name: 'Junior Development', dur: 60, lo: 500, hi: 1000, desc: 'Fun fundamentals program for kids and teens.' },
];
const SERIES_TITLES = [
  'Beginner Basics', 'Mastering the Dink', 'Serve & Return Lab', 'Footwork Fundamentals',
  'Doubles Strategy', 'Gear & Paddle Reviews', 'Rules Explained', 'Tournament Prep',
  'Fitness for Pickleball', 'Mindset & Mental Game', 'Venue Spotlights', 'Coach Q&A',
  'Injury Prevention', 'Nutrition on Court', 'Pro Player Profiles', 'Community Stories',
  'Drills of the Week', 'Shot of the Month', 'Open Play Etiquette', 'Buying Your First Paddle',
];
const POST_TITLES = [
  'How to Choose Your First Paddle', 'Five Drills to Sharpen Your Dink', 'Reading the Kitchen Line',
  'Why Footwork Wins Matches', 'A Beginner\'s Guide to Open Play', 'Mastering the Third-Shot Drop',
  'Doubles Communication 101', 'Serving Deep and With Spin', 'Stretching Before You Play',
  'Pickleball Scoring, Demystified', 'Indoor vs Outdoor: What Changes', 'Building a Practice Routine',
  'Top Etiquette Tips for New Players', 'Choosing the Right Court Shoes', 'Recovering Faster Between Games',
];

/* ─── Main ─────────────────────────────────────────────────────── */
async function seed() {
  await connectDb();
  console.log(`🌱 Seeding dummy data into empty collections (target ${N}/collection)\n`);

  /* Load existing reference data */
  const [users, coaches, venues, cities] = await Promise.all([
    User.find().select('_id email displayName roleDefault').lean(),
    Coach.find().select('_id displayName slug').lean(),
    Venue.find().select('_id slug displayName cityId courtCount').lean(),
    City.find().select('_id name slug').lean(),
  ]);
  console.log(`  Reference: ${users.length} users, ${coaches.length} coaches, ${venues.length} venues, ${cities.length} cities\n`);
  if (!users.length || !venues.length || !coaches.length) {
    throw new Error('Missing base data (users/venues/coaches). Run db:import + db:seed:users first.');
  }
  const uid = (i: number): Id => users[i % users.length]!._id as Id;
  const adminId = (users.find(u => u.roleDefault === 'admin')?._id ?? users[0]!._id) as Id;

  /* ── Independent reference collections ───────────────────────── */
  await ensure(Tag, 'tags', () => {
    const out: any[] = [];
    const seen = new Set<string>();
    for (const [tagType, names] of Object.entries(TAG_GROUPS)) {
      for (const name of names) {
        let slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        while (seen.has(slug)) slug += '-x';
        seen.add(slug);
        out.push({ slug, displayName: name, tagType });
      }
    }
    let i = 0;
    while (out.length < N) { out.push({ slug: `tag-${i}`, displayName: `Tag ${i}`, tagType: 'misc' }); i++; }
    return out;
  });

  await ensure(Amenity, 'amenities', () => {
    const out: any[] = [];
    const seen = new Set<string>();
    for (const [name, category] of AMENITIES) {
      let slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      while (seen.has(slug)) slug += '-x';
      seen.add(slug);
      out.push({ slug, displayName: name, category, icon: category });
    }
    let i = 0;
    while (out.length < N) { out.push({ slug: `amenity-${i}`, displayName: `Amenity ${i}`, category: 'misc', icon: 'misc' }); i++; }
    return out;
  });

  const series = await ensure(Series, 'series', () => {
    const out: any[] = [];
    for (let i = 0; i < Math.max(N, SERIES_TITLES.length); i++) {
      const base = SERIES_TITLES[i % SERIES_TITLES.length]!;
      const title = i < SERIES_TITLES.length ? base : `${base} Vol. ${Math.floor(i / SERIES_TITLES.length) + 1}`;
      out.push({
        slug: `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${i}`,
        title, description: `A ${title.toLowerCase()} content series for PickleBallers.`,
        postType: pick(['guide', 'video', 'article']), sortOrder: i, isActive: true,
      });
    }
    return out;
  });

  await ensure(Subscription, 'subscriptions', () => {
    const out: any[] = [];
    for (let i = 0; i < N; i++) {
      out.push({
        email: `subscriber.${i}.${token().slice(0, 6)}@example.com`,
        userId: chance(0.4) ? uid(i) : undefined,
        status: chance(0.9) ? 'active' : 'unsubscribed',
        source: pick(['footer', 'popup', 'checkout', 'import', 'event']),
        preferences: { weekly: chance(0.7), promos: chance(0.5) },
      });
    }
    return out;
  });

  /* ── Venue-scoped collections ────────────────────────────────── */
  const courts = await ensure(Court, 'courts', () => {
    const out: any[] = [];
    for (let i = 0; out.length < N; i++) {
      const v = venues[i % venues.length]!;
      const count = Math.max(2, v.courtCount || randInt(2, 6));
      for (let c = 1; c <= Math.min(count, 4) && out.length < N; c++) {
        out.push({
          venueId: v._id, courtNumber: String(c), courtName: `Court ${c}`,
          surfaceType: pick(SURFACES), indoor: chance(0.5), isActive: true,
        });
      }
    }
    return out;
  });
  const courtsByVenue = new Map<string, Id[]>();
  for (const c of courts) {
    const k = String(c.venueId);
    if (!courtsByVenue.has(k)) courtsByVenue.set(k, []);
    courtsByVenue.get(k)!.push(c._id as Id);
  }

  await ensure(Faq, 'faqs', () => {
    const out: any[] = [];
    for (let i = 0; out.length < N; i++) {
      const v = venues[i % venues.length]!;
      const pairs = pickN(FAQ_PAIRS, randInt(2, 4));
      pairs.forEach((p, idx) => { if (out.length < N) out.push({ venueId: v._id, question: p.q, answer: p.a, sortOrder: idx }); });
    }
    return out;
  });

  await ensure(HolidayClosure, 'holidayclosures', () => {
    const holidays = [
      ['12-25', 'Christmas Day'], ['12-30', 'Rizal Day'], ['01-01', 'New Year\'s Day'],
      ['04-09', 'Araw ng Kagitingan'], ['06-12', 'Independence Day'], ['11-01', 'All Saints\' Day'],
      ['08-21', 'Ninoy Aquino Day'], ['11-30', 'Bonifacio Day'],
    ];
    const yr = new Date().getFullYear();
    const out: any[] = [];
    for (let i = 0; i < N; i++) {
      const v = venues[i % venues.length]!;
      const [mmdd, reason] = holidays[i % holidays.length]!;
      const allDay = chance(0.7);
      out.push({
        venueId: v._id, closureDate: `${yr}-${mmdd}`, reason,
        isClosedAllDay: allDay,
        openTime: allDay ? undefined : hhmm(9), closeTime: allDay ? undefined : hhmm(13),
      });
    }
    return out;
  });

  const sessions = await ensure(OpenPlaySession, 'openplaysessions', () => {
    const out: any[] = [];
    // Shared across the batch so no two seeded sessions land on the same name.
    const titlesSeen = new Set<string>();
    for (let i = 0; i < N; i++) {
      const v = venues[i % venues.length]!;
      const lvl = pick(LEVELS);
      const start = randInt(6, 19);
      const cap = randInt(8, 24);
      const date = ymd(dayOffset(randInt(-10, 30)));
      const startTime = hhmm(start);
      out.push({
        slug: `open-play-${i}-${token().slice(0, 6)}`,
        // Named for when it runs and what it is, not for its skill band — four
        // level labels across N rows read as a placeholder. See open-play-titles.ts.
        title: openPlayTitle({ date, startTime, levelLabel: lvl.label }, titlesSeen),
        venueId: v._id, cityId: v.cityId,
        date,
        startTime, endTime: hhmm(start + 2),
        levelLabel: lvl.label, levelColor: lvl.color, skillLevelMin: lvl.min, skillLevelMax: lvl.max,
        price: peso(150, 500), capacity: cap, joinedCount: randInt(0, cap),
        status: 'published', organizerName: pick(['Venue Staff', 'PB Community', 'Local League']),
        organizerType: 'venue', isRecurring: chance(0.3),
        description: 'Drop-in open play. Paddles rotate every game; all welcome.',
      });
    }
    return out;
  });

  const events = await ensure(Event, 'events', () => {
    const out: any[] = [];
    const types = ['social', 'clinic', 'league', 'meetup', 'workshop'];
    for (let i = 0; i < N; i++) {
      const v = venues[i % venues.length]!;
      const cap = randInt(12, 48);
      out.push({
        slug: `event-${i}-${token().slice(0, 6)}`,
        name: `${pick(['Sunset', 'Weekend', 'Mixer', 'Sunrise', 'Friday Night'])} ${pick(['Social', 'Clinic', 'League Night', 'Meetup'])}`,
        venueId: v._id, cityId: v.cityId,
        date: ymd(dayOffset(randInt(-5, 40))), startTime: hhmm(randInt(7, 18)), endTime: hhmm(randInt(19, 21)),
        eventType: pick(types), price: peso(0, 600),
        description: 'A friendly community event — bring water and good vibes.',
        organizer: pick(['PickleBallers PH', 'Venue Staff', 'Coach Collective']),
        capacity: cap, registeredCount: randInt(0, cap), status: 'published',
      });
    }
    return out;
  });

  const tournaments = await ensure(Tournament, 'tournaments', () => {
    const out: any[] = [];
    const fmts = ['Round robin', 'Single elimination', 'Double elimination', 'Pool play + bracket'];
    for (let i = 0; i < N; i++) {
      const v = venues[i % venues.length]!;
      const start = dayOffset(randInt(5, 60));
      const lvl = pick(LEVELS);
      const max = randInt(16, 64);
      out.push({
        slug: `tournament-${i}-${token().slice(0, 6)}`,
        name: `${pick(['Metro', 'City', 'Open', 'Spring', 'Summer', 'Pro-Am'])} ${pick(['Cup', 'Classic', 'Championship', 'Open', 'Slam'])}`,
        venueId: v._id, cityId: v.cityId,
        startDate: ymd(start), endDate: ymd(new Date(start.getTime() + 86400000)),
        startTime: hhmm(8), endTime: hhmm(18),
        skillLevel: lvl.label, format: pick(fmts), price: peso(300, 1500),
        maxPlayers: max, registeredPlayers: randInt(0, max), status: pick(['open', 'open', 'open', 'closed']),
        description: 'Sanctioned bracket play with prizes for top finishers.',
        organizer: pick(['PickleBallers PH', 'National Pickleball League', 'Venue Pro Shop']),
        contactEmail: 'events@example.com', isFeatured: chance(0.25),
        prizeInfo: 'Medals + cash prizes for gold/silver/bronze.',
      });
    }
    return out;
  });

  /* ── Coach-scoped collections ────────────────────────────────── */
  await ensure(CoachService, 'coachservices', () => {
    const out: any[] = [];
    for (let i = 0; out.length < N; i++) {
      const coach = coaches[i % coaches.length]!;
      const svcs = pickN(COACH_SERVICES, randInt(2, 3));
      for (const s of svcs) {
        if (out.length >= N && i >= coaches.length) break;
        out.push({
          coachId: coach._id, name: s.name, durationMinutes: s.dur,
          price: peso(s.lo, s.hi), description: s.desc,
          maxStudents: s.name.includes('Clinic') || s.name.includes('Junior') ? randInt(4, 10) : (s.name.includes('Semi') ? 2 : 1),
          isActive: true,
        });
      }
    }
    return out;
  });

  await ensure(CoachReview, 'coachreviews', () => {
    const out: any[] = [];
    for (let i = 0; i < N; i++) {
      out.push({
        coachId: pick(coaches)._id, userId: uid(i),
        rating: randInt(3, 5), text: pick(COACH_REVIEW_TEXTS),
        status: chance(0.85) ? 'approved' : 'pending_moderation',
      });
    }
    return out;
  });

  /* ── Reviews + dependents ────────────────────────────────────── */
  const reviews = await ensure(Review, 'reviews', () => {
    const out: any[] = [];
    for (let i = 0; i < N; i++) {
      const v = venues[i % venues.length]!;
      out.push({
        venueId: v._id, userId: uid(i + 3),
        rating: randInt(3, 5), text: pick(REVIEW_TEXTS),
        visitDate: ymd(dayOffset(-randInt(1, 120))),
        status: chance(0.8) ? 'approved' : 'pending_moderation', source: 'native',
      });
    }
    return out;
  });

  await ensure(ReviewReply, 'reviewreplies', () => {
    // one reply per review (reviewId is unique); cap to the review pool
    return reviews.slice(0, Math.min(N, reviews.length)).map((r: any, i: number) => ({
      reviewId: r._id, venueId: r.venueId, replierUserId: uid(i + 1),
      text: pick([
        'Thanks for the kind words — see you on the courts!',
        'We appreciate the feedback and are glad you enjoyed your visit.',
        'Thank you! We\'re working on adding more evening slots.',
        'Noted on the midday heat — covered courts are coming soon.',
      ]),
    }));
  });

  await ensure(ReviewReport, 'reviewreports', () => {
    const reasons = ['spam', 'offensive', 'fake', 'off_topic', 'conflict'];
    return Array.from({ length: N }, (_, i) => ({
      reviewId: pick(reviews)._id, reporterUserId: uid(i + 2),
      reason: pick(reasons), details: 'Flagged for moderator review.',
      status: pick(['pending', 'pending', 'resolved', 'dismissed']),
    }));
  });

  /* ── Bookings + payments ─────────────────────────────────────── */
  const bookings = await ensure(Booking, 'bookings', () => {
    const out: any[] = [];
    const methods = ['gcash', 'cash', 'card', 'bank_transfer'];
    const statuses = ['confirmed', 'confirmed', 'pending_approval', 'completed', 'cancelled'];
    for (let i = 0; i < N; i++) {
      const v = venues[i % venues.length]!;
      const start = randInt(7, 20);
      const status = pick(statuses);
      const venueCourts = courtsByVenue.get(String(v._id));
      out.push({
        userId: uid(i), venueId: v._id, bookingType: 'court',
        courtId: venueCourts?.length ? pick(venueCourts) : undefined,
        date: ymd(dayOffset(randInt(-15, 30))),
        startTime: hhmm(start), endTime: hhmm(start + 1),
        playerCount: randInt(2, 4), amount: peso(300, 1200),
        status, referenceCode: `BK-${token().slice(0, 8).toUpperCase()}`,
        paymentMethod: pick(methods),
        cancellationReason: status === 'cancelled' ? 'Schedule conflict' : undefined,
        cancelledAt: status === 'cancelled' ? new Date() : undefined,
      });
    }
    return out;
  });

  await ensure(Payment, 'payments', () => {
    const out: any[] = [];
    const methods = ['gcash', 'card', 'bank_transfer', 'cash'];
    // payments tied to bookings
    for (const b of bookings.slice(0, Math.min(N, bookings.length))) {
      out.push({
        bookingId: b._id, userId: b.userId, amount: b.amount, currency: 'PHP',
        method: b.paymentMethod ?? pick(methods), provider: pick(['xendit', 'paymongo', 'manual']),
        providerRef: token().slice(0, 16),
        status: b.status === 'cancelled' ? 'refunded' : (b.status === 'pending_approval' ? 'pending' : 'paid'),
        notes: 'Auto-generated dummy payment.',
      });
    }
    // a few standalone (subscription / coaching) payments to top up
    let i = out.length;
    while (out.length < N) {
      out.push({
        userId: uid(i), amount: peso(200, 1500), currency: 'PHP',
        method: pick(methods), provider: pick(['xendit', 'paymongo']), providerRef: token().slice(0, 16),
        status: pick(['paid', 'paid', 'pending', 'failed']), notes: 'Standalone dummy payment.',
      });
      i++;
    }
    return out;
  });

  /* ── User-scoped collections ─────────────────────────────────── */
  await ensure(Notification, 'notifications', () =>
    Array.from({ length: N }, (_, i) => {
      const n = pick(NOTIF);
      return { userId: uid(i), type: n.type, title: n.title, body: n.body, icon: n.icon, isRead: chance(0.4) };
    }),
  );

  await ensure(Favorite, 'favorites', () => {
    const out: any[] = [];
    const seen = new Set<string>();
    const push = (userId: Id, t: string, id: Id) => {
      const k = `${userId}|${t}|${id}`;
      if (seen.has(k)) return; seen.add(k); out.push({ userId, favoritableType: t, favoritableId: id });
    };
    for (let i = 0; out.length < N; i++) {
      if (i % 4 === 0 && coaches.length) push(uid(i), 'coach', pick(coaches)._id as Id);
      else push(uid(i), 'venue', venues[i % venues.length]!._id as Id);
      if (i > N * 4) break; // safety
    }
    return out;
  });

  await ensure(UserDevice, 'userdevices', () =>
    Array.from({ length: N }, (_, i) => ({
      userId: uid(i), deviceToken: `dev-${token()}`,
      platform: pick(['ios', 'android', 'web']), isActive: chance(0.8),
    })),
  );

  await ensure(UserRole, 'userroles', () => {
    // Per-venue partner grants: seed a few coach & organizer grants scoped to
    // real venues so the Partners surface + badges aren't empty in dev. Only
    // the first few users get them; the rest stay plain players.
    const rows: any[] = [];
    const venueIds = (venues as any[]).map((v: any) => v._id);
    for (let i = 0; i < Math.min(4, users.length); i++) {
      const role = i % 2 === 0 ? 'coach' : 'organizer';
      const venueId = venueIds[i % venueIds.length];
      if (venueId) {
        rows.push({ userId: users[i]!._id, role, scopeType: 'venue', scopeId: venueId, isPrimary: false });
      }
    }
    return rows;
  });

  await ensure(EmailVerificationToken, 'emailverificationtokens', () =>
    Array.from({ length: N }, (_, i) => {
      const u = users[i % users.length]!;
      const verified = chance(0.6);
      return {
        userId: u._id, email: u.email, token: token(),
        expiresAt: dayOffset(randInt(1, 7)), verifiedAt: verified ? new Date() : undefined,
      };
    }),
  );

  await ensure(PasswordResetToken, 'passwordresettokens', () =>
    Array.from({ length: N }, (_, i) => {
      const used = chance(0.4);
      return {
        userId: uid(i), token: token(), expiresAt: dayOffset(1),
        usedAt: used ? new Date() : undefined,
      };
    }),
  );

  /* ── Venue management collections ────────────────────────────── */
  await ensure(VenueClaim, 'venueclaims', () =>
    Array.from({ length: N }, (_, i) => {
      const status = pick(['pending', 'pending', 'approved', 'rejected']);
      return {
        venueId: venues[i % venues.length]!._id, claimedByUserId: uid(i),
        status, proofDescription: 'I am the owner/manager of this venue.',
        proofDocumentUrls: [`https://example.com/proof/${token().slice(0, 8)}.pdf`],
        reviewedBy: status === 'pending' ? undefined : adminId,
        reviewNotes: status === 'rejected' ? 'Insufficient proof of ownership.' : undefined,
      };
    }),
  );

  await ensure(VenueStaff, 'venuestaffs', () => {
    // distinct venue per row keeps (venueId,userId,staffRole) unique
    const roles = ['manager', 'front_desk', 'coach', 'maintenance'];
    return Array.from({ length: Math.min(N, venues.length) }, (_, i) => ({
      venueId: venues[i]!._id, userId: uid(i), staffRole: pick(roles),
      permissions: pick(['full', 'bookings', 'reviews', 'read_only']), status: 'active',
    }));
  });

  await ensure(SuggestedEdit, 'suggestededits', () => {
    const editTypes = ['hours', 'pricing', 'amenities', 'contact', 'description', 'address'];
    return Array.from({ length: N }, (_, i) => {
      const t = pick(editTypes);
      return {
        venueId: venues[i % venues.length]!._id, suggestedByUserId: uid(i), editType: t,
        payloadJson: JSON.stringify({ field: t, suggestedValue: `Updated ${t} value`, note: 'Spotted during a recent visit.' }),
        sourceNotes: 'Submitted via venue detail page.',
        status: pick(['pending', 'pending', 'approved', 'rejected']),
      };
    });
  });

  /* ── Media (mixed owners) ────────────────────────────────────── */
  await ensure(Media, 'media', () =>
    Array.from({ length: N }, (_, i) => {
      const kind = i % 3;
      const owner = kind === 0 ? { ownerType: 'venue', ownerId: venues[i % venues.length]!._id }
        : kind === 1 ? { ownerType: 'coach', ownerId: coaches[i % coaches.length]!._id }
        : { ownerType: 'user', ownerId: uid(i) };
      return {
        ...owner,
        url: `https://picsum.photos/seed/pb-${i}/800/600`,
        altText: `${owner.ownerType} photo ${i + 1}`,
        sortOrder: i % 5, isPrimary: i % 5 === 0,
        uploadedBy: uid(i), width: 800, height: 600,
        fileSize: randInt(80_000, 600_000), mimeType: 'image/jpeg',
      };
    }),
  );

  /* ── Rental Inventory (6 sample items for the first owner) ─────── */
  const { RentalInventoryItem } = await import('../../features/rental-inventory/rental-inventory.model.js');
  const ownerUser = users.find((u: any) => u.roleDefault === 'owner') ?? users[0]!;
  const sampleVenue = venues[0];
  await ensure(RentalInventoryItem, 'rentalinventoryitems', () => {
    const now = new Date();
    return [
      { ownerId: ownerUser._id, venueId: sampleVenue?._id ?? null, name: 'Selkirk Amped S2', brand: 'Selkirk', sku: 'PAD-SEL-001', category: 'paddle', rentalPricePerHour: 150, totalStock: 12, availableStock: 7, rentedCount: 5, lowStockThreshold: 3, condition: 'excellent', status: 'partially_rented', createdAt: now, updatedAt: now },
      { ownerId: ownerUser._id, venueId: sampleVenue?._id ?? null, name: 'Engage Encore Pro', brand: 'Engage', sku: 'PAD-ENG-002', category: 'paddle', rentalPricePerHour: 180, totalStock: 8, availableStock: 3, rentedCount: 5, lowStockThreshold: 3, condition: 'excellent', status: 'partially_rented', createdAt: now, updatedAt: now },
      { ownerId: ownerUser._id, venueId: null, name: 'Franklin X-40 Outdoor', brand: 'Franklin', sku: 'BAL-FRA-003', category: 'ball', rentalPricePerHour: 30, totalStock: 60, availableStock: 38, rentedCount: 22, lowStockThreshold: 10, condition: 'good', status: 'partially_rented', createdAt: now, updatedAt: now },
      { ownerId: ownerUser._id, venueId: null, name: 'Dura Fast 40', brand: 'Dura', sku: 'BAL-DUR-004', category: 'ball', rentalPricePerHour: 30, totalStock: 45, availableStock: 30, rentedCount: 15, lowStockThreshold: 10, condition: 'good', status: 'partially_rented', createdAt: now, updatedAt: now },
      { ownerId: ownerUser._id, venueId: sampleVenue?._id ?? null, name: 'Pickle Bag Pro', brand: 'VenueOS', sku: 'GEA-VEN-005', category: 'gear', rentalPricePerHour: 80, totalStock: 20, availableStock: 14, rentedCount: 6, lowStockThreshold: 5, condition: 'excellent', status: 'partially_rented', createdAt: now, updatedAt: now },
      { ownerId: ownerUser._id, venueId: sampleVenue?._id ?? null, name: 'Court Shoes — Court King', brand: 'K-Swiss', sku: 'GEA-KSW-006', category: 'gear', rentalPricePerHour: 120, totalStock: 16, availableStock: 9, rentedCount: 7, lowStockThreshold: 5, condition: 'good', status: 'partially_rented', createdAt: now, updatedAt: now },
    ];
  });

  /* ── Posts + relations ───────────────────────────────────────── */
  const posts = await ensure(Post, 'posts', () => {
    const types = ['guide', 'news', 'blog', 'story'];
    return Array.from({ length: N }, (_, i) => {
      const title = i < POST_TITLES.length ? POST_TITLES[i]! : `${pick(POST_TITLES)} (Part ${i})`;
      return {
        slug: `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${i}`,
        title, subtitle: 'Tips and insights for everyday pickleball players.',
        postType: pick(types), status: chance(0.85) ? 'published' : 'draft',
        summary: 'A quick, practical read for players of all levels.',
        content: `<p>${title}.</p><p>This guide walks you through the essentials with clear, actionable steps you can take to your next session.</p>`,
        heroImageUrl: `https://picsum.photos/seed/post-${i}/1200/630`,
        readTime: `${randInt(3, 9)} min`,
        seriesId: chance(0.5) && series.length ? pick(series)._id : undefined,
        publishedAt: dayOffset(-randInt(1, 200)), isFeatured: chance(0.2),
        authors: [{ userId: uid(i), role: 'author', sortOrder: 0 }],
      };
    });
  });

  await ensure(PostRelation, 'postrelations', () => {
    // one relation per post keeps (postId,relationType,relationId) unique
    return posts.slice(0, Math.min(N, posts.length)).map((p: any, i: number) => {
      const isVenue = i % 2 === 0;
      return {
        postId: p._id,
        relationType: isVenue ? 'venue' : 'coach',
        relationId: isVenue ? venues[i % venues.length]!._id : coaches[i % coaches.length]!._id,
        relationRole: 'mentions', sortOrder: 0,
      };
    });
  });

  /* ── Registrations (depend on events/tournaments) ────────────── */
  await ensure(EventRegistration, 'eventregistrations', () =>
    Array.from({ length: N }, (_, i) => ({
      eventId: events[i % events.length]!._id, userId: uid(i),
      status: pick(['confirmed', 'confirmed', 'pending', 'waitlisted', 'cancelled']),
    })),
  );

  await ensure(TournamentRegistration, 'tournamentregistrations', () =>
    Array.from({ length: N }, (_, i) => ({
      tournamentId: tournaments[i % tournaments.length]!._id, userId: uid(i),
      status: pick(['confirmed', 'confirmed', 'pending', 'paid', 'cancelled']),
    })),
  );

  /* ── Audit logs (reference real entities) ────────────────────── */
  await ensure(AuditLog, 'auditlogs', () => {
    const actions = ['create', 'update', 'delete', 'approve', 'reject', 'login', 'moderate'];
    const entities: Array<[string, Id]> = [
      ...venues.slice(0, 20).map(v => ['Venue', v._id] as [string, Id]),
      ...users.slice(0, 20).map(u => ['User', u._id] as [string, Id]),
      ...coaches.slice(0, 20).map(c => ['Coach', c._id] as [string, Id]),
    ];
    return Array.from({ length: N }, (_, i) => {
      const [entityType, entityId] = entities[i % entities.length]!;
      return {
        actorId: adminId, action: pick(actions), entityType, entityId,
        oldValues: { status: 'unclaimed' }, newValues: { status: 'verified' },
        ipAddress: `203.0.113.${randInt(1, 254)}`,
      };
    });
  });

  /* ── Summary ─────────────────────────────────────────────────── */
  console.log('\n📊 Final collection counts:');
  const names = (await mongoose.connection.db!.listCollections().toArray()).map(c => c.name).sort();
  for (const name of names) {
    const cnt = await mongoose.connection.db!.collection(name).countDocuments();
    console.log(`   ${name.padEnd(26)} ${cnt}`);
  }

  console.log('\n✅ Dummy seed complete.');
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Dummy seed failed:', err);
  process.exit(1);
});
