import { Hono } from 'hono';
import { requireAuth } from '../../shared/middleware/auth.js';
import {
  cancelBooking, createBooking, getBooking, listBookings, updateBooking,
  modifyBooking, getRefundQuote,
} from './bookings.controller.js';

const bookingsRoutes = new Hono();

bookingsRoutes.use('/*', requireAuth);
bookingsRoutes.get('/', listBookings);
bookingsRoutes.post('/', createBooking);
// Static segment before `:id` — modify is the action, not an id.
bookingsRoutes.patch('/:id/modify', modifyBooking);
bookingsRoutes.get('/:id/refund-quote', getRefundQuote);
bookingsRoutes.get('/:id', getBooking);
bookingsRoutes.patch('/:id', updateBooking);
bookingsRoutes.post('/:id/cancel', cancelBooking);

export default bookingsRoutes;
