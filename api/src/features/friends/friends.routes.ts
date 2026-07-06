import { Hono } from 'hono';
import { requireAuth } from '../../shared/middleware/auth.js';
import {
  sendFriendRequest,
  respondToFriendRequest,
  listFriends,
  listPendingRequests,
  removeFriend,
  searchFriendableUsers,
  suggestFriends,
} from './friends.controller.js';

const friendsRoutes = new Hono();

// All friend routes require authentication.
// Literal paths MUST come before parameterized ones.
friendsRoutes.get('/', requireAuth, listFriends);
friendsRoutes.get('/pending', requireAuth, listPendingRequests);
friendsRoutes.get('/search', requireAuth, searchFriendableUsers);
friendsRoutes.get('/suggestions', requireAuth, suggestFriends);
friendsRoutes.post('/request', requireAuth, sendFriendRequest);
friendsRoutes.patch('/request/:id', requireAuth, respondToFriendRequest);
friendsRoutes.delete('/:id', requireAuth, removeFriend);

export default friendsRoutes;
