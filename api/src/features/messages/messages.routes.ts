import { Hono } from 'hono';
import { requireAuth } from '../../shared/middleware/auth.js';
import {
  listConversations,
  startConversation,
  getConversation,
  sendMessage,
  deleteConversation,
  deleteMessage,
  unreadMessageCount,
  getVenueConversation,
} from './messages.controller.js';

// Direct 1:1 messaging. All routes require auth; send/start additionally check
// the `user.messages.send` permission inside the controller.
const messagesRoutes = new Hono();

// Static segment before `:id` matchers.
messagesRoutes.get('/venue/:venueId', requireAuth, getVenueConversation);
messagesRoutes.get('/conversations', requireAuth, listConversations);
messagesRoutes.post('/conversations', requireAuth, startConversation);
messagesRoutes.get('/unread-count', requireAuth, unreadMessageCount);
messagesRoutes.get('/conversations/:id', requireAuth, getConversation);
messagesRoutes.delete('/conversations/:id', requireAuth, deleteConversation);
messagesRoutes.post('/conversations/:id/messages', requireAuth, sendMessage);
messagesRoutes.delete('/conversations/:id/messages/:msgId', requireAuth, deleteMessage);

export default messagesRoutes;
