import { z } from 'zod';
import { streamSSE } from 'hono/streaming';
import { Review, ReviewReply, ReviewReport, Favorite, Notification, ContentReport } from './interactions.model.js';
import { Venue } from '../venues/venues.model.js';
import { verifyToken } from '../../shared/lib/jwt.js';
import { subscribeUser } from '../../shared/lib/userEvents.js';

const createReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  text: z.string().min(1).max(5000).optional(),
  visitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const addFavoriteSchema = z.object({
  favoritableType: z.enum(['venue', 'coach', 'tournament', 'event']),
  favoritableId: z.string(),
});

const replySchema = z.object({ text: z.string().min(1).max(5000) });

const readStateSchema = z.object({ isRead: z.boolean().optional() });
const reportContentSchema = z.object({ reason: z.string().max(500).optional() });

const reportSchema = z.object({
  reason: z.enum(['inappropriate', 'spam', 'fake', 'offensive', 'other']),
  details: z.string().max(2000).optional(),
});

async function resolveVenueId(id: string): Promise<string | null> {
  const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);
  const venue = isObjectId ? await Venue.findById(id).select('_id') : await Venue.findOne({ slug: id }).select('_id');
  return venue ? venue._id.toString() : null;
}

async function assertVenueOwner(c: any, venueId: string): Promise<boolean> {
  const user = c.get('user');
  const venue = await Venue.findById(venueId).select('ownerUserId').lean();
  if (!venue || venue.ownerUserId?.toString() !== user.sub) return false;
  return true;
}

export async function createVenueReview(c: any) {
  const user = c.get('user');
  const venueId = await resolveVenueId(c.req.param('id'));
  if (!venueId) return c.json({ error: { code: 'NOT_FOUND', message: 'Venue not found' } }, 404);
  const existing = await Review.findOne({ venueId, userId: user.sub }).lean();
  if (existing) return c.json({ error: { code: 'CONFLICT', message: 'You have already reviewed this venue' } }, 409);
  const body = createReviewSchema.parse(await c.req.json());
  const result = await Review.create({ venueId, userId: user.sub, rating: body.rating, text: body.text || null, visitDate: body.visitDate || null, status: 'approved' });
  return c.json({ data: result.toObject() }, 201);
}

export async function updateReview(c: any) {
  const user = c.get('user'); const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const allowed: Record<string, unknown> = {};
  if (body.rating !== undefined) allowed.rating = body.rating;
  if (body.text !== undefined) allowed.text = body.text;
  if (!Object.keys(allowed).length) return c.json({ error: { code: 'BAD_REQUEST', message: 'No valid fields' } }, 400);
  const result = await Review.findOneAndUpdate({ _id: id, userId: user.sub }, allowed, { new: true }).lean();
  if (!result) return c.json({ error: { code: 'NOT_FOUND', message: 'Review not found' } }, 404);
  return c.json({ data: { ...result, id: result._id } });
}

export async function deleteReview(c: any) {
  const user = c.get('user'); const id = c.req.param('id');
  const result = await Review.findOneAndDelete({ _id: id, userId: user.sub });
  if (!result) return c.json({ error: { code: 'NOT_FOUND', message: 'Review not found' } }, 404);
  return c.json({ data: { message: 'Review deleted' } });
}

export async function listFavorites(c: any) {
  const user = c.get('user'); const type = c.req.query('type');
  const filter: Record<string, any> = { userId: user.sub };
  if (type) filter.favoritableType = type;
  const rows = await Favorite.find(filter).sort({ createdAt: -1 }).lean();
  return c.json({ data: rows.map((r: any) => ({ ...r, id: r._id })) });
}

export async function addFavorite(c: any) {
  const user = c.get('user');
  const body = addFavoriteSchema.parse(await c.req.json());
  const result = await Favorite.create({ userId: user.sub, favoritableType: body.favoritableType, favoritableId: body.favoritableId });
  return c.json({ data: result.toObject() }, 201);
}

export async function removeFavorite(c: any) {
  const user = c.get('user'); const id = c.req.param('id');
  const result = await Favorite.findOneAndDelete({ _id: id, userId: user.sub });
  if (!result) return c.json({ error: { code: 'NOT_FOUND', message: 'Favorite not found' } }, 404);
  return c.json({ data: { message: 'Favorite removed' } });
}

export async function listNotifications(c: any) {
  const user = c.get('user');
  const rows = await Notification.find({ userId: user.sub }).sort({ createdAt: -1 }).limit(50).lean();
  return c.json({ data: rows.map((r: any) => ({ ...r, id: r._id })) });
}

/** Lightweight unread tally for the live badge — cheap to poll on an interval. */
export async function unreadNotificationCount(c: any) {
  const user = c.get('user');
  const count = await Notification.countDocuments({ userId: user.sub, isRead: false });
  return c.json({ data: { count } });
}

// PATCH /notifications/:id — flip a notification's read state. The body is
// optional and defaults to `{ isRead: true }`, so the long-standing
// "mark this read" callers (which send `{}`) are unchanged; passing
// `{ isRead: false }` marks it unread again.
export async function markNotificationRead(c: any) {
  const user = c.get('user'); const id = c.req.param('id');
  const body = readStateSchema.parse(await c.req.json().catch(() => ({})));
  const isRead = body.isRead ?? true;
  const result = await Notification.findOneAndUpdate({ _id: id, userId: user.sub }, { isRead }, { new: true }).lean();
  if (!result) return c.json({ error: { code: 'NOT_FOUND', message: 'Notification not found' } }, 404);
  return c.json({ data: { ...result, id: result._id } });
}

export async function markAllNotificationsRead(c: any) {
  const user = c.get('user');
  await Notification.updateMany({ userId: user.sub, isRead: false }, { isRead: true });
  return c.json({ data: { message: 'All notifications marked as read' } });
}

// POST /notifications/:id/report — flag a notification for moderation review
// (its content came from another user — a chat, a club post, an invite).
// Self-scoped: you can only report a notification addressed to you.
export async function reportNotification(c: any) {
  const user = c.get('user');
  const id = c.req.param('id');
  const notif = await Notification.findOne({ _id: id, userId: user.sub }).select('_id').lean();
  if (!notif) return c.json({ error: { code: 'NOT_FOUND', message: 'Notification not found' } }, 404);
  const body = reportContentSchema.parse(await c.req.json().catch(() => ({})));
  await ContentReport.updateOne(
    { userId: user.sub, targetType: 'notification', targetId: (notif as any)._id },
    { $set: { reason: body.reason ?? null, status: 'pending' }, $unset: { resolvedBy: '' } },
    { upsert: true },
  );
  return c.json({ data: { reported: true } });
}

export async function deleteNotification(c: any) {
  const user = c.get('user');
  const id = c.req.param('id');
  const result = await Notification.findOneAndDelete({ _id: id, userId: user.sub }).lean();
  if (!result) return c.json({ error: { code: 'NOT_FOUND', message: 'Notification not found' } }, 404);
  return c.json({ data: { id } });
}

/* ─── SSE realtime stream (per user) ──────────────────────────────── */

// GET /api/v1/me/stream — a single per-user event stream carrying realtime
// `notification.created` (any new notification: messages, invites, tournaments,
// game-full, …) and `message.created` (an incoming direct message, so an open
// chat updates live). NOT behind requireAuth: native EventSource can't set an
// Authorization header, so the access token arrives as ?token= and is verified
// inline here (mirrors clubs' streamClub). Self-scoped — a user only ever
// receives their own events.
export async function streamUserEvents(c: any) {
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
  const userId = String(payload.sub);

  // Defeat proxy/middleware buffering of the event stream.
  c.header('X-Accel-Buffering', 'no');
  c.header('Cache-Control', 'no-cache');
  c.header('Connection', 'keep-alive');

  return streamSSE(c, async (stream) => {
    const unsubscribe = subscribeUser(userId, (e) => {
      stream.writeSSE({ event: e.event, data: JSON.stringify(e.data) }).catch(() => {});
    });
    const heartbeat = setInterval(() => {
      stream.writeSSE({ event: 'ping', data: String(Date.now()) }).catch(() => {});
    }, 25_000);
    await stream.writeSSE({ event: 'ready', data: JSON.stringify({ userId }) });
    // Hold the connection open until the client disconnects; clean up the
    // listener + heartbeat so neither leaks per reconnect.
    await new Promise<void>((resolve) => {
      stream.onAbort(() => { unsubscribe(); clearInterval(heartbeat); resolve(); });
    });
  });
}

export async function createReviewReply(c: any) {
  const reviewId = c.req.param('id');
  const review = await Review.findById(reviewId).select('venueId').lean();
  if (!review) return c.json({ error: { code: 'NOT_FOUND', message: 'Review not found' } }, 404);
  if (!(await assertVenueOwner(c, review.venueId.toString()))) return c.json({ error: { code: 'FORBIDDEN', message: 'Only the venue owner can reply' } }, 403);
  const existing = await ReviewReply.findOne({ reviewId }).lean();
  if (existing) return c.json({ error: { code: 'CONFLICT', message: 'A reply already exists for this review' } }, 409);
  const user = c.get('user'); const body = replySchema.parse(await c.req.json());
  const result = await ReviewReply.create({ reviewId, venueId: review.venueId, replierUserId: user.sub, text: body.text });
  return c.json({ data: result.toObject() }, 201);
}

export async function updateReviewReply(c: any) {
  const reviewId = c.req.param('id');
  const reply = await ReviewReply.findOne({ reviewId }).lean();
  if (!reply) return c.json({ error: { code: 'NOT_FOUND', message: 'Reply not found' } }, 404);
  if (!(await assertVenueOwner(c, reply.venueId.toString()))) return c.json({ error: { code: 'FORBIDDEN', message: 'Only the venue owner can update this reply' } }, 403);
  const body = replySchema.parse(await c.req.json());
  const result = await ReviewReply.findOneAndUpdate({ reviewId }, { text: body.text }, { new: true }).lean();
  return c.json({ data: { ...result, id: result!._id } });
}

export async function deleteReviewReply(c: any) {
  const reviewId = c.req.param('id');
  const reply = await ReviewReply.findOne({ reviewId }).lean();
  if (!reply) return c.json({ error: { code: 'NOT_FOUND', message: 'Reply not found' } }, 404);
  if (!(await assertVenueOwner(c, reply.venueId.toString()))) return c.json({ error: { code: 'FORBIDDEN', message: 'Only the venue owner can delete this reply' } }, 403);
  await ReviewReply.findOneAndDelete({ reviewId });
  return c.json({ data: { message: 'Reply deleted' } });
}

export async function reportReview(c: any) {
  const user = c.get('user'); const reviewId = c.req.param('id');
  const review = await Review.findById(reviewId).select('_id').lean();
  if (!review) return c.json({ error: { code: 'NOT_FOUND', message: 'Review not found' } }, 404);
  const existing = await ReviewReport.findOne({ reviewId, reporterUserId: user.sub }).lean();
  if (existing) return c.json({ error: { code: 'CONFLICT', message: 'You have already reported this review' } }, 409);
  const body = reportSchema.parse(await c.req.json());
  const result = await ReviewReport.create({ reviewId, reporterUserId: user.sub, reason: body.reason, details: body.details || null });
  return c.json({ data: result.toObject() }, 201);
}
