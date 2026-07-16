import { z } from 'zod';
import { CoachBooking } from './coach-bookings.model.js';
import { Coach, CoachService } from '../coaches/coaches.model.js';
import { User } from '../auth/auth.model.js';
import { notifyUser } from '../../shared/lib/notify.js';
import { hasActivePartnerSubscription } from '../partner-subscriptions/partner-subscriptions.model.js';

const createSchema = z.object({
  coachId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  serviceId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  venueId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  durationMinutes: z.number().int().min(15).max(600).optional(),
  notes: z.string().max(2000).optional(),
});

const declineSchema = z.object({ reason: z.string().max(500).optional() });

/** Live statuses — a slot is only taken by one of these. */
const BLOCKING = ['pending', 'confirmed'] as const;

async function bookingPayload(b: any) {
  const [coach, player] = await Promise.all([
    Coach.findById(b.coachId).select('displayName slug avatarUrl imageUrl specialty').lean(),
    User.findById(b.playerUserId).select('displayName avatarUrl').lean(),
  ]);
  return {
    id: b._id,
    coachId: b.coachId,
    coach: coach ? {
      id: (coach as any)._id,
      name: (coach as any).displayName,
      slug: (coach as any).slug,
      avatarUrl: (coach as any).avatarUrl || (coach as any).imageUrl || null,
      specialty: (coach as any).specialty ?? null,
    } : null,
    player: player ? {
      id: (player as any)._id,
      name: (player as any).displayName,
      avatarUrl: (player as any).avatarUrl ?? null,
    } : null,
    serviceId: b.serviceId ?? null,
    venueId: b.venueId ?? null,
    date: b.date,
    startTime: b.startTime,
    endTime: b.endTime ?? null,
    durationMinutes: b.durationMinutes ?? null,
    amount: b.amount,
    currency: b.currency,
    status: b.status,
    notes: b.notes ?? null,
    declineReason: b.declineReason ?? null,
    createdAt: b.createdAt,
  };
}

/** POST /coach-bookings — a player requests a session with a coach. */
export async function createCoachBooking(c: any) {
  const user = c.get('user');
  const body = createSchema.parse(await c.req.json());

  const coach = await Coach.findById(body.coachId).lean();
  if (!coach) return c.json({ error: { code: 'NOT_FOUND', message: 'Coach not found' } }, 404);

  const coachUserId = (coach as any).userId;
  // Only subscribed coaches are bookable — an unsubscribed (or lapsed) coach is
  // invisible in Find Coach, and must not be reachable by a stale deep link.
  if (!coachUserId || !(await hasActivePartnerSubscription(coachUserId, 'coach'))) {
    return c.json({ error: { code: 'COACH_NOT_SUBSCRIBED', message: 'This coach is not accepting bookings right now.' } }, 409);
  }
  if (String(coachUserId) === String(user.sub)) {
    return c.json({ error: { code: 'SELF_BOOKING', message: 'You cannot book yourself.' } }, 400);
  }

  // Price comes from the chosen service, else the coach's rate pinned to this
  // venue, else their global private hourly rate. Never trust a client-sent
  // amount. (`??` not `||` — a venue rate of 0 is a real "free here" price.)
  const venueRate = body.venueId
    ? ((coach as any).venueRates || []).find((r: any) => String(r.venueId) === String(body.venueId))
    : null;
  let amount = venueRate?.pricePrivatePerHour
    ?? (coach as any).pricePrivatePerHour ?? (coach as any).rateFrom ?? 0;
  let durationMinutes = body.durationMinutes ?? 60;
  if (body.serviceId) {
    const service = await CoachService.findOne({ _id: body.serviceId, coachId: coach._id }).lean();
    if (!service) return c.json({ error: { code: 'NOT_FOUND', message: 'Coach service not found' } }, 404);
    if ((service as any).isActive === false) {
      return c.json({ error: { code: 'SERVICE_INACTIVE', message: 'That session type is no longer offered.' } }, 409);
    }
    amount = (service as any).price;
    durationMinutes = (service as any).durationMinutes ?? durationMinutes;
  }

  // Reject a slot the coach already holds. A partial index would be tidier, but
  // the status set changes over a booking's life, so guard at write time.
  const clash = await CoachBooking.findOne({
    coachId: coach._id, date: body.date, startTime: body.startTime, status: { $in: BLOCKING },
  }).lean();
  if (clash) {
    return c.json({ error: { code: 'SLOT_TAKEN', message: 'That time is already taken. Pick another slot.' } }, 409);
  }

  const booking = await CoachBooking.create({
    coachId: coach._id,
    coachUserId,
    playerUserId: user.sub,
    serviceId: body.serviceId,
    venueId: body.venueId,
    date: body.date,
    startTime: body.startTime,
    endTime: body.endTime,
    durationMinutes,
    amount,
    currency: (coach as any).priceCurrency || 'PHP',
    notes: body.notes,
    status: 'pending',
  });

  const player = await User.findById(user.sub).select('displayName').lean();
  await notifyUser(coachUserId, {
    type: 'coach_booking_request',
    title: 'New coaching request',
    body: `${(player as any)?.displayName ?? 'A player'} requested a session on ${body.date} at ${body.startTime}.`,
    linkUrl: '/coach/bookings',
  });

  return c.json({ data: await bookingPayload(booking) }, 201);
}

/** GET /coach-bookings/mine — sessions the signed-in player requested. */
export async function listMyCoachBookings(c: any) {
  const user = c.get('user');
  const rows = await CoachBooking.find({ playerUserId: user.sub }).sort({ createdAt: -1 }).limit(100).lean();
  return c.json({ data: await Promise.all((rows as any[]).map(bookingPayload)) });
}

/** GET /coach-bookings/coach — the signed-in coach's incoming requests. */
export async function listCoachInbox(c: any) {
  const user = c.get('user');
  const rows = await CoachBooking.find({ coachUserId: user.sub }).sort({ createdAt: -1 }).limit(100).lean();
  return c.json({ data: await Promise.all((rows as any[]).map(bookingPayload)) });
}

/** Load a booking and assert the caller is its coach. */
async function loadForCoach(c: any) {
  const user = c.get('user');
  const booking = await CoachBooking.findById(c.req.param('id'));
  if (!booking) return { error: c.json({ error: { code: 'NOT_FOUND', message: 'Booking not found' } }, 404) };
  if (String(booking.get('coachUserId')) !== String(user.sub)) {
    return { error: c.json({ error: { code: 'FORBIDDEN', message: 'Not your booking' } }, 403) };
  }
  return { booking };
}

/** PATCH /coach-bookings/:id/accept */
export async function acceptCoachBooking(c: any) {
  const { booking, error } = await loadForCoach(c);
  if (error) return error;
  if (booking!.get('status') !== 'pending') {
    return c.json({ error: { code: 'CONFLICT', message: 'This request is no longer pending.' } }, 409);
  }
  booking!.set({ status: 'confirmed', decidedAt: new Date() });
  await booking!.save();

  await notifyUser(booking!.get('playerUserId'), {
    type: 'coach_booking_accepted',
    title: 'Coaching session confirmed',
    body: `Your session on ${booking!.get('date')} at ${booking!.get('startTime')} was accepted.`,
    linkUrl: '/coach-bookings',
  });
  return c.json({ data: await bookingPayload(booking) });
}

/** PATCH /coach-bookings/:id/decline */
export async function declineCoachBooking(c: any) {
  const { booking, error } = await loadForCoach(c);
  if (error) return error;
  if (booking!.get('status') !== 'pending') {
    return c.json({ error: { code: 'CONFLICT', message: 'This request is no longer pending.' } }, 409);
  }
  const body = declineSchema.parse(await c.req.json().catch(() => ({})));
  booking!.set({ status: 'declined', declineReason: body.reason, decidedAt: new Date() });
  await booking!.save();

  await notifyUser(booking!.get('playerUserId'), {
    type: 'coach_booking_declined',
    title: 'Coaching request declined',
    body: body.reason || `Your session on ${booking!.get('date')} was declined.`,
    linkUrl: '/coach-bookings',
  });
  return c.json({ data: await bookingPayload(booking) });
}

/** PATCH /coach-bookings/:id/cancel — either party calls this off. */
export async function cancelCoachBooking(c: any) {
  const user = c.get('user');
  const booking = await CoachBooking.findById(c.req.param('id'));
  if (!booking) return c.json({ error: { code: 'NOT_FOUND', message: 'Booking not found' } }, 404);

  const isPlayer = String(booking.get('playerUserId')) === String(user.sub);
  const isCoach = String(booking.get('coachUserId')) === String(user.sub);
  if (!isPlayer && !isCoach) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Not your booking' } }, 403);
  }
  if (!['pending', 'confirmed'].includes(booking.get('status'))) {
    return c.json({ error: { code: 'CONFLICT', message: 'This session can no longer be cancelled.' } }, 409);
  }

  booking.set({ status: 'cancelled', cancelledAt: new Date() });
  await booking.save();

  // Tell the other party, never the actor.
  await notifyUser(isPlayer ? booking.get('coachUserId') : booking.get('playerUserId'), {
    type: 'coach_booking_cancelled',
    title: 'Coaching session cancelled',
    body: `The session on ${booking.get('date')} at ${booking.get('startTime')} was cancelled.`,
    linkUrl: isPlayer ? '/coach/bookings' : '/coach-bookings',
  });
  return c.json({ data: await bookingPayload(booking) });
}
