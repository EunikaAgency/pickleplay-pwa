import { z } from 'zod';
import { Types } from 'mongoose';
import { Game, GameMessage } from './games.model.js';
import { parseTimeLabel } from './gameTime.js';
import { Booking } from '../bookings/bookings.model.js';
import { User } from '../auth/auth.model.js';
import { notifyUser, notifyUsers } from '../../shared/lib/notify.js';
import { publishUserEvent } from '../../shared/lib/userEvents.js';
import { hasPermission } from '../../shared/lib/permissions.js';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/);

// Competitive format for a public game — how the session is run.
const gameFormat = z.enum(['bracketing', 'round_robin', 'mini_tournament']);
const vibeEnum = z.enum(['casual', 'competitive']);
// When a full lobby fills, the player has this many ms to leave freely.
// After that window closes, the player must request host permission to leave.
const FULL_LOBBY_LEAVE_GRACE_MS = 3_600_000; // 1 hour
// When a player leaves twice from the same not-full lobby, they can't re-join for
// this many ms (prevents join/leave spam).
const LEAVE_COOLDOWN_MS = 3_600_000; // 1 hour

const createSchema = z.object({
  title: z.string().max(120).optional(),
  description: z.string().max(500).optional(),
  venueId: objectId.optional(),
  venueName: z.string().max(120).optional(),
  // 'open' = interest-based Open Play (no roster); 'public' = format-driven, capped
  // game with a lobby; 'singles'/'doubles' = classic fixed-seat lobbies.
  gameType: z.enum(['singles', 'doubles', 'open', 'public']).default('doubles'),
  format: gameFormat.optional(),
  vibe: vibeEnum.optional(),
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
  skillLabel: z.string().max(30).optional(),
  capacity: z.number().int().min(2).max(16).optional(),
  targetPlayers: z.number().int().min(2).max(64).optional(),
  visibility: z.enum(['public', 'invite']).optional(),
});

const listQuery = z.object({
  status: z.string().optional(),
  venueId: z.string().optional(),
  date: z.string().optional(),
  mine: z.coerce.boolean().optional(),
  creator: z.string().optional(),
  invited: z.coerce.boolean().optional(),
});

const VENUE_SELECT = 'displayName slug area city lat lng priceFrom priceFromLabel mainImageUrl';
const POPULATE = [
  { path: 'creatorId', select: 'displayName avatarUrl' },
  { path: 'participantIds', select: 'displayName avatarUrl' },
  { path: 'interestedUserIds', select: 'displayName avatarUrl' },
  { path: 'pendingLeaveUserIds', select: 'displayName avatarUrl' },
  { path: 'venueId', select: VENUE_SELECT },
  { path: 'invitedUserIds.invitedBy', select: 'displayName avatarUrl' },
  // over the venue image (falls back to the venue image when the court has none).
  { path: 'bookingId', select: 'courtId', populate: { path: 'courtId', select: 'mainImageUrl' } },
];

/** Pull min/max DUPR out of a label like '3.0–3.5' or '4.0+' (best-effort). */
function parseSkill(label?: string): { skillMin?: number; skillMax?: number } {
  if (!label) return {};
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

/** Map a populated, lean Game doc onto the shape the app consumes. */
function serialize(r: any, viewerUserId?: string) {
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
          image: v.mainImageUrl ?? null,
        }
      : null;
  const participants = (r.participantIds ?? []).map(refPerson);
  const interestedUsers = (r.interestedUserIds ?? []).map(refPerson);
  const pendingLeaveUsers = (r.pendingLeaveUserIds ?? []).map(refPerson);
  const capacity = r.capacity ?? 4;
  const creator = r.creatorId && typeof r.creatorId === 'object' ? refPerson(r.creatorId) : null;
  const venue = refVenue(r.venueId);
  // `bookingId` may be populated (with its court) for the court-image lookup, or
  // a bare ObjectId — handle both, keeping the output `bookingId` a string.
  const bookingObj = r.bookingId && typeof r.bookingId === 'object' ? r.bookingId : null;
  const courtImage =
    bookingObj && bookingObj.courtId && typeof bookingObj.courtId === 'object'
      ? (bookingObj.courtId.mainImageUrl ?? null)
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
    // Host-set vibe (casual or competitive) — surfaces on the lobby + cards.
    vibe: r.vibe ?? null,
    // Soft headcount goal for open play ("aiming for 8"). Not a cap.
    targetPlayers: r.targetPlayers ?? null,
    // Leave / join timing state (lobby games only).
    fullAt: r.fullAt ? (r.fullAt instanceof Date ? r.fullAt.toISOString() : r.fullAt) : null,
    pendingLeaveUsers,
    pendingLeaveCount: pendingLeaveUsers.length,
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
    .limit(50)
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
    body: `The game is ready to play. All ${game.capacity ?? game.participantIds.length} spots are filled.`,
    icon: 'bolt',
    linkUrl: `/games/${String(game._id)}`,
    tag: `game-full-${String(game._id)}`,
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
    body: `${name} joined ${gameLabel(game)} — ${game.participantIds.length}/${game.capacity ?? game.participantIds.length} spots filled.`,
    icon: 'group_add',
    linkUrl: `/games/${String(game._id)}`,
    tag: `game-join-${String(game._id)}`,
  });
}

export async function joinGame(c: any) {
  const user = c.get('user');
  const id = c.req.param('id');
  // Organizers manage games — they don't join as players.
  if (hasPermission(user, 'organizer.access')) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Organizer accounts manage tournaments and events — they cannot join games as a player.' } }, 403);
  }
  const game = await Game.findById(id);
  if (!game) return c.json({ error: { code: 'NOT_FOUND', message: 'Game not found' } }, 404);
  if (game.status === 'cancelled') {
    return c.json({ error: { code: 'CLOSED', message: 'This game has been cancelled' } }, 409);
  }
  // Open Play has no roster — it uses the "I'm Interested" signal instead of join.
  if (String(game.gameType) === 'open') {
    return c.json({ error: { code: 'INVALID_STATE', message: 'Open Play uses "I\'m Interested", not join.' } }, 400);
  }
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
    if (game.participantIds.length >= (game.capacity ?? 0)) {
      return c.json({ error: { code: 'FULL', message: 'This game is full' } }, 409);
    }
    const wasFull = game.status === 'full';
    game.participantIds.push(user.sub);
    // Remove from invitedUserIds since they've joined now.
    (game as any).invitedUserIds = (game.invitedUserIds ?? []).filter((entry: any) => {
      const uid = typeof entry === 'object' && entry.user ? String(entry.user) : String(entry);
      return uid !== user.sub;
    }) as any;
    const nowFull = game.participantIds.length >= (game.capacity ?? 0);
    if (nowFull) {
      game.status = 'full';
      (game as any).fullAt = new Date(); // start the 1h free-leave countdown
    }
    await game.save();
    // Notify the host when someone other than them joins: the richer "lobby full"
    // message on the transition into full, otherwise a plain "player joined".
    if (String(game.creatorId) !== user.sub) {
      if (nowFull && !wasFull) await notifyHostLobbyFull(game);
      else if (!nowFull) await notifyHostJoined(game, user.sub);
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
  const isFull = game.participantIds.length >= (game.capacity ?? 0);

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
    if (game.participantIds.length < (game.capacity ?? 0)) {
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
  (game as any).interestedUserIds = already
    ? list.filter((p: any) => String(p) !== user.sub)
    : [...list, user.sub];
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
  const isFull = game.participantIds.length >= (game.capacity ?? 0);
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
  if (game.participantIds.length < (game.capacity ?? 0)) {
    game.status = 'published';
    (game as any).fullAt = undefined;
  }
  await game.save();
  await notifyUser(userId, { type: 'game_leave_approved', title: 'Leave approved', body: `The host approved your request — you've left ${gameLabel(game)}.`, icon: 'check', linkUrl: `/games/${String(game._id)}`, tag: `game-leave-ok-${String(game._id)}` });
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
  if (body.gameType !== undefined) game.gameType = body.gameType;
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

/** True if the user is the host or a joined participant of the game. */
function isOnRoster(game: any, userId: string): boolean {
  if (String(game.creatorId) === userId) return true;
  return (game.participantIds ?? []).some((p: any) => String(p) === userId);
}

// GET /games/:id/messages — the game's group chat (oldest→newest). Roster only.
export async function listGameMessages(c: any) {
  const user = c.get('user');
  const id = c.req.param('id');
  if (!objectId.safeParse(id).success) return c.json({ error: { code: 'NOT_FOUND', message: 'Game not found' } }, 404);
  const game = await Game.findById(id).select('creatorId participantIds title venueName').lean();
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
  const game = await Game.findById(id).select('creatorId participantIds title venueName').lean();
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
  const roster = [String(game.creatorId), ...((game.participantIds ?? []).map((p: any) => String(p)))];
  const others = [...new Set(roster)].filter((uid) => uid !== user.sub);
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
