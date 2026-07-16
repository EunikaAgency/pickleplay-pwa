import { z } from 'zod';
import { User } from '../auth/auth.model.js';
import { Venue } from '../venues/venues.model.js';
import { Review, ReviewReport } from '../interactions/interactions.model.js';
import { FeedReport, FeedPost } from '../feed/feed.model.js';
import { VenueClaim, SuggestedEdit } from '../venues/venue-management.model.js';
import { Subscription, AuditLog } from '../subscriptions/subscriptions.model.js';
import { Booking } from '../bookings/bookings.model.js';
import { hasPermission } from '../../shared/lib/permissions.js';

const listUsersQuery = z.object({
  search: z.string().optional(), role: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(500).optional().default(20),
});

const updateUserSchema = z.object({
  roleDefault: z.string().max(30).optional(), isVerified: z.boolean().optional(), displayName: z.string().max(100).optional(),
});

const moderateReviewSchema = z.object({ status: z.enum(['approved', 'rejected', 'hidden']) });

const resolveReportSchema = z.object({ status: z.enum(['resolved', 'dismissed']) });

export async function requireAdmin(c: any, next: any) {
  const user = c.get('user');
  if (!hasPermission(user, 'admin.access')) return c.json({ error: { code: 'FORBIDDEN', message: 'Admin access required' } }, 403);
  await next();
}

export async function getDashboard(c: any) {
  const [userCount, venueCount, pendingReviewCount, unclaimedVenueCount,
    pendingReportCount, pendingClaimCount, pendingEditCount, bookingCount, pendingPostReportCount] = await Promise.all([
    User.countDocuments(), Venue.countDocuments(), Review.countDocuments({ status: 'pending_moderation' }),
    Venue.countDocuments({ state: 'unclaimed' }), ReviewReport.countDocuments({ status: 'pending' }),
    VenueClaim.countDocuments({ status: 'pending' }), SuggestedEdit.countDocuments({ status: 'pending' }),
    Booking.countDocuments(), FeedReport.countDocuments({ status: 'pending' }),
  ]);
  return c.json({ data: { totalUsers: userCount, totalVenues: venueCount, pendingReviews: pendingReviewCount, unclaimedVenues: unclaimedVenueCount, pendingReports: pendingReportCount, pendingClaims: pendingClaimCount, pendingEdits: pendingEditCount, totalBookings: bookingCount, pendingPostReports: pendingPostReportCount } });
}

export async function listUsers(c: any) {
  const { search, role, page, pageSize } = listUsersQuery.parse(c.req.query());
  const filter: Record<string, any> = {};
  if (search) { const r = new RegExp(search, 'i'); filter.$or = [{ displayName: r }, { email: r }]; }
  if (role) filter.roleDefault = role;
  const offset = (page - 1) * pageSize;
  const [rows, total] = await Promise.all([
    User.find(filter).select('email displayName roleDefault isVerified lastLoginAt createdAt').sort({ createdAt: -1 }).skip(offset).limit(pageSize).lean(),
    User.countDocuments(filter),
  ]);
  return c.json({ data: rows.map((r: any) => ({ ...r, id: r._id })), meta: { total, page, pageSize } });
}

// Venue owners with the venues they own. The owner↔venue link lives on
// Venue.ownerUserId, so the join has to happen here — the public venues list
// doesn't expose ownerUserId.
export async function listOwners(c: any) {
  const search = c.req.query('search');
  const filter: Record<string, any> = { roleDefault: 'owner' };
  if (search) { const r = new RegExp(search, 'i'); filter.$or = [{ displayName: r }, { email: r }]; }

  const owners = await User.find(filter)
    .select('email displayName roleDefault isVerified lastLoginAt createdAt')
    .sort({ createdAt: -1 })
    .lean();

  const ownerIds = owners.map((o: any) => o._id);
  const venues = ownerIds.length
    ? await Venue.find({ ownerUserId: { $in: ownerIds } })
        .select('displayName slug area region ownerUserId')
        .lean()
    : [];

  const byOwner: Record<string, any[]> = {};
  for (const v of venues as any[]) {
    const key = v.ownerUserId?.toString();
    if (!key) continue;
    (byOwner[key] ||= []).push({ id: v._id, name: v.displayName, slug: v.slug, area: v.area || v.region || '' });
  }

  const data = owners.map((o: any) => ({ ...o, id: o._id, venues: byOwner[o._id.toString()] || [] }));
  return c.json({ data, meta: { total: data.length } });
}

export async function updateUser(c: any) {
  const id = c.req.param('id');
  const body = updateUserSchema.parse(await c.req.json());
  const result = await User.findByIdAndUpdate(id, body, { new: true }).select('email displayName').lean();
  if (!result) return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);
  return c.json({ data: { ...result, id: result._id } });
}

export async function listReviews(c: any) {
  const status = c.req.query('status') || 'pending_moderation';
  const rows = await Review.find({ status }).sort({ createdAt: -1 }).limit(50).lean();
  return c.json({ data: rows.map((r: any) => ({ ...r, id: r._id })) });
}

export async function moderateReview(c: any) {
  const user = c.get('user'); const id = c.req.param('id');
  const body = moderateReviewSchema.parse(await c.req.json());
  const result = await Review.findByIdAndUpdate(id, { status: body.status, moderatedBy: user.sub, moderatedAt: new Date() }, { new: true }).lean();
  if (!result) return c.json({ error: { code: 'NOT_FOUND', message: 'Review not found' } }, 404);
  return c.json({ data: { ...result, id: result._id } });
}

export async function listReports(c: any) {
  const status = c.req.query('status') || 'pending';
  const rows = await ReviewReport.find({ status }).sort({ createdAt: -1 }).limit(50).lean();
  return c.json({ data: rows.map((r: any) => ({ ...r, id: r._id })) });
}

export async function resolveReport(c: any) {
  const user = c.get('user'); const id = c.req.param('id');
  const body = resolveReportSchema.parse(await c.req.json());
  const result = await ReviewReport.findByIdAndUpdate(id, { status: body.status, resolvedBy: user.sub }, { new: true }).lean();
  if (!result) return c.json({ error: { code: 'NOT_FOUND', message: 'Report not found' } }, 404);
  return c.json({ data: { ...result, id: result._id } });
}

// GET /api/v1/admin/feed-reports — reported PickleFeed posts to triage. Each
// row carries the reported post (body/author/deleted) + the reporter, so an
// admin can judge without a second look-up.
export async function listFeedReports(c: any) {
  const status = c.req.query('status') || 'pending';
  const rows = await FeedReport.find({ status })
    .sort({ createdAt: -1 }).limit(100)
    .populate('userId', 'displayName')
    .populate({ path: 'postId', select: 'body authorId isDeleted attachments createdAt', populate: { path: 'authorId', select: 'displayName' } })
    .lean();
  const data = rows.map((r: any) => {
    const post = r.postId && typeof r.postId === 'object' ? r.postId : null;
    const reporter = r.userId && typeof r.userId === 'object' ? r.userId : null;
    const author = post?.authorId && typeof post.authorId === 'object' ? post.authorId : null;
    return {
      id: String(r._id),
      reason: r.reason || null,
      status: r.status,
      createdAt: r.createdAt,
      reporter: reporter ? { id: String(reporter._id), displayName: reporter.displayName ?? null } : null,
      post: post ? {
        id: String(post._id),
        body: post.isDeleted ? null : (post.body ?? null),
        isDeleted: !!post.isDeleted,
        hasMedia: Array.isArray(post.attachments) && post.attachments.some((a: any) => a.type === 'image' || a.type === 'gif'),
        author: author ? { id: String(author._id), displayName: author.displayName ?? null } : null,
        createdAt: post.createdAt,
      } : null,
    };
  });
  return c.json({ data });
}

// PATCH /api/v1/admin/feed-reports/:id — resolve or dismiss a post report.
export async function resolveFeedReport(c: any) {
  const user = c.get('user'); const id = c.req.param('id');
  const body = resolveReportSchema.parse(await c.req.json());
  const result = await FeedReport.findByIdAndUpdate(id, { status: body.status, resolvedBy: user.sub }, { new: true }).lean();
  if (!result) return c.json({ error: { code: 'NOT_FOUND', message: 'Report not found' } }, 404);
  return c.json({ data: { ...result, id: (result as any)._id } });
}

export async function listAuditLogs(c: any) {
  const entityType = c.req.query('entityType'); const action = c.req.query('action');
  const filter: Record<string, any> = {};
  if (entityType) filter.entityType = entityType;
  if (action) filter.action = action;
  const rows = await AuditLog.find(filter).sort({ createdAt: -1 }).limit(100).lean();
  return c.json({ data: rows.map((r: any) => ({ ...r, id: r._id })) });
}

export async function listSubscriptions(c: any) {
  const status = c.req.query('status') || 'active';
  const rows = await Subscription.find({ status }).sort({ createdAt: -1 }).limit(200).lean();
  return c.json({ data: rows.map((r: any) => ({ ...r, id: r._id })) });
}
