import { z } from 'zod';
import { Game, GameMessage } from './games.model.js';
import { Booking } from '../bookings/bookings.model.js';
import { User } from '../auth/auth.model.js';
import { notifyUser, notifyUsers } from '../../shared/lib/notify.js';
import { publishUserEvent } from '../../shared/lib/userEvents.js';
import { hasPermission } from '../../shared/lib/permissions.js';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/);

const createSchema = z.object({
  title: z.string().max(120).optional(),
  description: z.string().max(500).optional(),
  venueId: objectId.optional(),
  venueName: z.string().max(120).optional(),
  gameType: z.enum(['singles', 'doubles', 'open']).default('doubles'),
  skillLabel: z.string().max(30).optional(),
  whenLabel: z.string().max(30).optional(),
  timeLabel: z.string().max(20).optional(),
  durationLabel: z.string().max(20).optional(),
  // Explicit calendar date (from the date picker). When present it wins over the
  // best-effort date derived from whenLabel.
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  capacity: z.number().int().min(2).max(16).default(4),
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
  gameType: z.enum(['singles', 'doubles', 'open']).optional(),
  skillLabel: z.string().max(30).optional(),
  capacity: z.number().int().min(2).max(16).optional(),
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

// ── Lobby leave / grace-period rule (single source of truth for the API) ──
//
// A game's roster is its "lobby". Joiners can drop out freely until it fills;
// once a lobby is FULL their spot is only leaveable (refundable) while the game
// is still more than this many days away. Inside the window a full lobby is
// locked in — the host's court is committed, so the booking is final. Change
// this one constant to retune the window across the API.
export const LOBBY_LEAVE_GRACE_PERIOD_DAYS = 3;

/** Whole days from today (local midnight) to a YYYY-MM-DD game date; null if undated/unparsable. */
function daysUntilGame(date?: string | null): number | null {
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return Math.round((d.getTime() - today.getTime()) / 86_400_000);
}

/** The game date is inside the no-refund window (≤ grace period away). Undated → outside. */
function isWithinGracePeriod(date?: string | null): boolean {
  const days = daysUntilGame(date);
  return days != null && days <= LOBBY_LEAVE_GRACE_PERIOD_DAYS;
}

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
function serialize(r: any) {
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
    // "My Invites" = games where the current user is in invitedUserIds.user.
    if (!user) return c.json({ data: [] });
    filter['invitedUserIds.user'] = user.sub;
  } else if (q.mine) {
    // "My Games" = games I created OR joined. Requires a signed-in user.
    if (!user) return c.json({ data: [] });
    filter.$or = [{ creatorId: user.sub }, { participantIds: user.sub }];
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
  return c.json({ data: rows.map(serialize) });
}

export async function createGame(c: any) {
  const user = c.get('user');
  if (!hasPermission(user, 'player.games.create')) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Game creation permission required' } }, 403);
  }
  const body = createSchema.parse(await c.req.json());
  const { skillMin, skillMax } = parseSkill(body.skillLabel);
  // Singles 1v1 and Doubles 2v2 have a fixed seat count; only Open is custom.
  const capacity = body.gameType === 'singles' ? 2 : body.gameType === 'doubles' ? 4 : body.capacity;
  const game = await Game.create({
    creatorId: user.sub,
    title: body.title || null,
    description: body.description || null,
    venueId: body.venueId || null,
    venueName: body.venueName || null,
    gameType: body.gameType,
    skillLabel: body.skillLabel || null,
    skillMin,
    skillMax,
    whenLabel: body.whenLabel || null,
    timeLabel: body.timeLabel || null,
    durationLabel: body.durationLabel || null,
    date: body.date || computeDate(body.whenLabel),
    capacity,
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
    if (nowFull) game.status = 'full';
    await game.save();
    // Notify the host when someone other than them joins: the richer "lobby full"
    // message on the transition into full, otherwise a plain "player joined".
    if (String(game.creatorId) !== user.sub) {
      if (nowFull && !wasFull) await notifyHostLobbyFull(game);
      else if (!nowFull) await notifyHostJoined(game, user.sub);
    }
  }
  const populated = await Game.findById(id).populate(POPULATE).lean();
  return c.json({ data: serialize(populated) });
}

export async function leaveGame(c: any) {
  const user = c.get('user');
  const id = c.req.param('id');
  const game = await Game.findById(id);
  if (!game) return c.json({ error: { code: 'NOT_FOUND', message: 'Game not found' } }, 404);

  // Grace-period lock: a joiner can't leave once the lobby is FULL and the game
  // is within the grace window — their spot is final/non-refundable. The host is
  // exempt (they manage/cancel the game instead of "leaving" it).
  const isMember = game.participantIds.some((p: any) => String(p) === user.sub);
  const isHost = String(game.creatorId) === user.sub;
  const isFull = game.participantIds.length >= (game.capacity ?? 0);
  if (isMember && !isHost && isFull && isWithinGracePeriod(game.date)) {
    return c.json({
      error: {
        code: 'LOBBY_LOCKED',
        message: `You can no longer leave this lobby because the game is within the ${LOBBY_LEAVE_GRACE_PERIOD_DAYS}-day grace period and the lobby is already full.`,
      },
    }, 409);
  }

  game.participantIds = game.participantIds.filter((p: any) => String(p) !== user.sub) as any;
  // A game that dropped below capacity re-opens.
  if (game.status === 'full') game.status = 'published';
  await game.save();
  // Tell the host a spot opened up (only when a non-host member actually left).
  if (isMember && !isHost) {
    const name = await actorName(user.sub);
    await notifyUser(game.creatorId, {
      type: 'game_leave',
      title: 'A player left',
      body: `${name} left ${gameLabel(game)} — a spot is open again.`,
      icon: 'group_remove',
      linkUrl: `/games/${String(game._id)}`,
      tag: `game-leave-${String(game._id)}`,
    });
  }
  const populated = await Game.findById(id).populate(POPULATE).lean();
  return c.json({ data: serialize(populated) });
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
  return c.json({ data: serialize(populated) });
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
  if (String(game.creatorId) !== user.sub && !isParticipant) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Only participants can invite players to this game' } }, 403);
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
  return c.json({ data: serialize(populated) });
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
