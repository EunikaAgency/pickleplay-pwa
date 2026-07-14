// The Play tab's Discover feed — one merged, ranked candidate set.
//
// This exists because ranking used to run on the device, which had two costs:
//   1. Two players could see the SAME sessions in a DIFFERENT order (each device
//      scored its own copy), and
//   2. retuning the weights meant shipping an app release.
//
// It also fixes a truncation bug the client could not fix. The app fetched at most
// 50 games and 50 sessions ORDERED BY DATE, then ranked that slice — so "nearest"
// really meant "nearest among the soonest", and a close session three weeks out was
// invisible no matter how well it scored. Ranking here draws from the whole
// upcoming catalogue and truncates AFTER scoring, which is the right way round.

import { z } from 'zod';
import { Types } from 'mongoose';
import { Game } from '../games/games.model.js';
import { OpenPlaySession, OpenPlayRegistration } from '../content/content.model.js';
import { Friend } from '../friends/friends.model.js';
import { User } from '../auth/auth.model.js';
import { serialize as serializeGame } from '../games/games.controller.js';
import { sessionView as serializeSession } from '../content/content.controller.js';
import { rankPlayFeed, type FeedGame, type FeedSession, type ScoredPlayItem } from './playRanking.js';
import type { LatLng } from '../../shared/lib/geo.js';

const VENUE_SELECT = 'displayName slug area city lat lng priceFrom priceFromLabel mainImageUrl';

const GAME_POPULATE = [
  { path: 'creatorId', select: 'displayName avatarUrl' },
  { path: 'participantIds', select: 'displayName avatarUrl' },
  { path: 'interestedUserIds', select: 'displayName avatarUrl' },
  { path: 'venueId', select: VENUE_SELECT },
  { path: 'bookingId', select: 'courtId', populate: { path: 'courtId', select: 'mainImageUrl' } },
];

/** How many rows we're willing to SCORE. Deliberately far above `pageSize` — the
 *  whole point of ranking server-side is to choose from the real catalogue, not
 *  from whatever happened to be soonest. */
const CANDIDATE_CAP = 500;

const discoverQuery = z.object({
  // The viewer's coordinates. Only the browser knows these, so they're passed in;
  // everything else about the viewer (skill, friends) is read from the token.
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  // 'open-play' = interest-based open games + venue-run sessions.
  // 'events'    = the lobby games (singles / doubles / public formats).
  section: z.enum(['open-play', 'events']).default('open-play'),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

/** Today in the process timezone (Asia/Manila, pinned in ecosystem.config.json) —
 *  the same clock `startAt` scores against. */
function todayDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** The viewer's accepted friends, for the `social` signal. Empty for guests, which
 *  drops the signal and renormalises the other weights. */
async function friendIdsOf(userId: string): Promise<Set<string>> {
  const rows = await Friend.find({
    status: 'accepted',
    $or: [{ requesterId: userId }, { recipientId: userId }],
  }).select('requesterId recipientId').lean();
  const ids = new Set<string>();
  for (const r of rows as any[]) {
    const a = String(r.requesterId);
    const b = String(r.recipientId);
    ids.add(a === userId ? b : a);
  }
  return ids;
}

/**
 * JSON has no Infinity. An open-ended skill band ('4.0+') is `[4, Infinity]` in the
 * scorer, and `JSON.stringify` turns that into `[4, null]` — which the client's skill
 * filter would read as an upper bound of *nothing* and quietly drop the listing.
 * So say `null` deliberately, and let the client read it back as "no upper bound".
 */
function toWire(i: ScoredPlayItem) {
  return {
    ...i,
    skillBand: i.skillBand
      ? [i.skillBand[0], Number.isFinite(i.skillBand[1]) ? i.skillBand[1] : null]
      : null,
  };
}

/** GET /api/v1/play/discover — the ranked Discover feed for one section. */
export async function discoverFeed(c: any) {
  const q = discoverQuery.parse(c.req.query());
  const user = c.get('user');
  const uid = user?.sub ? String(user.sub) : null;
  const openPlay = q.section === 'open-play';

  // A game is "open play" when its type is 'open' (or unset — the legacy default).
  // Mongo has no "or missing" shorthand here, so both branches spell it out.
  const openTypes = { $or: [{ gameType: 'open' }, { gameType: { $exists: false } }, { gameType: null }] };
  const gameFilter: Record<string, any> = {
    status: { $in: ['published', 'full'] },
    visibility: 'public',
    date: { $gte: todayDate() },
    ...(openPlay ? openTypes : { gameType: { $in: ['singles', 'doubles', 'public'] } }),
  };
  // Never rank a listing the viewer is already part of — Discover is for finding
  // something NEW. (The app used to filter these out after the fetch, which meant
  // its 50-row page could come back half-empty.)
  if (uid) {
    const me = new Types.ObjectId(uid);
    gameFilter.creatorId = { $ne: me };
    gameFilter.participantIds = { $ne: me };
    gameFilter.interestedUserIds = { $ne: me };
  }

  const [gameRows, sessionRows, joinedSessionIds, friendIds, skill] = await Promise.all([
    Game.find(gameFilter).populate(GAME_POPULATE).sort({ date: 1 }).limit(CANDIDATE_CAP).lean(),
    openPlay
      ? OpenPlaySession.find({ status: 'published', date: { $gte: todayDate() } })
          .populate('venueId', VENUE_SELECT)
          .sort({ date: 1, startTime: 1 })
          .limit(CANDIDATE_CAP)
          .lean()
      : Promise.resolve([]),
    uid && openPlay
      ? OpenPlayRegistration.find({ userId: uid }).select('sessionId').lean()
      : Promise.resolve([]),
    uid ? friendIdsOf(uid) : Promise.resolve(new Set<string>()),
    uid ? User.findById(uid).select('skillLevel').lean() : Promise.resolve(null),
  ]);

  const joined = new Set((joinedSessionIds as any[]).map((r) => String(r.sessionId)));
  const games = (gameRows as any[]).map((r) => serializeGame(r, uid ?? undefined)) as FeedGame[];
  const sessions = (sessionRows as any[])
    .filter((s) => !joined.has(String(s._id)))
    .map((s) => serializeSession(s)) as FeedSession[];

  const userLoc: LatLng | null = q.lat != null && q.lng != null ? [q.lat, q.lng] : null;
  const ranked = rankPlayFeed(games, sessions, {
    now: new Date(),
    userLoc,
    userSkill: (skill as any)?.skillLevel ?? null,
    friendIds,
  });

  return c.json({
    data: ranked.slice(0, q.pageSize).map(toWire),
    // What the ranking actually saw. The app used to guess at this and get it
    // wrong in its empty-state copy.
    meta: {
      section: q.section,
      candidates: games.length + sessions.length,
      truncated: games.length + sessions.length > q.pageSize,
      // Which signals were live for THIS viewer. Without it, a cold-start user's
      // ordering looks arbitrary and there is no way to tell from the response why.
      signals: {
        timeFit: true,
        fillPressure: true,
        proximity: userLoc != null,
        skillFit: (skill as any)?.skillLevel != null,
        social: friendIds.size > 0,
      },
    },
  });
}
