import { z } from 'zod';
import { FeedPost, FeedPostReaction } from './feed.model.js';
import { Game } from '../games/games.model.js';
import { OpenPlaySession } from '../content/content.model.js';
import { Club } from '../clubs/clubs.model.js';
import { notifyUsers } from '../../shared/lib/notify.js';
import { withCursor, nextCursor, SORT_NEWEST } from '../../shared/lib/cursor.js';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/);
const PERSON_SELECT = 'displayName avatarUrl';
const VENUE_SELECT = 'displayName area city mainImageUrl';

/* ─── Schemas ─────────────────────────────────────────────────────── */

const feedQuery = z.object({
  pageSize: z.coerce.number().int().min(1).max(50).optional().default(20),
  cursor: z.string().optional(),
});

const attachmentInput = z.object({
  type: z.enum(['game', 'open_play', 'club']),
  refId: objectId,
});

const createPostSchema = z.object({
  body: z.string().max(8000).optional(),
  parentPostId: objectId.optional(),
  sharedPostId: objectId.optional(),
  attachment: attachmentInput.optional(),
}).refine(
  (b) => (b.body && b.body.trim().length > 0) || !!b.attachment || !!b.sharedPostId,
  { message: 'A post needs text, an attachment, or a repost' },
);

const editPostSchema = z.object({ body: z.string().max(8000).optional() });

/* ─── Helpers ─────────────────────────────────────────────────────── */

const GAME_TYPE_LABEL: Record<string, string> = {
  singles: 'Singles', doubles: 'Doubles', open: 'Open Play', public: 'Public',
};

function refPerson(p: any) {
  return p && typeof p === 'object'
    ? { id: String(p._id), displayName: p.displayName ?? null, avatarUrl: p.avatarUrl ?? null }
    : { id: String(p), displayName: null, avatarUrl: null };
}

function venueLine(v: any): string | null {
  if (!v) return null;
  return [v.displayName, v.area || v.city].filter(Boolean).join(' · ') || null;
}

/**
 * Snapshot a public Game / OpenPlaySession / Club into a denormalized share
 * card. Server-authoritative (client only sends `{ type, refId }`), so a feed
 * page renders without extra look-ups and the card text can't be spoofed.
 * Returns null when the entity is missing/deleted (post is rejected 404).
 */
async function enrichAttachment(input: { type: string; refId: string }): Promise<any | null> {
  if (input.type === 'game') {
    const g: any = await Game.findById(input.refId).populate('venueId', VENUE_SELECT).lean();
    if (!g || g.status === 'cancelled') return null;
    const v = g.venueId && typeof g.venueId === 'object' ? g.venueId : null;
    const capacity = g.capacity ?? 4;
    return {
      type: 'game',
      refId: g._id,
      title: g.title || 'Game',
      subtitle: g.description || null,
      imageUrl: v?.mainImageUrl || null,
      gameType: GAME_TYPE_LABEL[g.gameType] || 'Game',
      skillLabel: g.skillLabel || null,
      dateTime: [g.whenLabel, g.timeLabel].filter(Boolean).join(' · ') || null,
      venue: venueLine(v) || g.venueName || null,
      spotsLeft: Math.max(0, capacity - (g.participantIds?.length ?? 0)),
      capacity,
    };
  }
  if (input.type === 'open_play') {
    const s: any = await OpenPlaySession.findById(input.refId).populate('venueId', VENUE_SELECT).lean();
    if (!s || s.status === 'cancelled') return null;
    const v = s.venueId && typeof s.venueId === 'object' ? s.venueId : null;
    const capacity = s.capacity ?? 0;
    return {
      type: 'open_play',
      refId: s._id,
      title: s.title || 'Open Play',
      subtitle: null,
      imageUrl: v?.mainImageUrl || null,
      gameType: 'Open Play',
      skillLabel: s.levelLabel || null,
      dateTime: [s.date, s.startTime].filter(Boolean).join(' · ') || null,
      venue: venueLine(v),
      spotsLeft: capacity ? Math.max(0, capacity - (s.joinedCount ?? 0)) : undefined,
      capacity: capacity || undefined,
    };
  }
  // club
  const cl: any = await Club.findById(input.refId).lean();
  if (!cl || cl.isDeleted || cl.visibility !== 'public') return null;
  return {
    type: 'club',
    refId: cl._id,
    title: cl.name,
    subtitle: cl.description || null,
    imageUrl: cl.coverImageUrl || null,
    memberCount: cl.memberCount ?? 0,
  };
}

function serializeAttachment(a: any) {
  return {
    type: a.type,
    refId: String(a.refId),
    title: a.title ?? null,
    subtitle: a.subtitle ?? null,
    imageUrl: a.imageUrl ?? null,
    gameType: a.gameType ?? null,
    skillLabel: a.skillLabel ?? null,
    dateTime: a.dateTime ?? null,
    venue: a.venue ?? null,
    spotsLeft: a.spotsLeft ?? null,
    capacity: a.capacity ?? null,
    memberCount: a.memberCount ?? null,
  };
}

/** A shallow view of a reposted post (no nested repost — one level only). */
function sharedSnapshot(sp: any) {
  if (!sp) return null;
  const author = sp.authorId ? refPerson(sp.authorId) : null;
  return {
    id: String(sp._id),
    author,
    authorId: author ? author.id : String(sp.authorId),
    body: sp.isDeleted ? null : (sp.body ?? ''),
    attachments: sp.isDeleted ? [] : (sp.attachments ?? []).map(serializeAttachment),
    isDeleted: !!sp.isDeleted,
    createdAt: sp.createdAt,
  };
}

function serializePost(p: any, viewerReacted = false, sharedSnap: any = null) {
  const author = p.authorId ? refPerson(p.authorId) : null;
  return {
    id: String(p._id),
    parentPostId: p.parentPostId ? String(p.parentPostId) : null,
    rootPostId: p.rootPostId ? String(p.rootPostId) : null,
    authorId: author ? author.id : String(p.authorId),
    author,
    body: p.isDeleted ? null : (p.body ?? ''),
    attachments: p.isDeleted ? [] : (p.attachments ?? []).map(serializeAttachment),
    sharedPostId: p.sharedPostId ? String(p.sharedPostId) : null,
    sharedPost: p.isDeleted ? null : sharedSnap,
    reactionCount: p.reactionCount ?? 0,
    replyCount: p.replyCount ?? 0,
    isDeleted: !!p.isDeleted,
    viewerReacted: !!viewerReacted,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

/** Set of post ids the viewer has reacted to, for a page of posts. */
async function reactedSet(postIds: any[], userId?: string | null): Promise<Set<string>> {
  if (!userId || !postIds.length) return new Set();
  const rows = await FeedPostReaction.find({ postId: { $in: postIds }, userId }).select('postId').lean();
  return new Set(rows.map((r: any) => String(r.postId)));
}

/** postId → shared-post snapshot, batch-loaded for a page of posts. */
async function sharedSnapMap(rows: any[]): Promise<Map<string, any>> {
  const ids = [...new Set(rows.map((r) => r.sharedPostId && String(r.sharedPostId)).filter(Boolean))] as string[];
  if (!ids.length) return new Map();
  const shared = await FeedPost.find({ _id: { $in: ids } }).populate('authorId', PERSON_SELECT).lean();
  return new Map(shared.map((s: any) => [String(s._id), sharedSnapshot(s)]));
}

/* ─── Feed read ───────────────────────────────────────────────────── */

// GET /api/v1/feed — the global top-level feed, newest first (cursor).
export async function listFeed(c: any) {
  const user = c.get('user');
  const q = feedQuery.parse(c.req.query());
  const filter = withCursor({ parentPostId: null, isDeleted: false }, q.cursor);
  const rows = await FeedPost.find(filter)
    .populate('authorId', PERSON_SELECT)
    .sort(SORT_NEWEST)
    .limit(q.pageSize + 1)
    .lean();
  const hasMore = rows.length > q.pageSize;
  if (hasMore) rows.pop();
  const [reacted, snaps] = await Promise.all([
    reactedSet(rows.map((r: any) => r._id), user?.sub),
    sharedSnapMap(rows),
  ]);
  const data = rows.map((p: any) =>
    serializePost(p, reacted.has(String(p._id)), p.sharedPostId ? snaps.get(String(p.sharedPostId)) : null));
  return c.json({ data, meta: { total: data.length, cursor: nextCursor(rows as any, hasMore) } });
}

// GET /api/v1/feed/posts/:postId — a single post + its first page of replies.
export async function getPost(c: any) {
  const user = c.get('user');
  const post = await FeedPost.findById(c.req.param('postId')).populate('authorId', PERSON_SELECT).lean();
  if (!post) return c.json({ error: { code: 'NOT_FOUND', message: 'Post not found' } }, 404);
  const q = feedQuery.parse(c.req.query());
  const replyFilter = withCursor({ parentPostId: (post as any)._id, isDeleted: false }, q.cursor);
  const replies = await FeedPost.find(replyFilter)
    .populate('authorId', PERSON_SELECT).sort(SORT_NEWEST).limit(q.pageSize + 1).lean();
  const hasMore = replies.length > q.pageSize;
  if (hasMore) replies.pop();
  const all = [post, ...replies];
  const [reacted, snaps] = await Promise.all([
    reactedSet(all.map((r: any) => r._id), user?.sub),
    sharedSnapMap(all),
  ]);
  const view = (p: any) => serializePost(p, reacted.has(String(p._id)), p.sharedPostId ? snaps.get(String(p.sharedPostId)) : null);
  return c.json({
    data: {
      post: view(post),
      replies: replies.map(view),
      meta: { cursor: nextCursor(replies as any, hasMore) },
    },
  });
}

// GET /api/v1/feed/posts/:postId/replies — comments (cursor).
export async function listReplies(c: any) {
  const user = c.get('user');
  const q = feedQuery.parse(c.req.query());
  const filter = withCursor({ parentPostId: c.req.param('postId'), isDeleted: false }, q.cursor);
  const rows = await FeedPost.find(filter)
    .populate('authorId', PERSON_SELECT).sort(SORT_NEWEST).limit(q.pageSize + 1).lean();
  const hasMore = rows.length > q.pageSize;
  if (hasMore) rows.pop();
  const [reacted, snaps] = await Promise.all([
    reactedSet(rows.map((r: any) => r._id), user?.sub),
    sharedSnapMap(rows),
  ]);
  const data = rows.map((p: any) =>
    serializePost(p, reacted.has(String(p._id)), p.sharedPostId ? snaps.get(String(p.sharedPostId)) : null));
  return c.json({ data, meta: { total: data.length, cursor: nextCursor(rows as any, hasMore) } });
}

/* ─── Feed write ──────────────────────────────────────────────────── */

// POST /api/v1/feed/posts — create a post, reply, repost, or share card.
export async function createPost(c: any) {
  const user = c.get('user');
  const body = createPostSchema.parse(await c.req.json());

  // A reply targets an existing, non-deleted post.
  let parent: any = null;
  if (body.parentPostId) {
    parent = await FeedPost.findOne({ _id: body.parentPostId, isDeleted: false }).lean();
    if (!parent) return c.json({ error: { code: 'NOT_FOUND', message: 'Parent post not found' } }, 404);
  }

  // A repost quotes an existing, non-deleted post (one level — never a repost of a repost).
  let shared: any = null;
  if (body.sharedPostId) {
    shared = await FeedPost.findOne({ _id: body.sharedPostId, isDeleted: false }).lean();
    if (!shared) return c.json({ error: { code: 'NOT_FOUND', message: 'Shared post not found' } }, 404);
  }

  // Enrich the optional share card server-side.
  let attachments: any[] = [];
  if (body.attachment) {
    const card = await enrichAttachment(body.attachment);
    if (!card) return c.json({ error: { code: 'NOT_FOUND', message: 'Shared item not found' } }, 404);
    attachments = [card];
  }

  const post = await FeedPost.create({
    authorId: user.sub,
    parentPostId: parent ? parent._id : null,
    rootPostId: parent ? (parent.rootPostId || parent._id) : null,
    body: body.body?.trim() || null,
    attachments,
    sharedPostId: shared ? shared._id : null,
  });

  if (parent) await FeedPost.updateOne({ _id: parent._id }, { $inc: { replyCount: 1 } });

  const populated = await FeedPost.findById(post._id).populate('authorId', PERSON_SELECT).lean();
  const snap = shared ? sharedSnapshot(await FeedPost.findById(shared._id).populate('authorId', PERSON_SELECT).lean()) : null;
  const view = serializePost(populated, false, snap);

  // Notify the relevant author (never self). Top-level plain posts fan out to
  // nobody — the global feed has no membership to notify.
  if (parent && String(parent.authorId) !== user.sub) {
    await notifyUsers([parent.authorId], {
      type: 'feed_reply', title: 'New reply', body: 'Someone replied to your post.',
      icon: 'reply', linkUrl: `/feed/${parent._id}`,
    });
  }
  if (shared && String(shared.authorId) !== user.sub) {
    await notifyUsers([shared.authorId], {
      type: 'feed_repost', title: 'Your post was shared', body: 'Someone reposted your post.',
      icon: 'repeat', linkUrl: `/feed/${post._id}`,
    });
  }
  return c.json({ data: view }, 201);
}

// PATCH /api/v1/feed/posts/:postId — edit body (author-only).
export async function editPost(c: any) {
  const user = c.get('user');
  const post = await FeedPost.findOne({ _id: c.req.param('postId'), isDeleted: false });
  if (!post) return c.json({ error: { code: 'NOT_FOUND', message: 'Post not found' } }, 404);
  if (String(post.authorId) !== user.sub) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Only the author can edit this post' } }, 403);
  }
  const body = editPostSchema.parse(await c.req.json());
  if (body.body !== undefined) post.body = (body.body.trim() || null) as any;
  await post.save();
  const populated = await FeedPost.findById(post._id).populate('authorId', PERSON_SELECT).lean();
  const snap = (populated as any)?.sharedPostId
    ? sharedSnapshot(await FeedPost.findById((populated as any).sharedPostId).populate('authorId', PERSON_SELECT).lean())
    : null;
  return c.json({ data: serializePost(populated, false, snap) });
}

// DELETE /api/v1/feed/posts/:postId — soft-delete (author-only).
export async function deletePost(c: any) {
  const user = c.get('user');
  const post = await FeedPost.findById(c.req.param('postId')).lean();
  if (!post) return c.json({ error: { code: 'NOT_FOUND', message: 'Post not found' } }, 404);
  if (String((post as any).authorId) !== user.sub) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Only the author can delete this post' } }, 403);
  }
  // Gate on the isDeleted transition so a repeated DELETE never double-decrements.
  const res = await FeedPost.updateOne({ _id: (post as any)._id, isDeleted: false }, { $set: { isDeleted: true } });
  if (res.modifiedCount && (post as any).parentPostId) {
    await FeedPost.updateOne({ _id: (post as any).parentPostId }, { $inc: { replyCount: -1 } });
  }
  return c.json({ data: { id: String((post as any)._id), deleted: true } });
}

// POST /api/v1/feed/posts/:postId/react — like (idempotent).
export async function reactPost(c: any) {
  const user = c.get('user');
  const post = await FeedPost.findOne({ _id: c.req.param('postId'), isDeleted: false }).lean();
  if (!post) return c.json({ error: { code: 'NOT_FOUND', message: 'Post not found' } }, 404);

  const result = await FeedPostReaction.updateOne(
    { postId: (post as any)._id, userId: user.sub },
    { $setOnInsert: { type: 'like' } },
    { upsert: true },
  );
  const inserted = result.upsertedCount === 1;
  if (inserted) await FeedPost.updateOne({ _id: (post as any)._id }, { $inc: { reactionCount: 1 } });
  const fresh = await FeedPost.findById((post as any)._id).select('reactionCount').lean();
  const reactionCount = (fresh as any)?.reactionCount ?? 0;

  if (inserted && String((post as any).authorId) !== user.sub) {
    await notifyUsers([(post as any).authorId], {
      type: 'feed_like', title: 'Someone liked your post', body: 'Your post got a like.',
      icon: 'favorite', linkUrl: `/feed/${(post as any)._id}`,
    });
  }
  return c.json({ data: { reacted: true, reactionCount } });
}

// DELETE /api/v1/feed/posts/:postId/react — unlike.
export async function unreactPost(c: any) {
  const user = c.get('user');
  const post = await FeedPost.findById(c.req.param('postId')).lean();
  if (!post) return c.json({ error: { code: 'NOT_FOUND', message: 'Post not found' } }, 404);
  const res = await FeedPostReaction.deleteOne({ postId: (post as any)._id, userId: user.sub });
  if (res.deletedCount) await FeedPost.updateOne({ _id: (post as any)._id }, { $inc: { reactionCount: -1 } });
  const fresh = await FeedPost.findById((post as any)._id).select('reactionCount').lean();
  const reactionCount = (fresh as any)?.reactionCount ?? 0;
  return c.json({ data: { reacted: false, reactionCount } });
}
