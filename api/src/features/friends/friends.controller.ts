import { z } from 'zod';
import { Friend } from './friends.model.js';
import { User } from '../auth/auth.model.js';
import { Notification } from '../interactions/interactions.model.js';
import { Club } from '../clubs/clubs.model.js';
import { Game } from '../games/games.model.js';
import { notifyUser } from '../../shared/lib/notify.js';
import { publishUserEvent } from '../../shared/lib/userEvents.js';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/);
const sendRequestSchema = z.object({ userId: objectId });
const respondSchema = z.object({ accept: z.boolean() });

/** Roles that can be added as a friend. Admins, moderators, and staff are excluded. */
const FRIENDABLE_ROLES = ['player', 'coach', 'organizer'];

/** Public shape returned for a friend. */
function friendView(u: any) {
  if (!u) return null;
  return {
    id: String(u._id ?? u.id),
    displayName: u.displayName ?? 'Player',
    avatarUrl: u.avatarUrl ?? null,
    roleDefault: u.roleDefault ?? 'player',
    bio: u.bio ?? null,
    skillLevel: u.skillLevel ?? null,
    skillLevelLabel: u.skillLevelLabel ?? null,
  };
}

/** Resolve a friend row to the *other* user's profile (the one who isn't `me`). */
async function resolveFriend(friendRow: any, me: string) {
  const otherId = String(friendRow.requesterId) === me
    ? String(friendRow.recipientId)
    : String(friendRow.requesterId);
  const other = await User.findById(otherId)
    .select('displayName avatarUrl roleDefault bio skillLevel skillLevelLabel')
    .lean();
  return {
    id: String(friendRow._id),
    friend: friendView(other) ?? { id: otherId, displayName: 'Player', avatarUrl: null, roleDefault: 'player', bio: null, skillLevel: null, skillLevelLabel: null },
    status: friendRow.status,
    createdAt: friendRow.createdAt,
    /** True when the current user sent the request (so the UI can show "Request sent" vs "Accept/Reject"). */
    sentByMe: String(friendRow.requesterId) === me,
  };
}

// ─── Handlers ──────────────────────────────────────────────────────

/** POST /friends/request — send a friend request to another user. */
export async function sendFriendRequest(c: any) {
  const user = c.get('user');
  const { userId } = sendRequestSchema.parse(await c.req.json());

  if (userId === user.sub) {
    return c.json({ error: { code: 'CONFLICT', message: "You can't friend yourself" } }, 409);
  }

  const recipient = await User.findById(userId).select('displayName roleDefault').lean();
  if (!recipient) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);
  }

  const recipientRole = (recipient as any).roleDefault ?? 'player';
  if (!FRIENDABLE_ROLES.includes(recipientRole)) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'This user cannot be added as a friend' } }, 403);
  }

  // Check for an existing row (any direction, any status).
  const existing = await Friend.findOne({
    $or: [
      { requesterId: user.sub, recipientId: userId },
      { requesterId: userId, recipientId: user.sub },
    ],
  });
  if (existing) {
    if (existing.status === 'pending') {
      return c.json({ error: { code: 'CONFLICT', message: 'A friend request already exists between you' } }, 409);
    }
    if (existing.status === 'accepted') {
      return c.json({ error: { code: 'CONFLICT', message: 'You are already friends' } }, 409);
    }
    // If rejected, allow re-request by updating the existing row.
    existing.requesterId = user.sub as any;
    existing.recipientId = userId as any;
    existing.status = 'pending';
    await existing.save();

    // Notify the recipient.
    const me = await User.findById(user.sub).select('displayName').lean();
    const senderName = (me as any)?.displayName || 'Someone';
    await notifyUser(userId, {
      type: 'friend_request',
      title: 'Friend Request',
      body: `${senderName} sent you a friend request.`,
      icon: 'person_add',
      linkUrl: `/friends`,
      tag: `friend-request-${String(existing._id)}`,
    });

    return c.json({ data: { id: String(existing._id), status: 'pending', sentByMe: true } }, 200);
  }

  const row = await Friend.create({ requesterId: user.sub, recipientId: userId, status: 'pending' });

  // Notify the recipient.
  const me = await User.findById(user.sub).select('displayName').lean();
  const senderName = (me as any)?.displayName || 'Someone';
  await notifyUser(userId, {
    type: 'friend_request',
    title: 'Friend Request',
    body: `${senderName} sent you a friend request.`,
    icon: 'person_add',
    linkUrl: `/friends`,
    tag: `friend-request-${String(row._id)}`,
  });

  return c.json({ data: { id: String(row._id), status: 'pending', sentByMe: true } }, 201);
}

/** PATCH /friends/request/:id — accept or reject a friend request. */
export async function respondToFriendRequest(c: any) {
  const user = c.get('user');
  const id = c.req.param('id');
  if (!objectId.safeParse(id).success) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Friend request not found' } }, 404);
  }
  const { accept } = respondSchema.parse(await c.req.json());

  const row = await Friend.findById(id);
  if (!row) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Friend request not found' } }, 404);
  }
  // Only the recipient can accept/reject.
  if (String(row.recipientId) !== user.sub) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Only the recipient can respond to this request' } }, 403);
  }
  if (row.status !== 'pending') {
    return c.json({ error: { code: 'CONFLICT', message: `This request has already been ${row.status}` } }, 409);
  }

  row.status = accept ? 'accepted' : 'rejected';
  await row.save();

  // Delete the related notification so it disappears from the inbox.
  await Notification.deleteMany({
    userId: user.sub, type: 'friend_request', tag: `friend-request-${String(row._id)}`,
  });
  // Ping BOTH users' SSE streams so the notification disappears for the
  // recipient AND the Friends screen updates for the sender in realtime.
  publishUserEvent(user.sub, 'notification.created', {});
  publishUserEvent(String(row.requesterId), 'notification.created', {});

  // Only notify the requester on accept — rejection is silent.
  if (accept) {
    const me = await User.findById(user.sub).select('displayName').lean();
    const responderName = (me as any)?.displayName || 'Someone';
    await notifyUser(String(row.requesterId), {
      type: 'friend_request',
      title: 'Friend Request Accepted',
      body: `${responderName} accepted your friend request.`,
      icon: 'person_check',
      linkUrl: `/friends`,
      tag: `friend-response-${String(row._id)}`,
    });
  }

  return c.json({ data: { id: String(row._id), status: row.status } });
}

/** GET /friends — list the current user's accepted friends. */
export async function listFriends(c: any) {
  const user = c.get('user');
  const rows = await Friend.find({
    status: 'accepted',
    $or: [{ requesterId: user.sub }, { recipientId: user.sub }],
  })
    .sort({ updatedAt: -1 })
    .lean();

  const data = await Promise.all(rows.map((r) => resolveFriend(r, user.sub)));
  return c.json({ data });
}

/** GET /friends/pending — pending friend requests (sent + received). */
export async function listPendingRequests(c: any) {
  const user = c.get('user');
  const rows = await Friend.find({
    status: 'pending',
    $or: [{ requesterId: user.sub }, { recipientId: user.sub }],
  })
    .sort({ createdAt: -1 })
    .lean();

  const data = await Promise.all(rows.map((r) => resolveFriend(r, user.sub)));
  return c.json({ data });
}

/** DELETE /friends/:id — remove a friend (either side can do this). */
export async function removeFriend(c: any) {
  const user = c.get('user');
  const id = c.req.param('id');
  if (!objectId.safeParse(id).success) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Friendship not found' } }, 404);
  }

  const row = await Friend.findById(id);
  if (!row) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Friendship not found' } }, 404);
  }
  const isParticipant = String(row.requesterId) === user.sub || String(row.recipientId) === user.sub;
  if (!isParticipant) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'You are not part of this friendship' } }, 403);
  }

  await Friend.findByIdAndDelete(id);

  // Delete related notifications for both parties so cancelled requests
  // disappear from the inbox immediately.
  await Notification.deleteMany({
    type: 'friend_request',
    tag: { $in: [`friend-request-${id}`, `friend-response-${id}`] },
  });
  // Ping both parties' SSE streams so their inboxes refetch instantly.
  publishUserEvent(String(row.requesterId), 'notification.created', {});
  publishUserEvent(String(row.recipientId), 'notification.created', {});

  return c.json({ data: { id, removed: true } });
}

/** GET /friends/search?q= — search for friendable users (player/coach/organizer),
 *  excluding the current user and existing friends (any status). */
export async function searchFriendableUsers(c: any) {
  const user = c.get('user');
  const q = (c.req.query('q') || '').trim();

  // Gather existing friend IDs so we can exclude them (only pending/accepted —
  // rejected rows are re-requestable, so don't hide those users from search).
  const existingRows = await Friend.find({
    $or: [{ requesterId: user.sub }, { recipientId: user.sub }],
    status: { $in: ['pending', 'accepted'] },
  }).lean();
  const excludeIds = new Set<string>();
  for (const r of existingRows) {
    excludeIds.add(String(r.requesterId));
    excludeIds.add(String(r.recipientId));
  }
  excludeIds.add(user.sub); // exclude self

  const filter: Record<string, any> = {
    _id: { $nin: [...excludeIds] },
    roleDefault: { $in: FRIENDABLE_ROLES },
  };
  if (q) {
    const regex = new RegExp(q, 'i');
    filter.$or = [{ displayName: regex }, { firstName: regex }, { lastName: regex }];
  }

  const rows = await User.find(filter)
    .select('displayName avatarUrl roleDefault bio skillLevel skillLevelLabel')
    .limit(20)
    .lean();

  return c.json({
    data: rows.map((r: any) => ({
      id: String(r._id),
      displayName: r.displayName,
      avatarUrl: r.avatarUrl ?? null,
      roleDefault: r.roleDefault ?? 'player',
      bio: r.bio ?? null,
      skillLevel: r.skillLevel ?? null,
      skillLevelLabel: r.skillLevelLabel ?? null,
    })),
  });
}

/** Haversine distance in km between two lat/lng points. */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** GET /friends/suggestions — show suggested friendable users.
 *  Priority: nearby (when lat/lng passed) → shared games/clubs → random. */
export async function suggestFriends(c: any) {
  const user = c.get('user');
  const latRaw = c.req.query('lat');
  const lngRaw = c.req.query('lng');
  const lat = latRaw ? parseFloat(latRaw) : null;
  const lng = lngRaw ? parseFloat(lngRaw) : null;
  const hasCoords = lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng);

  // Gather existing friend IDs + self to exclude (only pending/accepted —
  // rejected rows are re-requestable).
  const existingRows = await Friend.find({
    $or: [{ requesterId: user.sub }, { recipientId: user.sub }],
    status: { $in: ['pending', 'accepted'] },
  }).lean();
  const excludeIds = new Set<string>();
  for (const r of existingRows) {
    excludeIds.add(String(r.requesterId));
    excludeIds.add(String(r.recipientId));
  }
  excludeIds.add(user.sub);

  const baseFilter: Record<string, any> = {
    _id: { $nin: [...excludeIds] },
    roleDefault: { $in: FRIENDABLE_ROLES },
  };

  let suggestions: any[] = [];

  // ── 0. Friends of friends (TOP priority) ───────────────────
  // People connected to your accepted friends but not yet to you. Ranked by how
  // many of your friends they share (more mutuals first). If there are none, the
  // tiers below (nearby → shared → random) run exactly as before.
  let fof: any[] = [];
  const acceptedFriendIds = existingRows
    .filter((r: any) => r.status === 'accepted')
    .map((r: any) => (String(r.requesterId) === user.sub ? String(r.recipientId) : String(r.requesterId)));
  if (acceptedFriendIds.length) {
    const friendSet = new Set(acceptedFriendIds);
    const edges = await Friend.find({
      status: 'accepted',
      $or: [{ requesterId: { $in: acceptedFriendIds } }, { recipientId: { $in: acceptedFriendIds } }],
    }).select('requesterId recipientId').lean();
    // Count, per candidate, how many of my friends they're connected to, and
    // capture the actual mutual friend IDs for the Facebook-style avatar stack.
    const mutual = new Map<string, number>();
    const mutualFriendIds = new Map<string, string[]>(); // candidate → [friendId, …]
    for (const e of edges) {
      const a = String(e.requesterId);
      const b = String(e.recipientId);
      const aFriend = friendSet.has(a);
      const bFriend = friendSet.has(b);
      // The candidate is the endpoint that ISN'T already one of my friends.
      const cand = aFriend && !bFriend ? b : bFriend && !aFriend ? a : null;
      if (!cand || excludeIds.has(cand)) continue; // skips me + my friends/pending
      mutual.set(cand, (mutual.get(cand) ?? 0) + 1);
      const friendId = aFriend ? a : b;
      const existing = mutualFriendIds.get(cand) ?? [];
      if (existing.length < 3) existing.push(friendId);
      mutualFriendIds.set(cand, existing);
    }
    if (mutual.size) {
      // Collect all mutual friend IDs referenced, batch their avatars.
      const allMutualFriendIds = [...new Set([...mutualFriendIds.values()].flat())];
      const mutualFriendUsers = allMutualFriendIds.length
        ? await User.find({ _id: { $in: allMutualFriendIds } }).select('displayName avatarUrl').lean()
        : [];
      const friendUserById = new Map(mutualFriendUsers.map((u: any) => [String(u._id), u]));
      const rankedIds = [...mutual.entries()].sort((x, y) => y[1] - x[1]).slice(0, 20).map(([id]) => id);
      const users = await User.find({ _id: { $in: rankedIds }, roleDefault: { $in: FRIENDABLE_ROLES } })
        .select('displayName avatarUrl roleDefault bio skillLevel skillLevelLabel')
        .lean();
      const byId = new Map(users.map((u: any) => [String(u._id), u]));
      // Preserve the mutual-count ranking (Mongo returns unordered).
      fof = rankedIds
        .map((id) => byId.get(id))
        .filter(Boolean)
        .map((u: any) => {
          const mfIds = mutualFriendIds.get(String(u._id)) ?? [];
          const mfAvatars = mfIds
            .map((fid) => friendUserById.get(fid))
            .filter(Boolean)
            .map((fu: any) => ({ id: String(fu._id), displayName: fu.displayName, avatarUrl: fu.avatarUrl ?? null }));
          return { ...u, _mutual: mutual.get(String(u._id)) ?? 0, _mutualFriends: mfAvatars };
        });
    }
  }

  // ── 1. Nearby users (when coords available) ────────────────
  // Only when FoF didn't already fill the list.
  if (hasCoords && fof.length < 20) {
    const nearby = await User.find({ ...baseFilter, lat: { $exists: true }, lng: { $exists: true } })
      .select('displayName avatarUrl roleDefault bio skillLevel skillLevelLabel lat lng')
      .lean();
    suggestions = nearby
      .map((u: any) => ({ ...u, _dist: haversineKm(lat!, lng!, u.lat, u.lng) }))
      .sort((a: any, b: any) => a._dist - b._dist)
      .slice(0, 20);
  }

  // ── 2. Shared games/clubs (fallback when no nearby results) ──
  if (suggestions.length === 0 && fof.length < 20) {
    // Find club IDs the user is a member of.
    const myClubs = await Club.find({ memberIds: user.sub }).select('_id').lean();
    const myClubIds = myClubs.map((c: any) => c._id);

    // Find game IDs the user participated in.
    const myGames = await Game.find({ participantIds: user.sub }).select('_id').lean();
    const myGameIds = myGames.map((g: any) => g._id);

    // Find users who share clubs or games.
    const sharedFilter: Record<string, any> = { ...baseFilter };
    const $or: any[] = [];
    if (myClubIds.length) $or.push({ _id: { $in: await Club.distinct('memberIds', { _id: { $in: myClubIds } }) } });
    if (myGameIds.length) $or.push({ _id: { $in: await Game.distinct('participantIds', { _id: { $in: myGameIds } }) } });
    if ($or.length) {
      sharedFilter.$or = $or;
      const similar = await User.find(sharedFilter)
        .select('displayName avatarUrl roleDefault bio skillLevel skillLevelLabel')
        .limit(20)
        .lean();
      // Score by shared count (deduped).
      suggestions = similar.map((u: any) => {
        const uid = String(u._id);
        let score = 0;
        if (myClubIds.length) score += 1; // simplified — just count presence
        if (myGameIds.length) score += 1;
        return { ...u, _score: score };
      }).sort((a: any, b: any) => b._score - a._score);
    }
  }

  // ── 3. Random fallback ──────────────────────────────────────
  if (suggestions.length === 0 && fof.length < 20) {
    const count = await User.countDocuments(baseFilter);
    const skip = Math.max(0, Math.floor(Math.random() * Math.max(0, count - 20)));
    suggestions = await User.find(baseFilter)
      .select('displayName avatarUrl roleDefault bio skillLevel skillLevelLabel')
      .skip(skip)
      .limit(20)
      .lean();
  }

  // Friends-of-friends first (priority), then the tiered results — deduped,
  // capped at 20. With no FoF this is just the current algo, unchanged.
  const seen = new Set<string>();
  const merged: any[] = [];
  for (const u of [...fof, ...suggestions]) {
    const id = String(u._id);
    if (seen.has(id)) continue;
    seen.add(id);
    merged.push(u);
    if (merged.length >= 20) break;
  }

  return c.json({
    data: merged.map((r: any) => ({
      id: String(r._id),
      displayName: r.displayName,
      avatarUrl: r.avatarUrl ?? null,
      roleDefault: r.roleDefault ?? 'player',
      bio: r.bio ?? null,
      skillLevel: r.skillLevel ?? null,
      skillLevelLabel: r.skillLevelLabel ?? null,
      // Only include distance when we actually computed it.
      distanceKm: r._dist != null ? Math.round(r._dist * 10) / 10 : undefined,
      // Number of shared friends when this is a friend-of-friend suggestion.
      mutualCount: r._mutual != null ? r._mutual : undefined,
      // Up to 3 mutual friends' avatars for the Facebook-style overlap display.
      mutualFriends: r._mutualFriends?.length ? r._mutualFriends : undefined,
    })),
  });
}
