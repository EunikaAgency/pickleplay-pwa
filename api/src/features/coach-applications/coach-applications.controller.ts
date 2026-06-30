import { z } from 'zod';
import { CoachApplication } from './coach-applications.model.js';
import { Venue } from '../venues/venues.model.js';
import { Coach } from '../coaches/coaches.model.js';
import { User } from '../auth/auth.model.js';
import { resolveVenueId } from '../venues/venues.controller.js';
import { hasPermission } from '../../shared/lib/permissions.js';

// Coach submits + reads their own applications.
const COACH_PERM = 'coach.applications.manage' as const;
// Owner reviews applications for venues they own.
const OWNER_PERM = 'owner.coaches.manage' as const;
// Admins manage any venue.
const ADMIN_PERM = 'admin.venues.manage' as const;

const submitSchema = z.object({
  venueId: z.string().min(1), // accepts a venue slug or _id
  message: z.string().max(2000).optional(),
});

/* ─── Shaping helpers ─────────────────────────────────────────────── */

function venueView(v: any) {
  if (!v) return null;
  return {
    id: v._id,
    name: v.displayName,
    slug: v.slug,
    location: v.area || v.region || v.fullAddress || '',
    image: v.mainImageUrl || null,
  };
}

// Resolve the applying user's identity + linked coach profile (if any) so the
// stored application can snapshot the coach profile id.
async function findCoachProfile(userId: string) {
  const user = await User.findById(userId).select('coachId managedCoachId').lean();
  const linked = [user?.coachId, user?.managedCoachId].filter(Boolean);
  const or: Record<string, any>[] = [{ userId }];
  if (linked.length) or.push({ _id: { $in: linked } });
  return Coach.findOne({ $or: or }).select('_id').lean();
}

// Batch-build the owner-facing view: coach identity (Coach profile preferred,
// else the user account) + venue. One User + one Coach query for the whole set.
async function shapeOwnerApps(apps: any[]) {
  const userIds = [...new Set(apps.map((a) => a.coachUserId?.toString()).filter(Boolean))];
  const coachIds = [...new Set(apps.map((a) => a.coachId?.toString()).filter(Boolean))];
  const [users, coaches] = await Promise.all([
    userIds.length ? User.find({ _id: { $in: userIds } }).select('displayName avatarUrl').lean() : [],
    coachIds.length ? Coach.find({ _id: { $in: coachIds } }).select('displayName slug avatarUrl imageUrl').lean() : [],
  ]);
  const userById = new Map((users as any[]).map((u) => [u._id.toString(), u]));
  const coachById = new Map((coaches as any[]).map((cc) => [cc._id.toString(), cc]));

  return apps.map((a: any) => {
    const u = userById.get(a.coachUserId?.toString());
    const cc = a.coachId ? coachById.get(a.coachId.toString()) : null;
    return {
      id: a._id,
      status: a.status,
      createdAt: a.createdAt,
      decidedAt: a.decidedAt || null,
      coach: {
        userId: a.coachUserId,
        name: cc?.displayName || u?.displayName || 'Coach',
        slug: cc?.slug || null,
        avatar: cc?.avatarUrl || cc?.imageUrl || u?.avatarUrl || null,
      },
      venue: venueView(a.venueId),
    };
  });
}

async function ownsVenue(user: any, venueId: any): Promise<boolean> {
  if (hasPermission(user, ADMIN_PERM)) return true;
  const venue = await Venue.findById(venueId).select('ownerUserId');
  return !!venue && venue.ownerUserId?.toString() === user.sub;
}

/* ─── Coach side ──────────────────────────────────────────────────── */

// POST /api/v1/coach-applications
export async function submitCoachApplication(c: any) {
  const user = c.get('user');
  if (!hasPermission(user, COACH_PERM)) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Coach application permission required' } }, 403);
  }
  const body = submitSchema.parse(await c.req.json());
  const venueId = await resolveVenueId(body.venueId);
  if (!venueId) return c.json({ error: { code: 'NOT_FOUND', message: 'Venue not found' } }, 404);

  const existing = await CoachApplication.findOne({ coachUserId: user.sub, venueId }).lean();
  if (existing) {
    return c.json(
      { error: { code: 'CONFLICT', message: 'You have already applied to this venue' }, status: (existing as any).status },
      409,
    );
  }

  const coach = await findCoachProfile(user.sub);
  const app = await CoachApplication.create({
    coachUserId: user.sub,
    coachId: coach?._id,
    venueId,
    status: 'pending',
    message: body.message,
  });
  return c.json({ data: { id: app._id, status: app.status, venueId, createdAt: app.createdAt } }, 201);
}

// GET /api/v1/coach-applications/mine
export async function getMyCoachApplications(c: any) {
  const user = c.get('user');
  if (!hasPermission(user, COACH_PERM)) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Coach application permission required' } }, 403);
  }
  const apps = await CoachApplication.find({ coachUserId: user.sub })
    .populate('venueId', 'displayName slug area region fullAddress mainImageUrl')
    .sort({ createdAt: -1 })
    .lean();
  const data = apps
    .filter((a: any) => a.venueId) // venue may have been deleted
    .map((a: any) => ({
      id: a._id,
      status: a.status,
      createdAt: a.createdAt,
      decidedAt: a.decidedAt || null,
      venue: venueView(a.venueId),
    }));
  return c.json({ data });
}

// GET /api/v1/coach-applications/for-venue/:venueId
// The current coach's application for one venue (or null) — drives the
// Apply button's state on the venue detail page.
export async function getMyApplicationForVenue(c: any) {
  const user = c.get('user');
  if (!hasPermission(user, COACH_PERM)) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Coach application permission required' } }, 403);
  }
  const venueId = await resolveVenueId(c.req.param('venueId'));
  if (!venueId) return c.json({ error: { code: 'NOT_FOUND', message: 'Venue not found' } }, 404);
  const app = await CoachApplication.findOne({ coachUserId: user.sub, venueId }).lean();
  return c.json({
    data: app
      ? { id: (app as any)._id, status: (app as any).status, createdAt: (app as any).createdAt, decidedAt: (app as any).decidedAt || null }
      : null,
  });
}

/* ─── Owner side ──────────────────────────────────────────────────── */

// GET /api/v1/coach-applications/owner — every application across the owner's venues.
export async function getOwnerCoachApplications(c: any) {
  const user = c.get('user');
  if (!hasPermission(user, OWNER_PERM) && !hasPermission(user, ADMIN_PERM)) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Owner coach-application permission required' } }, 403);
  }
  const venues = await Venue.find({ ownerUserId: user.sub }).select('_id').lean();
  const venueIds = (venues as any[]).map((v) => v._id);
  if (!venueIds.length) return c.json({ data: [] });

  const apps = await CoachApplication.find({ venueId: { $in: venueIds } })
    .populate('venueId', 'displayName slug area region fullAddress mainImageUrl')
    .sort({ createdAt: -1 })
    .lean();
  return c.json({ data: await shapeOwnerApps(apps) });
}

// GET /api/v1/coach-applications/venue/:venueId — applications for one owned
// venue; optional ?status= filter (used for the "Approved coaches" section).
export async function getVenueCoachApplications(c: any) {
  const user = c.get('user');
  if (!hasPermission(user, OWNER_PERM) && !hasPermission(user, ADMIN_PERM)) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Owner coach-application permission required' } }, 403);
  }
  const venueId = await resolveVenueId(c.req.param('venueId'));
  if (!venueId) return c.json({ error: { code: 'NOT_FOUND', message: 'Venue not found' } }, 404);
  if (!(await ownsVenue(user, venueId))) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'You do not own this venue' } }, 403);
  }

  const status = c.req.query('status');
  const filter: Record<string, any> = { venueId };
  if (status && ['pending', 'approved', 'rejected', 'removed'].includes(status)) filter.status = status;

  const apps = await CoachApplication.find(filter)
    .populate('venueId', 'displayName slug area region fullAddress mainImageUrl')
    .sort({ createdAt: -1 })
    .lean();
  return c.json({ data: await shapeOwnerApps(apps) });
}

async function decide(c: any, status: 'approved' | 'rejected' | 'removed') {
  const user = c.get('user');
  if (!hasPermission(user, OWNER_PERM) && !hasPermission(user, ADMIN_PERM)) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Owner coach-application permission required' } }, 403);
  }
  const app = await CoachApplication.findById(c.req.param('id')).select('venueId coachId coachUserId');
  if (!app) return c.json({ error: { code: 'NOT_FOUND', message: 'Application not found' } }, 404);
  if (!(await ownsVenue(user, app.venueId))) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'You do not own this venue' } }, 403);
  }
  let coachId = (app as any).coachId;
  if (!coachId && (app as any).coachUserId) {
    const coach = await findCoachProfile((app as any).coachUserId.toString());
    coachId = coach?._id;
  }
  const updated = await CoachApplication.findByIdAndUpdate(
    app._id,
    { status, decidedByUserId: user.sub, decidedAt: new Date(), ...(coachId ? { coachId } : {}) },
    { new: true },
  ).lean();
  if (status === 'approved' && coachId) {
    await Coach.findByIdAndUpdate(coachId, { $addToSet: { venues: app.venueId } });
  } else if (coachId) {
    await Coach.findByIdAndUpdate(coachId, { $pull: { venues: app.venueId } });
  }
  return c.json({ data: { id: (updated as any)._id, status: (updated as any).status, decidedAt: (updated as any).decidedAt } });
}

// PATCH /api/v1/coach-applications/:id/approve
export const approveCoachApplication = (c: any) => decide(c, 'approved');
// PATCH /api/v1/coach-applications/:id/reject
export const rejectCoachApplication = (c: any) => decide(c, 'rejected');
// PATCH /api/v1/coach-applications/:id/remove
export const removeCoachApplication = (c: any) => decide(c, 'removed');
