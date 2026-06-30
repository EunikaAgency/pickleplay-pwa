import { Hono } from 'hono';
import { requireAuth } from '../../shared/middleware/auth.js';
import {
  submitCoachApplication,
  getMyCoachApplications,
  getMyApplicationForVenue,
  getOwnerCoachApplications,
  getVenueCoachApplications,
  approveCoachApplication,
  rejectCoachApplication,
  removeCoachApplication,
} from './coach-applications.controller.js';

const coachApplicationsRoutes = new Hono();

/* ─── Coach side ──────────────────────────────────────────────────── */
coachApplicationsRoutes.post('/', requireAuth, submitCoachApplication);
coachApplicationsRoutes.get('/mine', requireAuth, getMyCoachApplications);
coachApplicationsRoutes.get('/for-venue/:venueId', requireAuth, getMyApplicationForVenue);

/* ─── Owner side ──────────────────────────────────────────────────── */
coachApplicationsRoutes.get('/owner', requireAuth, getOwnerCoachApplications);
coachApplicationsRoutes.get('/venue/:venueId', requireAuth, getVenueCoachApplications);
coachApplicationsRoutes.patch('/:id/approve', requireAuth, approveCoachApplication);
coachApplicationsRoutes.patch('/:id/reject', requireAuth, rejectCoachApplication);
coachApplicationsRoutes.patch('/:id/remove', requireAuth, removeCoachApplication);

export default coachApplicationsRoutes;
