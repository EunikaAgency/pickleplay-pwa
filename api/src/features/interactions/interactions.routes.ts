import { Hono } from 'hono';
import { requireAuth } from '../../shared/middleware/auth.js';
import {
  addFavorite,
  createReviewReply,
  createVenueReview,
  deleteReview,
  deleteReviewReply,
  listFavorites,
  listNotifications,
  deleteNotification,
  markAllNotificationsRead,
  markNotificationRead,
  reportNotification,
  unreadNotificationCount,
  removeFavorite,
  reportReview,
  streamUserEvents,
  updateReview,
  updateReviewReply,
} from './interactions.controller.js';

const interactionsRoutes = new Hono();

interactionsRoutes.post('/venues/:id/reviews', requireAuth, createVenueReview);
interactionsRoutes.patch('/reviews/:id', requireAuth, updateReview);
interactionsRoutes.delete('/reviews/:id', requireAuth, deleteReview);
interactionsRoutes.get('/favorites', requireAuth, listFavorites);
interactionsRoutes.post('/favorites', requireAuth, addFavorite);
interactionsRoutes.delete('/favorites/:id', requireAuth, removeFavorite);
// Per-user realtime SSE stream (notifications + incoming messages). Auth is
// inline via ?token= (EventSource can't set an Authorization header), so it is
// NOT behind requireAuth.
interactionsRoutes.get('/me/stream', streamUserEvents);
interactionsRoutes.get('/notifications', requireAuth, listNotifications);
interactionsRoutes.get('/notifications/unread-count', requireAuth, unreadNotificationCount);
// Literal route MUST come before the parameterized ':id' route, else
// '/notifications/mark-all-read' is captured as :id (→ ObjectId cast error).
interactionsRoutes.patch('/notifications/mark-all-read', requireAuth, markAllNotificationsRead);
interactionsRoutes.patch('/notifications/:id', requireAuth, markNotificationRead);
interactionsRoutes.delete('/notifications/:id', requireAuth, deleteNotification);
interactionsRoutes.post('/notifications/:id/report', requireAuth, reportNotification);
interactionsRoutes.post('/reviews/:id/reply', requireAuth, createReviewReply);
interactionsRoutes.patch('/reviews/:id/reply', requireAuth, updateReviewReply);
interactionsRoutes.delete('/reviews/:id/reply', requireAuth, deleteReviewReply);
interactionsRoutes.post('/reviews/:id/report', requireAuth, reportReview);

export default interactionsRoutes;
