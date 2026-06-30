import { z } from 'zod';
import { TournamentApplication } from './tournament-applications.model.js';
import { Tournament } from '../content/content.model.js';
import { Venue } from '../venues/venues.model.js';
import { User } from '../auth/auth.model.js';
import { resolveVenueId } from '../venues/venues.controller.js';
import { hasPermission } from '../../shared/lib/permissions.js';

// Organizer submits + reads their own venue requests.
const ORGANIZER_PERM = 'organizer.tournaments.manage' as const;
// Owner reviews requests for venues they own.
const OWNER_PERM = 'owner.tournaments.manage' as const;
// Admins manage any venue.
const ADMIN_PERM = 'admin.venues.manage' as const;

const submitSchema = z.object({
  tournamentId: z.string().min(1),
  venueId: z.string().min(1), // accepts a venue slug or _id
  requestedStartDate: z.string().min(1),
  requestedEndDate: z.string().optional(),
  timeSlotStart: z.string().min(1),
  timeSlotEnd: z.string().min(1),
  courtsRequired: z.coerce.number().int().min(1),
  message: z.string().max(2000).optional(),
});

const rejectSchema = z.object({ remarks: z.string().max(2000).optional() });

/* ─── Shaping helpers ─────────────────────────────────────────────── */

function venueView(v: any) {
  if (!v) return null;
  return {
    id: v._id,
    name: v.displayName,
    slug: v.slug,
    location: v.area || v.region || v.fullAddress || '',
    image: v.mainImageUrl || null,
    courtCount: v.courtCount ?? null,
  };
}

function tournamentView(t: any) {
  if (!t) return null;
  return { id: t._id, name: t.name, slug: t.slug, status: t.status };
}

// Fields every application response shares (request schedule + decision meta).
function baseApp(a: any) {
  return {
    id: a._id,
    status: a.status,
    requestedStartDate: a.requestedStartDate,
    requestedEndDate: a.requestedEndDate || null,
    timeSlotStart: a.timeSlotStart,
    timeSlotEnd: a.timeSlotEnd,
    courtsRequired: a.courtsRequired,
    message: a.message || '',
    remarks: a.remarks || '',
    createdAt: a.createdAt,
    decidedAt: a.decidedAt || null,
  };
}

// Owner-facing view: organizer identity + venue + tournament. One User query
// for the whole set.
async function shapeOwnerApps(apps: any[]) {
  const userIds = [...new Set(apps.map((a) => a.organizerUserId?.toString()).filter(Boolean))];
  const users = userIds.length
    ? await User.find({ _id: { $in: userIds } }).select('displayName avatarUrl email').lean()
    : [];
  const userById = new Map((users as any[]).map((u) => [u._id.toString(), u]));

  return apps.map((a: any) => {
    const u = userById.get(a.organizerUserId?.toString());
    return {
      ...baseApp(a),
      organizer: {
        userId: a.organizerUserId,
        name: u?.displayName || 'Organizer',
        email: u?.email || '',
        avatar: u?.avatarUrl || null,
      },
      tournament: tournamentView(a.tournamentId),
      venue: venueView(a.venueId),
    };
  });
}

async function ownsVenue(user: any, venueId: any): Promise<boolean> {
  if (hasPermission(user, ADMIN_PERM)) return true;
  const venue = await Venue.findById(venueId).select('ownerUserId');
  return !!venue && venue.ownerUserId?.toString() === user.sub;
}

// Date ranges (YYYY-MM-DD) overlap — string compare is valid for ISO dates.
function datesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart <= bEnd && bStart <= aEnd;
}
// Time windows (HH:MM) overlap.
function timesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart < bEnd && bStart < aEnd;
}

/* ─── Organizer side ──────────────────────────────────────────────── */

// POST /api/v1/tournament-applications
export async function submitTournamentApplication(c: any) {
  const user = c.get('user');
  if (!hasPermission(user, ORGANIZER_PERM)) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Organizer permission required' } }, 403);
  }
  const body = submitSchema.parse(await c.req.json());

  const tournament = await Tournament.findById(body.tournamentId);
  if (!tournament) return c.json({ error: { code: 'NOT_FOUND', message: 'Tournament not found' } }, 404);
  if (tournament.organizerUserId?.toString() !== user.sub) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'You do not own this tournament' } }, 403);
  }

  const venueId = await resolveVenueId(body.venueId);
  if (!venueId) return c.json({ error: { code: 'NOT_FOUND', message: 'Venue not found' } }, 404);

  const existing = await TournamentApplication.findOne({
    tournamentId: tournament._id, venueId, status: 'pending',
  }).lean();
  if (existing) {
    return c.json(
      { error: { code: 'CONFLICT', message: 'A pending request already exists for this venue' } },
      409,
    );
  }

  const app = await TournamentApplication.create({
    tournamentId: tournament._id,
    organizerUserId: user.sub,
    venueId,
    requestedStartDate: body.requestedStartDate,
    requestedEndDate: body.requestedEndDate || body.requestedStartDate,
    timeSlotStart: body.timeSlotStart,
    timeSlotEnd: body.timeSlotEnd,
    courtsRequired: body.courtsRequired,
    message: body.message,
    status: 'pending',
  });

  // Move the tournament into the approval pipeline.
  tournament.status = 'pending_venue_approval';
  await tournament.save();

  return c.json({ data: { id: app._id, status: app.status, createdAt: app.createdAt } }, 201);
}

// GET /api/v1/tournament-applications/mine
export async function getMyTournamentApplications(c: any) {
  const user = c.get('user');
  if (!hasPermission(user, ORGANIZER_PERM)) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Organizer permission required' } }, 403);
  }
  const apps = await TournamentApplication.find({ organizerUserId: user.sub })
    .populate('venueId', 'displayName slug area region fullAddress mainImageUrl courtCount')
    .populate('tournamentId', 'name slug status')
    .sort({ createdAt: -1 })
    .lean();
  const data = apps.map((a: any) => ({
    ...baseApp(a),
    tournament: tournamentView(a.tournamentId),
    venue: venueView(a.venueId),
  }));
  return c.json({ data });
}

// PATCH /api/v1/tournament-applications/:id/cancel — organizer withdraws a
// pending request (and resets the tournament back to draft).
export async function cancelTournamentApplication(c: any) {
  const user = c.get('user');
  if (!hasPermission(user, ORGANIZER_PERM)) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Organizer permission required' } }, 403);
  }
  const app = await TournamentApplication.findById(c.req.param('id'));
  if (!app) return c.json({ error: { code: 'NOT_FOUND', message: 'Request not found' } }, 404);
  if (app.organizerUserId?.toString() !== user.sub) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'You do not own this request' } }, 403);
  }
  if (app.status !== 'pending') {
    return c.json({ error: { code: 'CONFLICT', message: 'Only pending requests can be cancelled' } }, 409);
  }
  app.status = 'cancelled';
  await app.save();
  // Return the tournament to draft if it was awaiting this request.
  await Tournament.updateOne(
    { _id: app.tournamentId, status: 'pending_venue_approval' },
    { status: 'draft' },
  );
  return c.json({ data: { id: app._id, status: app.status } });
}

/* ─── Owner side ──────────────────────────────────────────────────── */

// GET /api/v1/tournament-applications/owner — every request across the owner's venues.
export async function getOwnerTournamentApplications(c: any) {
  const user = c.get('user');
  if (!hasPermission(user, OWNER_PERM) && !hasPermission(user, ADMIN_PERM)) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Owner tournament-request permission required' } }, 403);
  }
  const venues = await Venue.find({ ownerUserId: user.sub }).select('_id').lean();
  const venueIds = (venues as any[]).map((v) => v._id);
  if (!venueIds.length) return c.json({ data: [] });

  const apps = await TournamentApplication.find({ venueId: { $in: venueIds } })
    .populate('venueId', 'displayName slug area region fullAddress mainImageUrl courtCount')
    .populate('tournamentId', 'name slug status')
    .sort({ createdAt: -1 })
    .lean();
  return c.json({ data: await shapeOwnerApps(apps) });
}

// GET /api/v1/tournament-applications/venue/:venueId — requests for one owned
// venue; optional ?status= filter.
export async function getVenueTournamentApplications(c: any) {
  const user = c.get('user');
  if (!hasPermission(user, OWNER_PERM) && !hasPermission(user, ADMIN_PERM)) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Owner tournament-request permission required' } }, 403);
  }
  const venueId = await resolveVenueId(c.req.param('venueId'));
  if (!venueId) return c.json({ error: { code: 'NOT_FOUND', message: 'Venue not found' } }, 404);
  if (!(await ownsVenue(user, venueId))) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'You do not own this venue' } }, 403);
  }

  const status = c.req.query('status');
  const filter: Record<string, any> = { venueId };
  if (status && ['pending', 'approved', 'rejected', 'cancelled'].includes(status)) filter.status = status;

  const apps = await TournamentApplication.find(filter)
    .populate('venueId', 'displayName slug area region fullAddress mainImageUrl courtCount')
    .populate('tournamentId', 'name slug status')
    .sort({ createdAt: -1 })
    .lean();
  return c.json({ data: await shapeOwnerApps(apps) });
}

// PATCH /api/v1/tournament-applications/:id/approve
export async function approveTournamentApplication(c: any) {
  const user = c.get('user');
  if (!hasPermission(user, OWNER_PERM) && !hasPermission(user, ADMIN_PERM)) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Owner tournament-request permission required' } }, 403);
  }
  const app = await TournamentApplication.findById(c.req.param('id'));
  if (!app) return c.json({ error: { code: 'NOT_FOUND', message: 'Request not found' } }, 404);
  if (!(await ownsVenue(user, app.venueId))) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'You do not own this venue' } }, 403);
  }
  if (app.status !== 'pending') {
    return c.json({ error: { code: 'CONFLICT', message: 'Only pending requests can be approved' } }, 409);
  }

  // Conflict check: ensure the venue has enough free courts across the
  // requested date range + time window once this request is granted.
  const venue = await Venue.findById(app.venueId).select('courtCount');
  const courtCount = venue?.courtCount ?? 0;
  const reqEnd = app.requestedEndDate || app.requestedStartDate;
  const others = await TournamentApplication.find({
    venueId: app.venueId,
    status: 'approved',
    _id: { $ne: app._id },
  }).select('requestedStartDate requestedEndDate timeSlotStart timeSlotEnd courtsRequired').lean();

  let contestedCourts = app.courtsRequired;
  for (const o of others as any[]) {
    const oEnd = o.requestedEndDate || o.requestedStartDate;
    if (
      datesOverlap(app.requestedStartDate, reqEnd, o.requestedStartDate, oEnd) &&
      timesOverlap(app.timeSlotStart, app.timeSlotEnd, o.timeSlotStart, o.timeSlotEnd)
    ) {
      contestedCourts += o.courtsRequired;
    }
  }
  if (courtCount > 0 && contestedCourts > courtCount) {
    return c.json(
      { error: { code: 'CONFLICT', message: `Not enough courts for this slot (${contestedCourts} requested, ${courtCount} available)` } },
      409,
    );
  }

  app.status = 'approved';
  app.decidedByUserId = user.sub;
  app.decidedAt = new Date();
  await app.save();

  // Reserve the venue on the tournament + advance its status.
  await Tournament.updateOne(
    { _id: app.tournamentId },
    {
      status: 'approved',
      venueId: app.venueId,
      startDate: app.requestedStartDate,
      endDate: reqEnd,
      startTime: app.timeSlotStart,
      endTime: app.timeSlotEnd,
      courtsRequired: app.courtsRequired,
    },
  );

  return c.json({ data: { id: app._id, status: app.status, decidedAt: app.decidedAt } });
}

// PATCH /api/v1/tournament-applications/:id/reject
export async function rejectTournamentApplication(c: any) {
  const user = c.get('user');
  if (!hasPermission(user, OWNER_PERM) && !hasPermission(user, ADMIN_PERM)) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Owner tournament-request permission required' } }, 403);
  }
  const app = await TournamentApplication.findById(c.req.param('id'));
  if (!app) return c.json({ error: { code: 'NOT_FOUND', message: 'Request not found' } }, 404);
  if (!(await ownsVenue(user, app.venueId))) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'You do not own this venue' } }, 403);
  }
  if (app.status !== 'pending') {
    return c.json({ error: { code: 'CONFLICT', message: 'Only pending requests can be rejected' } }, 409);
  }
  const body = rejectSchema.parse(await c.req.json().catch(() => ({})));
  app.status = 'rejected';
  app.remarks = body.remarks;
  app.decidedByUserId = user.sub;
  app.decidedAt = new Date();
  await app.save();

  // Mark the tournament rejected so the organizer can choose another venue.
  await Tournament.updateOne(
    { _id: app.tournamentId, status: 'pending_venue_approval' },
    { status: 'rejected' },
  );

  return c.json({ data: { id: app._id, status: app.status, remarks: app.remarks, decidedAt: app.decidedAt } });
}
