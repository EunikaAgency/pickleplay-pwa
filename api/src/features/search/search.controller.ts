import { z } from 'zod';
import { Venue } from '../venues/venues.model.js';
import { Coach } from '../coaches/coaches.model.js';
import { User } from '../auth/auth.model.js';
import { Game, INVITABLE_ROLE } from '../games/games.model.js';
import { Club } from '../clubs/clubs.model.js';

const searchQuery = z.object({
  q: z.string().min(1).optional(),
  // A single type narrows the result to that entity; `all` returns the full
  // cross-entity set (courts/games/players/clubs/coaches) for the app's global
  // search screen. With no type we keep the legacy venues+coaches default so
  // existing web consumers are unaffected.
  type: z.enum(['venues', 'coaches', 'players', 'games', 'clubs', 'all']).optional(),
  // When set with type=players, scopes results to staff accounts created by
  // this owner (roleDefault:'staff' + parentOwnerUserId match). Also used
  // without a query to return all staff of this owner (on-focus suggestions).
  ownerUserId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  // When set with type=players, returns only accounts that may be INVITED to a
  // game (see INVITABLE_ROLE in games.controller). Owner-side accounts run
  // venues, they don't get invited to play — an owner can invite a player, but
  // nobody invites an owner. Off by default: plain people-search (new DM, owner
  // "add member") must still surface every account.
  invitable: z.enum(['1', 'true']).optional(),
});

async function searchVenues(q: string) {
  const useFts = q.length >= 3;
  if (useFts) {
    try {
      const rows = await Venue.find(
        { $text: { $search: q } },
        { score: { $meta: 'textScore' } },
      )
        .sort({ score: { $meta: 'textScore' } })
        .limit(10)
        .lean();
      if (rows.length > 0) return rows.map((r: any) => ({ ...r, id: r._id }));
    } catch { /* text index not available */ }
  }
  const regex = new RegExp(q, 'i');
  const rows = await Venue.find({
    $or: [{ displayName: regex }, { area: regex }, { description: regex }],
  }).limit(10).lean();
  return rows.map((r: any) => ({ ...r, id: r._id }));
}

async function searchCoaches(q: string) {
  const useFts = q.length >= 3;
  if (useFts) {
    try {
      const rows = await Coach.find(
        { $text: { $search: q } },
        { score: { $meta: 'textScore' } },
      )
        .sort({ score: { $meta: 'textScore' } })
        .limit(10)
        .lean();
      if (rows.length > 0) return rows.map((r: any) => ({ ...r, id: r._id }));
    } catch { /* text index not available */ }
  }
  const regex = new RegExp(q, 'i');
  const rows = await Coach.find({
    $or: [{ displayName: regex }, { specialty: regex }, { bio: regex }],
  }).limit(10).lean();
  return rows.map((r: any) => ({ ...r, id: r._id }));
}

/** Find players by display name, for invites and people search. Returns a lean
 *  public shape (no email/auth fields). The caller may exclude themselves.
 *  When ownerUserId is passed, scopes to staff accounts created by that owner
 *  (roleDefault:'staff' + parentOwnerUserId match).
 *  When invitableOnly is set, drops the accounts a game invite can't target. */
async function searchPlayers(
  q: string,
  opts?: { excludeUserId?: string; ownerUserId?: string; invitableOnly?: boolean },
) {
  const filter: Record<string, any> = {};
  if (q) {
    const regex = new RegExp(q, 'i');
    filter.$or = [{ displayName: regex }, { firstName: regex }, { lastName: regex }];
  }
  if (opts?.excludeUserId) filter._id = { $ne: opts.excludeUserId };
  if (opts?.invitableOnly) filter.roleDefault = INVITABLE_ROLE;
  if (opts?.ownerUserId) {
    filter.roleDefault = 'staff';
    filter.parentOwnerUserId = opts.ownerUserId;
  }
  const rows = await User.find(filter)
    .select('displayName avatarUrl skillLevel skillLevelLabel lastActiveAt roleDefault')
    .limit(opts?.ownerUserId ? 30 : 10)
    .lean();
  return rows.map((r: any) => ({
    id: String(r._id),
    displayName: r.displayName,
    avatarUrl: r.avatarUrl ?? null,
    skillLevel: r.skillLevel ?? null,
    skillLevelLabel: r.skillLevelLabel ?? null,
    lastActiveAt: r.lastActiveAt ?? null,
    // Include so the UI can distinguish staff from regular players
    isStaff: r.roleDefault === 'staff',
  }));
}

/** Find open-play games by title or free-text venue name. Returns a lean,
 *  render-ready card shape (with derived spots-left). Invite-only and cancelled
 *  games are excluded — search only surfaces things you can actually join. */
async function searchGames(q: string) {
  const regex = new RegExp(q, 'i');
  const rows = await Game.find({
    visibility: 'public',
    status: { $ne: 'cancelled' },
    $or: [{ title: regex }, { venueName: regex }],
  })
    .sort({ date: 1, _id: -1 })
    .limit(10)
    .lean();
  return rows.map((r: any) => {
    const capacity = r.capacity ?? 0;
    const taken = (r.participantIds ?? []).length;
    return {
      id: String(r._id),
      title: r.title || 'Pickleball game',
      gameType: r.gameType ?? null,
      skillLabel: r.skillLabel ?? null,
      whenLabel: r.whenLabel ?? null,
      timeLabel: r.timeLabel ?? null,
      date: r.date ?? null,
      venueName: r.venueName ?? null,
      capacity,
      spotsLeft: Math.max(0, capacity - taken),
    };
  });
}

/** Find public clubs by name or description. Returns a lean card shape keyed by
 *  slug (the app/web club routes resolve either slug or id). */
async function searchClubs(q: string) {
  const regex = new RegExp(q, 'i');
  const rows = await Club.find({
    visibility: 'public',
    isDeleted: { $ne: true },
    $or: [{ name: regex }, { description: regex }],
  })
    .sort({ memberCount: -1, _id: -1 })
    .limit(10)
    .lean();
  return rows.map((r: any) => ({
    id: r.slug || String(r._id),
    name: r.name,
    memberCount: r.memberCount ?? 0,
    visibility: r.visibility ?? 'public',
    coverImageUrl: r.coverImageUrl ?? null,
  }));
}

export async function search(c: any) {
  const { q, type, ownerUserId, invitable } = searchQuery.parse(c.req.query());
  const user = c.get('user');
  const all = type === 'all';
  const results: Record<string, unknown[]> = {};
  if (all || !type || type === 'venues') results.venues = await searchVenues(q || '');
  if (all || !type || type === 'coaches') results.coaches = await searchCoaches(q || '');
  if (all || type === 'games') results.games = await searchGames(q || '');
  if (all || type === 'clubs') results.clubs = await searchClubs(q || '');
  // Players are only returned when explicitly requested (type=players) or as
  // part of the full cross-entity set (type=all), so the legacy no-type search
  // keeps its venues+coaches shape for existing consumers. The current user is
  // excluded from their own people search.
  // When ownerUserId is provided, results are scoped to staff accounts created
  // by that owner (used by the per-venue Staff tab). When invitable is set, the
  // list is narrowed to the accounts a game invite can actually target.
  if (all || type === 'players') {
    results.players = await searchPlayers(q || '', {
      excludeUserId: user?.sub,
      ownerUserId,
      invitableOnly: Boolean(invitable),
    });
  }
  return c.json({ data: results });
}
