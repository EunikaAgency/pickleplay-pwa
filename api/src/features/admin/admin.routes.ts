import { Hono } from 'hono';
import { requireAuth } from '../../shared/middleware/auth.js';
import {
  getDashboard,
  listAuditLogs,
  listOwners,
  listReports,
  listReviews,
  listSubscriptions,
  listUsers,
  moderateReview,
  requireAdmin,
  resolveReport,
  updateUser,
} from './admin.controller.js';

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
adminRoutes.get('/audit-logs', listAuditLogs);
adminRoutes.get('/subscriptions', listSubscriptions);

export default adminRoutes;
