import { Hono } from 'hono';
import { requireAuth } from '../../shared/middleware/auth.js';
import {
  createCoachBooking, listMyCoachBookings, listCoachInbox,
  acceptCoachBooking, declineCoachBooking, cancelCoachBooking,
} from './coach-bookings.controller.js';

const coachBookingsRoutes = new Hono();

/* ─── Player side ─────────────────────────────────────────────────── */
coachBookingsRoutes.post('/', requireAuth, createCoachBooking);
coachBookingsRoutes.get('/mine', requireAuth, listMyCoachBookings);

/* ─── Coach side ──────────────────────────────────────────────────── */
// Static segments must be registered before the /:id matchers below.
coachBookingsRoutes.get('/coach', requireAuth, listCoachInbox);
coachBookingsRoutes.patch('/:id/accept', requireAuth, acceptCoachBooking);
coachBookingsRoutes.patch('/:id/decline', requireAuth, declineCoachBooking);

/* ─── Either party ────────────────────────────────────────────────── */
coachBookingsRoutes.patch('/:id/cancel', requireAuth, cancelCoachBooking);

export default coachBookingsRoutes;
