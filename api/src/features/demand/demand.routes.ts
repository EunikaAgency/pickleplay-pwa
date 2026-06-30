import { Hono } from 'hono';
import { requireAuth, optionalAuth } from '../../shared/middleware/auth.js';
import { recordDemandEvent, getVenueDemand, getVenueLeakageReport, getSuggestedPricing, applySuggestedPricing } from './demand.controller.js';

const demandRoutes = new Hono();

// Capture a demand signal — public (optionalAuth attaches the actor when present).
demandRoutes.post('/events', optionalAuth, recordDemandEvent);
// Owner/manager demand report for one venue.
demandRoutes.get('/venues/:id', requireAuth, getVenueDemand);
// Owner/manager booking-funnel leakage report for one venue.
demandRoutes.get('/venues/:id/leakage', requireAuth, getVenueLeakageReport);
// Suggested dynamic pricing — analyses demand patterns and recommends adjustments.
demandRoutes.get('/venues/:id/suggested-pricing', requireAuth, getSuggestedPricing);
// Apply selected pricing suggestions as SlotPriceOverrides for the next N weeks.
demandRoutes.post('/venues/:id/suggested-pricing/apply', requireAuth, applySuggestedPricing);

export default demandRoutes;
