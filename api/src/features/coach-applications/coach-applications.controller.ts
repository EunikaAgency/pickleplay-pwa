import { z } from 'zod';
import { CoachApplication } from './coach-applications.model.js';
import { Venue } from '../venues/venues.model.js';
import { Coach } from '../coaches/coaches.model.js';
import { User, UserRole } from '../auth/auth.model.js';
import { resolveVenueId } from '../venues/venues.controller.js';
import { hasPermission } from '../../shared/lib/permissions.js';

// Players apply to coach at a venue and track their own applications. Gated by
// player.dashboard.access — any player-type account can apply, but owners/staff
// cannot (they lack this permission). The old coach.applications.manage gate
// created a chicken-and-egg: you needed the coach role to apply for it.
const PLAYER_PERM = 'player.dashboard.access' as const;
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
// Exported for the combined owner Partners feed (features/partners).
export async function shapeOwnerApps(apps: any[]) {
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
  if (!hasPermission(user, PLAYER_PERM)) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Only player accounts can apply as a coach' } }, 403);
  }
  const body = submitSchema.parse(await c.req.json());
  const venueId = await resolveVenueId(body.venueId);
  if (!venueId) return c.json({ error: { code: 'NOT_FOUND', message: 'Venue not found' } }, 404);

  const existing = await CoachApplication.findOne({ coachUserId: user.sub, venueId }).lean();
  if (existing) {
    const status = (existing as any).status;
    // A live application blocks a duplicate; a removed/rejected one can be
    // re-opened — reset the same row to pending (the unique index means one
    // row per coach+venue, so re-applying reuses it).
    if (status === 'pending' || status === 'approved') {
      return c.json(
        { error: { code: 'CONFLICT', message: 'You have already applied to this venue' }, status },
        409,
      );
    }
    const reopened = await CoachApplication.findByIdAndUpdate(
      (existing as any)._id,
      { status: 'pending', message: body.message, decidedByUserId: null, decidedAt: null },
      { new: true },
    ).lean();
    return c.json({ data: { id: (reopened as any)._id, status: (reopened as any).status, venueId, createdAt: (reopened as any).createdAt } }, 201);
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
  if (!hasPermission(user, PLAYER_PERM)) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Only player accounts can view coach applications' } }, 403);
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
// The current player's application for one venue (or null) — drives the
// Apply button's state on the venue detail page.
export async function getMyApplicationForVenue(c: any) {
  const user = c.get('user');
  if (!hasPermission(user, PLAYER_PERM)) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Only player accounts can view coach applications' } }, 403);
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

// DELETE /api/v1/coach-applications/:id — the applicant withdraws their own
// PENDING application (deletes the row; a never-decided application carries no
// partnership history worth keeping). Approved/rejected/removed rows stay —
// only the venue owner changes those.
export async function cancelCoachApplication(c: any) {
  const user = c.get('user');
  const app = await CoachApplication.findById(c.req.param('id')).lean();
  if (!app) return c.json({ error: { code: 'NOT_FOUND', message: 'Application not found' } }, 404);
  if ((app as any).coachUserId?.toString() !== user.sub) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'You can only cancel your own application' } }, 403);
  }
  if ((app as any).status !== 'pending') {
    return c.json({ error: { code: 'CONFLICT', message: 'Only a pending application can be cancelled' } }, 409);
  }
  await CoachApplication.deleteOne({ _id: (app as any)._id });
  return c.json({ data: { id: (app as any)._id, cancelled: true } });
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
  if (status === 'approved') {
    // Grant the coach role scoped to this venue — from now on the player's
    // token + /me will include 'coach' in roles[] and the venue in partnerRoles[].
    await UserRole.updateOne(
      { userId: (app as any).coachUserId, role: 'coach', scopeType: 'venue', scopeId: app.venueId },
      { $setOnInsert: { isPrimary: false } },
      { upsert: true },
    );
    // Ensure a Coach profile exists so they show up in coach listings.
    if (coachId) {
      await Coach.findByIdAndUpdate(coachId, { $addToSet: { venues: app.venueId } });
    } else {
      // No existing Coach profile — create a minimal one from the User account.
      // Coach.slug carries a unique index, so a slug must be set (two slug-less
      // docs collide on { slug: null }); suffix with the user id for uniqueness.
      const userDoc = await User.findById((app as any).coachUserId).select('displayName avatarUrl').lean();
      const name = (userDoc as any)?.displayName || 'Coach';
      const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}-${(app as any).coachUserId.toString().slice(-6)}`;
      const newCoach = await Coach.create({
        userId: (app as any).coachUserId,
        displayName: name,
        slug,
        avatarUrl: (userDoc as any)?.avatarUrl || null,
        venues: [app.venueId],
      });
      await User.findByIdAndUpdate((app as any).coachUserId, { coachId: newCoach._id });
    }
  } else if (status === 'rejected' || status === 'removed') {
    // Revoke the per-venue coach grant.
    await UserRole.deleteOne({
      userId: (app as any).coachUserId, role: 'coach', scopeType: 'venue', scopeId: app.venueId,
    });
    if (coachId) {
      await Coach.findByIdAndUpdate(coachId, { $pull: { venues: app.venueId } });
    }
  }
  return c.json({ data: { id: (updated as any)._id, status: (updated as any).status, decidedAt: (updated as any).decidedAt } });
}

// PATCH /api/v1/coach-applications/:id/approve
export const approveCoachApplication = (c: any) => decide(c, 'approved');
// PATCH /api/v1/coach-applications/:id/reject
export const rejectCoachApplication = (c: any) => decide(c, 'rejected');
// PATCH /api/v1/coach-applications/:id/remove
export const removeCoachApplication = (c: any) => decide(c, 'removed');
