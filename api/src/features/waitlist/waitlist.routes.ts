import { Hono } from 'hono';
import { requireAuth } from '../../shared/middleware/auth.js';
import { joinWaitlist, listMyWaitlist, leaveWaitlist, claimWaitlist } from './waitlist.controller.js';

const waitlistRoutes = new Hono();

// All waitlist routes require auth.
waitlistRoutes.use('/*', requireAuth);
// Static segment before :id matchers.
waitlistRoutes.get('/mine', listMyWaitlist);
waitlistRoutes.post('/', joinWaitlist);
waitlistRoutes.delete('/:id', leaveWaitlist);
waitlistRoutes.post('/:id/claim', claimWaitlist);

export default waitlistRoutes;
