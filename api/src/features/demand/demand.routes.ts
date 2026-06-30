import { Hono } from 'hono';
import { requireAuth, optionalAuth } from '../../shared/middleware/auth.js';
import { recordDemandEvent, getVenueDemand, getVenueLeakageReport, getSuggestedPricing, applySuggestedPricing, runAutoDynamicPricing } from './demand.controller.js';

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
// Automated dynamic pricing cron — runs suggestion engine + auto-applies for all
// opted-in venues. Admin-only (designed to be called by a cron scheduler).
demandRoutes.post('/auto-dynamic-pricing', requireAuth, async (c: any) => {
  const user = c.get('user');
  if (!user?.roles?.includes('admin')) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Admin only' } }, 403);
  }
  const result = await runAutoDynamicPricing(c);
  return c.json({ data: result });
});

export default demandRoutes;
