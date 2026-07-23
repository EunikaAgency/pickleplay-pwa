import { Hono } from 'hono';
import { requireAuth } from '../../shared/middleware/auth.js';
import {
  deactivatePartnerSubscription,
  getDashboard,
  listAuditLogs,
  listOwners,
  listPartnerSubscriptions,
  listReports,
  listFeedReports,
  listReviews,
  listSubscriptions,
  listUsers,
  moderateReview,
  requireAdmin,
  resolveReport,
  resolveFeedReport,
  updateUser,
} from './admin.controller.js';
import dataOpsRoutes from '../data-ops/data-ops.routes.js';

const adminRoutes = new Hono();

adminRoutes.use('/*', requireAuth, requireAdmin);
adminRoutes.get('/dashboard', getDashboard);
adminRoutes.get('/users', listUsers);
adminRoutes.patch('/users/:id', updateUser);
adminRoutes.get('/owners', listOwners);
adminRoutes.get('/reviews', listReviews);
adminRoutes.patch('/reviews/:id', moderateReview);
adminRoutes.get('/reports', listReports);
adminRoutes.patch('/reports/:id', resolveReport);
adminRoutes.get('/feed-reports', listFeedReports);
adminRoutes.patch('/feed-reports/:id', resolveFeedReport);
adminRoutes.get('/audit-logs', listAuditLogs);
// The newsletter mailing list…
adminRoutes.get('/subscriptions', listSubscriptions);
// …and the PAID coach/organizer plans, which an admin may end on the spot
// (unlike the user's own cancel, which only takes effect at the term's end).
adminRoutes.get('/partner-subscriptions', listPartnerSubscriptions);
adminRoutes.delete('/partner-subscriptions/:id', deactivatePartnerSubscription);

export default adminRoutes;
