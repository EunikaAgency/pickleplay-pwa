// Seed Games that look like a real week of play.
//
// WHY
// `seed-dummy-data.ts` seeds the RETIRED `OpenPlaySession` collection, so running
// it to top up the Bookings screen would re-create the very rows
// `retire-open-play-sessions.ts` just converted away. This script seeds the model
// the app actually reads — `Game`, with a real host, a real court Booking, and a
// real roster — and randomises every field that made the old data look generated:
//
//   - a different venue per row, drawn from the venues that really have courts
//     (the old E2E block stacked 25 games on one venue at one time)
//   - start times on a realistic weekday/weekend curve, not one 18:00 slot
//   - capacity, join fee, and roster fill that vary per row
//   - a mix of gameTypes, skill bands, gender policies, and vibes
//   - names from `openPlayTitle()`, de-duplicated against what is already stored
//
// REVERSIBILITY
// Records every id it creates. `--revert` deletes exactly those Games and Bookings
// and touches nothing else.
//
// Usage: npx tsx src/shared/db/seed-realistic-games.ts             (dry run)
//        npx tsx src/shared/db/seed-realistic-games.ts --apply
//        GAMES_N=60 npx tsx src/shared/db/seed-realistic-games.ts --apply
//        npx tsx src/shared/db/seed-realistic-games.ts --revert

import 'dotenv/config';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import mongoose from 'mongoose';
import { connectDb } from './index.js';
import { Game } from '../../features/games/games.model.js';
import { Booking } from '../../features/bookings/bookings.model.js';
import { openPlayTitle } from './open-play-titles.js';

const BACKUP_URL = new URL('./seed-realistic-games.backup.json', import.meta.url);
const APPLY = process.argv.includes('--apply');
const REVERT = process.argv.includes('--revert');
const N = Number(process.env.GAMES_N ?? 45);

/* ─── Random helpers ───────────────────────────────────────────── */
const rng = () => Math.random();
const pick = <T>(a: T[]): T => a[Math.floor(rng() * a.length)]!;
const pickN = <T>(a: T[], n: number): T[] => [...a].sort(() => rng() - 0.5).slice(0, n);
const randInt = (lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));
const chance = (p: number) => rng() < p;
const peso = (lo: number, hi: number, step = 50) => Math.round(randInt(lo, hi) / step) * step;

/** Weighted pick: `[value, weight]` pairs. Keeps the common cases common. */
function weighted<T>(pairs: Array<[T, number]>): T {
  const total = pairs.reduce((s, p) => s + p[1], 0);
  let r = rng() * total;
  for (const [v, w] of pairs) { r -= w; if (r <= 0) return v; }
  return pairs[pairs.length - 1]![0];
}

const hhmm = (h: number, m = 0) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

/** Today in Manila — `date` is a plain YYYY-MM-DD string written in that zone. */
function todayManila(): Date {
  const s = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
}

const SKILL_BANDS = [
  { label: 'Beginner', min: 1.0, max: 2.5, weight: 3 },
  { label: 'Intermediate', min: 2.5, max: 3.5, weight: 4 },
  { label: 'Advanced', min: 3.5, max: 4.5, weight: 2 },
  { label: 'Open / All levels', min: 1.0, max: 5.0, weight: 4 },
];

const DESCRIPTIONS = [
  'Drop-in open play. Paddles rotate every game, winners stay on.',
  'Casual rotation, all paddles welcome. Bring water and indoor shoes.',
  'Friendly games with balanced matchups. We shuffle partners each round.',
  'Rotating doubles, 11-point games. Court fee split among whoever shows up.',
  'Chill session after work. First timers welcome, we will pair you up.',
  'Competitive rotation — expect fast hands at the kitchen line.',
  'Round robin format, everyone plays everyone. Small prize for the top pair.',
  'Bring a friend. We run two courts and rotate every 15 minutes.',
  'Warm-up drills for the first 20 minutes, then straight to games.',
  'Merienda after. Court fee only, no join fee.',
];

/**
 * Start hours on a plausible curve: weekday play clusters before work and after
 * office hours, weekends spread across the morning. A flat 6–21 random would put
 * as many 11am Tuesday games as 7pm ones, which is what made the old rows read wrong.
 */
function startHour(isWeekend: boolean): { h: number; m: number } {
  const h = isWeekend
    ? weighted([[6, 3], [7, 4], [8, 5], [9, 4], [10, 3], [13, 2], [15, 2], [16, 3], [17, 3], [18, 3], [19, 2]])
    : weighted([[6, 3], [7, 3], [9, 1], [12, 1], [16, 2], [17, 4], [18, 6], [19, 5], [20, 3], [21, 1]]);
  return { h, m: chance(0.3) ? 30 : 0 };
}

async function revert() {
  if (!existsSync(BACKUP_URL)) {
    console.error('No backup file — nothing to revert.');
    process.exit(1);
  }
  const backup = JSON.parse(readFileSync(BACKUP_URL, 'utf8'));
  const gameIds = (backup.created ?? []).map((c: any) => new mongoose.Types.ObjectId(c.gameId));
  const bookingIds = (backup.created ?? []).filter((c: any) => c.bookingId).map((c: any) => new mongoose.Types.ObjectId(c.bookingId));
  const delGames = await Game.deleteMany({ _id: { $in: gameIds } });
  const delBookings = await Booking.deleteMany({ _id: { $in: bookingIds } });
  console.log(JSON.stringify({
    reverted: true, gamesRemoved: delGames.deletedCount, bookingsRemoved: delBookings.deletedCount,
  }, null, 2));
}

async function main() {
  await connectDb();
  if (REVERT) { await revert(); await mongoose.disconnect(); return; }

  const db = mongoose.connection.db!;

  // Hosts. Organizers are the only accounts allowed to charge a join fee, so keep
  // them identifiable rather than lumping every host together.
  const organizerIds = (await db.collection('userroles').distinct('userId', { role: 'organizer' })).map(String);
  const players = await db.collection('users').find({ roleDefault: 'player' }).project({ _id: 1 }).toArray();
  const playerIds = players.map((p: any) => String(p._id));
  if (playerIds.length < 8) throw new Error(`need at least 8 player accounts to fill rosters, found ${playerIds.length}`);

  // Only venues that really have courts — a game needs a court to book.
  const courts = await db.collection('courts').find({}).project({ _id: 1, venueId: 1 }).toArray();
  const courtsByVenue = new Map<string, any[]>();
  for (const c of courts) {
    const k = String(c.venueId);
    if (!courtsByVenue.has(k)) courtsByVenue.set(k, []);
    courtsByVenue.get(k)!.push(c);
  }
  const venueIds = [...courtsByVenue.keys()];
  if (venueIds.length === 0) throw new Error('no venue has any courts');

  // De-dup new names against every title already stored, so a seeded game never
  // collides with an existing one.
  const seen = new Set<string>(
    (await Game.find({}).select({ title: 1 }).lean())
      .map((g: any) => g.title).filter((t: any): t is string => typeof t === 'string'),
  );

  const today = todayManila();
  // Spread across venues without repeating one until the list is exhausted.
  const venueOrder = pickN(venueIds, Math.min(N, venueIds.length));

  const rows: any[] = [];
  for (let i = 0; i < N; i++) {
    const venueId = venueOrder[i % venueOrder.length]!;
    const venueCourts = courtsByVenue.get(venueId)!;
    const court = pick(venueCourts);

    // Weighted toward the next fortnight — that is what a player actually browses.
    const offset = weighted([[randInt(0, 2), 4], [randInt(3, 7), 5], [randInt(8, 14), 3], [randInt(15, 30), 2]]);
    const when = new Date(today.getTime() + offset * 86400000);
    const date = when.toISOString().split('T')[0]!;
    const dow = when.getUTCDay();
    const isWeekend = dow === 0 || dow === 6;

    const { h, m } = startHour(isWeekend);
    const startTime = hhmm(h, m);
    const hours = weighted([[1, 2], [2, 5], [3, 2]]);
    const endTime = hhmm(Math.min(h + hours, 23), m);

    const gameType = weighted([['open', 55], ['doubles', 22], ['public', 13], ['singles', 10]]);
    const band = weighted(SKILL_BANDS.map((b) => [b, b.weight] as [typeof b, number]));

    // Capacity follows the format: a singles match seats two, open play seats a crowd.
    const capacity = gameType === 'singles' ? 2
      : gameType === 'doubles' ? pick([4, 4, 8])
      : gameType === 'public' ? randInt(12, 24)
      : randInt(8, 20);

    // An organizer hosts most paid open play; everything else is player-hosted.
    const organizerHosted = gameType !== 'singles' && organizerIds.length > 0 && chance(0.35);
    const creatorId = organizerHosted ? pick(organizerIds) : pick(playerIds);
    const joinFee = organizerHosted && chance(0.6) ? peso(100, 400) : 0;

    // Creator holds a seat from the moment they post, same as createGame. The rest
    // of the roster is a partial fill — a screen of only-full lobbies looks staged.
    const others = pickN(playerIds.filter((p) => p !== creatorId), Math.max(0, weighted([
      [0, 2], [randInt(1, Math.max(1, Math.floor(capacity * 0.3))), 5],
      [randInt(1, Math.max(1, capacity - 1)), 3], [capacity - 1, 1],
    ])));
    const participantIds = [creatorId, ...others].slice(0, capacity);

    rows.push({
      creatorId, venueId, courtId: String(court._id), date, startTime, endTime, hours,
      gameType, capacity, joinFee, participantIds,
      title: openPlayTitle({ date, startTime, levelLabel: band.label, gameType }, seen),
      description: pick(DESCRIPTIONS),
      skillLabel: band.label, skillMin: band.min, skillMax: band.max,
      // Restricted games are a real but small slice of the board.
      genderPolicy: weighted([['all', 86], ['women', 8], ['men', 6]]),
      vibe: weighted([['casual', 5], ['competitive', 3], [null, 4]]),
      // Only a 'public' game has a competitive format.
      format: gameType === 'public' ? weighted([['round_robin', 4], ['bracketing', 3], ['mini_tournament', 2]]) : null,
      requiresApproval: chance(0.12),
      // The court fee the host paid — the platform's 7% is charged on this.
      amount: peso(400, 1600),
      status: participantIds.length >= capacity ? 'full' : 'published',
    });
  }

  const plan = {
    mode: APPLY ? 'APPLIED' : 'DRY RUN (pass --apply to write)',
    gamesToCreate: rows.length,
    distinctVenues: new Set(rows.map((r) => r.venueId)).size,
    distinctTitles: new Set(rows.map((r) => r.title)).size,
    byGameType: rows.reduce((a: any, r) => ({ ...a, [r.gameType]: (a[r.gameType] ?? 0) + 1 }), {}),
    byStartHour: rows.reduce((a: any, r) => ({ ...a, [r.startTime.slice(0, 2) + 'h']: (a[r.startTime.slice(0, 2) + 'h'] ?? 0) + 1 }), {}),
    full: rows.filter((r) => r.status === 'full').length,
    paid: rows.filter((r) => r.joinFee > 0).length,
    sampleTitles: rows.slice(0, 14).map((r) => `${r.date} ${r.startTime}  ${r.title}  (${r.participantIds.length}/${r.capacity})`),
  };
  console.log(JSON.stringify(plan, null, 2));

  if (!APPLY) { await mongoose.disconnect(); return; }

  const created: any[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]!;
    const booking = await Booking.create({
      userId: r.creatorId,
      bookingType: 'game',
      venueId: r.venueId,
      courtId: r.courtId,
      date: r.date,
      startTime: r.startTime,
      endTime: r.endTime,
      playerCount: r.capacity,
      amount: r.amount,
      status: 'confirmed',
      referenceCode: `BK-RG${String(i).padStart(4, '0')}`,
      paymentMethod: pick(['bank_transfer', 'gcash', 'card']),
    });

    const game = await Game.create({
      creatorId: r.creatorId,
      title: r.title,
      description: r.description,
      venueId: r.venueId,
      gameType: r.gameType,
      format: r.format,
      vibe: r.vibe,
      genderPolicy: r.genderPolicy,
      skillLabel: r.skillLabel,
      skillMin: r.skillMin,
      skillMax: r.skillMax,
      date: r.date,
      startTime: r.startTime,
      timeLabel: r.startTime,
      durationLabel: `${r.hours} hr`,
      capacity: r.capacity,
      joinFee: r.joinFee,
      participantIds: r.participantIds,
      requiresApproval: r.requiresApproval,
      visibility: 'public',
      status: r.status,
      bookingId: booking._id,
    });

    created.push({ gameId: String(game._id), bookingId: String(booking._id), title: r.title });
  }

  writeFileSync(BACKUP_URL, JSON.stringify({
    takenAt: new Date().toISOString(),
    note: 'Games + Bookings created by seed-realistic-games.ts. Revert with --revert.',
    created,
  }, null, 2));

  console.log(JSON.stringify({ applied: true, gamesCreated: created.length, backup: BACKUP_URL.pathname }, null, 2));
  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
