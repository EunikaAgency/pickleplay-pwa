import { Hono } from 'hono';
import { requireAuth, optionalAuth } from '../../shared/middleware/auth.js';
import { recordDemandEvent, getVenueDemand, getVenueLeakageReport } from './demand.controller.js';

const demandRoutes = new Hono();

// Capture a demand signal — public (optionalAuth attaches the actor when present).
demandRoutes.post('/events', optionalAuth, recordDemandEvent);
// Owner/manager demand report for one venue.
demandRoutes.get('/venues/:id', requireAuth, getVenueDemand);
// Owner/manager booking-funnel leakage report for one venue.
demandRoutes.get('/venues/:id/leakage', requireAuth, getVenueLeakageReport);

export default demandRoutes;
