import { z } from 'zod';
import { CheckIn } from './check-ins.model.js';
import { Venue } from '../venues/venues.model.js';
import { User } from '../auth/auth.model.js';
import { hasPermission } from '../../shared/lib/permissions.js';

// A check-in counts as "here now" for this long after the last check-in.
const ACTIVE_MS = 3 * 60 * 60 * 1000; // 3h
const activeSince = () => new Date(Date.now() - ACTIVE_MS);

const venueBody = z.object({ venueId: z.string() });

/** Resolve a venue by slug or _id (the app passes either). */
async function resolveVenue(idOrSlug: string) {
  const isOid = /^[a-f\d]{24}$/i.test(idOrSlug);
  return isOid
    ? Venue.findById(idOrSlug).select('_id displayName slug').lean<{ _id: any; displayName?: string; slug?: string } | null>()
    : Venue.findOne({ slug: idOrSlug }).select('_id displayName slug').lean<{ _id: any; displayName?: string; slug?: string } | null>();
}

type PlayerLite = { id: string; name: string; avatarUrl: string | null };
function toPlayer(u: any): PlayerLite {
  return { id: String(u._id), name: u.displayName || 'Player', avatarUrl: u.avatarUrl ?? null };
}

/** POST /check-ins — the current user checks in at a venue (single presence). */
export async function checkIn(c: any) {
  const user = c.get('user');
  if (!hasPermission(user, 'player.venues.checkin')) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Check-in permission required' } }, 403);
  }
  const { venueId } = venueBody.parse(await c.req.json());
  const venue = await resolveVenue(venueId);
  if (!venue) return c.json({ error: { code: 'NOT_FOUND', message: 'Venue not found' } }, 404);

  // You're in one place at a time — clear check-ins elsewhere, then (re)check-in here.
  await CheckIn.deleteMany({ userId: user.sub, venueId: { $ne: venue._id } });
  await CheckIn.updateOne(
    { userId: user.sub, venueId: venue._id },
    { $set: { lastSeenAt: new Date() }, $setOnInsert: { userId: user.sub, venueId: venue._id } },
    { upsert: true },
  );

  const count = await CheckIn.countDocuments({ venueId: venue._id, lastSeenAt: { $gte: activeSince() } });
  return c.json({ data: { venueId: String(venue._id), checkedIn: true, count } }, 201);
}

/** DELETE /check-ins — the current user checks out (leaves wherever they were). */
export async function checkOut(c: any) {
  const user = c.get('user');
  const body = await c.req.json().catch(() => ({}));
  const parsed = venueBody.safeParse(body);
  const filter: Record<string, any> = { userId: user.sub };
  if (parsed.success) {
    const venue = await resolveVenue(parsed.data.venueId);
    if (venue) filter.venueId = venue._id;
  }
  await CheckIn.deleteMany(filter);
  return c.json({ data: { checkedIn: false } });
}

/** GET /check-ins?venueId= — who's checked in at a venue right now (+ whether you are). */
export async function getVenueCheckIns(c: any) {
  const venueId = c.req.query('venueId');
  if (!venueId) return c.json({ error: { code: 'BAD_REQUEST', message: 'venueId is required' } }, 400);
  const venue = await resolveVenue(venueId);
  if (!venue) return c.json({ error: { code: 'NOT_FOUND', message: 'Venue not found' } }, 404);

  const since = activeSince();
  const [rows, count] = await Promise.all([
    CheckIn.find({ venueId: venue._id, lastSeenAt: { $gte: since } })
      .sort({ lastSeenAt: -1 }).limit(8).populate('userId', 'displayName avatarUrl').lean(),
    CheckIn.countDocuments({ venueId: venue._id, lastSeenAt: { $gte: since } }),
  ]);

  const user = c.get('user');
  const checkedIn = user
    ? !!(await CheckIn.exists({ userId: user.sub, venueId: venue._id, lastSeenAt: { $gte: since } }))
    : false;

  return c.json({
    data: {
      venueId: String(venue._id),
      venueName: venue.displayName ?? 'this venue',
      count,
      players: rows.map((r: any) => toPlayer(r.userId)).filter((p) => p.id !== 'undefined'),
      checkedIn,
    },
  });
}

/** GET /check-ins/hotspot — the busiest venue right now, for the home banner. */
export async function getHotspot(c: any) {
  const since = activeSince();
  const top = await CheckIn.aggregate([
    { $match: { lastSeenAt: { $gte: since } } },
    { $group: { _id: '$venueId', count: { $sum: 1 }, users: { $push: '$userId' } } },
    { $sort: { count: -1 } },
    { $limit: 1 },
  ]);
  if (!top.length) return c.json({ data: null });

  const hot = top[0];
  const [venue, users] = await Promise.all([
    Venue.findById(hot._id).select('displayName slug').lean<{ displayName?: string; slug?: string } | null>(),
    User.find({ _id: { $in: hot.users.slice(0, 5) } }).select('displayName avatarUrl').lean(),
  ]);

  return c.json({
    data: {
      venueId: String(hot._id),
      venueName: venue?.displayName ?? 'a venue',
      venueSlug: venue?.slug ?? null,
      count: hot.count,
      players: users.map(toPlayer),
    },
  });
}
