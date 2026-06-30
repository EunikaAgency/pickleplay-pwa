import { z } from 'zod';
import { WaitlistEntry } from '../bookings/bookings.model.js';
import { Booking } from '../bookings/bookings.model.js';
import { Court } from '../venues/venues.model.js';
import { notifyUser } from '../../shared/lib/notify.js';
import { freeCourtsByHour, resolveVenueCapacity } from '../bookings/bookings.controller.js';

const joinSchema = z.object({
  venueId: z.string().min(1),
  courtId: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{1,2}:\d{2}$/),
  endTime: z.string().regex(/^\d{1,2}:\d{2}$/),
  playerCount: z.coerce.number().int().min(1).optional().default(1),
});

const CLAIM_WINDOW_HOURS = 2;

// POST /api/v1/waitlist — join a waitlist for a full slot.
export async function joinWaitlist(c: any) {
  const user = c.get('user');
  const body = joinSchema.parse(await c.req.json());

  // Verify the slot is genuinely full.
  const venueId = body.venueId;
  const bookings = await Booking.find({
    venueId,
    date: body.date,
    status: { $nin: ['cancelled'] },
    bookingType: { $nin: ['blocked'] },
  }).select('startTime endTime courtId').lean();
  const capacity = await resolveVenueCapacity(venueId);
  const free = freeCourtsByHour(bookings as any[], capacity);
  const startH = Number(body.startTime.split(':')[0]);
  if (startH < 24 && (free[startH] ?? 0) > 0) {
    return c.json({ error: { code: 'CONFLICT', message: 'This slot is not full — you can book it directly' } }, 409);
  }

  // One entry per user per slot.
  const exists = await WaitlistEntry.findOne({
    userId: user.sub, venueId, date: body.date, startTime: body.startTime,
    status: { $in: ['waiting', 'promoted'] },
  });
  if (exists) {
    return c.json({ error: { code: 'CONFLICT', message: 'You are already on the waitlist for this slot' } }, 409);
  }

  const entry = await WaitlistEntry.create({
    userId: user.sub,
    venueId,
    courtId: body.courtId || undefined,
    date: body.date,
    startTime: body.startTime,
    endTime: body.endTime,
    playerCount: body.playerCount,
  });

  return c.json({ data: { id: String(entry._id), status: 'waiting' } }, 201);
}

// GET /api/v1/waitlist/mine — current user's waitlist entries.
export async function listMyWaitlist(c: any) {
  const user = c.get('user');
  const rows = await WaitlistEntry.find({ userId: user.sub })
    .sort({ createdAt: -1 })
    .populate('venueId', 'displayName slug')
    .lean();
  const now = new Date();

  // Expire stale promotions.
  const expired = rows.filter((r: any) => r.status === 'promoted' && r.claimExpiresAt && new Date(r.claimExpiresAt) < now);
  if (expired.length) {
    await WaitlistEntry.updateMany(
      { _id: { $in: expired.map((e: any) => e._id) } },
      { status: 'expired' },
    );
    expired.forEach((e: any) => { e.status = 'expired'; });
  }

  return c.json({
    data: rows.map((r: any) => ({
      id: String(r._id),
      venueId: String(r.venueId?._id ?? r.venueId),
      venueName: r.venueId?.displayName ?? null,
      date: r.date,
      startTime: r.startTime,
      endTime: r.endTime,
      playerCount: r.playerCount,
      status: r.status,
      claimExpiresAt: r.claimExpiresAt,
      createdAt: r.createdAt,
    })),
  });
}

// DELETE /api/v1/waitlist/:id — leave a waitlist.
export async function leaveWaitlist(c: any) {
  const user = c.get('user');
  const entry = await WaitlistEntry.findOneAndUpdate(
    { _id: c.req.param('id'), userId: user.sub },
    { status: 'cancelled' },
    { new: true },
  );
  if (!entry) return c.json({ error: { code: 'NOT_FOUND', message: 'Waitlist entry not found' } }, 404);
  return c.json({ data: { ok: true } });
}

// POST /api/v1/waitlist/:id/claim — claim a promoted slot (creates a booking).
export async function claimWaitlist(c: any) {
  const user = c.get('user');
  const entry = await WaitlistEntry.findOne({ _id: c.req.param('id'), userId: user.sub, status: 'promoted' });
  if (!entry) return c.json({ error: { code: 'NOT_FOUND', message: 'No promoted waitlist entry found — it may have expired' } }, 404);

  if (!entry.claimExpiresAt || new Date(entry.claimExpiresAt) < new Date()) {
    entry.status = 'expired';
    await entry.save();
    return c.json({ error: { code: 'CONFLICT', message: 'Your claim window has expired' } }, 409);
  }

  // Re-check availability before creating the booking.
  const bookings = await Booking.find({
    venueId: entry.venueId,
    date: entry.date,
    status: { $nin: ['cancelled'] },
    bookingType: { $nin: ['blocked'] },
  }).select('startTime endTime courtId').lean();
  const capacity = await resolveVenueCapacity(String(entry.venueId));
  const free = freeCourtsByHour(bookings as any[], capacity);
  const startH = Number((entry as any).startTime.split(':')[0]);
  if (startH < 24 && (free[startH] ?? 0) < 1) {
    return c.json({ error: { code: 'CONFLICT', message: 'This slot is no longer available — someone else may have claimed it' } }, 409);
  }

  // Create a confirmed booking from the waitlist entry.
  const booking = await Booking.create({
    userId: user.sub,
    venueId: entry.venueId,
    courtId: (entry as any).courtId || null,
    date: (entry as any).date,
    startTime: (entry as any).startTime,
    endTime: (entry as any).endTime,
    playerCount: (entry as any).playerCount ?? 1,
    amount: 0, // will be set by checkout; waitlist claim creates an unpaid booking
    status: 'confirmed',
    notes: 'Claimed from waitlist',
  });

  entry.status = 'claimed';
  await entry.save();

  return c.json({ data: { bookingId: String(booking._id), status: 'claimed' } }, 201);
}

// Promote the first waiting entry for a freed slot. Called after a cancellation.
export async function promoteWaitlistForSlot(
  venueId: string,
  date: string,
  startTime: string,
): Promise<void> {
  const next = await WaitlistEntry.findOne({
    venueId, date, startTime,
    status: 'waiting',
  }).sort({ createdAt: 1 });

  if (!next) return;

  const now = new Date();
  const expires = new Date(now.getTime() + CLAIM_WINDOW_HOURS * 60 * 60 * 1000);
  next.status = 'promoted';
  next.promotedAt = now;
  (next as any).claimExpiresAt = expires;
  await next.save();

  // Notify the player (push + in-app).
  const { User } = await import('../auth/auth.model.js');
  const venue = await (await import('../venues/venues.model.js')).Venue.findById(venueId).select('displayName').lean();
  const venueName = (venue as any)?.displayName || 'the venue';

  await notifyUser((next as any).userId, {
    type: 'booking',
    title: 'A court opened up!',
    body: `A slot at ${venueName} on ${date} at ${startTime} just opened — you have ${CLAIM_WINDOW_HOURS} hours to book!`,
    icon: 'calendar',
    linkUrl: `/bookings`,
    tag: `waitlist-${next._id}`,
  });
}
