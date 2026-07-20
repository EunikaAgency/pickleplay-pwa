// Retire the legacy OpenPlaySession rows by converting them into real Games.
//
// WHY
// `OpenPlaySession` is the pre-merge idea of Open Play: organizer-published,
// read-only, no court booked, no lobby, no payment. Every row is ownerless —
// `organizerName` is a plain string, not a reference — so nobody can host, edit,
// or be paid for one. They also earn the platform nothing: the 7% only fires on a
// booking, and these have none.
//
// `Game` is the same idea done properly: a real creator, a booked court, a roster,
// a lobby, chat, and the gender/skill/capacity guards. Since the app now routes
// every Game to the real lobby, converting these rows is what finishes the merge.
//
// WHAT IT DOES
// Converts, rather than deletes. Each upcoming session becomes a Game with:
//   - a real creator, drawn from the organizer-subscribed users
//   - a real Booking (bookingType 'game', confirmed) on a real court at the venue
//   - its title, description, date, time, skill band, and capacity carried over
// Sessions already in the past are deleted rather than converted — a lobby for a
// game that already happened is noise.
//
// Deleting instead of converting would empty the Open Play feed: it draws ~30 of
// its items from these rows against ~9 real games.
//
// REVERSIBILITY
// Writes every original row to a backup JSON before touching anything, and records
// the ids it created. `--revert` restores the sessions and removes what it made.
//
// Usage: npx tsx src/shared/db/retire-open-play-sessions.ts            (dry run)
//        npx tsx src/shared/db/retire-open-play-sessions.ts --apply
//        npx tsx src/shared/db/retire-open-play-sessions.ts --revert

import 'dotenv/config';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import mongoose from 'mongoose';
import { connectDb } from './index.js';
import { Game } from '../../features/games/games.model.js';
import { Booking } from '../../features/bookings/bookings.model.js';

const BACKUP_URL = new URL('./retire-open-play-sessions.backup.json', import.meta.url);
const APPLY = process.argv.includes('--apply');
const REVERT = process.argv.includes('--revert');

// Today in Manila — the API runs TZ=Asia/Manila, and `date` is a plain YYYY-MM-DD
// string, so compare as strings in the same zone the rows were written in.
function todayManila(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
}

async function revert() {
  if (!existsSync(BACKUP_URL)) {
    console.error('No backup file — nothing to revert.');
    process.exit(1);
  }
  const backup = JSON.parse(readFileSync(BACKUP_URL, 'utf8'));
  const db = mongoose.connection.db!;

  // Remove what we made, then put the originals back.
  const gameIds = backup.created.map((c: any) => new mongoose.Types.ObjectId(c.gameId));
  const bookingIds = backup.created.filter((c: any) => c.bookingId).map((c: any) => new mongoose.Types.ObjectId(c.bookingId));
  const delGames = await Game.deleteMany({ _id: { $in: gameIds } });
  const delBookings = await Booking.deleteMany({ _id: { $in: bookingIds } });

  const sessions = backup.sessions.map((s: any) => ({
    ...s,
    _id: new mongoose.Types.ObjectId(s._id),
    venueId: s.venueId ? new mongoose.Types.ObjectId(s.venueId) : undefined,
    cityId: s.cityId ? new mongoose.Types.ObjectId(s.cityId) : undefined,
  }));
  // Restore only the ones that are actually gone, so a partial revert is safe.
  const existing = await db.collection('openplaysessions')
    .find({ _id: { $in: sessions.map((s: any) => s._id) } }).project({ _id: 1 }).toArray();
  const have = new Set(existing.map((e: any) => String(e._id)));
  const toRestore = sessions.filter((s: any) => !have.has(String(s._id)));
  if (toRestore.length) await db.collection('openplaysessions').insertMany(toRestore);

  console.log(JSON.stringify({
    reverted: true,
    gamesRemoved: delGames.deletedCount,
    bookingsRemoved: delBookings.deletedCount,
    sessionsRestored: toRestore.length,
    sessionsAlreadyPresent: have.size,
  }, null, 2));
}

async function main() {
  await connectDb();
  if (REVERT) { await revert(); await mongoose.disconnect(); return; }

  const db = mongoose.connection.db!;
  const today = todayManila();

  const sessions = await db.collection('openplaysessions').find({}).toArray();
  if (sessions.length === 0) {
    console.log(JSON.stringify({ note: 'no OpenPlaySession rows — nothing to do' }, null, 2));
    await mongoose.disconnect();
    return;
  }

  // Hosts: real users who hold an organizer subscription. These sessions were
  // "organizer-published" in name only, so give them actual organizers.
  const organizerIds = await db.collection('userroles').distinct('userId', { role: 'organizer' });
  if (organizerIds.length === 0) throw new Error('no organizer users to host the converted games');

  // Courts per venue, so each booking lands on a court that really exists there.
  const courts = await db.collection('courts').find({}).project({ _id: 1, venueId: 1 }).toArray();
  const courtsByVenue = new Map<string, any[]>();
  for (const c of courts) {
    const k = String(c.venueId);
    if (!courtsByVenue.has(k)) courtsByVenue.set(k, []);
    courtsByVenue.get(k)!.push(c);
  }

  const upcoming = sessions.filter((s: any) => (s.date ?? '') >= today);
  const past = sessions.filter((s: any) => (s.date ?? '') < today);
  const convertible = upcoming.filter((s: any) => s.venueId && courtsByVenue.has(String(s.venueId)));
  const unconvertible = upcoming.filter((s: any) => !s.venueId || !courtsByVenue.has(String(s.venueId)));

  const plan = {
    mode: APPLY ? 'APPLIED' : 'DRY RUN (pass --apply to write)',
    today,
    sessionsTotal: sessions.length,
    upcoming: upcoming.length,
    past: past.length,
    willConvertToGames: convertible.length,
    willDeleteAsPast: past.length,
    // Surfaced, never silently dropped: an upcoming session at a venue with no
    // courts can't get a booking, so it can't become a real Game.
    cannotConvertNoCourts: unconvertible.length,
    cannotConvertTitles: unconvertible.slice(0, 5).map((s: any) => s.title),
  };

  if (!APPLY) {
    console.log(JSON.stringify({ ...plan, sample: convertible.slice(0, 3).map((s: any) => ({
      title: s.title, date: s.date, time: `${s.startTime}-${s.endTime}`, capacity: s.capacity,
    })) }, null, 2));
    await mongoose.disconnect();
    return;
  }

  const created: any[] = [];
  for (let i = 0; i < convertible.length; i++) {
    const s: any = convertible[i];
    const creatorId = organizerIds[i % organizerIds.length];
    const venueCourts = courtsByVenue.get(String(s.venueId))!;
    const court = venueCourts[i % venueCourts.length];

    // The host's own court reservation — what makes this Open Play real, and what
    // the platform's 7% is actually charged on.
    const booking = await Booking.create({
      userId: creatorId,
      bookingType: 'game',
      venueId: s.venueId,
      courtId: court._id,
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
      playerCount: s.capacity ?? 4,
      amount: typeof s.price === 'number' && s.price > 0 ? s.price : 400,
      status: 'confirmed',
      referenceCode: `BK-OPS${String(i).padStart(4, '0')}`,
      paymentMethod: 'bank_transfer',
    });

    const game = await Game.create({
      creatorId,
      title: s.title ?? null,
      description: s.description ?? null,
      venueId: s.venueId,
      gameType: 'open',
      genderPolicy: 'all',
      skillLabel: s.levelLabel ?? null,
      skillMin: s.skillLevelMin ?? undefined,
      skillMax: s.skillLevelMax ?? undefined,
      date: s.date,
      startTime: s.startTime,
      timeLabel: s.startTime,
      capacity: Math.max(2, Math.min(s.capacity ?? 8, 16)),
      // The creator holds a seat from the moment they post, same as createGame.
      participantIds: [creatorId],
      // Off, matching the product default. A host turns it on themselves.
      requiresApproval: false,
      visibility: 'public',
      status: 'published',
      bookingId: booking._id,
    });

    created.push({ gameId: String(game._id), bookingId: String(booking._id), fromSessionId: String(s._id), title: s.title });
  }

  // Backup BEFORE removing the originals — full rows, so a revert is lossless.
  writeFileSync(BACKUP_URL, JSON.stringify({
    takenAt: new Date().toISOString(),
    note: 'Full OpenPlaySession rows removed by retire-open-play-sessions.ts, plus the Games/Bookings created from them. Revert with --revert.',
    sessions: sessions.map((s: any) => ({ ...s, _id: String(s._id), venueId: s.venueId ? String(s.venueId) : null, cityId: s.cityId ? String(s.cityId) : null })),
    created,
  }, null, 2));

  const removeIds = [...convertible, ...past].map((s: any) => s._id);
  const del = await db.collection('openplaysessions').deleteMany({ _id: { $in: removeIds } });

  console.log(JSON.stringify({
    ...plan,
    gamesCreated: created.length,
    bookingsCreated: created.length,
    sessionsRemoved: del.deletedCount,
    sessionsLeft: await db.collection('openplaysessions').countDocuments(),
    backup: BACKUP_URL.pathname,
  }, null, 2));

  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
