import { z } from 'zod';
import { OrganizerApplication } from './organizer-applications.model.js';
import { Venue } from '../venues/venues.model.js';
import { User, UserRole } from '../auth/auth.model.js';
import { resolveVenueId } from '../venues/venues.controller.js';
import { hasPermission } from '../../shared/lib/permissions.js';

// Players apply to organise at a venue and track their own applications. Gated
// by player.dashboard.access — any player-type account can apply, but
// owners/staff cannot (they lack this permission). Mirrors the coach-apps gate.
const PLAYER_PERM = 'player.dashboard.access' as const;
// Owner reviews organizer applications for venues they own.
const OWNER_PERM = 'owner.tournaments.manage' as const;
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

// Batch-build the owner-facing view: applicant identity (User account) + venue.
// Exported for the combined owner Partners feed (features/partners).
export async function shapeOwnerOrganizerApps(apps: any[]) {
  const userIds = [...new Set(apps.map((a) => a.organizerUserId?.toString()).filter(Boolean))];
  const users = userIds.length
    ? await User.find({ _id: { $in: userIds } }).select('displayName avatarUrl').lean()
    : [];
  const userById = new Map((users as any[]).map((u) => [u._id.toString(), u]));

  return apps.map((a: any) => {
    const u = userById.get(a.organizerUserId?.toString());
    return {
      id: a._id,
      status: a.status,
      createdAt: a.createdAt,
      decidedAt: a.decidedAt || null,
      applicant: {
        userId: a.organizerUserId,
        name: u?.displayName || 'Organiser',
        slug: null,
        avatar: u?.avatarUrl || null,
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

/* ─── Player side ────────────────────────────────────────────────── */

// POST /api/v1/organizer-applications
export async function submitOrganizerApplication(c: any) {
  const user = c.get('user');
  if (!hasPermission(user, PLAYER_PERM)) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Only player accounts can apply as an organiser' } }, 403);
  }
  const body = submitSchema.parse(await c.req.json());
  const venueId = await resolveVenueId(body.venueId);
  if (!venueId) return c.json({ error: { code: 'NOT_FOUND', message: 'Venue not found' } }, 404);

  const existing = await OrganizerApplication.findOne({ organizerUserId: user.sub, venueId }).lean();
  if (existing) {
    const status = (existing as any).status;
    // A live application blocks a duplicate; a removed/rejected one can be
    // re-opened — reset the same row to pending (mirrors coach-applications).
    if (status === 'pending' || status === 'approved') {
      return c.json(
        { error: { code: 'CONFLICT', message: 'You have already applied to this venue' }, status },
        409,
      );
    }
    const reopened = await OrganizerApplication.findByIdAndUpdate(
      (existing as any)._id,
      { status: 'pending', message: body.message, decidedByUserId: null, decidedAt: null },
      { new: true },
    ).lean();
    return c.json({ data: { id: (reopened as any)._id, status: (reopened as any).status, venueId, createdAt: (reopened as any).createdAt } }, 201);
  }

  const app = await OrganizerApplication.create({
    organizerUserId: user.sub,
    venueId,
    status: 'pending',
    message: body.message,
  });
  return c.json({ data: { id: app._id, status: app.status, venueId, createdAt: app.createdAt } }, 201);
}

// GET /api/v1/organizer-applications/mine
export async function getMyOrganizerApplications(c: any) {
  const user = c.get('user');
  if (!hasPermission(user, PLAYER_PERM)) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Only player accounts can view organiser applications' } }, 403);
  }
  const apps = await OrganizerApplication.find({ organizerUserId: user.sub })
    .populate('venueId', 'displayName slug area region fullAddress mainImageUrl')
    .sort({ createdAt: -1 })
    .lean();
  const data = apps
    .filter((a: any) => a.venueId)
    .map((a: any) => ({
      id: a._id,
      status: a.status,
      createdAt: a.createdAt,
      decidedAt: a.decidedAt || null,
      venue: venueView(a.venueId),
    }));
  return c.json({ data });
}

// GET /api/v1/organizer-applications/for-venue/:venueId
export async function getMyOrganizerApplicationForVenue(c: any) {
  const user = c.get('user');
  if (!hasPermission(user, PLAYER_PERM)) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Only player accounts can view organiser applications' } }, 403);
  }
  const venueId = await resolveVenueId(c.req.param('venueId'));
  if (!venueId) return c.json({ error: { code: 'NOT_FOUND', message: 'Venue not found' } }, 404);
  const app = await OrganizerApplication.findOne({ organizerUserId: user.sub, venueId }).lean();
  return c.json({
    data: app
      ? { id: (app as any)._id, status: (app as any).status, createdAt: (app as any).createdAt, decidedAt: (app as any).decidedAt || null }
      : null,
  });
}

// DELETE /api/v1/organizer-applications/:id — the applicant withdraws their
// own PENDING application (mirrors coach-applications cancel).
export async function cancelOrganizerApplication(c: any) {
  const user = c.get('user');
  const app = await OrganizerApplication.findById(c.req.param('id')).lean();
  if (!app) return c.json({ error: { code: 'NOT_FOUND', message: 'Application not found' } }, 404);
  if ((app as any).organizerUserId?.toString() !== user.sub) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'You can only cancel your own application' } }, 403);
  }
  if ((app as any).status !== 'pending') {
    return c.json({ error: { code: 'CONFLICT', message: 'Only a pending application can be cancelled' } }, 409);
  }
  await OrganizerApplication.deleteOne({ _id: (app as any)._id });
  return c.json({ data: { id: (app as any)._id, cancelled: true } });
}

/* ─── Owner side ──────────────────────────────────────────────────── */

// GET /api/v1/organizer-applications/owner
export async function getOwnerOrganizerApplications(c: any) {
  const user = c.get('user');
  if (!hasPermission(user, OWNER_PERM) && !hasPermission(user, ADMIN_PERM)) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Owner organiser-application permission required' } }, 403);
  }
  const venues = await Venue.find({ ownerUserId: user.sub }).select('_id').lean();
  const venueIds = (venues as any[]).map((v) => v._id);
  if (!venueIds.length) return c.json({ data: [] });

  const apps = await OrganizerApplication.find({ venueId: { $in: venueIds } })
    .populate('venueId', 'displayName slug area region fullAddress mainImageUrl')
    .sort({ createdAt: -1 })
    .lean();
  return c.json({ data: await shapeOwnerOrganizerApps(apps) });
}

// GET /api/v1/organizer-applications/venue/:venueId
export async function getVenueOrganizerApplications(c: any) {
  const user = c.get('user');
  if (!hasPermission(user, OWNER_PERM) && !hasPermission(user, ADMIN_PERM)) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Owner organiser-application permission required' } }, 403);
  }
  const venueId = await resolveVenueId(c.req.param('venueId'));
  if (!venueId) return c.json({ error: { code: 'NOT_FOUND', message: 'Venue not found' } }, 404);
  if (!(await ownsVenue(user, venueId))) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'You do not own this venue' } }, 403);
  }

  const status = c.req.query('status');
  const filter: Record<string, any> = { venueId };
  if (status && ['pending', 'approved', 'rejected', 'removed'].includes(status)) filter.status = status;

  const apps = await OrganizerApplication.find(filter)
    .populate('venueId', 'displayName slug area region fullAddress mainImageUrl')
    .sort({ createdAt: -1 })
    .lean();
  return c.json({ data: await shapeOwnerOrganizerApps(apps) });
}

/* ─── Decide ──────────────────────────────────────────────────────── */

async function decide(c: any, status: 'approved' | 'rejected' | 'removed') {
  const user = c.get('user');
  if (!hasPermission(user, OWNER_PERM) && !hasPermission(user, ADMIN_PERM)) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Owner organiser-application permission required' } }, 403);
  }
  const app = await OrganizerApplication.findById(c.req.param('id')).select('venueId organizerUserId');
  if (!app) return c.json({ error: { code: 'NOT_FOUND', message: 'Application not found' } }, 404);
  if (!(await ownsVenue(user, app.venueId))) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'You do not own this venue' } }, 403);
  }

  const updated = await OrganizerApplication.findByIdAndUpdate(
    app._id,
    { status, decidedByUserId: user.sub, decidedAt: new Date() },
    { new: true },
  ).lean();

  if (status === 'approved') {
    // Grant the organiser role scoped to this venue — from now on the player's
    // token + /me will include 'organizer' in roles[] and the venue in partnerRoles[].
    await UserRole.updateOne(
      { userId: (app as any).organizerUserId, role: 'organizer', scopeType: 'venue', scopeId: app.venueId },
      { $setOnInsert: { isPrimary: false } },
      { upsert: true },
    );
  } else if (status === 'rejected' || status === 'removed') {
    // Revoke the per-venue organiser grant.
    await UserRole.deleteOne({
      userId: (app as any).organizerUserId, role: 'organizer', scopeType: 'venue', scopeId: app.venueId,
    });
  }

  return c.json({ data: { id: (updated as any)._id, status: (updated as any).status, decidedAt: (updated as any).decidedAt } });
}

// PATCH /api/v1/organizer-applications/:id/approve
export const approveOrganizerApplication = (c: any) => decide(c, 'approved');
// PATCH /api/v1/organizer-applications/:id/reject
export const rejectOrganizerApplication = (c: any) => decide(c, 'rejected');
// PATCH /api/v1/organizer-applications/:id/remove
export const removeOrganizerApplication = (c: any) => decide(c, 'removed');
