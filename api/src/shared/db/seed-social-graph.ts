// Pickleballers API — Social graph + competition seed (fills the gap
// `seed-dummy-data.ts` leaves behind).
//
// WHY THIS EXISTS
// `seed-dummy-data.ts` was written before clubs, friends, PickleFeed, direct
// messages, and tournament brackets existed, and it only seeds the models it
// imports. Running the whole pipeline against an empty database therefore left
// 27 collections at zero — every social and competition surface rendered its
// empty state on a "fully seeded" install.
//
// This script seeds those, reusing the users / venues / games / tournaments /
// coaches the earlier pipeline steps created as foreign keys.
//
// Idempotent in the same way as seed-dummy-data: a collection is only seeded
// when it holds zero documents, so re-running tops up what is still missing and
// never duplicates what is already there.
//
// Usage: npm run db:seed:social
//        SEED_N=40 npx tsx src/shared/db/seed-social-graph.ts

import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDb } from './index.js';

import { User } from '../../features/auth/auth.model.js';
import { Venue } from '../../features/venues/venues.model.js';
import { Game, GameMessage } from '../../features/games/games.model.js';
import { Coach, CoachService } from '../../features/coaches/coaches.model.js';
import { Tournament, TournamentAnnouncement, TournamentMessage, OpenPlaySeries } from '../../features/content/content.model.js';
import {
  Club, ClubMembership, ClubPost, ClubPostReaction, ClubJoinRequest, ClubMessage, ClubStaff,
} from '../../features/clubs/clubs.model.js';
import { Friend } from '../../features/friends/friends.model.js';
import {
  FeedPost, FeedPostReaction, FeedSignal, FeedHiddenPost, FeedReport, FeedNotifySub,
} from '../../features/feed/feed.model.js';
import { Conversation, Message, conversationKey } from '../../features/messages/messages.model.js';
import { TournamentEntrant, Bracket, BracketMatch } from '../../features/brackets/brackets.model.js';
import { generateBracket } from '../../features/brackets/bracketEngine.js';
import { CoachBooking } from '../../features/coach-bookings/coach-bookings.model.js';
import { DemandEvent } from '../../features/demand/demand.model.js';

const N = Number(process.env.SEED_N ?? 60);

type Id = mongoose.Types.ObjectId;

/* ─── Random helpers ───────────────────────────────────────────── */
const rng = () => Math.random();
const pick = <T>(a: T[]): T => a[Math.floor(rng() * a.length)]!;
const randInt = (lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));
const chance = (p: number) => rng() < p;
function sample<T>(a: T[], n: number): T[] {
  const copy = [...a];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy.slice(0, Math.min(n, copy.length));
}
/** A date within the last `days`, so feeds and chats read as recent activity. */
const daysAgo = (days: number) => new Date(Date.now() - Math.floor(rng() * days * 864e5));

/** Seed a collection only when it's empty — the contract seed-dummy-data uses. */
async function seedIfEmpty(
  model: { countDocuments: () => Promise<number> },
  name: string,
  fill: () => Promise<number>,
): Promise<void> {
  const existing = await model.countDocuments();
  if (existing > 0) {
    console.log(`  · ${name.padEnd(22)} skipped (${existing} rows)`);
    return;
  }
  const created = await fill();
  console.log(`  ✔ ${name.padEnd(22)} ${created}`);
}

/* ─── Copy ─────────────────────────────────────────────────────── */

const CLUB_NAMES = [
  'Metro Manila Dinkers', 'Makati Morning Crew', 'BGC Paddle Society', 'QC Kitchen Kings',
  'Alabang Rally Club', 'Cavite Coastline Picklers', 'Pasig Riverside Paddlers', 'Batangas Beach Ballers',
  'Ortigas Lunch Break League', 'Sunrise Servers', 'Third Shot Collective', 'Weekend Warriors PH',
  'Beginners Welcome Club', 'The Dink Tank', 'Paddle & Pace', 'Southside Smashers',
];

const CLUB_BLURBS = [
  'Friendly weekly sessions for every level. Bring water and a good attitude.',
  'We play twice a week and rotate courts so everyone gets games in.',
  'Competitive doubles group. We keep score and we keep it fun.',
  'Beginner-first club — we pair new players with someone who can coach them through a game.',
  'Early risers only. Courts at 6am, coffee after.',
];

const CLUB_POSTS = [
  'Courts are booked for Saturday 7am. Reply if you\'re in.',
  'Great sessions today, everyone. That last game went to 15.',
  'Anyone have a spare paddle a new member could borrow this week?',
  'Reminder: bring exact change for court fees.',
  'We\'re two players short for tomorrow — who can make it?',
  'Posting the rotation early so nobody waits around.',
  'New members, introduce yourselves here!',
  'Weather looks clear for the weekend session.',
];

const FEED_POSTS = [
  'Finally landed a clean third-shot drop today. Six months of practice.',
  'Looking for a doubles partner around Makati on weekday evenings.',
  'PSA: the courts near BGC just added lights. Night games are on.',
  'First tournament next month. Any advice for a nervous 3.0?',
  'Played my first open play session — everyone was so welcoming.',
  'Paddle recommendations for someone with tennis elbow?',
  'Best warm-up routine you\'ve found? Mine takes too long.',
  'Three games, three wins. Not bragging. (Bragging.)',
  'Anyone else struggle with the kitchen line rule at first?',
  'Court etiquette question: how do you call your own faults?',
];

const CHAT_LINES = [
  'Hey! Are you playing this weekend?', 'Yep, Saturday morning works for me.',
  'Cool, I\'ll book the court.', 'What time were you thinking?',
  'Around 7am before it gets hot.', 'Perfect. See you there.',
  'Bring an extra ball if you have one.', 'Will do 👍',
  'Good games today!', 'That last rally was unreal.',
];

const GAME_CHAT = [
  'On my way, 10 mins out.', 'Court 2, see you there.', 'Anyone bringing balls?',
  'I\'ve got a spare paddle if someone needs one.', 'Running a bit late, start without me.',
  'Great games everyone 🎾', 'Same time next week?',
];

const ANNOUNCEMENTS: Array<{ kind: 'general' | 'schedule' | 'venue'; title: string; body: string }> = [
  { kind: 'schedule', title: 'Schedule posted', body: 'First matches begin at 8:00 AM. Check your bracket for your court assignment.' },
  { kind: 'venue', title: 'Parking update', body: 'Overflow parking is available at the adjacent lot. Arrive 30 minutes early.' },
  { kind: 'general', title: 'Rules briefing', body: 'A short briefing runs 15 minutes before the first match. Attendance is required for all entrants.' },
  { kind: 'general', title: 'Bring your own paddle', body: 'Rentals are limited this weekend. Please bring your own equipment if you can.' },
];

const REPORT_REASONS = [
  'Spam or repeated advertising', 'Harassment towards another player',
  'Off-topic for this community', 'Misleading information about a venue',
];

/* ─── Main ─────────────────────────────────────────────────────── */

async function seed() {
  await connectDb();
  console.log(`🌱 Seeding the social graph + competition data (target ${N}/collection)\n`);

  const [users, venues, games, tournaments, coaches] = await Promise.all([
    User.find({}).select('_id displayName').limit(400).lean(),
    Venue.find({}).select('_id displayName').limit(200).lean(),
    Game.find({}).select('_id creatorId participantIds').limit(200).lean(),
    Tournament.find({}).select('_id name organizerUserId').limit(60).lean(),
    Coach.find({}).select('_id userId').limit(60).lean(),
  ]);

  if (!users.length) {
    console.error('❌ No users found. Run the earlier pipeline steps first (db:seed:users).');
    process.exit(1);
  }

  const userIds = users.map((u) => u._id as Id);
  const venueIds = venues.map((v) => v._id as Id);
  console.log(`  Reusing ${userIds.length} users · ${venueIds.length} venues · ${games.length} games · ${tournaments.length} tournaments · ${coaches.length} coaches\n`);

  /* ── Friends ───────────────────────────────────────────────── */

  await seedIfEmpty(Friend, 'friends', async () => {
    // A connected graph rather than random pairs: each user befriends a handful
    // of others, so "friends of friends" suggestions have something to walk.
    const seen = new Set<string>();
    const rows: Record<string, unknown>[] = [];
    for (const requesterId of userIds) {
      for (const recipientId of sample(userIds.filter((id) => !id.equals(requesterId)), randInt(2, 8))) {
        const key = [String(requesterId), String(recipientId)].sort().join(':');
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push({
          requesterId, recipientId,
          // Mostly accepted, with a live tail of pending requests so the
          // friend-request badge has something to count.
          status: chance(0.85) ? 'accepted' : chance(0.8) ? 'pending' : 'rejected',
          createdAt: daysAgo(180), updatedAt: daysAgo(30),
        });
      }
    }
    await Friend.insertMany(rows, { ordered: false });
    return rows.length;
  });

  /* ── Clubs ─────────────────────────────────────────────────── */

  const clubDocs: Array<{ _id: Id; hostId: Id; memberIds: Id[] }> = [];

  await seedIfEmpty(Club, 'clubs', async () => {
    const rows = CLUB_NAMES.map((name, i) => ({
      _id: new mongoose.Types.ObjectId(),
      name,
      slug: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${i}`,
      description: pick(CLUB_BLURBS),
      hostId: pick(userIds),
      visibility: chance(0.75) ? 'public' : 'private',
      joinLimit: chance(0.3) ? randInt(20, 80) : null,
      memberCount: 1,
      postCount: 0,
      createdAt: daysAgo(365), updatedAt: daysAgo(20),
    }));
    await Club.insertMany(rows);
    return rows.length;
  });

  // Re-read: the block above is skipped on a re-run, and everything below needs
  // the club ids either way.
  for (const c of await Club.find({}).select('_id hostId').lean()) {
    clubDocs.push({ _id: c._id as Id, hostId: c.hostId as Id, memberIds: [] });
  }

  await seedIfEmpty(ClubMembership, 'clubmemberships', async () => {
    const rows: Record<string, unknown>[] = [];
    for (const club of clubDocs) {
      const members = sample(userIds.filter((id) => !id.equals(club.hostId)), randInt(5, 25));
      club.memberIds = [club.hostId, ...members];
      rows.push({ clubId: club._id, userId: club.hostId, role: 'host', joinedAt: daysAgo(365) });
      for (const userId of members) {
        rows.push({ clubId: club._id, userId, role: 'member', joinedAt: daysAgo(300) });
      }
      await Club.updateOne({ _id: club._id }, { $set: { memberCount: members.length + 1 } });
    }
    await ClubMembership.insertMany(rows, { ordered: false });
    return rows.length;
  });

  // Same re-read guard: memberIds must be populated even when the block above
  // was skipped, or every club-scoped seed below picks from an empty list.
  if (clubDocs.some((c) => !c.memberIds.length)) {
    for (const club of clubDocs) {
      const memberships = await ClubMembership.find({ clubId: club._id }).select('userId').lean();
      club.memberIds = memberships.length ? memberships.map((m) => m.userId as Id) : [club.hostId];
    }
  }

  await seedIfEmpty(ClubStaff, 'clubstaffs', async () => {
    const rows = clubDocs.flatMap((club) =>
      sample(club.memberIds.filter((id) => !id.equals(club.hostId)), randInt(0, 2))
        .map((userId) => ({ clubId: club._id, userId, staffRole: 'moderator', status: 'active' })));
    await ClubStaff.insertMany(rows, { ordered: false });
    return rows.length;
  });

  const clubPostIds: Array<{ _id: Id; clubId: Id }> = [];

  await seedIfEmpty(ClubPost, 'clubposts', async () => {
    const rows: Record<string, unknown>[] = [];
    for (const club of clubDocs) {
      for (let i = 0; i < randInt(2, 6); i++) {
        const _id = new mongoose.Types.ObjectId();
        clubPostIds.push({ _id, clubId: club._id });
        rows.push({
          _id, clubId: club._id, authorId: pick(club.memberIds), parentPostId: null, rootPostId: null,
          body: pick(CLUB_POSTS), reactionCount: 0, replyCount: 0,
          createdAt: daysAgo(90), updatedAt: daysAgo(90),
        });
      }
    }
    // A second pass adds replies, so threads aren't uniformly flat.
    const replies = sample(clubPostIds, Math.floor(clubPostIds.length / 2)).flatMap((parent) =>
      Array.from({ length: randInt(1, 3) }, () => ({
        clubId: parent.clubId,
        authorId: pick(clubDocs.find((c) => c._id.equals(parent.clubId))!.memberIds),
        parentPostId: parent._id, rootPostId: parent._id,
        body: pick(['Count me in.', 'I\'ll be there.', 'Can\'t make this one, next time!', 'Booked 👍', 'What time again?']),
        createdAt: daysAgo(60), updatedAt: daysAgo(60),
      })));
    await ClubPost.insertMany([...rows, ...replies]);
    for (const parent of clubPostIds) {
      const count = replies.filter((r) => (r.parentPostId as Id).equals(parent._id)).length;
      if (count) await ClubPost.updateOne({ _id: parent._id }, { $set: { replyCount: count } });
    }
    for (const club of clubDocs) {
      await Club.updateOne({ _id: club._id }, { $set: { postCount: rows.filter((r) => (r.clubId as Id).equals(club._id)).length } });
    }
    return rows.length + replies.length;
  });

  if (!clubPostIds.length) {
    for (const p of await ClubPost.find({ parentPostId: null }).select('_id clubId').lean()) {
      clubPostIds.push({ _id: p._id as Id, clubId: p.clubId as Id });
    }
  }

  await seedIfEmpty(ClubPostReaction, 'clubpostreactions', async () => {
    const rows: Record<string, unknown>[] = [];
    for (const post of clubPostIds) {
      const club = clubDocs.find((c) => c._id.equals(post.clubId));
      if (!club) continue;
      const likers = sample(club.memberIds, randInt(0, 6));
      for (const userId of likers) {
        rows.push({ postId: post._id, clubId: post.clubId, userId, type: 'like', createdAt: daysAgo(60) });
      }
      if (likers.length) await ClubPost.updateOne({ _id: post._id }, { $set: { reactionCount: likers.length } });
    }
    await ClubPostReaction.insertMany(rows, { ordered: false });
    return rows.length;
  });

  await seedIfEmpty(ClubJoinRequest, 'clubjoinrequests', async () => {
    const rows: Record<string, unknown>[] = [];
    // Only private clubs gate joining, so only they accumulate a queue.
    for (const club of await Club.find({ visibility: 'private' }).select('_id hostId').lean()) {
      const memberSet = new Set(clubDocs.find((c) => c._id.equals(club._id))?.memberIds.map(String) ?? []);
      for (const userId of sample(userIds.filter((id) => !memberSet.has(String(id))), randInt(1, 4))) {
        const status = chance(0.6) ? 'pending' : chance(0.7) ? 'approved' : 'denied';
        rows.push({
          clubId: club._id, userId, status,
          message: pick(['Would love to join!', 'A friend recommended this club.', 'Looking for weekend games.', '']),
          decidedBy: status === 'pending' ? undefined : club.hostId,
          decidedAt: status === 'pending' ? undefined : daysAgo(30),
          createdAt: daysAgo(60), updatedAt: daysAgo(30),
        });
      }
    }
    await ClubJoinRequest.insertMany(rows, { ordered: false });
    return rows.length;
  });

  await seedIfEmpty(ClubMessage, 'clubmessages', async () => {
    const rows: Record<string, unknown>[] = [];
    for (const club of clubDocs) {
      let when = daysAgo(30).getTime();
      for (let i = 0; i < randInt(3, 12); i++) {
        when += randInt(60, 3600) * 1000;
        rows.push({
          clubId: club._id, senderId: pick(club.memberIds), body: pick(CHAT_LINES),
          createdAt: new Date(when), updatedAt: new Date(when),
        });
      }
    }
    await ClubMessage.insertMany(rows);
    return rows.length;
  });

  /* ── PickleFeed ────────────────────────────────────────────── */

  const feedPostIds: Id[] = [];

  await seedIfEmpty(FeedPost, 'feedposts', async () => {
    const rows: Record<string, unknown>[] = [];
    for (let i = 0; i < N; i++) {
      const _id = new mongoose.Types.ObjectId();
      feedPostIds.push(_id);
      rows.push({
        _id, authorId: pick(userIds), parentPostId: null, rootPostId: null,
        body: pick(FEED_POSTS), reactionCount: 0, replyCount: 0,
        createdAt: daysAgo(60), updatedAt: daysAgo(60),
      });
    }
    const replies = sample(feedPostIds, Math.floor(N / 2)).flatMap((parent) =>
      Array.from({ length: randInt(1, 4) }, () => ({
        authorId: pick(userIds), parentPostId: parent, rootPostId: parent,
        body: pick(['Nice one!', 'Same here 😄', 'Which venue was this?', 'Congrats!', 'I\'d join that.', 'Try shortening your backswing.']),
        createdAt: daysAgo(40), updatedAt: daysAgo(40),
      })));
    await FeedPost.insertMany([...rows, ...replies]);
    for (const parent of feedPostIds) {
      const count = replies.filter((r) => (r.parentPostId as Id).equals(parent)).length;
      if (count) await FeedPost.updateOne({ _id: parent }, { $set: { replyCount: count } });
    }
    return rows.length + replies.length;
  });

  if (!feedPostIds.length) {
    for (const p of await FeedPost.find({ parentPostId: null }).select('_id').lean()) feedPostIds.push(p._id as Id);
  }

  await seedIfEmpty(FeedPostReaction, 'feedpostreactions', async () => {
    const rows: Record<string, unknown>[] = [];
    for (const postId of feedPostIds) {
      const likers = sample(userIds, randInt(0, 12));
      for (const userId of likers) rows.push({ postId, userId, type: 'like', createdAt: daysAgo(40) });
      if (likers.length) await FeedPost.updateOne({ _id: postId }, { $set: { reactionCount: likers.length } });
    }
    await FeedPostReaction.insertMany(rows, { ordered: false });
    return rows.length;
  });

  await seedIfEmpty(FeedSignal, 'feedsignals', async () => {
    const seen = new Set<string>();
    const rows: Record<string, unknown>[] = [];
    for (const userId of sample(userIds, N)) {
      for (const authorId of sample(userIds.filter((id) => !id.equals(userId)), randInt(1, 4))) {
        const key = `${userId}:${authorId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push({ userId, authorId, type: chance(0.7) ? 'interested' : 'not_interested', createdAt: daysAgo(50) });
      }
    }
    await FeedSignal.insertMany(rows, { ordered: false });
    return rows.length;
  });

  await seedIfEmpty(FeedHiddenPost, 'feedhiddenposts', async () => {
    const seen = new Set<string>();
    const rows: Record<string, unknown>[] = [];
    for (const userId of sample(userIds, Math.floor(N / 3))) {
      for (const postId of sample(feedPostIds, randInt(1, 3))) {
        const key = `${userId}:${postId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push({ userId, postId, hiddenUntil: new Date(Date.now() + randInt(1, 30) * 864e5), createdAt: daysAgo(20) });
      }
    }
    await FeedHiddenPost.insertMany(rows, { ordered: false });
    return rows.length;
  });

  await seedIfEmpty(FeedReport, 'feedreports', async () => {
    const seen = new Set<string>();
    const rows: Record<string, unknown>[] = [];
    for (const postId of sample(feedPostIds, Math.floor(N / 4))) {
      for (const userId of sample(userIds, randInt(1, 2))) {
        const key = `${userId}:${postId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        // Mostly pending, so the admin Post-reports queue isn't empty on arrival.
        rows.push({
          userId, postId, reason: pick(REPORT_REASONS),
          status: chance(0.6) ? 'pending' : chance(0.6) ? 'dismissed' : 'resolved',
          createdAt: daysAgo(30), updatedAt: daysAgo(10),
        });
      }
    }
    await FeedReport.insertMany(rows, { ordered: false });
    return rows.length;
  });

  await seedIfEmpty(FeedNotifySub, 'feednotifysubs', async () => {
    const seen = new Set<string>();
    const rows: Record<string, unknown>[] = [];
    for (const postId of sample(feedPostIds, Math.floor(N / 2))) {
      for (const userId of sample(userIds, randInt(1, 3))) {
        const key = `${userId}:${postId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push({ userId, postId, createdAt: daysAgo(30) });
      }
    }
    await FeedNotifySub.insertMany(rows, { ordered: false });
    return rows.length;
  });

  /* ── Direct messages ───────────────────────────────────────── */

  const conversationRows: Array<{ _id: Id; participantIds: Id[] }> = [];

  await seedIfEmpty(Conversation, 'conversations', async () => {
    const seen = new Set<string>();
    const rows: Record<string, unknown>[] = [];
    for (let i = 0; i < N; i++) {
      const [a, b] = sample(userIds, 2);
      if (!a || !b) continue;
      const key = conversationKey(String(a), String(b));
      if (seen.has(key)) continue;
      seen.add(key);
      const _id = new mongoose.Types.ObjectId();
      conversationRows.push({ _id, participantIds: [a, b] });
      const lastAt = daysAgo(20);
      rows.push({
        _id, participantIds: [a, b], key,
        lastBody: pick(CHAT_LINES), lastSenderId: pick([a, b]), lastAt,
        reads: [{ userId: a, at: lastAt }],
        createdAt: daysAgo(120), updatedAt: lastAt,
      });
    }
    await Conversation.insertMany(rows);
    return rows.length;
  });

  if (!conversationRows.length) {
    for (const c of await Conversation.find({}).select('_id participantIds').lean()) {
      conversationRows.push({ _id: c._id as Id, participantIds: (c.participantIds ?? []) as Id[] });
    }
  }

  await seedIfEmpty(Message, 'messages', async () => {
    const rows: Record<string, unknown>[] = [];
    for (const convo of conversationRows) {
      if (convo.participantIds.length < 2) continue;
      let when = daysAgo(120).getTime();
      for (let i = 0; i < randInt(3, 14); i++) {
        when += randInt(300, 86400) * 1000;
        rows.push({
          conversationId: convo._id,
          // Alternate speakers so a thread reads like a conversation.
          senderId: convo.participantIds[i % 2],
          body: pick(CHAT_LINES),
          createdAt: new Date(when), updatedAt: new Date(when),
        });
      }
    }
    await Message.insertMany(rows);
    return rows.length;
  });

  /* ── Game roster chat ──────────────────────────────────────── */

  await seedIfEmpty(GameMessage, 'gamemessages', async () => {
    const rows: Record<string, unknown>[] = [];
    for (const game of sample(games, Math.min(games.length, N))) {
      // Chat is gated to the roster server-side, so only roster members may post.
      const roster = [game.creatorId, ...((game.participantIds ?? []) as Id[])].filter(Boolean) as Id[];
      if (!roster.length) continue;
      let when = daysAgo(14).getTime();
      for (let i = 0; i < randInt(2, 6); i++) {
        when += randInt(120, 7200) * 1000;
        rows.push({
          gameId: game._id, senderId: pick(roster), body: pick(GAME_CHAT),
          createdAt: new Date(when), updatedAt: new Date(when),
        });
      }
    }
    await GameMessage.insertMany(rows);
    return rows.length;
  });

  /* ── Tournaments: entrants, brackets, announcements, chat ──── */

  await seedIfEmpty(TournamentEntrant, 'tournamententrants', async () => {
    const rows: Record<string, unknown>[] = [];
    for (const t of tournaments) {
      // Powers of two keep single-elimination brackets clean and bye-free.
      const size = pick([4, 8, 8, 16]);
      const players = sample(users, size * 2);
      for (let i = 0; i < size; i++) {
        const a = players[i * 2];
        const b = players[i * 2 + 1];
        if (!a) break;
        rows.push({
          tournamentId: t._id, seed: i + 1,
          displayName: b ? `${a.displayName} / ${b.displayName}` : String(a.displayName),
          players: [a, b].filter(Boolean).map((p) => ({ userId: p!._id, name: p!.displayName })),
          status: 'active', seededManually: false,
          createdAt: daysAgo(45), updatedAt: daysAgo(45),
        });
      }
    }
    await TournamentEntrant.insertMany(rows);
    return rows.length;
  });

  await seedIfEmpty(Bracket, 'brackets', async () => {
    let made = 0;
    // Only about half the tournaments have a drawn bracket — the rest are still
    // taking registrations, which is the state the organizer console must handle.
    for (const t of sample(tournaments, Math.ceil(tournaments.length / 2))) {
      const ordered = await TournamentEntrant.find({ tournamentId: t._id, status: 'active' })
        .sort({ seed: 1, createdAt: 1 }).lean();
      if (ordered.length < 2) continue;

      // Generated by the real engine rather than hand-rolled, so the seeded
      // bracket obeys the same seeding/advancement rules the app enforces.
      const generated = generateBracket('single_elimination',
        ordered.map((e, i) => ({ id: String(e._id), seed: i + 1 })));

      const bracket = await Bracket.create({
        tournamentId: t._id, format: 'single_elimination', matchFormat: 'bo3', pointsPerGame: 11,
        entrantCount: ordered.length, bracketSize: generated.bracketSize,
        status: 'active', locked: false, generatedAt: daysAgo(20),
      });

      const keyToId = new Map<string, Id>();
      for (const m of generated.matches) keyToId.set(m.key, new mongoose.Types.ObjectId());
      await BracketMatch.insertMany(generated.matches.map((m) => ({
        _id: keyToId.get(m.key), tournamentId: t._id, bracketId: bracket._id,
        key: m.key, bracket: m.bracket, round: m.round, slotInRound: m.slotInRound, poolKey: m.poolKey,
        entrantA: m.entrantA ? new mongoose.Types.ObjectId(m.entrantA) : null,
        entrantB: m.entrantB ? new mongoose.Types.ObjectId(m.entrantB) : null,
        isByeA: m.isByeA, isByeB: m.isByeB,
        nextMatchId: m.nextMatchKey ? keyToId.get(m.nextMatchKey) : null, nextSlot: m.nextSlot,
        nextLoserMatchId: m.nextLoserMatchKey ? keyToId.get(m.nextLoserMatchKey) : null,
        nextLoserSlot: m.nextLoserSlot,
        games: [], winner: m.winner, status: m.status,
        isGrandFinalReset: m.isGrandFinalReset, seedSourceA: m.seedSourceA, seedSourceB: m.seedSourceB,
      })));
      made++;
    }
    return made;
  });

  await seedIfEmpty(BracketMatch, 'bracketmatches', async () => {
    // Reached only when brackets already existed but their matches were cleared;
    // the Bracket block above inserts matches alongside each bracket it draws.
    console.log('    (brackets already present without matches — nothing to rebuild safely)');
    return 0;
  });

  await seedIfEmpty(TournamentAnnouncement, 'tournamentannouncements', async () => {
    const rows: Record<string, unknown>[] = [];
    for (const t of tournaments) {
      const organizerUserId = (t.organizerUserId as Id) ?? pick(userIds);
      for (const a of sample(ANNOUNCEMENTS, randInt(1, 3))) {
        rows.push({
          tournamentId: t._id, organizerUserId, kind: a.kind, title: a.title, body: a.body,
          recipientCount: randInt(4, 40), createdAt: daysAgo(30), updatedAt: daysAgo(30),
        });
      }
    }
    await TournamentAnnouncement.insertMany(rows);
    return rows.length;
  });

  await seedIfEmpty(TournamentMessage, 'tournamentmessages', async () => {
    const rows: Record<string, unknown>[] = [];
    for (const t of tournaments) {
      const roster = (await TournamentEntrant.find({ tournamentId: t._id }).select('players').lean())
        .flatMap((e) => (e.players ?? []).map((p: any) => p.userId).filter(Boolean)) as Id[];
      if (!roster.length) continue;
      let when = daysAgo(25).getTime();
      for (let i = 0; i < randInt(2, 6); i++) {
        when += randInt(600, 43200) * 1000;
        rows.push({
          tournamentId: t._id, senderId: pick(roster),
          body: pick(['What court are we on?', 'Good luck everyone!', 'Is the schedule final?', 'See you at the briefing.', 'Great match 👏']),
          createdAt: new Date(when), updatedAt: new Date(when),
        });
      }
    }
    await TournamentMessage.insertMany(rows);
    return rows.length;
  });

  /* ── Coach bookings ────────────────────────────────────────── */

  await seedIfEmpty(CoachBooking, 'coachbookings', async () => {
    const rows: Record<string, unknown>[] = [];
    for (const coach of coaches) {
      const services = await CoachService.find({ coachId: coach._id }).lean();
      for (let i = 0; i < randInt(1, 4); i++) {
        const svc = services.length ? pick(services) : null;
        const day = new Date(Date.now() + randInt(-20, 20) * 864e5);
        const startHour = randInt(6, 19);
        const duration = svc?.durationMinutes ?? 60;
        rows.push({
          coachId: coach._id, coachUserId: coach.userId ?? undefined,
          playerUserId: pick(userIds), serviceId: svc?._id, venueId: venueIds.length ? pick(venueIds) : undefined,
          date: day.toISOString().slice(0, 10),
          startTime: `${String(startHour).padStart(2, '0')}:00`,
          endTime: `${String(startHour + Math.ceil(duration / 60)).padStart(2, '0')}:00`,
          durationMinutes: duration,
          // Price mirrors the server rule: the service's own price wins.
          amount: svc?.price ?? randInt(600, 1800),
          currency: 'PHP',
          status: day.getTime() < Date.now()
            ? pick(['completed', 'completed', 'cancelled'])
            : pick(['pending', 'confirmed', 'confirmed']),
          createdAt: daysAgo(40), updatedAt: daysAgo(10),
        });
      }
    }
    await CoachBooking.insertMany(rows, { ordered: false });
    return rows.length;
  });

  /* ── Demand analytics ──────────────────────────────────────── */

  await seedIfEmpty(DemandEvent, 'demandevents', async () => {
    const TYPES = ['search', 'venue_view', 'booking_attempt', 'booking_completed', 'empty_slot', 'checkout_started', 'checkout_abandoned'] as const;
    const QUERIES = ['pickleball makati', 'courts near me', 'open play tonight', 'indoor courts', 'cheap court rental', 'bgc pickleball'];
    const rows: Record<string, unknown>[] = [];
    for (let i = 0; i < N * 8; i++) {
      const type = pick([...TYPES]);
      const when = daysAgo(60);
      rows.push({
        type,
        venueId: type === 'search' || !venueIds.length ? undefined : pick(venueIds),
        userId: chance(0.7) ? pick(userIds) : undefined,
        date: when.toISOString().slice(0, 10),
        // Weighted toward evenings, so the owner demand heatmap shows a real peak
        // instead of a flat line.
        startHour: chance(0.6) ? randInt(17, 21) : randInt(6, 22),
        query: type === 'search' ? pick(QUERIES) : undefined,
        createdAt: when, updatedAt: when,
      });
    }
    await DemandEvent.insertMany(rows);
    return rows.length;
  });

  /* ── Recurring open play ───────────────────────────────────── */

  await seedIfEmpty(OpenPlaySeries, 'openplayseries', async () => {
    if (!venueIds.length) return 0;
    const rows = Array.from({ length: randInt(5, 12) }, () => {
      const startHour = randInt(6, 19);
      return {
        organizerUserId: pick(userIds),
        title: pick(['Weeknight Open Play', 'Sunrise Social', 'Saturday Round Robin', 'Beginners Night', 'Competitive Doubles Series']),
        venueId: pick(venueIds),
        daysOfWeek: sample([0, 1, 2, 3, 4, 5, 6], randInt(1, 3)),
        startTime: `${String(startHour).padStart(2, '0')}:${chance(0.5) ? '00' : '30'}`,
        endTime: `${String(Math.min(startHour + 2, 23)).padStart(2, '0')}:00`,
        levelLabel: pick(['All levels', 'Beginner', 'Intermediate', '3.0–3.5']),
        price: pick([0, 150, 200, 250, 300]),
        capacity: pick([8, 12, 16, 20]),
        description: 'Recurring drop-in session. Rotate in, rotate out, everyone plays.',
        weeksAhead: 8, status: 'active',
        createdAt: daysAgo(90), updatedAt: daysAgo(20),
      };
    });
    await OpenPlaySeries.insertMany(rows);
    return rows.length;
  });

  console.log('\n✅ Social graph seed complete.');
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Social graph seed failed:', err);
  process.exit(1);
});
