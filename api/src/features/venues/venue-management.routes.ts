import { Hono } from 'hono';
import { requireAuth } from '../../shared/middleware/auth.js';
import {
  createClaim,
  createSuggestedEdit,
  getClaim,
  getMyClaims,
  listClaims,
  listPendingVenues,
  listSuggestedEdits,
  requireAdmin,
  resubmitClaim,
  reviewClaim,
  reviewSuggestedEdit,
  reviewVenueApproval,
} from './venue-management.controller.js';

const venueManagementRoutes = new Hono();

// Static segments before parameterised ones so they match first.
venueManagementRoutes.get('/claims/mine', requireAuth, getMyClaims);
venueManagementRoutes.patch('/claims/:id/resubmit', requireAuth, resubmitClaim); // /:id/resubmit before /:id
venueManagementRoutes.get('/claims/:id', requireAuth, getClaim);
venueManagementRoutes.post('/claims', requireAuth, createClaim);
venueManagementRoutes.get('/claims', requireAuth, requireAdmin(), listClaims);
venueManagementRoutes.patch('/claims/:id', requireAuth, requireAdmin(), reviewClaim);
venueManagementRoutes.post('/venues/:id/suggested-edits', requireAuth, createSuggestedEdit);
venueManagementRoutes.get('/suggested-edits', requireAuth, requireAdmin(), listSuggestedEdits);
venueManagementRoutes.patch('/suggested-edits/:id', requireAuth, requireAdmin(), reviewSuggestedEdit);
venueManagementRoutes.get('/venue-approvals', requireAuth, requireAdmin(), listPendingVenues);
venueManagementRoutes.patch('/venue-approvals/:id', requireAuth, requireAdmin(), reviewVenueApproval);

export default venueManagementRoutes;
