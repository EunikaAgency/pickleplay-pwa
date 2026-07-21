import { z } from 'zod';
import { Types } from 'mongoose';
import { Game, GameMessage, INVITABLE_ROLE } from './games.model.js';
import { parseTimeLabel } from './gameTime.js';
import { Booking } from '../bookings/bookings.model.js';
import { User } from '../auth/auth.model.js';
import { notifyUser, notifyUsers } from '../../shared/lib/notify.js';
import { publishUserEvent } from '../../shared/lib/userEvents.js';
import { hasPermission } from '../../shared/lib/permissions.js';
import { hasActivePartnerSubscription } from '../partner-subscriptions/partner-subscriptions.model.js';
import { getPlayerCapabilities } from '../settings/settings.controller.js';
import { toWebpUrl } from '../../shared/lib/webp.js';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/);

// Competitive format for a public game — how the session is run.
const gameFormat = z.enum(['bracketing', 'round_robin', 'mini_tournament']);
const vibeEnum = z.enum(['casual', 'competitive']);
// Who the host admits. 'men'/'women' are matched against the player's profile
// gender at join/interest time.
const genderPolicyEnum = z.enum(['all', 'men', 'women']);
// When a full lobby fills, the player has this many ms to leave freely.
// After that window closes, the player must request host permission to leave.
const FULL_LOBBY_LEAVE_GRACE_MS = 3_600_000; // 1 hour
// When a player leaves twice from the same not-full lobby, they can't re-join for
// this many ms (prevents join/leave spam).
const LEAVE_COOLDOWN_MS = 3_600_000; // 1 hour

/** How many seats a game has. Mirrors the model's `capacity` default so the guards
 *  and the serialized `spotsLeft` can never disagree.
 *
 *  A handful of legacy open-play rows predate `capacity` having a default and store
 *  no value at all (they used `targetPlayers` as the cap instead). Those read as
 *  capacity 0 under a `?? 0` fallback, so every guard called them full while
 *  `spotsLeft` — which already defaulted to 4 — advertised free seats. Always go
 *  through here rather than defaulting at each call site. */
const DEFAULT_CAPACITY = 4;
function seats(g: { capacity?: number | null }): number {
  return g.capacity ?? DEFAULT_CAPACITY;
}

const createSchema = z.object({
  title: z.string().max(120).optional(),
  description: z.string().max(500).optional(),
  venueId: objectId.optional(),
  venueName: z.string().max(120).optional(),
  // 'open' = Open Play; 'public' = format-driven competitive game (see `format`);
  // 'singles'/'doubles' = classic fixed-seat lobbies. Since the merge every type
  // behaves the same on join: a real roster seat in participantIds, capped by
  // `capacity`, guarded by gender + skill.
  gameType: z.enum(['singles', 'doubles', 'open', 'public']).default('doubles'),
  format: gameFormat.optional(),
  vibe: vibeEnum.optional(),
  genderPolicy: genderPolicyEnum.default('all'),
  skillLabel: z.string().max(30).optional(),
  whenLabel: z.string().max(30).optional(),
  timeLabel: z.string().max(20).optional(),
  durationLabel: z.string().max(20).optional(),
  // Explicit calendar date (from the date picker). When present it wins over the
  // best-effort date derived from whenLabel.
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  capacity: z.number().int().min(2).max(16).default(4),
  // Soft headcount goal for open play ("aiming for 8"). Not a hard cap.
  targetPlayers: z.number().int().min(2).max(64).optional(),
  // Open Play join fee (pesos). Accepted from any client, but only honoured for a
  // subscribed organizer — everyone else is forced to 0 in the handler.
  joinFee: z.number().min(0).max(100000).optional(),
  // Host-gated joining. Accepted from any client, but forced to false in the
  // handler when the admin switch is off.
  requiresApproval: z.boolean().optional(),
  visibility: z.enum(['public', 'invite']).default('public'),
  // The host's court reservation, created + paid via the book-a-court flow before
  // the game is posted. Links the game to its booked court.
  bookingId: objectId.optional(),
});

// Host removes a player from the roster.
const kickSchema = z.object({ userId: objectId });

// Host invites players (by id) to a game they host.
const inviteSchema = z.object({ userIds: z.array(objectId).min(1).max(20) });

// The editable subset of a game — every field optional (PATCH semantics). The
// venue + schedule are locked at creation (the court is already booked), so they
// aren't here.
const updateSchema = z.object({
  title: z.string().max(120).optional(),
  description: z.string().max(500).optional(),
  gameType: z.enum(['singles', 'doubles', 'open', 'public']).optional(),
  format: gameFormat.optional(),
  vibe: vibeEnum.optional(),
  genderPolicy: genderPolicyEnum.optional(),
  skillLabel: z.string().max(30).optional(),
  capacity: z.number().int().min(2).max(16).optional(),
  targetPlayers: z.number().int().min(2).max(64).optional(),
  joinFee: z.number().min(0).max(100000).optional(),
  requiresApproval: z.boolean().optional(),
  visibility: z.enum(['public', 'invite']).optional(),
});

const listQuery = z.object({
  status: z.string().optional(),
  venueId: z.string().optional(),
  date: z.string().optional(),
  mine: z.coerce.boolean().optional(),
  creator: z.string().optional(),
  invited: z.coerce.boolean().optional(),
  // Browse surfaces cap the result set, truncating by `date` — so a caller that
  // ranks on any other key only ranks within the soonest `pageSize` rows.
  // The Play tab ranks client-side and asks for the whole upcoming window; other
  // callers keep the 50 default. The 500 max is a runaway guard, not a product
  // cap: `date >= today` has no upper bound, so an uncapped query would ask for
  // every game that will ever exist.
  pageSize: z.coerce.number().int().min(1).max(500).optional().default(50),
});

const VENUE_SELECT = 'displayName slug area city lat lng priceFrom priceFromLabel mainImageUrl';
const POPULATE = [
  { path: 'creatorId', select: 'displayName avatarUrl' },
  { path: 'participantIds', select: 'displayName avatarUrl' },
  { path: 'interestedUserIds', select: 'displayName avatarUrl' },
  { path: 'pendingLeaveUserIds', select: 'displayName avatarUrl' },
  { path: 'pendingJoinUserIds', select: 'displayName avatarUrl' },
  { path: 'venueId', select: VENUE_SELECT },
  { path: 'invitedUserIds.invitedBy', select: 'displayName avatarUrl' },
  // over the venue image (falls back to the venue image when the court has none).
  { path: 'bookingId', select: 'courtId', populate: { path: 'courtId', select: 'mainImageUrl' } },
];

/** The profile gender each restricted policy admits. Anything else ('all', an
 *  unset field, a legacy value) admits everyone. */
const POLICY_GENDER: Record<string, string> = { men: 'male', women: 'female' };

/** Why the player can't take a seat in a gender-restricted game — null when they
 *  can. `other` and accounts predating the gender field match neither 'men' nor
 *  'women', so they're steered to the profile rather than silently rejected. */
async function genderBlock(policy: unknown, userId: string) {
  const want = POLICY_GENDER[String(policy ?? 'all')];
  if (!want) return null;
  const me: any = await User.findById(userId).select('gender').lean();
  const gender = me?.gender;
  if (gender === want) return null;
  const label = want === 'female' ? 'women' : 'men';
  return gender
    ? { code: 'NOT_ELIGIBLE', message: `This game is ${label} only.` }
    : { code: 'GENDER_REQUIRED', message: `This game is ${label} only — set your gender in your profile to join.` };
}

/** Why the player can't take a seat given the game's skill band — null when they
 *  can (the game carries no band, or their DUPR sits inside [skillMin, skillMax]).
 *  Mirrors genderBlock: a player with no skill level set is steered to their
 *  profile rather than silently admitted. Server-authoritative — the app disables
 *  the join button on the same rule, but this is the gate a crafted client hits. */
async function skillBlock(game: any, userId: string) {
  const min = game.skillMin;
  const max = game.skillMax;
  if (min == null) return null; // no band → open to all levels
  const me: any = await User.findById(userId).select('skillLevel').lean();
  const skill = me?.skillLevel;
  const band = game.skillLabel ?? (max != null ? `${min}–${max}` : `${min}+`);
  if (skill == null) {
    return { code: 'SKILL_REQUIRED', message: `This game is for ${band} players — set your skill level in your profile to join.` };
  }
  const withinBand = skill >= min && (max == null || skill <= max);
  if (withinBand) return null;
  return { code: 'NOT_ELIGIBLE', message: `This game is for ${band} players — your skill level is outside that range.` };
}

/** Pull min/max DUPR out of a label like '3.0–3.5' or '4.0+' (best-effort). */
function parseSkill(label?: string): { skillMin?: number; skillMax?: number } {
  if (!label) return {};
  // "Beginner" is a real restriction that carries no digits — it must keep
  // stronger players out (DUPR above 3.0), not fall through to an open band.
  // ("Open" / "All levels" legitimately parse to no band and stay unbanded.)
  if (/beginner/i.test(label)) return { skillMin: 0, skillMax: 3.0 };
  const nums = (label.match(/\d(?:\.\d)?/g) ?? []).map(Number);
  if (!nums.length) return {};
  return { skillMin: nums[0], skillMax: nums[1] };
}

// The old day-based grace-period lock (LOBBY_LEAVE_GRACE_PERIOD_DAYS) is
// superseded by the time-based policy above: not-full lobbies are freely
// leaveable (with a 1h re-join cooldown after a 2nd leave), and a full lobby
// gives each player a 1h window to leave before requiring host permission.

/** Best-effort YYYY-MM-DD from a fuzzy "when" label so the calendar/sort works. */
function computeDate(whenLabel?: string): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  switch ((whenLabel || '').toLowerCase()) {
    case 'tomorrow':
      d.setDate(d.getDate() + 1);
      break;
    case 'this weekend': {
      // Advance to the upcoming Saturday (day 6); stay put if already Saturday.
      const delta = (6 - d.getDay() + 7) % 7;
      d.setDate(d.getDate() + delta);
      break;
    }
    case 'next week':
      d.setDate(d.getDate() + 7);
      break;
    default:
      // 'Tonight' / 'Custom' / 'Recurring' / unknown → today.
      break;
  }
  // Format from local date parts (not toISOString, which is UTC and would shift
  // the day in a +offset timezone) so it matches how the app reads `date`.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Today as YYYY-MM-DD in local time — the floor for "upcoming" browse filters.
 *  Stored dates are zero-padded YYYY-MM-DD, so a lexical `$gte` is chronological. */
function todayDate(): string {
  return computeDate();
}

/** Map a populated, lean Game doc onto the shape the app consumes. Exported so the
 *  Play feed can rank the same rows the app already renders, rather than a parallel
 *  projection that could drift from this one. */
export function serialize(r: any, viewerUserId?: string) {
  const refPerson = (p: any) =>
    p && typeof p === 'object'
      ? { id: String(p._id), displayName: p.displayName, avatarUrl: p.avatarUrl ?? null }
      : { id: String(p) };
  const refVenue = (v: any) =>
    v && typeof v === 'object'
      ? {
          id: String(v._id),
          displayName: v.displayName,
          slug: v.slug,
          area: v.area ?? null,
          city: v.city ?? null,
          lat: v.lat ?? null,
          lng: v.lng ?? null,
          priceFrom: v.priceFrom ?? null,
          priceFromLabel: v.priceFromLabel ?? null,
          image: v.mainImageUrl ? toWebpUrl(v.mainImageUrl) : null,
        }
      : null;
  const participants = (r.participantIds ?? []).map(refPerson);
  const interestedUsers = (r.interestedUserIds ?? []).map(refPerson);
  const pendingLeaveUsers = (r.pendingLeaveUserIds ?? []).map(refPerson);
  const pendingJoinUsers = (r.pendingJoinUserIds ?? []).map(refPerson);
  const capacity = seats(r);
  const creator = r.creatorId && typeof r.creatorId === 'object' ? refPerson(r.creatorId) : null;
  const venue = refVenue(r.venueId);
  // `bookingId` may be populated (with its court) for the court-image lookup, or
  // a bare ObjectId — handle both, keeping the output `bookingId` a string.
  const bookingObj = r.bookingId && typeof r.bookingId === 'object' ? r.bookingId : null;
  const courtImage =
    bookingObj && bookingObj.courtId && typeof bookingObj.courtId === 'object'
      ? (bookingObj.courtId.mainImageUrl ? toWebpUrl(bookingObj.courtId.mainImageUrl) : null)
      : null;
  return {
    ...r,
    id: String(r._id),
    creator,
    creatorId: creator ? creator.id : (r.creatorId ? String(r.creatorId) : null),
    venue,
    venueId: venue ? venue.id : (r.venueId ? String(r.venueId) : null),
    bookingId: bookingObj ? String(bookingObj._id) : (r.bookingId ? String(r.bookingId) : null),
    courtImage,
    participants,
    participantCount: participants.length,
    spotsLeft: Math.max(0, capacity - participants.length),
    // Open Play join fee (pesos); 0 = free. Only a subscribed organizer's game
    // ever carries a non-zero fee, and they keep all of it.
    joinFee: r.joinFee ?? 0,
    // Host-set vibe (casual or competitive) — surfaces on the lobby + cards.
    vibe: r.vibe ?? null,
    // Who the host admits. Games created before the field default to open.
    genderPolicy: r.genderPolicy ?? 'all',
    // Soft headcount goal for open play ("aiming for 8"). Not a cap.
    targetPlayers: r.targetPlayers ?? null,
    // Leave / join timing state (lobby games only).
    fullAt: r.fullAt ? (r.fullAt instanceof Date ? r.fullAt.toISOString() : r.fullAt) : null,
    pendingLeaveUsers,
    pendingLeaveCount: pendingLeaveUsers.length,
    // Host-gated joining. `pendingJoinUsers` hold no seat, so they're absent from
    // participants/spotsLeft above — the host reviews them from the lobby.
    requiresApproval: r.requiresApproval ?? false,
    pendingJoinUsers,
    pendingJoinCount: pendingJoinUsers.length,
    // The viewer's own request state, mirroring how the client derives isJoined.
    viewerPendingJoin: viewerUserId ? pendingJoinUsers.some((p: any) => p.id === viewerUserId) : false,
    // How many times has the viewer left this lobby (for the 1h cooldown check).
    viewerLeaves: viewerUserId
      ? (r.leaveLog ?? []).filter((e: any) => String(e.user ?? e.userId) === viewerUserId).length
      : 0,
    // Open Play interest (soft signal). The client derives `viewerInterested` by
    // checking its own id against this list, mirroring how it derives isJoined.
    interestedUsers,
    interestedCount: interestedUsers.length,
    invitedUserIds: (r.invitedUserIds ?? []).map((entry: any) => {
      // Handle both old (bare ObjectId string) and new ({ user, invitedBy }) formats.
      if (typeof entry === 'object' && entry !== null) {
        return {
          user: String(entry.user?._id ?? entry.user),
          invitedBy: entry.invitedBy && typeof entry.invitedBy === 'object'
            ? { id: String(entry.invitedBy._id), displayName: entry.invitedBy.displayName, avatarUrl: entry.invitedBy.avatarUrl ?? null }
            : null,
        };
      }
      return { user: String(entry) };
    }),
  };
}

export async function listGames(c: any) {
  const q = listQuery.parse(c.req.query());
  const user = c.get('user');
  const filter: Record<string, any> = {};

  if (q.invited) {
    // "My Invites" = games where the current user is in invitedUserIds,
    // matching both the new format ({user, invitedBy}) and the old (raw ObjectId).
    // Use explicit ObjectId — Mongoose auto-cast doesn't always reach into $or dot-notation paths.
    if (!user) return c.json({ data: [] });
    const uid = new Types.ObjectId(user.sub);
    filter.$or = [{ 'invitedUserIds.user': uid }, { invitedUserIds: uid }];
  } else if (q.mine) {
    // "My Games" = games I created, joined, OR showed interest in (open play).
    if (!user) return c.json({ data: [] });
    filter.$or = [{ creatorId: user.sub }, { participantIds: user.sub }, { interestedUserIds: user.sub }];
    if (q.venueId) filter.venueId = q.venueId;
  } else if (q.creator) {
    filter.creatorId = q.creator;
    filter.status = q.status || 'published';
    if (q.venueId) filter.venueId = q.venueId;
  } else if (q.venueId) {
    // Venue-scoped public browse (e.g. a venue's "Games here"): public games at
    // this venue, hiding cancelled unless an explicit status is requested.
    filter.visibility = 'public';
    filter.venueId = q.venueId;
    filter.status = q.status ? q.status : { $ne: 'cancelled' };
  } else {
    // Public browse shows upcoming public games that are OPEN or FULL — full
    // games keep a "Full" badge (social proof, still openable/shareable) rather
    // than vanishing. Invite-only + cancelled stay hidden. An explicit ?status=
    // still narrows to exactly that status (e.g. the home feed asks for 'published').
    filter.status = q.status || { $in: ['published', 'full'] };
    filter.visibility = 'public';
  }
  if (q.date) {
    filter.date = q.date;
  } else if (!q.mine) {
    // Browse surfaces (public, venue "Games here", a creator's games) only show
    // upcoming games — a game whose date has already passed isn't joinable. "My
    // games" is exempt: it keeps the player's history + commitments.
    filter.date = { $gte: todayDate() };
  }

  const rows = await Game.find(filter)
    .populate(POPULATE)
    .sort({ date: 1, createdAt: -1 })
    .limit(q.pageSize)
    .lean();
  return c.json({ data: rows.map((r: any) => serialize(r)) });
}

export async function createGame(c: any) {
  const user = c.get('user');
  if (!hasPermission(user, 'player.games.create')) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Game creation permission required' } }, 403);
  }
  const body = createSchema.parse(await c.req.json());
  const { skillMin, skillMax } = parseSkill(body.skillLabel);
  // Singles 1v1 and Doubles 2v2 have a fixed seat count; Open (interest-only) and
  // Public (format-driven) use the custom capacity the host set.
  const capacity = body.gameType === 'singles' ? 2 : body.gameType === 'doubles' ? 4 : body.capacity;
  // The linked reservation's slot is the authoritative start time; a game posted
  // without a booking can only offer its free-text timeLabel. Scoped by userId so
  // a caller can't read a slot off someone else's booking.
  const booking: any = body.bookingId
    ? await Booking.findOne({ _id: body.bookingId, userId: user.sub }).select('startTime').lean()
    : null;
  const startTime = booking?.startTime ?? parseTimeLabel(body.timeLabel);
  // A join fee only sticks for a subscribed organizer (they keep 100% of it). Any
  // other host — or an organizer whose plan lapsed — posts free Open Play, no matter
  // what the client sent. The platform's cut stays the 7% on the booking alone.
  let joinFee = 0;
  if (body.gameType === 'open' && body.joinFee && body.joinFee > 0) {
    if (await hasActivePartnerSubscription(user.sub, 'organizer')) joinFee = body.joinFee;
  }
  // The two admin kill switches. Both default ON, so this is a no-op until an admin
  // turns one off — at which point it's a real gate, not just a hidden button.
  const caps = await getPlayerCapabilities();
  if (body.gameType === 'public' && !caps.allowNonOrganizerEvents) {
    if (!(await hasActivePartnerSubscription(user.sub, 'organizer'))) {
      return c.json({ error: { code: 'FORBIDDEN', message: 'Only organizers can create events right now.' } }, 403);
    }
  }
  // Forced, not rejected: a client that can't see the toggle shouldn't fail to post
  // a game just because it sent the field. The lobby simply stays open-join.
  const requiresApproval = caps.allowPlayerApprovalLobbies ? (body.requiresApproval ?? false) : false;
  const game = await Game.create({
    creatorId: user.sub,
    title: body.title || null,
    description: body.description || null,
    venueId: body.venueId || null,
    venueName: body.venueName || null,
    gameType: body.gameType,
    // Format only applies to public games; ignore it for other types.
    format: body.gameType === 'public' ? (body.format || null) : null,
    // Vibe applies to any type (host picks casual or competitive at creation).
    vibe: body.vibe || null,
    genderPolicy: body.genderPolicy,
    requiresApproval,
    skillLabel: body.skillLabel || null,
    skillMin,
    skillMax,
    whenLabel: body.whenLabel || null,
    timeLabel: body.timeLabel || null,
    durationLabel: body.durationLabel || null,
    date: body.date || computeDate(body.whenLabel),
    startTime,
    capacity,
    targetPlayers: body.targetPlayers || null,
    joinFee,
    participantIds: [user.sub],
    visibility: body.visibility,
    status: 'published',
    bookingId: body.bookingId || null,
  });
  // The linked court reservation belongs to this game — tag it so it surfaces as
  // a game, not as a standalone booking in "My bookings".
  if (body.bookingId) {
    await Booking.updateOne({ _id: body.bookingId, userId: user.sub }, { bookingType: 'game' });
  }
  const populated = await Game.findById(game._id).populate(POPULATE).lean();
  return c.json({ data: serialize(populated) }, 201);
}

export async function getGame(c: any) {
  const id = c.req.param('id');
  if (!objectId.safeParse(id).success) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Game not found' } }, 404);
  }
  const row = await Game.findById(id).populate(POPULATE).lean();
  if (!row) return c.json({ error: { code: 'NOT_FOUND', message: 'Game not found' } }, 404);
  return c.json({ data: serialize(row) });
}

/** A human label for a game, used in notification copy ("your <name> game"). */
function gameLabel(game: any): string {
  if (game.title) return `"${game.title}"`;
  if (game.venueName) return `your game at ${game.venueName}`;
  return 'your game';
}

/** Display name of a user id, for "<name> joined…" copy. Best-effort. */
async function actorName(userId: unknown): Promise<string> {
  try {
    const u = await User.findById(userId).select('displayName firstName').lean();
    return ((u as any)?.displayName || (u as any)?.firstName || 'A player') as string;
  } catch {
    return 'A player';
  }
}

/** Drop a "lobby full — ready to play" notification into the host's inbox the
 *  moment their game fills. Best-effort: never let a notification failure (or a
 *  host who somehow filled their own game) break the join. */
async function notifyHostLobbyFull(game: any) {
  // The host is auto-added at creation, so a join that fills the game is always
  // by someone other than the host — but guard anyway so we never self-notify.
  if (!game.creatorId) return;
  await notifyUser(game.creatorId, {
    type: 'game_full',
    title: 'Your lobby is full',
    body: `The game is ready to play. All ${seats(game)} spots are filled.`,
    icon: 'bolt',
    linkUrl: `/games/${String(game._id)}`,
    tag: `game-full-${String(game._id)}`,
  });
}

/** Tell the host someone wants in on an approval-gated lobby. Mirrors the leave
 *  side's `game_leave_request`. The request holds no seat until the host acts. */
async function notifyHostJoinRequest(game: any, requesterId: string) {
  if (!game.creatorId) return;
  const name = await actorName(requesterId);
  await notifyUser(game.creatorId, {
    type: 'game_join_request',
    title: `${name} wants to join`,
    body: `${name} is asking to join ${gameLabel(game)} — approve or decline in the lobby.`,
    icon: 'group_add',
    linkUrl: `/games/${String(game._id)}`,
    tag: `game-join-req-${String(game._id)}`,
  });
}

/** Tell the host someone joined (only while the lobby still has room — a join
 *  that fills it sends the richer "lobby full" notification instead). */
async function notifyHostJoined(game: any, joinerId: string) {
  if (!game.creatorId) return;
  const name = await actorName(joinerId);
  await notifyUser(game.creatorId, {
    type: 'game_join',
    title: 'New player joined',
    body: `${name} joined ${gameLabel(game)} — ${game.participantIds.length}/${seats(game)} spots filled.`,
    icon: 'group_add',
    linkUrl: `/games/${String(game._id)}`,
    tag: `game-join-${String(game._id)}`,
  });
}

export async function joinGame(c: any) {
  const user = c.get('user');
  const id = c.req.param('id');
  // An organizer subscription is an add-on capability, not a separate account
  // type — the organizer role inherits PLAYER_BASE_PERMISSIONS ("organisers are
  // players too", see permissions.ts). So a subscribed organizer takes a roster
  // seat in someone else's game or Open Play like any other player.
  const game = await Game.findById(id);
  if (!game) return c.json({ error: { code: 'NOT_FOUND', message: 'Game not found' } }, 404);
  if (game.status === 'cancelled') {
    return c.json({ error: { code: 'CLOSED', message: 'This game has been cancelled' } }, 409);
  }
  // Open Play now has a real lobby (the merge): it takes a roster seat through this
  // same path — capacity, gender, and skill guards all apply — rather than the old
  // "I'm Interested" soft signal. No early return for gameType 'open' anymore.
  // Cooldown: second+ leave in the leaveLog that's still within LEAVE_COOLDOWN_MS
  // blocks re-join for that lobby. Filter history for just this user.
  const log = ((game as any).leaveLog ?? []) as any[];
  const myLog = log.filter((e: any) => String(e.user) === user.sub).sort((a: any, b: any) => new Date(b.leftAt).getTime() - new Date(a.leftAt).getTime());
  if (myLog.length >= 2) {
    const lastLeft = new Date(myLog[0].leftAt).getTime();
    const since = Date.now() - lastLeft;
    if (since < LEAVE_COOLDOWN_MS) {
      const mins = Math.ceil((LEAVE_COOLDOWN_MS - since) / 60_000);
      return c.json({ error: { code: 'COOLDOWN', message: `You left and rejoined — you can join this lobby again in ${mins} min.` } }, 409);
    }
  }
  const already = game.participantIds.some((p: any) => String(p) === user.sub);
  if (!already) {
    // The host set a men-only / women-only game — check it against the player's
    // profile gender before they can take a seat.
    const blocked = await genderBlock((game as any).genderPolicy, user.sub);
    if (blocked) return c.json({ error: blocked }, 403);
    // Skill band: a banded game only admits a player whose DUPR is inside it.
    const skillBlocked = await skillBlock(game, user.sub);
    if (skillBlocked) return c.json({ error: skillBlocked }, 403);
    // Host-gated lobby: the join becomes a request instead of a seat. This sits
    // AFTER the eligibility guards (never queue someone who could never get in)
    // and BEFORE the capacity check (a full lobby still accepts requests — that's
    // the waiting list, so the host can admit from the queue if someone drops).
    // The host never queues behind their own gate.
    if ((game as any).requiresApproval && String(game.creatorId) !== user.sub) {
      const pend = ((game as any).pendingJoinUserIds ?? []) as any[];
      if (pend.some((p: any) => String(p) === user.sub)) {
        return c.json({ error: { code: 'CONFLICT', message: 'You already asked to join — the host will review it.' } }, 409);
      }
      (game as any).pendingJoinUserIds = [...pend, user.sub];
      await game.save();
      await notifyHostJoinRequest(game, user.sub);
      const pendingPopulated = await Game.findById(id).populate(POPULATE).lean();
      return c.json({ data: serialize(pendingPopulated, user.sub) });
    }
    const seatCount = seats(game);
    if (game.participantIds.length >= seatCount) {
      return c.json({ error: { code: 'FULL', message: 'This game is full' } }, 409);
    }
    // Atomic seat claim (A6): only add the seat if there is still room AND the
    // player isn't already on the roster. Two concurrent joins on the last seat
    // (or a double-tap) can't both pass — the loser gets a clean 409 instead of
    // over-filling the lobby or listing the same user twice.
    const claimed = await Game.findOneAndUpdate(
      { _id: id, $expr: { $lt: [{ $size: '$participantIds' }, seatCount] }, participantIds: { $ne: user.sub } },
      { $addToSet: { participantIds: user.sub }, $pull: { pendingJoinUserIds: user.sub as any } },
      { new: true },
    );
    if (!claimed) {
      return c.json({ error: { code: 'FULL', message: 'This game is full' } }, 409);
    }
    const nowFull = claimed.participantIds.length >= seatCount;
    // Second targeted update (not a full-doc save that could clobber a concurrent
    // join): clear this player's stale invite + flip to 'full' on the transition.
    const invitedCleaned = (claimed.invitedUserIds ?? []).filter((entry: any) => {
      const uid = typeof entry === 'object' && entry.user ? String(entry.user) : String(entry);
      return uid !== user.sub;
    });
    const post: any = {};
    if (invitedCleaned.length !== (claimed.invitedUserIds ?? []).length) post.invitedUserIds = invitedCleaned;
    if (nowFull && claimed.status !== 'full') { post.status = 'full'; post.fullAt = new Date(); }
    if (Object.keys(post).length) await Game.updateOne({ _id: id }, { $set: post });
    // Notify the host when someone other than them joins: the richer "lobby full"
    // message on the transition into full, otherwise a plain "player joined".
    if (String(claimed.creatorId) !== user.sub) {
      if (nowFull) await notifyHostLobbyFull(claimed);
      else await notifyHostJoined(claimed, user.sub);
    }
  }
  const populated = await Game.findById(id).populate(POPULATE).lean();
  return c.json({ data: serialize(populated, c.get('user')?.sub) });
}

export async function leaveGame(c: any) {
  const user = c.get('user');
  const id = c.req.param('id');
  const game = await Game.findById(id);
  if (!game) return c.json({ error: { code: 'NOT_FOUND', message: 'Game not found' } }, 404);

  const isMember = game.participantIds.some((p: any) => String(p) === user.sub);
  const isHost = String(game.creatorId) === user.sub;
  const isFull = game.participantIds.length >= seats(game);

  if (!isMember) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'You are not in this lobby.' } }, 404);
  }
  // The host "leaves" as cancel+delete, not this endpoint.
  if (isHost) {
    return c.json({ error: { code: 'CONFLICT', message: 'As the host, cancel the game instead of leaving.' } }, 409);
  }
  // Not full (or not yet full): leave freely — but track the leave for cooldown.
  if (!isFull) {
    game.participantIds = game.participantIds.filter((p: any) => String(p) !== user.sub) as any;
    // Record this leave for the 1h-rejoin cooldown.
    if (!(game as any).leaveLog) (game as any).leaveLog = [];
    (game as any).leaveLog.push({ user: user.sub, leftAt: new Date() });
    await game.save();
    const name = await actorName(user.sub);
    await notifyUser(game.creatorId, { type: 'game_leave', title: 'A player left', body: `${name} left ${gameLabel(game)} — a spot is open again.`, icon: 'group_remove', linkUrl: `/games/${String(game._id)}`, tag: `game-leave-${String(game._id)}` });
    const populated = await Game.findById(id).populate(POPULATE).lean();
    return c.json({ data: serialize(populated, c.get('user')?.sub) });
  }
  // Lobby is FULL — check if still within the 1h free-leave window.
  const fullTime = (game as any).fullAt ? new Date((game as any).fullAt).getTime() : 0;
  const windowOpen = fullTime > 0 && (Date.now() - fullTime) < FULL_LOBBY_LEAVE_GRACE_MS;
  if (windowOpen) {
    game.participantIds = game.participantIds.filter((p: any) => String(p) !== user.sub) as any;
    if (game.participantIds.length < seats(game)) {
      game.status = 'published';
      (game as any).fullAt = undefined; // no longer full — reset the clock
    }
    if (!(game as any).leaveLog) (game as any).leaveLog = [];
    (game as any).leaveLog.push({ user: user.sub, leftAt: new Date() });
    await game.save();
    const name = await actorName(user.sub);
    await notifyUser(game.creatorId, { type: 'game_leave', title: 'A player left', body: `${name} left ${gameLabel(game)} — a spot is open again.`, icon: 'group_remove', linkUrl: `/games/${String(game._id)}`, tag: `game-leave-${String(game._id)}` });
    const populated = await Game.findById(id).populate(POPULATE).lean();
    return c.json({ data: serialize(populated, c.get('user')?.sub) });
  }
  // Lobby is full AND the 1h window has closed — the player must request host
  // permission to leave. Redirect them to the request endpoint.
  return c.json({ error: { code: 'LOBBY_LOCKED', message: 'This lobby is locked. Ask the host for permission to leave.' } }, 409);
}

/** Toggle the caller's "I'm Interested" on an Open Play game. Idempotent: taps in
 *  if absent, out if present. Interest is a soft signal (no capacity, no roster),
 *  so it only applies to gameType 'open'. */
export async function toggleGameInterest(c: any) {
  const user = c.get('user');
  const id = c.req.param('id');
  const game = await Game.findById(id);
  if (!game) return c.json({ error: { code: 'NOT_FOUND', message: 'Game not found' } }, 404);
  if (game.status === 'cancelled') {
    return c.json({ error: { code: 'CLOSED', message: 'This Open Play has been cancelled' } }, 409);
  }
  if (String(game.gameType) !== 'open') {
    return c.json({ error: { code: 'INVALID_STATE', message: 'Only Open Play uses "I\'m Interested".' } }, 400);
  }
  const list = ((game as any).interestedUserIds ?? []) as any[];
  const already = list.some((p: any) => String(p) === user.sub);
  // Only adding interest is gated — withdrawing it always works, even if the host
  // narrowed the policy after the player signed up.
  if (!already) {
    const blocked = await genderBlock((game as any).genderPolicy, user.sub);
    if (blocked) return c.json({ error: blocked }, 403);
    // Skill band: a level-restricted Open Play only admits a matching DUPR.
    const skillBlocked = await skillBlock(game, user.sub);
    if (skillBlocked) return c.json({ error: skillBlocked }, 403);
  }
  (game as any).interestedUserIds = already
    ? list.filter((p: any) => String(p) !== user.sub)
    : [...list, user.sub];
  if (!already) {
    // Accepting an Open Play invite lands here (the app's "Accept invite" calls
    // interest, not join), so consume the invite — exactly as joinGame does for
    // a lobby. Without this the invite survives the accept and the Invites tab
    // re-lists the game on the next fetch; worse, this endpoint is a TOGGLE, so
    // tapping "Accept invite" on the resurrected card silently withdrew the
    // interest the player had just registered.
    // Withdrawing interest does NOT restore the invite — an accepted invite is
    // spent; declining is the separate DELETE /:id/invite.
    (game as any).invitedUserIds = (game.invitedUserIds ?? []).filter((entry: any) => {
      const uid = typeof entry === 'object' && entry.user ? String(entry.user) : String(entry);
      return uid !== user.sub;
    }) as any;
  }
  await game.save();
  const populated = await Game.findById(id).populate(POPULATE).lean();
  return c.json({ data: serialize(populated, c.get('user')?.sub) });
}

/** A player in a FULL+LOCKED lobby asks the host for permission to leave. The
 *  player is added to pendingLeaveUserIds; the host must approve for them to
 *  actually leave. Reject if the lobby isn't full or the 1h window is still open
 *  (they can just `leaveGame` directly). */
export async function requestLeave(c: any) {
  const user = c.get('user');
  const id = c.req.param('id');
  const game = await Game.findById(id);
  if (!game) return c.json({ error: { code: 'NOT_FOUND', message: 'Game not found' } }, 404);
  const isMember = game.participantIds.some((p: any) => String(p) === user.sub);
  if (!isMember) return c.json({ error: { code: 'NOT_FOUND', message: 'You are not in this lobby.' } }, 404);
  const isFull = game.participantIds.length >= seats(game);
  if (!isFull) {
    return c.json({ error: { code: 'INVALID_STATE', message: 'The lobby is not full — you can leave directly.' } }, 400);
  }
  const fullTime = (game as any).fullAt ? new Date((game as any).fullAt).getTime() : 0;
  const windowOpen = fullTime > 0 && (Date.now() - fullTime) < FULL_LOBBY_LEAVE_GRACE_MS;
  if (windowOpen) {
    return c.json({ error: { code: 'INVALID_STATE', message: 'You can still leave directly — the 1-hour free-leave window is still open.' } }, 400);
  }
  const pend = ((game as any).pendingLeaveUserIds ?? []) as any[];
  const already = pend.some((p: any) => String(p) === user.sub);
  if (already) {
    return c.json({ error: { code: 'CONFLICT', message: 'You already requested to leave — the host will review it.' } }, 409);
  }
  (game as any).pendingLeaveUserIds = [...pend, user.sub];
  await game.save();
  // Tell the host someone wants to leave.
  const name = await actorName(user.sub);
  await notifyUser(game.creatorId, { type: 'game_leave_request', title: `${name} wants to leave`, body: `${name} is asking to leave ${gameLabel(game)}.`, icon: 'person_off', linkUrl: `/games/${String(game._id)}`, tag: `game-leave-req-${String(game._id)}` });
  const populated = await Game.findById(id).populate(POPULATE).lean();
  return c.json({ data: serialize(populated, c.get('user')?.sub) });
}

/** Host approves a pending leave request — removes the player from the roster and
 *  the pending list. Body: { userId }. The host is the only one who can approve. */
export async function approveLeave(c: any) {
  const user = c.get('user');
  const id = c.req.param('id');
  const game = await Game.findById(id);
  if (!game) return c.json({ error: { code: 'NOT_FOUND', message: 'Game not found' } }, 404);
  if (String(game.creatorId) !== user.sub) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Only the host can approve a leave request.' } }, 403);
  }
  const { userId } = kickSchema.parse(await c.req.json());
  const pend = ((game as any).pendingLeaveUserIds ?? []) as any[];
  if (!pend.some((p: any) => String(p) === userId)) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'That player did not request to leave.' } }, 404);
  }
  // Remove from both.
  (game as any).pendingLeaveUserIds = pend.filter((p: any) => String(p) !== userId);
  game.participantIds = game.participantIds.filter((p: any) => String(p) !== userId) as any;
  if (game.participantIds.length < seats(game)) {
    game.status = 'published';
    (game as any).fullAt = undefined;
  }
  await game.save();
  await notifyUser(userId, { type: 'game_leave_approved', title: 'Leave approved', body: `The host approved your request — you've left ${gameLabel(game)}.`, icon: 'check', linkUrl: `/games/${String(game._id)}`, tag: `game-leave-ok-${String(game._id)}` });
  const populated = await Game.findById(id).populate(POPULATE).lean();
  return c.json({ data: serialize(populated, c.get('user')?.sub) });
}

/** Host admits a pending join request — the player moves from pendingJoinUserIds
 *  into the roster. Body: { userId }. Capacity is re-checked HERE, not just at
 *  request time: the queue is a waiting list, so it outlives the lobby filling up
 *  and a request made against a free seat may be approved after it's gone. */
export async function approveJoin(c: any) {
  const user = c.get('user');
  const id = c.req.param('id');
  const game = await Game.findById(id);
  if (!game) return c.json({ error: { code: 'NOT_FOUND', message: 'Game not found' } }, 404);
  if (String(game.creatorId) !== user.sub) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Only the host can approve a join request.' } }, 403);
  }
  const { userId } = kickSchema.parse(await c.req.json());
  const pend = ((game as any).pendingJoinUserIds ?? []) as any[];
  if (!pend.some((p: any) => String(p) === userId)) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'That player has not asked to join.' } }, 404);
  }
  if (game.participantIds.length >= seats(game)) {
    return c.json({ error: { code: 'FULL', message: 'The lobby is full — free a spot first, then approve.' } }, 409);
  }
  (game as any).pendingJoinUserIds = pend.filter((p: any) => String(p) !== userId);
  const wasFull = game.status === 'full';
  game.participantIds.push(userId as any);
  // They're on the roster now, so a standing invite is spent — same as joinGame.
  (game as any).invitedUserIds = (game.invitedUserIds ?? []).filter((entry: any) => {
    const uid = typeof entry === 'object' && entry.user ? String(entry.user) : String(entry);
    return uid !== userId;
  }) as any;
  const nowFull = game.participantIds.length >= seats(game);
  if (nowFull) {
    game.status = 'full';
    (game as any).fullAt = new Date(); // starts the 1h free-leave window, as joinGame does
  }
  await game.save();
  await notifyUser(userId, { type: 'game_join_approved', title: "You're in", body: `The host approved your request — you've joined ${gameLabel(game)}.`, icon: 'check', linkUrl: `/games/${String(game._id)}`, tag: `game-join-ok-${String(game._id)}` });
  if (nowFull && !wasFull) await notifyHostLobbyFull(game);
  const populated = await Game.findById(id).populate(POPULATE).lean();
  return c.json({ data: serialize(populated, c.get('user')?.sub) });
}

/** Host declines a pending join request — drops them from the queue, no seat taken.
 *  Body: { userId }. Nothing stops them asking again; the host can decline again. */
export async function rejectJoin(c: any) {
  const user = c.get('user');
  const id = c.req.param('id');
  const game = await Game.findById(id);
  if (!game) return c.json({ error: { code: 'NOT_FOUND', message: 'Game not found' } }, 404);
  if (String(game.creatorId) !== user.sub) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Only the host can decline a join request.' } }, 403);
  }
  const { userId } = kickSchema.parse(await c.req.json());
  const pend = ((game as any).pendingJoinUserIds ?? []) as any[];
  if (!pend.some((p: any) => String(p) === userId)) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'That player has not asked to join.' } }, 404);
  }
  (game as any).pendingJoinUserIds = pend.filter((p: any) => String(p) !== userId);
  await game.save();
  await notifyUser(userId, { type: 'game_join_rejected', title: 'Request declined', body: `The host declined your request to join ${gameLabel(game)}.`, icon: 'person_off', linkUrl: `/games/${String(game._id)}`, tag: `game-join-no-${String(game._id)}` });
  const populated = await Game.findById(id).populate(POPULATE).lean();
  return c.json({ data: serialize(populated, c.get('user')?.sub) });
}

/** Host removes a player from the roster (can't kick yourself — use leave). */
export async function kickPlayer(c: any) {
  const user = c.get('user');
  const id = c.req.param('id');
  const game = await Game.findById(id);
  if (!game) return c.json({ error: { code: 'NOT_FOUND', message: 'Game not found' } }, 404);
  if (String(game.creatorId) !== user.sub) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Only the host can remove players' } }, 403);
  }
  const { userId } = kickSchema.parse(await c.req.json());
  if (userId === user.sub) {
    return c.json({ error: { code: 'CONFLICT', message: "The host can't be removed" } }, 409);
  }
  const wasParticipant = game.participantIds.some((p: any) => String(p) === userId);
  game.participantIds = game.participantIds.filter((p: any) => String(p) !== userId) as any;
  if (game.status === 'full') game.status = 'published';
  await game.save();
  // Let the removed player know they're no longer on the roster.
  if (wasParticipant) {
    await notifyUser(userId, {
      type: 'game_kick',
      title: 'Removed from a game',
      body: `The host removed you from ${gameLabel(game)}.`,
      icon: 'person_off',
      linkUrl: `/games/${String(game._id)}`,
      tag: `game-kick-${String(game._id)}`,
    });
  }
  const populated = await Game.findById(id).populate(POPULATE).lean();
  return c.json({ data: serialize(populated, c.get('user')?.sub) });
}

/** Anyone on the roster (host or participant) can invite other players to their
 *  game. The invite IS a notification + deep link (the invitee taps through and
 *  joins normally) — we also record them on `invitedUserIds` so re-invites
 *  dedupe. Anyone already on the roster, and the inviter themselves, are skipped. */
export async function inviteToGame(c: any) {
  const user = c.get('user');
  if (!hasPermission(user, 'player.games.invite')) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Invite permission required' } }, 403);
  }
  const id = c.req.param('id');
  if (!objectId.safeParse(id).success) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Game not found' } }, 404);
  }
  const game = await Game.findById(id);
  if (!game) return c.json({ error: { code: 'NOT_FOUND', message: 'Game not found' } }, 404);
  const isParticipant = game.participantIds.some((p: any) => String(p) === user.sub);
  // Open Play games use interest, not a roster — interested players can also invite.
  const isInterested = (game.gameType === 'open' || game.gameType === 'public') &&
    ((game.interestedUserIds ?? []) as any[]).some((p: any) => String(p) === user.sub);
  if (String(game.creatorId) !== user.sub && !isParticipant && !isInterested) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Only participants or interested players can invite to this game' } }, 403);
  }
  if (game.status === 'cancelled') {
    return c.json({ error: { code: 'CONFLICT', message: "Can't invite to a cancelled game" } }, 409);
  }
  const { userIds } = inviteSchema.parse(await c.req.json());
  const inRoster = new Set(game.participantIds.map((p: any) => String(p)));
  // De-dupe the request, drop the host + anyone already in the lobby.
  const targets = [...new Set(userIds)].filter((uid) => uid !== user.sub && !inRoster.has(uid));
  if (!targets.length) {
    return c.json({ data: { invited: 0 } });
  }
  // Invites only ever target players (see INVITABLE_ROLE): an owner may invite a
  // player, but nobody invites an owner-side or organizer account. The search
  // that feeds the invite sheet already hides them; this is the gate that a
  // hand-crafted request hits.
  const invitable = await User.find({ _id: { $in: targets }, roleDefault: INVITABLE_ROLE })
    .select('_id')
    .lean();
  if (invitable.length !== targets.length) {
    return c.json(
      { error: { code: 'NOT_INVITABLE', message: 'You can only invite players to a game' } },
      403,
    );
  }
  // Record invitees (merge, dedupe) so re-invites don't pile up.
  // Each entry tracks { user, invitedBy } so the invitee can see who invited them.
  const existing = (game.invitedUserIds ?? []).map((entry: any) =>
    typeof entry === 'object' && entry.user ? String(entry.user) : String(entry)
  );
  const existingSet = new Set(existing);
  const newEntries = targets
    .filter((t) => !existingSet.has(t))
    .map((t) => ({ user: t, invitedBy: user.sub }));
  (game as any).invitedUserIds = [...(game.invitedUserIds ?? []), ...newEntries] as any;
  await game.save();

  const inviterName = await actorName(user.sub);
  // Neutral, invitee-facing label (gameLabel is host-centric — "your game").
  const where = game.title
    ? `"${game.title}"`
    : game.venueName
      ? `the game at ${game.venueName}`
      : 'a game';
  await notifyUsers(targets, {
    type: 'game_invite',
    title: "You're invited to a game",
    body: `${inviterName} invited you to ${where}.`,
    icon: 'mail',
    linkUrl: `/games/${id}`,
    tag: `game-invite-${id}`,
  });
  // Realtime push so the invitee's Invites tab updates without a refresh.
  targets.forEach((uid) => publishUserEvent(uid, 'game.invited', { gameId: id }));
  return c.json({ data: { invited: targets.length } });
}

/** Remove the current user from a game's invited list (decline the invite).
 *  Notifies the person who invited them so they know the invite was declined. */
export async function declineInvite(c: any) {
  const user = c.get('user');
  const id = c.req.param('id');
  if (!objectId.safeParse(id).success) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Game not found' } }, 404);
  }
  const game = await Game.findById(id);
  if (!game) return c.json({ error: { code: 'NOT_FOUND', message: 'Game not found' } }, 404);
  // Find who invited this user (if tracked) before removing the entry.
  let inviterId: string | null = null;
  for (const entry of (game.invitedUserIds ?? [])) {
    const uid = typeof entry === 'object' && entry.user ? String(entry.user) : String(entry);
    if (uid === user.sub) {
      inviterId = typeof entry === 'object' && entry.invitedBy ? String(entry.invitedBy) : null;
      break;
    }
  }
  // Remove the current user from invitedUserIds (handle both old and new format).
  (game as any).invitedUserIds = (game.invitedUserIds ?? []).filter((entry: any) => {
    const uid = typeof entry === 'object' && entry.user ? String(entry.user) : String(entry);
    return uid !== user.sub;
  }) as any;
  await game.save();
  // Notify the inviter that their invite was declined.
  if (inviterId && inviterId !== user.sub) {
    const declinerName = await actorName(user.sub);
    const where = game.title
      ? `"${game.title}"`
      : game.venueName
        ? `the game at ${game.venueName}`
        : 'your game';
    await notifyUser(inviterId, {
      type: 'game_invite_declined',
      title: 'Invite declined',
      body: `${declinerName} declined your invite to ${where}.`,
      icon: 'mail',
      linkUrl: `/games/${id}`,
    });
  }
  return c.json({ data: { declined: true } });
}

// ---- Edit / delete (host-only) ------------------------------------------

/** Host edits a game's details (type/skill/name/capacity/visibility). The venue +
 *  schedule are fixed at creation, so they're not editable here. */
export async function updateGame(c: any) {
  const user = c.get('user');
  if (!hasPermission(user, 'player.games.manage')) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Game management permission required' } }, 403);
  }
  const id = c.req.param('id');
  if (!objectId.safeParse(id).success) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Game not found' } }, 404);
  }
  const game = await Game.findById(id);
  if (!game) return c.json({ error: { code: 'NOT_FOUND', message: 'Game not found' } }, 404);
  if (String(game.creatorId) !== user.sub) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Only the host can edit this game' } }, 403);
  }
  if (game.status === 'cancelled') {
    return c.json({ error: { code: 'CONFLICT', message: "Can't edit a cancelled game" } }, 409);
  }
  // A game that has already taken place is read-only — no editing the past.
  if (game.date && game.date < todayDate()) {
    return c.json({ error: { code: 'CONFLICT', message: "Can't edit a game that has already taken place." } }, 409);
  }
  const body = updateSchema.parse(await c.req.json());

  if (body.capacity != null && body.capacity < game.participantIds.length) {
    return c.json({ error: { code: 'CONFLICT', message: `Capacity can't be below the ${game.participantIds.length} players already in` } }, 409);
  }

  // Apply only provided fields; recompute derived values where inputs changed.
  if (body.title !== undefined) game.title = body.title || null;
  if (body.description !== undefined) game.description = body.description || null;
  if (body.gameType !== undefined) {
    // Same gate as creation: with the switch off, a non-organizer can't convert an
    // existing game into an event via edit either.
    if (body.gameType === 'public' && game.gameType !== 'public') {
      const caps = await getPlayerCapabilities();
      if (!caps.allowNonOrganizerEvents && !(await hasActivePartnerSubscription(user.sub, 'organizer'))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Only organizers can create events right now.' } }, 403);
      }
    }
    game.gameType = body.gameType;
  }
  if (body.format !== undefined) (game as any).format = body.format || null;
  if (body.skillLabel !== undefined) {
    game.skillLabel = body.skillLabel || null;
    const { skillMin, skillMax } = parseSkill(body.skillLabel);
    game.skillMin = skillMin as any;
    game.skillMax = skillMax as any;
  }
  if (body.capacity !== undefined) {
    game.capacity = body.capacity;
    // Re-opening room can revert a 'full' game back to filling.
    if (game.status === 'full' && game.participantIds.length < body.capacity) game.status = 'published';
  }
  if (body.visibility !== undefined) game.visibility = body.visibility;
  if (body.joinFee !== undefined) {
    // Same gate as creation: an organizer keeps their fee; anyone else is forced
    // to free, so a lapsed/never-subscribed host can't start charging via edit.
    (game as any).joinFee = body.joinFee > 0 && await hasActivePartnerSubscription(user.sub, 'organizer')
      ? body.joinFee
      : 0;
  }
  if (body.requiresApproval !== undefined) {
    // Same gate as creation — the switch can't be sidestepped via edit.
    const caps = await getPlayerCapabilities();
    (game as any).requiresApproval = caps.allowPlayerApprovalLobbies ? body.requiresApproval : false;
    // Turning the gate off does NOT auto-admit or auto-drop the queue: those players
    // asked under a rule the host has since changed, so deciding for them either way
    // would be wrong. The host keeps the queue and can still approve or decline each.
  }

  // Singles 1v1 / Doubles 2v2 have a fixed seat count regardless of what was sent.
  const fixedCap = game.gameType === 'singles' ? 2 : game.gameType === 'doubles' ? 4 : null;
  if (fixedCap != null) {
    if (fixedCap < game.participantIds.length) {
      return c.json({ error: { code: 'CONFLICT', message: `That format seats ${fixedCap}, but ${game.participantIds.length} players are already in.` } }, 409);
    }
    if (game.capacity !== fixedCap) {
      game.capacity = fixedCap;
      if (game.status === 'full' && game.participantIds.length < fixedCap) game.status = 'published';
    }
  }

  await game.save();
  // Let the other players know the host changed the game details.
  const others = game.participantIds.filter((p: any) => String(p) !== user.sub);
  await notifyUsers(others, {
    type: 'game_update',
    title: 'Game details updated',
    body: `The host updated ${gameLabel(game)}. Check the latest details.`,
    icon: 'edit',
    linkUrl: `/games/${String(game._id)}`,
    tag: `game-update-${String(game._id)}`,
  });
  const populated = await Game.findById(id).populate(POPULATE).lean();
  return c.json({ data: serialize(populated, c.get('user')?.sub) });
}

/** Host deletes a game. By default the host's court reservation is released with
 *  it: that booking is tagged `bookingType: 'game'` (hidden from My Bookings — the
 *  game is its receipt), so the host can't cancel it themselves; cancelling it
 *  here frees the court hour instead of leaving a phantom reservation behind.
 *
 *  With `?keepBooking=true` the lobby is removed but the court stays reserved —
 *  the reservation is converted back to a normal `bookingType: 'court'` booking so
 *  it reappears in My Bookings and the host can cancel/refund it separately. The
 *  surviving `bookingId` is returned so the caller can route to the refund flow. */
export async function deleteGame(c: any) {
  const user = c.get('user');
  if (!hasPermission(user, 'player.games.manage')) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Game management permission required' } }, 403);
  }
  const id = c.req.param('id');
  if (!objectId.safeParse(id).success) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Game not found' } }, 404);
  }
  const game = await Game.findById(id);
  if (!game) return c.json({ error: { code: 'NOT_FOUND', message: 'Game not found' } }, 404);
  if (String(game.creatorId) !== user.sub) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Only the host can delete this game' } }, 403);
  }
  const keepBooking = c.req.query('keepBooking') === 'true';
  // Capture the roster before the row is gone, so we can tell the other players.
  const others = game.participantIds.filter((p: any) => String(p) !== user.sub);
  const label = gameLabel(game);
  await Game.deleteOne({ _id: id });
  let keptBookingId: string | null = null;
  if (game.bookingId) {
    if (keepBooking) {
      // Keep the court reserved, but turn the game's hidden reservation back into
      // a normal court booking the host can see and cancel/refund on their own.
      const updated = await Booking.findOneAndUpdate(
        { _id: game.bookingId, userId: game.creatorId, status: { $ne: 'cancelled' } },
        { bookingType: 'court' },
        { new: true },
      ).lean();
      if (updated) keptBookingId = String((updated as any)._id);
    } else {
      // Release the linked court reservation so the hour frees up (no-op if
      // already cancelled, or if the game had no booking — e.g. legacy games).
      await Booking.updateOne(
        { _id: game.bookingId, userId: game.creatorId, status: { $ne: 'cancelled' } },
        { status: 'cancelled', cancellationReason: 'Game cancelled', cancelledAt: new Date() },
      );
    }
  }
  await notifyUsers(others, {
    type: 'game_cancel',
    title: 'Game cancelled',
    body: `The host cancelled ${label}.`,
    icon: 'event_busy',
    linkUrl: '/games',
    tag: `game-cancel-${id}`,
  });
  return c.json({ data: { id, deleted: true, bookingId: keptBookingId } });
}

/* ─── Game group chat (roster only) ───────────────────────────── */

/**
 * Everyone who belongs in a game's chat: the host plus whoever joined.
 *
 * "Joined" is stored in two different places depending on the game kind — lobby
 * games (singles/doubles/public) fill `participantIds`, while Open Play
 * (gameType 'open') has no roster at all and tracks its players as
 * `interestedUserIds`. Reading both is what gives Open Play a chat; keying off
 * `participantIds` alone locked every Open Play player out of their own game.
 */
function chatRoster(game: any): string[] {
  const ids = [
    String(game.creatorId),
    ...((game.participantIds ?? []).map((p: any) => String(p))),
    ...((game.interestedUserIds ?? []).map((p: any) => String(p))),
  ];
  return [...new Set(ids)].filter((id) => id && id !== 'undefined');
}

/** True if the user is the host, a joined participant, or an interested Open Play player. */
function isOnRoster(game: any, userId: string): boolean {
  return chatRoster(game).includes(String(userId));
}

// GET /games/:id/messages — the game's group chat (oldest→newest). Roster only.
export async function listGameMessages(c: any) {
  const user = c.get('user');
  const id = c.req.param('id');
  if (!objectId.safeParse(id).success) return c.json({ error: { code: 'NOT_FOUND', message: 'Game not found' } }, 404);
  const game = await Game.findById(id).select('creatorId participantIds interestedUserIds title venueName').lean();
  if (!game) return c.json({ error: { code: 'NOT_FOUND', message: 'Game not found' } }, 404);
  if (!isOnRoster(game, user.sub)) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Join this game to see its chat' } }, 403);
  }
  const rows = await GameMessage.find({ gameId: id })
    .sort({ createdAt: 1 }).limit(200)
    .populate({ path: 'senderId', select: 'displayName avatarUrl' })
    .lean();
  const messages = rows.map((m: any) => {
    const sid = String(m.senderId?._id ?? m.senderId);
    return {
      id: String(m._id),
      senderId: sid,
      senderName: m.senderId?.displayName ?? 'Player',
      senderAvatarUrl: m.senderId?.avatarUrl ?? null,
      body: m.body,
      createdAt: m.createdAt,
      mine: sid === user.sub,
    };
  });
  return c.json({ data: { gameId: id, title: (game as any).title || (game as any).venueName || null, messages } });
}

// POST /games/:id/messages — post to the game chat. Roster + player.games.chat.
export async function sendGameMessage(c: any) {
  const user = c.get('user');
  if (!hasPermission(user, 'player.games.chat')) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Game chat permission required' } }, 403);
  }
  const id = c.req.param('id');
  if (!objectId.safeParse(id).success) return c.json({ error: { code: 'NOT_FOUND', message: 'Game not found' } }, 404);
  const game = await Game.findById(id).select('creatorId participantIds interestedUserIds title venueName').lean();
  if (!game) return c.json({ error: { code: 'NOT_FOUND', message: 'Game not found' } }, 404);
  if (!isOnRoster(game, user.sub)) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Join this game to chat' } }, 403);
  }
  const body = z.object({ body: z.string().min(1).max(4000) }).parse(await c.req.json()).body;
  const me = await User.findById(user.sub).select('displayName avatarUrl').lean();
  const now = new Date();
  const msg = await GameMessage.create({ gameId: id, senderId: user.sub, body });
  const senderName = (me as any)?.displayName ?? 'Player';
  const view = {
    id: String((msg as any)._id),
    senderId: String(user.sub),
    senderName,
    senderAvatarUrl: (me as any)?.avatarUrl ?? null,
    body,
    createdAt: now,
  };
  // Realtime fan-out to every OTHER roster member's open app (live append in an
  // open chat) + a notification (badge/push/inbox) so they're alerted when not
  // looking at the chat. Collapsed per game so a burst doesn't spam pushes.
  const others = chatRoster(game).filter((uid) => uid !== user.sub);
  others.forEach((uid) => publishUserEvent(uid, 'game.message.created', { gameId: id, message: { ...view, mine: false } }));
  const preview = body.length > 120 ? `${body.slice(0, 117)}…` : body;
  await notifyUsers(others, {
    type: 'game_message',
    title: `${senderName} · ${gameLabel(game)}`,
    body: preview,
    icon: 'chat',
    linkUrl: `/games/${id}/chat`,   // deep-links straight into the game chat, not the lobby
    tag: `game-chat-${id}`,
  });

  return c.json({ data: { ...view, mine: true } }, 201);
}
