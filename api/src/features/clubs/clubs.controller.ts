import { z } from 'zod';
import { Types } from 'mongoose';
import { streamSSE } from 'hono/streaming';
import { Club, ClubMembership, ClubPost, ClubPostReaction, ClubJoinRequest, ClubMessage, ClubStaff } from './clubs.model.js';
import { User } from '../auth/auth.model.js';
import { notifyUsers } from '../../shared/lib/notify.js';
import { hasPermission } from '../../shared/lib/permissions.js';
import { verifyToken } from '../../shared/lib/jwt.js';
import { withCursor, nextCursor, SORT_NEWEST } from '../../shared/lib/cursor.js';
import { publishClubEvent, subscribeClub } from './clubs.events.js';
import { publishUserEvent } from '../../shared/lib/userEvents.js';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/);
const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

// Above this member count we skip the durable notification fan-out on a new
// post (online members still get it live via SSE, and the in-club feed shows
// it) — a single post shouldn't write thousands of Notification docs.
const FANOUT_CAP = 500;

const PERSON_SELECT = 'displayName avatarUrl';

/* ─── Schemas ─────────────────────────────────────────────────────── */

const listQuery = z.object({
  search: z.string().optional(),
  mine: z.coerce.boolean().optional(),
  pageSize: z.coerce.number().int().min(1).max(50).optional().default(20),
  cursor: z.string().optional(),
});

const createSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(4000).optional(),
  coverImageUrl: z.string().max(500).optional(),
  visibility: z.enum(['public', 'private']).default('public'),
  joinLimit: z.number().int().positive().max(100000).optional(),
});

const updateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  description: z.string().max(4000).optional(),
  coverImageUrl: z.string().max(500).optional(),
  visibility: z.enum(['public', 'private']).optional(),
  joinLimit: z.number().int().positive().max(100000).nullable().optional(),
});

const joinSchema = z.object({ message: z.string().max(500).optional() });

const attachmentSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('image'), url: z.string().min(1).max(1000) }),
  z.object({ type: z.literal('gif'), url: z.string().min(1).max(1000) }),
  z.object({
    type: z.literal('game_link'),
    gameId: z.string().min(1),
    url: z.string().max(1000).optional(),
    title: z.string().max(200).optional(),
    subtitle: z.string().max(300).optional(),
    gameType: z.string().max(50).optional(),
    skillLabel: z.string().max(50).optional(),
    dateTime: z.string().max(100).optional(),
    venue: z.string().max(200).optional(),
    spotsLeft: z.number().int().optional(),
    capacity: z.number().int().optional(),
  }),
]);
const createPostSchema = z.object({
  body: z.string().max(8000).optional(),
  attachments: z.array(attachmentSchema).max(10).optional(),
  parentPostId: objectId.optional(),
}).refine((b) => (b.body && b.body.trim().length > 0) || (b.attachments && b.attachments.length > 0), {
  message: 'A post needs text or at least one attachment',
});
const editPostSchema = z.object({
  body: z.string().max(8000).optional(),
  attachments: z.array(attachmentSchema).max(10).optional(),
});
const feedQuery = z.object({
  pageSize: z.coerce.number().int().min(1).max(50).optional().default(20),
  cursor: z.string().optional(),
});

/* ─── Helpers ─────────────────────────────────────────────────────── */

function slugify(s: string): string {
  return (s || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90) || 'club';
}

async function uniqueClubSlug(base: string): Promise<string> {
  let slug = base;
  let n = 1;
  // eslint-disable-next-line no-await-in-loop
  while (await Club.exists({ slug })) {
    n += 1;
    slug = `${base}-${n}`.slice(0, 100);
  }
  return slug;
}

/** Resolve a club by slug or _id. Returns a lean doc (excludes deleted unless asked). */
async function loadClub(idParam: string, includeDeleted = false): Promise<any | null> {
  const byId = OBJECT_ID.test(idParam);
  const club = byId
    ? await Club.findById(idParam).populate('hostId', PERSON_SELECT).lean()
    : await Club.findOne({ slug: idParam }).populate('hostId', PERSON_SELECT).lean();
  if (!club) return null;
  if ((club as any).isDeleted && !includeDeleted) return null;
  return club;
}

async function getMembership(clubId: any, userId?: string | null): Promise<any | null> {
  if (!userId) return null;
  return ClubMembership.findOne({ clubId, userId }).lean();
}

// Host check. Accepts a bare userId (literal match — used by the membership
// lifecycle) OR the token user object, in which case a staff sub-account also
// counts as host of any club its creating owner hosts (parentOwnerId). This is
// how a staff member manages all of their owner's clubs without owning them.
type Viewer = { sub?: string; parentOwnerId?: string | null };
function isHostOf(club: any, viewer?: string | Viewer | null): boolean {
  if (!viewer) return false;
  const hostId = String(club.hostId?._id ?? club.hostId);
  if (typeof viewer === 'string') return hostId === viewer;
  if (viewer.sub && hostId === String(viewer.sub)) return true;
  return !!viewer.parentOwnerId && hostId === String(viewer.parentOwnerId);
}

/** Can this viewer read the club (its detail + feed)? Public: anyone. Private: members/host (staff count as their owner). */
async function canViewClub(club: any, viewer?: string | Viewer | null): Promise<boolean> {
  if (club.visibility === 'public') return true;
  if (isHostOf(club, viewer)) return true;
  const uid = typeof viewer === 'string' ? viewer : viewer?.sub;
  return !!(await getMembership(club._id, uid));
}

function refPerson(p: any) {
  return p && typeof p === 'object'
    ? { id: String(p._id), displayName: p.displayName ?? null, avatarUrl: p.avatarUrl ?? null }
    : { id: String(p), displayName: null, avatarUrl: null };
}

function serializeClub(c: any, viewer: { isMember?: boolean; isHost?: boolean; isStaff?: boolean; joinRequestStatus?: string | null } = {}, memberAvatars?: { id: string; displayName: string; avatarUrl: string | null }[]) {
  const host = c.hostId ? refPerson(c.hostId) : null;
  return {
    id: String(c._id),
    name: c.name,
    slug: c.slug,
    description: c.description ?? null,
    coverImageUrl: c.coverImageUrl ?? null,
    visibility: c.visibility,
    joinLimit: c.joinLimit ?? null,
    memberCount: c.memberCount ?? 0,
    postCount: c.postCount ?? 0,
    hostId: host ? host.id : String(c.hostId),
    host,
    isMember: !!viewer.isMember,
    isHost: !!viewer.isHost,
    isStaff: !!viewer.isStaff,
    joinRequestStatus: viewer.joinRequestStatus ?? null,
    memberAvatars: memberAvatars?.length ? memberAvatars : undefined,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

function serializePost(p: any, viewerReacted = false) {
  const author = p.authorId ? refPerson(p.authorId) : null;
  return {
    id: String(p._id),
    clubId: String(p.clubId),
    parentPostId: p.parentPostId ? String(p.parentPostId) : null,
    rootPostId: p.rootPostId ? String(p.rootPostId) : null,
    authorId: author ? author.id : String(p.authorId),
    author,
    body: p.isDeleted ? null : (p.body ?? ''),
    attachments: p.isDeleted ? [] : (p.attachments ?? []).map((a: any) => {
      if (a.type === 'game_link') {
        return { type: a.type, gameId: String(a.gameId), url: a.url, title: a.title, subtitle: a.subtitle, gameType: a.gameType, skillLabel: a.skillLabel, dateTime: a.dateTime, venue: a.venue, spotsLeft: a.spotsLeft, capacity: a.capacity };
      }
      return { type: a.type, url: a.url };
    }),
    sharedPostId: p.sharedPostId ? String(p.sharedPostId) : null,
    reactionCount: p.reactionCount ?? 0,
    replyCount: p.replyCount ?? 0,
    isDeleted: !!p.isDeleted,
    viewerReacted: !!viewerReacted,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

/** Durable notification fan-out (deduped, skips empty). Persists the in-app
 *  inbox row *and* fires an OS push for each recipient via the shared helper. */
async function notify(userIds: Array<unknown>, payload: { type: string; title: string; body: string; icon: string; linkUrl: string }): Promise<void> {
  await notifyUsers(userIds, payload);
}

/** Set of post ids the viewer has reacted to, for a page of posts. */
async function reactedSet(postIds: any[], userId?: string | null): Promise<Set<string>> {
  if (!userId || !postIds.length) return new Set();
  const rows = await ClubPostReaction.find({ postId: { $in: postIds }, userId }).select('postId').lean();
  return new Set(rows.map((r: any) => String(r.postId)));
}

/* ─── Club CRUD ───────────────────────────────────────────────────── */

export async function listClubs(c: any) {
  const q = listQuery.parse(c.req.query());
  const user = c.get('user');

  const conds: Record<string, any>[] = [];
  if (q.mine) {
    if (!user) return c.json({ data: [], meta: { cursor: undefined } });
    const [memberships, staffRows] = await Promise.all([
      ClubMembership.find({ userId: user.sub }).select('clubId').lean(),
      ClubStaff.find({ userId: user.sub, status: 'active' }).select('clubId').lean(),
    ]);
    const clubIds = [...new Set([
      ...memberships.map((m: any) => String(m.clubId)),
      ...staffRows.map((s: any) => String(s.clubId)),
    ])];
    if (!clubIds.length) return c.json({ data: [], meta: { cursor: undefined } });
    conds.push({ _id: { $in: clubIds }, isDeleted: false });
  } else {
    conds.push({ visibility: 'public', isDeleted: false });
  }
  if (q.search) {
    conds.push({ $or: [
      { name: { $regex: q.search, $options: 'i' } },
      { description: { $regex: q.search, $options: 'i' } },
    ] });
  }

  const base: Record<string, any> = conds.length === 1 ? conds[0]! : { $and: conds };
  const filter = withCursor(base, q.cursor);

  const rows = await Club.find(filter)
    .populate('hostId', PERSON_SELECT)
    .sort(SORT_NEWEST)
    .limit(q.pageSize + 1)
    .lean();

  const hasMore = rows.length > q.pageSize;
  if (hasMore) rows.pop();

  // Batch the viewer's membership + pending-request + staff state for the whole page.
  let memberClubIds = new Set<string>();
  let pendingClubIds = new Set<string>();
  let staffClubIds = new Set<string>();
  if (user && rows.length) {
    const ids = rows.map((r: any) => r._id);
    const [mems, reqs, staff] = await Promise.all([
      ClubMembership.find({ clubId: { $in: ids }, userId: user.sub }).select('clubId').lean(),
      ClubJoinRequest.find({ clubId: { $in: ids }, userId: user.sub, status: 'pending' }).select('clubId').lean(),
      ClubStaff.find({ clubId: { $in: ids }, userId: user.sub, status: 'active' }).select('clubId').lean(),
    ]);
    memberClubIds = new Set(mems.map((m: any) => String(m.clubId)));
    pendingClubIds = new Set(reqs.map((r: any) => String(r.clubId)));
    staffClubIds = new Set(staff.map((s: any) => String(s.clubId)));
  }

  // Batch-load member avatars for the Facebook-style stack (up to 3 per club).
  const memberAvatarsByClub = new Map<string, { id: string; displayName: string; avatarUrl: string | null }[]>();
  if (rows.length) {
    const clubIds = rows.map((r: any) => r._id);
    const allMemberships = await ClubMembership.find({ clubId: { $in: clubIds } })
      .select('clubId userId').lean();
    // Group first 3 member userIds per club.
    const memberIdsByClub = new Map<string, string[]>();
    for (const m of allMemberships) {
      const cid = String((m as any).clubId);
      const arr = memberIdsByClub.get(cid) ?? [];
      if (arr.length < 3) arr.push(String((m as any).userId));
      memberIdsByClub.set(cid, arr);
    }
    // Batch-lookup user avatars.
    const allMemberIds = [...new Set([...memberIdsByClub.values()].flat())];
    const memberUsers = allMemberIds.length
      ? await User.find({ _id: { $in: allMemberIds } }).select('displayName avatarUrl').lean()
      : [];
    const userById = new Map(memberUsers.map((u: any) => [String(u._id), u]));
    for (const [cid, uids] of memberIdsByClub) {
      memberAvatarsByClub.set(cid, uids
        .map((uid) => userById.get(uid))
        .filter(Boolean)
        .map((u: any) => ({ id: String(u._id), displayName: u.displayName, avatarUrl: u.avatarUrl ?? null })));
    }
  }

  const data = rows.map((r: any) => {
    const cid = String(r._id);
    const isHost = isHostOf(r, user);
    return serializeClub(r, {
      isMember: memberClubIds.has(cid) || isHost,
      isHost,
      isStaff: staffClubIds.has(cid),
      joinRequestStatus: pendingClubIds.has(cid) ? 'pending' : null,
    }, memberAvatarsByClub.get(cid));
  });

  return c.json({ data, meta: { total: data.length, cursor: nextCursor(rows as any, hasMore) } });
}

export async function createClub(c: any) {
  const user = c.get('user');
  if (!hasPermission(user, 'player.clubs.create')) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Club creation permission required' } }, 403);
  }
  const body = createSchema.parse(await c.req.json());
  const slug = await uniqueClubSlug(slugify(body.name));
  const club = await Club.create({
    name: body.name,
    slug,
    description: body.description || null,
    coverImageUrl: body.coverImageUrl || null,
    hostId: user.sub,
    visibility: body.visibility,
    joinLimit: body.joinLimit ?? null,
    memberCount: 1,
    postCount: 0,
  });
  await ClubMembership.create({ clubId: club._id, userId: user.sub, role: 'host' });
  const populated = await Club.findById(club._id).populate('hostId', PERSON_SELECT).lean();
  return c.json({ data: serializeClub(populated, { isMember: true, isHost: true }) }, 201);
}

export async function getClub(c: any) {
  const club = await loadClub(c.req.param('id'));
  if (!club) return c.json({ error: { code: 'NOT_FOUND', message: 'Club not found' } }, 404);
  const user = c.get('user');
  // Private clubs are invisible (404, leak-proof) to non-members.
  if (!(await canViewClub(club, user))) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Club not found' } }, 404);
  }
  const isHost = isHostOf(club, user);
  const membership = isHost ? true : await getMembership(club._id, user?.sub);
  const pending = !isHost && !membership && user
    ? await ClubJoinRequest.findOne({ clubId: club._id, userId: user.sub, status: 'pending' }).select('_id').lean()
    : null;
  return c.json({ data: serializeClub(club, {
    isMember: !!membership || isHost,
    isHost,
    joinRequestStatus: pending ? 'pending' : null,
  }) });
}

export async function updateClub(c: any) {
  const user = c.get('user');
  const club = await loadClub(c.req.param('id'));
  if (!club) return c.json({ error: { code: 'NOT_FOUND', message: 'Club not found' } }, 404);
  if (!(await canModerateClub(club, user)) && !hasPermission(user, 'player.clubs.moderate')) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Only the host or club staff can edit this club' } }, 403);
  }
  const body = updateSchema.parse(await c.req.json());
  const patch: Record<string, any> = {};
  if (body.name !== undefined) patch.name = body.name;
  if (body.description !== undefined) patch.description = body.description || null;
  if (body.coverImageUrl !== undefined) patch.coverImageUrl = body.coverImageUrl || null;
  if (body.visibility !== undefined) patch.visibility = body.visibility;
  if (body.joinLimit !== undefined) patch.joinLimit = body.joinLimit ?? null;
  await Club.updateOne({ _id: club._id }, patch);
  const updated = await Club.findById(club._id).populate('hostId', PERSON_SELECT).lean();
  return c.json({ data: serializeClub(updated, { isMember: true, isHost: isHostOf(updated, user) }) });
}

export async function deleteClub(c: any) {
  const user = c.get('user');
  const club = await loadClub(c.req.param('id'));
  if (!club) return c.json({ error: { code: 'NOT_FOUND', message: 'Club not found' } }, 404);
  if (!isHostOf(club, user) && !hasPermission(user, 'player.clubs.moderate')) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Only the host can delete this club' } }, 403);
  }
  // Hard cascade — a deleted club has no value and the slug is freed.
  await Promise.all([
    ClubMembership.deleteMany({ clubId: club._id }),
    ClubPost.deleteMany({ clubId: club._id }),
    ClubPostReaction.deleteMany({ clubId: club._id }),
    ClubJoinRequest.deleteMany({ clubId: club._id }),
    Club.deleteOne({ _id: club._id }),
  ]);
  return c.json({ data: { id: String(club._id), deleted: true } });
}

/* ─── Membership ──────────────────────────────────────────────────── */

export async function listMembers(c: any) {
  const club = await loadClub(c.req.param('id'));
  if (!club) return c.json({ error: { code: 'NOT_FOUND', message: 'Club not found' } }, 404);
  const user = c.get('user');
  if (!(await canViewClub(club, user))) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Club not found' } }, 404);
  }
  const rows = await ClubMembership.find({ clubId: club._id })
    .populate('userId', PERSON_SELECT)
    .lean();
  // Host first, then most-recent joiners.
  rows.sort((a: any, b: any) => {
    if (a.role !== b.role) return a.role === 'host' ? -1 : 1;
    return new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime();
  });
  const data = rows.map((m: any) => {
    const p = refPerson(m.userId);
    return { id: String(m._id), userId: p.id, displayName: p.displayName, avatarUrl: p.avatarUrl, role: m.role, joinedAt: m.joinedAt };
  });
  return c.json({ data });
}

export async function joinClub(c: any) {
  const user = c.get('user');
  if (!hasPermission(user, 'player.clubs.join')) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Club join permission required' } }, 403);
  }
  const club = await loadClub(c.req.param('id'));
  if (!club) return c.json({ error: { code: 'NOT_FOUND', message: 'Club not found' } }, 404);
  const body = joinSchema.parse(await c.req.json().catch(() => ({})));

  // Already a member (or host) → idempotent success.
  if (isHostOf(club, user.sub) || await getMembership(club._id, user.sub)) {
    return c.json({ data: { status: 'member' } });
  }

  // Private clubs: create a pending join request for the host to approve.
  if (club.visibility === 'private') {
    const existing = await ClubJoinRequest.findOne({ clubId: club._id, userId: user.sub, status: 'pending' }).lean();
    if (existing) return c.json({ data: { status: 'pending' } });
    await ClubJoinRequest.create({ clubId: club._id, userId: user.sub, status: 'pending', message: body.message || null });
    await notify([club.hostId?._id ?? club.hostId], {
      type: 'club_join_request', title: `Join request for ${club.name}`,
      body: 'Someone asked to join your club.', icon: 'group_add', linkUrl: `/clubs/${club.slug}`,
    });
    return c.json({ data: { status: 'pending' } });
  }

  // Public clubs: atomic join-limit guard, then create the membership.
  const seat = await Club.findOneAndUpdate(
    { _id: club._id, isDeleted: false, $expr: { $or: [{ $eq: ['$joinLimit', null] }, { $lt: ['$memberCount', '$joinLimit'] }] } },
    { $inc: { memberCount: 1 } },
    { new: true },
  );
  if (!seat) return c.json({ error: { code: 'FULL', message: 'This club is full' } }, 409);
  try {
    await ClubMembership.create({ clubId: club._id, userId: user.sub, role: 'member' });
  } catch (err: any) {
    // Lost a double-join race — undo the seat we took and report success.
    await Club.updateOne({ _id: club._id }, { $inc: { memberCount: -1 } });
    if (err?.code === 11000) return c.json({ data: { status: 'member' } });
    throw err;
  }
  publishClubEvent(club._id, 'member.joined', { clubId: String(club._id), memberCount: seat.memberCount });
  await notify([club.hostId?._id ?? club.hostId], {
    type: 'club_member_joined', title: `New member in ${club.name}`,
    body: 'Someone joined your club.', icon: 'how_to_reg', linkUrl: `/clubs/${club.slug}`,
  });
  return c.json({ data: { status: 'member' } });
}

export async function leaveClub(c: any) {
  const user = c.get('user');
  const club = await loadClub(c.req.param('id'));
  if (!club) return c.json({ error: { code: 'NOT_FOUND', message: 'Club not found' } }, 404);
  if (isHostOf(club, user.sub)) {
    return c.json({ error: { code: 'CONFLICT', message: 'The host cannot leave — delete the club instead' } }, 409);
  }
  const res = await ClubMembership.deleteOne({ clubId: club._id, userId: user.sub });
  if (res.deletedCount) await Club.updateOne({ _id: club._id }, { $inc: { memberCount: -1 } });
  return c.json({ data: { left: true } });
}

export async function removeMember(c: any) {
  const user = c.get('user');
  const club = await loadClub(c.req.param('id'));
  if (!club) return c.json({ error: { code: 'NOT_FOUND', message: 'Club not found' } }, 404);
  if (!(await canModerateClub(club, user)) && !hasPermission(user, 'player.clubs.moderate')) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Only the host or club staff can remove members' } }, 403);
  }
  const targetId = c.req.param('userId');
  if (String(targetId) === String(club.hostId?._id ?? club.hostId)) {
    return c.json({ error: { code: 'CONFLICT', message: 'The host cannot be removed' } }, 409);
  }
  const res = await ClubMembership.deleteOne({ clubId: club._id, userId: targetId });
  if (!res.deletedCount) return c.json({ error: { code: 'NOT_FOUND', message: 'Not a member' } }, 404);
  await Club.updateOne({ _id: club._id }, { $inc: { memberCount: -1 } });
  await notify([targetId], {
    type: 'club_removed', title: `Removed from ${club.name}`,
    body: 'A host removed you from the club.', icon: 'person_remove', linkUrl: `/clubs`,
  });
  return c.json({ data: { removed: true } });
}

export async function listRequests(c: any) {
  const user = c.get('user');
  const club = await loadClub(c.req.param('id'));
  if (!club) return c.json({ error: { code: 'NOT_FOUND', message: 'Club not found' } }, 404);
  if (!(await canModerateClub(club, user)) && !hasPermission(user, 'player.clubs.moderate')) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Only the host can view join requests' } }, 403);
  }
  const rows = await ClubJoinRequest.find({ clubId: club._id, status: 'pending' })
    .populate('userId', PERSON_SELECT)
    .sort({ createdAt: -1 })
    .lean();
  const data = rows.map((r: any) => {
    const p = refPerson(r.userId);
    return { id: String(r._id), userId: p.id, displayName: p.displayName, avatarUrl: p.avatarUrl, message: r.message ?? null, createdAt: r.createdAt };
  });
  return c.json({ data });
}

export async function approveRequest(c: any) {
  const user = c.get('user');
  const club = await loadClub(c.req.param('id'));
  if (!club) return c.json({ error: { code: 'NOT_FOUND', message: 'Club not found' } }, 404);
  if (!(await canModerateClub(club, user)) && !hasPermission(user, 'player.clubs.moderate')) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Only the host can approve requests' } }, 403);
  }
  const req = await ClubJoinRequest.findOne({ _id: c.req.param('reqId'), clubId: club._id, status: 'pending' });
  if (!req) return c.json({ error: { code: 'NOT_FOUND', message: 'Request not found' } }, 404);

  const seat = await Club.findOneAndUpdate(
    { _id: club._id, isDeleted: false, $expr: { $or: [{ $eq: ['$joinLimit', null] }, { $lt: ['$memberCount', '$joinLimit'] }] } },
    { $inc: { memberCount: 1 } },
    { new: true },
  );
  if (!seat) return c.json({ error: { code: 'FULL', message: 'This club is full' } }, 409);
  try {
    await ClubMembership.create({ clubId: club._id, userId: req.userId, role: 'member' });
  } catch (err: any) {
    if (err?.code !== 11000) { await Club.updateOne({ _id: club._id }, { $inc: { memberCount: -1 } }); throw err; }
    // Already a member somehow — release the extra seat, still mark approved.
    await Club.updateOne({ _id: club._id }, { $inc: { memberCount: -1 } });
  }
  req.status = 'approved';
  req.decidedBy = user.sub as any;
  req.decidedAt = new Date();
  await req.save();
  publishClubEvent(club._id, 'member.joined', { clubId: String(club._id), memberCount: seat.memberCount });
  await notify([req.userId], {
    type: 'club_request_approved', title: `You're in — ${club.name}`,
    body: 'Your request to join was approved.', icon: 'how_to_reg', linkUrl: `/clubs/${club.slug}`,
  });
  return c.json({ data: { status: 'approved' } });
}

export async function denyRequest(c: any) {
  const user = c.get('user');
  const club = await loadClub(c.req.param('id'));
  if (!club) return c.json({ error: { code: 'NOT_FOUND', message: 'Club not found' } }, 404);
  if (!(await canModerateClub(club, user)) && !hasPermission(user, 'player.clubs.moderate')) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Only the host can deny requests' } }, 403);
  }
  const req = await ClubJoinRequest.findOne({ _id: c.req.param('reqId'), clubId: club._id, status: 'pending' });
  if (!req) return c.json({ error: { code: 'NOT_FOUND', message: 'Request not found' } }, 404);
  req.status = 'denied';
  req.decidedBy = user.sub as any;
  req.decidedAt = new Date();
  await req.save();
  await notify([req.userId], {
    type: 'club_request_denied', title: `Request to ${club.name} declined`,
    body: 'Your request to join was not approved.', icon: 'block', linkUrl: `/clubs`,
  });
  return c.json({ data: { status: 'denied' } });
}

/* ─── Feed (recursive posts) ──────────────────────────────────────── */

export async function listFeed(c: any) {
  const club = await loadClub(c.req.param('id'));
  if (!club) return c.json({ error: { code: 'NOT_FOUND', message: 'Club not found' } }, 404);
  const user = c.get('user');
  if (!(await canViewClub(club, user))) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Club not found' } }, 404);
  }
  const q = feedQuery.parse(c.req.query());
  const filter = withCursor({ clubId: club._id, parentPostId: null, isDeleted: false }, q.cursor);
  const rows = await ClubPost.find(filter)
    .populate('authorId', PERSON_SELECT)
    .sort(SORT_NEWEST)
    .limit(q.pageSize + 1)
    .lean();
  const hasMore = rows.length > q.pageSize;
  if (hasMore) rows.pop();
  const reacted = await reactedSet(rows.map((r: any) => r._id), user?.sub);
  const data = rows.map((p: any) => serializePost(p, reacted.has(String(p._id))));
  return c.json({ data, meta: { total: data.length, cursor: nextCursor(rows as any, hasMore) } });
}

export async function getPost(c: any) {
  const club = await loadClub(c.req.param('id'));
  if (!club) return c.json({ error: { code: 'NOT_FOUND', message: 'Club not found' } }, 404);
  const user = c.get('user');
  if (!(await canViewClub(club, user))) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Club not found' } }, 404);
  }
  const post = await ClubPost.findOne({ _id: c.req.param('postId'), clubId: club._id })
    .populate('authorId', PERSON_SELECT).lean();
  if (!post) return c.json({ error: { code: 'NOT_FOUND', message: 'Post not found' } }, 404);
  const q = feedQuery.parse(c.req.query());
  const replyFilter = withCursor({ clubId: club._id, parentPostId: (post as any)._id, isDeleted: false }, q.cursor);
  const replies = await ClubPost.find(replyFilter)
    .populate('authorId', PERSON_SELECT).sort(SORT_NEWEST).limit(q.pageSize + 1).lean();
  const hasMore = replies.length > q.pageSize;
  if (hasMore) replies.pop();
  const reacted = await reactedSet([(post as any)._id, ...replies.map((r: any) => r._id)], user?.sub);
  return c.json({
    data: {
      post: serializePost(post, reacted.has(String((post as any)._id))),
      replies: replies.map((r: any) => serializePost(r, reacted.has(String(r._id)))),
      meta: { cursor: nextCursor(replies as any, hasMore) },
    },
  });
}

export async function listReplies(c: any) {
  const club = await loadClub(c.req.param('id'));
  if (!club) return c.json({ error: { code: 'NOT_FOUND', message: 'Club not found' } }, 404);
  const user = c.get('user');
  if (!(await canViewClub(club, user))) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Club not found' } }, 404);
  }
  const q = feedQuery.parse(c.req.query());
  const filter = withCursor({ clubId: club._id, parentPostId: c.req.param('postId'), isDeleted: false }, q.cursor);
  const rows = await ClubPost.find(filter)
    .populate('authorId', PERSON_SELECT).sort(SORT_NEWEST).limit(q.pageSize + 1).lean();
  const hasMore = rows.length > q.pageSize;
  if (hasMore) rows.pop();
  const reacted = await reactedSet(rows.map((r: any) => r._id), user?.sub);
  const data = rows.map((p: any) => serializePost(p, reacted.has(String(p._id))));
  return c.json({ data, meta: { total: data.length, cursor: nextCursor(rows as any, hasMore) } });
}

export async function createPost(c: any) {
  const user = c.get('user');
  if (!hasPermission(user, 'player.clubs.post')) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Club posting permission required' } }, 403);
  }
  const club = await loadClub(c.req.param('id'));
  if (!club) return c.json({ error: { code: 'NOT_FOUND', message: 'Club not found' } }, 404);
  const isHost = isHostOf(club, user);
  const membership = isHost ? true : await getMembership(club._id, user.sub);
  if (!membership) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Join this club to post' } }, 403);
  }
  const body = createPostSchema.parse(await c.req.json());

  let parent: any = null;
  if (body.parentPostId) {
    parent = await ClubPost.findOne({ _id: body.parentPostId, clubId: club._id, isDeleted: false }).lean();
    if (!parent) return c.json({ error: { code: 'NOT_FOUND', message: 'Parent post not found' } }, 404);
  }

  const post = await ClubPost.create({
    clubId: club._id,
    authorId: user.sub,
    parentPostId: parent ? parent._id : null,
    rootPostId: parent ? (parent.rootPostId || parent._id) : null,
    body: body.body?.trim() || null,
    attachments: body.attachments || [],
  });

  if (parent) await ClubPost.updateOne({ _id: parent._id }, { $inc: { replyCount: 1 } });
  else await Club.updateOne({ _id: club._id }, { $inc: { postCount: 1 } });

  const populated = await ClubPost.findById(post._id).populate('authorId', PERSON_SELECT).lean();
  const view = serializePost(populated);
  publishClubEvent(club._id, 'post.created', view);

  // Notifications (all activity): a reply pings the parent's author; a top-level
  // post fans out to all other members (capped).
  if (parent) {
    await notify([parent.authorId], {
      type: 'club_reply', title: `New reply in ${club.name}`,
      body: 'Someone replied to a post.', icon: 'reply', linkUrl: `/clubs/${club.slug}/posts/${parent._id}`,
    });
  } else {
    const members = await ClubMembership.find({ clubId: club._id, userId: { $ne: user.sub } }).select('userId').lean();
    if (members.length && members.length <= FANOUT_CAP) {
      await notify(members.map((m: any) => m.userId), {
        type: 'club_post', title: `New post in ${club.name}`,
        body: 'A member posted in your club.', icon: 'forum', linkUrl: `/clubs/${club.slug}/posts/${post._id}`,
      });
    } else if (members.length > FANOUT_CAP) {
      console.log(`[clubs] skipped notification fan-out for post in ${club.slug} (${members.length} members > ${FANOUT_CAP} cap); delivered live via SSE`);
    }
  }
  return c.json({ data: view }, 201);
}

export async function editPost(c: any) {
  const user = c.get('user');
  const club = await loadClub(c.req.param('id'));
  if (!club) return c.json({ error: { code: 'NOT_FOUND', message: 'Club not found' } }, 404);
  const post = await ClubPost.findOne({ _id: c.req.param('postId'), clubId: club._id, isDeleted: false });
  if (!post) return c.json({ error: { code: 'NOT_FOUND', message: 'Post not found' } }, 404);
  if (String(post.authorId) !== user.sub) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Only the author can edit this post' } }, 403);
  }
  const body = editPostSchema.parse(await c.req.json());
  if (body.body !== undefined) post.body = body.body.trim() || (null as any);
  if (body.attachments !== undefined) post.attachments = body.attachments as any;
  await post.save();
  const populated = await ClubPost.findById(post._id).populate('authorId', PERSON_SELECT).lean();
  const view = serializePost(populated);
  publishClubEvent(club._id, 'post.updated', view);
  return c.json({ data: view });
}

export async function deletePost(c: any) {
  const user = c.get('user');
  const club = await loadClub(c.req.param('id'));
  if (!club) return c.json({ error: { code: 'NOT_FOUND', message: 'Club not found' } }, 404);
  const post = await ClubPost.findOne({ _id: c.req.param('postId'), clubId: club._id }).lean();
  if (!post) return c.json({ error: { code: 'NOT_FOUND', message: 'Post not found' } }, 404);
  const isAuthor = String((post as any).authorId) === user.sub;
  const isHost = isHostOf(club, user);
  if (!isAuthor && !isHost && !hasPermission(user, 'player.clubs.moderate')) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Only the author or host can delete this post' } }, 403);
  }
  // Soft-delete gated on the isDeleted transition so a repeated DELETE is a no-op
  // and the counters never double-decrement.
  const res = await ClubPost.updateOne({ _id: (post as any)._id, isDeleted: false }, { $set: { isDeleted: true } });
  if (res.modifiedCount) {
    if ((post as any).parentPostId) await ClubPost.updateOne({ _id: (post as any).parentPostId }, { $inc: { replyCount: -1 } });
    else await Club.updateOne({ _id: club._id }, { $inc: { postCount: -1 } });
    publishClubEvent(club._id, 'post.deleted', { id: String((post as any)._id), clubId: String(club._id), parentPostId: (post as any).parentPostId ? String((post as any).parentPostId) : null });
  }
  return c.json({ data: { id: String((post as any)._id), deleted: true } });
}

export async function reactPost(c: any) {
  const user = c.get('user');
  if (!hasPermission(user, 'player.clubs.react')) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Club reaction permission required' } }, 403);
  }
  const club = await loadClub(c.req.param('id'));
  if (!club) return c.json({ error: { code: 'NOT_FOUND', message: 'Club not found' } }, 404);
  const isHost = isHostOf(club, user);
  if (!isHost && !(await getMembership(club._id, user.sub))) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Join this club to react' } }, 403);
  }
  const post = await ClubPost.findOne({ _id: c.req.param('postId'), clubId: club._id, isDeleted: false }).lean();
  if (!post) return c.json({ error: { code: 'NOT_FOUND', message: 'Post not found' } }, 404);

  // Upsert; only bump the count when a row was actually inserted (idempotent —
  // upsertedCount is 1 exactly when a new reaction row was created).
  const result = await ClubPostReaction.updateOne(
    { postId: (post as any)._id, userId: user.sub },
    { $setOnInsert: { clubId: club._id, type: 'like' } },
    { upsert: true },
  );
  const inserted = result.upsertedCount === 1;
  if (inserted) await ClubPost.updateOne({ _id: (post as any)._id }, { $inc: { reactionCount: 1 } });
  const fresh = await ClubPost.findById((post as any)._id).select('reactionCount').lean();
  const reactionCount = (fresh as any)?.reactionCount ?? 0;

  publishClubEvent(club._id, 'reaction.changed', { postId: String((post as any)._id), reactionCount });
  if (inserted && String((post as any).authorId) !== user.sub) {
    await notify([(post as any).authorId], {
      type: 'club_like', title: `Someone liked your post in ${club.name}`,
      body: 'Your post got a like.', icon: 'favorite', linkUrl: `/clubs/${club.slug}`,
    });
  }
  return c.json({ data: { reacted: true, reactionCount } });
}

export async function unreactPost(c: any) {
  const user = c.get('user');
  const club = await loadClub(c.req.param('id'));
  if (!club) return c.json({ error: { code: 'NOT_FOUND', message: 'Club not found' } }, 404);
  const post = await ClubPost.findOne({ _id: c.req.param('postId'), clubId: club._id }).lean();
  if (!post) return c.json({ error: { code: 'NOT_FOUND', message: 'Post not found' } }, 404);
  const res = await ClubPostReaction.deleteOne({ postId: (post as any)._id, userId: user.sub });
  if (res.deletedCount) await ClubPost.updateOne({ _id: (post as any)._id }, { $inc: { reactionCount: -1 } });
  const fresh = await ClubPost.findById((post as any)._id).select('reactionCount').lean();
  const reactionCount = (fresh as any)?.reactionCount ?? 0;
  publishClubEvent(club._id, 'reaction.changed', { postId: String((post as any)._id), reactionCount });
  return c.json({ data: { reacted: false, reactionCount } });
}

/* ─── SSE realtime stream ─────────────────────────────────────────── */

// GET /api/v1/clubs/:id/stream — NOT behind requireAuth (native EventSource
// can't set an Authorization header and the web stores tokens in localStorage),
// so the access token comes as ?token= and is verified inline here.
export async function streamClub(c: any) {
  const headerToken = c.req.header('Authorization')?.startsWith('Bearer ')
    ? c.req.header('Authorization').slice(7) : null;
  const token = c.req.query('token') || headerToken;
  if (!token) return c.json({ error: { code: 'UNAUTHORIZED', message: 'Stream token required' } }, 401);

  let payload: any;
  try {
    payload = await verifyToken(token);
    if (payload.type && payload.type !== 'access') throw new Error('wrong token type');
  } catch {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } }, 401);
  }
  const userId = payload.sub as string;

  const club = await loadClub(c.req.param('id'));
  if (!club) return c.json({ error: { code: 'NOT_FOUND', message: 'Club not found' } }, 404);
  // Public clubs: any signed-in user may listen. Private: members/host only.
  if (club.visibility === 'private' && !isHostOf(club, payload) && !(await getMembership(club._id, userId))) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Join this club to stream its feed' } }, 403);
  }

  // Defeat proxy/middleware buffering of the event stream.
  c.header('X-Accel-Buffering', 'no');
  c.header('Cache-Control', 'no-cache');
  c.header('Connection', 'keep-alive');

  const clubId = String(club._id);
  return streamSSE(c, async (stream) => {
    const unsubscribe = subscribeClub(clubId, (e) => {
      stream.writeSSE({ event: e.event, data: JSON.stringify(e.data) }).catch(() => {});
    });
    const heartbeat = setInterval(() => {
      stream.writeSSE({ event: 'ping', data: String(Date.now()) }).catch(() => {});
    }, 25_000);
    await stream.writeSSE({ event: 'ready', data: JSON.stringify({ clubId }) });
    // Hold the connection open until the client disconnects; clean up the
    // listener + heartbeat so neither leaks per reconnect.
    await new Promise<void>((resolve) => {
      stream.onAbort(() => { unsubscribe(); clearInterval(heartbeat); resolve(); });
    });
  });
}

/* ─── Member group chat (host + members) ─────────────────────────────
 * A two-way group chat scoped to a club's membership, separate from the public
 * feed. Read + post both require membership (mirrors the game/tournament roster
 * chat); posting additionally needs `player.clubs.chat`. Each send fans a
 * realtime `club.message.created` out to every other member's per-user stream +
 * a collapsed notification.
 */

// Membership gate for the chat — host or member only (the feed is publicly
// viewable for public clubs, but the chat is members-only).
async function canAccessClubChat(club: any, userId?: string | null): Promise<boolean> {
  if (!userId) return false;
  if (isHostOf(club, userId)) return true;
  return !!(await getMembership(club._id, userId));
}

function cardView(c: any) {
  if (!c) return undefined;
  return {
    gameId: c.gameId ? String(c.gameId) : undefined,
    title: c.title,
    subtitle: c.subtitle,
    gameType: c.gameType,
    skillLabel: c.skillLabel,
    dateTime: c.dateTime,
    venue: c.venue,
    imageUrl: c.imageUrl,
    spotsLeft: c.spotsLeft,
    capacity: c.capacity,
  };
}

function clubMessageView(m: any, meId: string) {
  const sid = String(m.senderId?._id ?? m.senderId);
  return {
    id: String(m._id),
    senderId: sid,
    senderName: m.senderId?.displayName ?? 'Player',
    senderAvatarUrl: m.senderId?.avatarUrl ?? null,
    body: m.body,
    card: cardView(m.card),
    createdAt: m.createdAt,
    mine: sid === meId,
  };
}

// GET /clubs/:id/messages — the member chat. Members only.
export async function listClubMessages(c: any) {
  const user = c.get('user');
  const club = await loadClub(c.req.param('id'));
  if (!club) return c.json({ error: { code: 'NOT_FOUND', message: 'Club not found' } }, 404);
  if (!(await canAccessClubChat(club, user?.sub))) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Join this club to see its chat' } }, 403);
  }
  const rows = await ClubMessage.find({ clubId: club._id })
    .sort({ createdAt: 1 }).limit(200)
    .populate({ path: 'senderId', select: PERSON_SELECT })
    .lean();
  const messages = rows.map((m: any) => clubMessageView(m, user.sub));
  return c.json({ data: { clubId: String(club._id), title: club.name || null, messages } });
}

// POST /clubs/:id/messages — post to the member chat. Member + player.clubs.chat.
export async function sendClubMessage(c: any) {
  const user = c.get('user');
  if (!hasPermission(user, 'player.clubs.chat')) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Club chat permission required' } }, 403);
  }
  const club = await loadClub(c.req.param('id'));
  if (!club) return c.json({ error: { code: 'NOT_FOUND', message: 'Club not found' } }, 404);
  if (!(await canAccessClubChat(club, user.sub))) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Join this club to chat' } }, 403);
  }
  const parseResult = z.object({
    body: z.string().max(4000).optional().default(''),
    card: z.object({
      gameId: z.string().min(1),
      title: z.string().max(200).optional(),
      subtitle: z.string().max(300).optional(),
      gameType: z.string().max(50).optional(),
      skillLabel: z.string().max(50).optional(),
      dateTime: z.string().max(100).optional(),
      venue: z.string().max(200).optional(),
      imageUrl: z.string().max(1000).optional(),
      spotsLeft: z.number().int().optional(),
      capacity: z.number().int().optional(),
    }).optional(),
  }).refine((b) => (b.body && b.body.trim().length > 0) || b.card, {
    message: 'A chat message needs text or a card',
  }).parse(await c.req.json());
  const { body, card } = parseResult;
  const me = await User.findById(user.sub).select(PERSON_SELECT).lean();
  const now = new Date();
  // Cast card.gameId from string to ObjectId for Mongoose.
  const cardDoc = card ? { ...card, gameId: new Types.ObjectId(card.gameId) } : undefined;
  const msg = await ClubMessage.create({ clubId: club._id, senderId: user.sub, body, ...(cardDoc ? { card: cardDoc } : {}) });
  const senderName = (me as any)?.displayName ?? 'Player';
  const view = {
    id: String((msg as any)._id),
    senderId: String(user.sub),
    senderName,
    senderAvatarUrl: (me as any)?.avatarUrl ?? null,
    body,
    card: card ? cardView({ ...card, gameId: card.gameId }) : undefined,
    createdAt: now,
  };
  // Realtime fan-out to every OTHER member + a collapsed notification so they're
  // alerted when not in the chat.
  const members = await ClubMembership.find({ clubId: club._id }).select('userId').lean();
  const others = [...new Set(members.map((m: any) => String(m.userId)))].filter((uid) => uid && uid !== 'undefined' && uid !== user.sub);
  others.forEach((uid) => publishUserEvent(uid, 'club.message.created', { clubId: String(club._id), message: { ...view, mine: false } }));
  const preview = body.length > 120 ? `${body.slice(0, 117)}…` : body;
  await notifyUsers(others, {
    type: 'club_message',
    title: `${senderName} · ${club.name || 'Club'}`,
    body: preview,
    icon: 'chat',
    linkUrl: `/clubs/${club.slug}/chat`,
    tag: `club-chat-${String(club._id)}`,
  });
  return c.json({ data: { ...view, mine: true } }, 201);
}

// PATCH /clubs/:id/messages/:msgId — edit your own message body (sender-only).
export async function editClubMessage(c: any) {
  const user = c.get('user');
  const msgId = c.req.param('msgId');
  if (!objectId.safeParse(msgId).success) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Message not found' } }, 404);
  }
  const msg = await ClubMessage.findById(msgId);
  if (!msg) return c.json({ error: { code: 'NOT_FOUND', message: 'Message not found' } }, 404);
  if (String((msg as any).senderId) !== user.sub) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'You can only edit your own messages' } }, 403);
  }
  // 15-minute edit window from send time.
  const ageMs = Date.now() - new Date((msg as any).createdAt).getTime();
  if (ageMs > 15 * 60 * 1000) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Messages can only be edited within 15 minutes of sending' } }, 403);
  }
  const { body } = z.object({ body: z.string().min(1).max(4000) }).parse(await c.req.json());
  msg.set('body', body);
  await msg.save();

  const view = clubMessageView(msg.toObject(), user.sub);

  // Fan-out the edit to other members so open chats update live.
  const members = await ClubMembership.find({ clubId: msg.clubId }).select('userId').lean();
  const others = [...new Set(members.map((m: any) => String(m.userId)))].filter((uid) => uid && uid !== 'undefined' && uid !== user.sub);
  others.forEach((uid) => publishUserEvent(uid, 'club.message.edited', { clubId: String(msg.clubId), message: { ...view, mine: false } }));

  return c.json({ data: view });
}

// DELETE /clubs/:id/messages/:msgId — delete your own message (sender-only).
export async function deleteClubMessage(c: any) {
  const user = c.get('user');
  const msgId = c.req.param('msgId');
  if (!objectId.safeParse(msgId).success) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Message not found' } }, 404);
  }
  const msg = await ClubMessage.findById(msgId);
  if (!msg) return c.json({ error: { code: 'NOT_FOUND', message: 'Message not found' } }, 404);
  if (String((msg as any).senderId) !== user.sub) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'You can only delete your own messages' } }, 403);
  }

  const clubId = String(msg.clubId);
  await msg.deleteOne();

  // Fan-out the deletion to other members so open chats drop the message live.
  const members = await ClubMembership.find({ clubId: msg.clubId }).select('userId').lean();
  const others = [...new Set(members.map((m: any) => String(m.userId)))].filter((uid) => uid && uid !== 'undefined' && uid !== user.sub);
  others.forEach((uid) => publishUserEvent(uid, 'club.message.deleted', { clubId, messageId: msgId }));

  return c.json({ data: { ok: true } });
}

// ── Per-club staff ──────────────────────────────────────────────────────────
// ClubStaff rows let a host delegate moderation to specific people without
// making them full hosts. A club staff member can moderate posts and members
// but cannot delete the club or manage other staff.

async function isClubStaff(clubId: string, userId: string): Promise<boolean> {
  const row = await ClubStaff.findOne({ clubId, userId, status: 'active' }).select('_id').lean();
  return !!row;
}

/** True if the viewer is the host OR an assigned club staff member. */
async function canModerateClub(club: any, viewer: any): Promise<boolean> {
  if (isHostOf(club, viewer)) return true;
  if (!viewer?.sub) return false;
  return isClubStaff(String(club._id), viewer.sub);
}

const clubStaffSchema = z.object({
  userId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  staffRole: z.string().max(30).optional(),
});

// GET /clubs/:id/staff
export async function getClubStaff(c: any) {
  const club = await loadClub(c.req.param('id'));
  if (!club) return c.json({ error: { code: 'NOT_FOUND', message: 'Club not found' } }, 404);
  const user = c.get('user');
  if (!isHostOf(club, user) && !hasPermission(user, 'player.clubs.moderate')) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Only the host can view club staff' } }, 403);
  }
  const rows = await ClubStaff.find({ clubId: club._id, status: 'active' })
    .populate('userId', 'displayName email avatarUrl')
    .sort({ createdAt: -1 })
    .lean();
  return c.json({ data: rows.map((r: any) => ({
    id: String(r._id),
    userId: String(r.userId?._id ?? r.userId),
    displayName: r.userId?.displayName ?? null,
    email: r.userId?.email ?? null,
    avatarUrl: r.userId?.avatarUrl ?? null,
    staffRole: r.staffRole || 'moderator',
    createdAt: r.createdAt,
  })) });
}

// POST /clubs/:id/staff
export async function addClubStaff(c: any) {
  const club = await loadClub(c.req.param('id'));
  if (!club) return c.json({ error: { code: 'NOT_FOUND', message: 'Club not found' } }, 404);
  const user = c.get('user');
  if (!isHostOf(club, user) && !hasPermission(user, 'owner.staff.manage')) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Only the host can add club staff' } }, 403);
  }
  const body = clubStaffSchema.parse(await c.req.json());
  const target = await User.findById(body.userId).select('_id').lean();
  if (!target) return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);
  // Prevent adding the host themselves as staff
  if (String(club.hostId?._id ?? club.hostId) === body.userId) {
    return c.json({ error: { code: 'BAD_REQUEST', message: 'The host is already the owner' } }, 400);
  }
  const existing = await ClubStaff.findOne({ clubId: club._id, userId: body.userId });
  if (existing) {
    if (existing.status === 'active') {
      return c.json({ error: { code: 'CONFLICT', message: 'Already a staff member' } }, 409);
    }
    existing.status = 'active';
    existing.staffRole = body.staffRole || existing.staffRole;
    await existing.save();
    return c.json({ data: { id: existing._id, userId: body.userId, staffRole: existing.staffRole } });
  }
  const row = await ClubStaff.create({
    clubId: club._id,
    userId: body.userId,
    staffRole: body.staffRole || 'moderator',
    status: 'active',
  });
  return c.json({ data: { id: row._id, userId: body.userId, staffRole: row.staffRole } }, 201);
}

// DELETE /clubs/staff/:id
export async function removeClubStaff(c: any) {
  const staffId = c.req.param('id');
  if (!objectId.safeParse(staffId).success) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Staff assignment not found' } }, 404);
  }
  const row = await ClubStaff.findById(staffId);
  if (!row) return c.json({ error: { code: 'NOT_FOUND', message: 'Staff assignment not found' } }, 404);
  const club = await Club.findById(row.clubId).select('hostId').lean();
  const user = c.get('user');
  if (!isHostOf(club, user) && !hasPermission(user, 'owner.staff.manage')) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Only the host can remove club staff' } }, 403);
  }
  row.status = 'inactive';
  await row.save();
  return c.json({ data: { ok: true } });
}
