import { Hono } from 'hono';
import { requireAuth } from '../../shared/middleware/auth.js';
import { getMySubscriptions, subscribe, cancelSubscription, resumeSubscription } from './partner-subscriptions.controller.js';

const partnerSubscriptionsRoutes = new Hono();

// All self-scoped: a user reads, buys, and cancels their OWN subscription. No
// new permission — mirrors how a player joins a venue membership or a club.
partnerSubscriptionsRoutes.get('/me', requireAuth, getMySubscriptions);
partnerSubscriptionsRoutes.post('/', requireAuth, subscribe);
// Cancel is scheduled for the end of the paid term, not immediate.
partnerSubscriptionsRoutes.delete('/:id', requireAuth, cancelSubscription);
partnerSubscriptionsRoutes.post('/:id/resume', requireAuth, resumeSubscription);

export default partnerSubscriptionsRoutes;
