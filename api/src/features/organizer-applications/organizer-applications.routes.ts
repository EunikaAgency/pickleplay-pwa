import { Hono } from 'hono';
import { requireAuth } from '../../shared/middleware/auth.js';
import {
  submitOrganizerApplication,
  getMyOrganizerApplications,
  getMyOrganizerApplicationForVenue,
  cancelOrganizerApplication,
  getOwnerOrganizerApplications,
  getVenueOrganizerApplications,
  approveOrganizerApplication,
  rejectOrganizerApplication,
  removeOrganizerApplication,
} from './organizer-applications.controller.js';

const organizerApplicationsRoutes = new Hono();

/* ─── Player side ──────────────────────────────────────────────────── */
organizerApplicationsRoutes.post('/', requireAuth, submitOrganizerApplication);
organizerApplicationsRoutes.get('/mine', requireAuth, getMyOrganizerApplications);
organizerApplicationsRoutes.get('/for-venue/:venueId', requireAuth, getMyOrganizerApplicationForVenue);
organizerApplicationsRoutes.delete('/:id', requireAuth, cancelOrganizerApplication);

/* ─── Owner side ──────────────────────────────────────────────────── */
organizerApplicationsRoutes.get('/owner', requireAuth, getOwnerOrganizerApplications);
organizerApplicationsRoutes.get('/venue/:venueId', requireAuth, getVenueOrganizerApplications);
organizerApplicationsRoutes.patch('/:id/approve', requireAuth, approveOrganizerApplication);
organizerApplicationsRoutes.patch('/:id/reject', requireAuth, rejectOrganizerApplication);
organizerApplicationsRoutes.patch('/:id/remove', requireAuth, removeOrganizerApplication);

export default organizerApplicationsRoutes;
