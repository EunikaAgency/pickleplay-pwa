import { Hono } from 'hono';
import { optionalAuth, requireAuth } from '../../shared/middleware/auth.js';
import {
  listClubs, createClub, getClub, updateClub, deleteClub,
  listMembers, joinClub, leaveClub, removeMember,
  listRequests, approveRequest, denyRequest,
  listFeed, getPost, listReplies, createPost, editPost, deletePost, reactPost, unreactPost,
  streamClub, listClubMessages, sendClubMessage, editClubMessage, deleteClubMessage,
  getClubStaff, addClubStaff, removeClubStaff,
} from './clubs.controller.js';

const clubsRoutes = new Hono();

// Browse + detail + feed are public (guests window-shop public clubs); writes
// require auth. Routes with a literal second segment are declared before the
// bare /:id so static paths win over the param.
clubsRoutes.get('/', optionalAuth, listClubs);
clubsRoutes.post('/', requireAuth, createClub);

// Membership + host moderation.
clubsRoutes.get('/:id/members', optionalAuth, listMembers);
clubsRoutes.delete('/:id/members/:userId', requireAuth, removeMember);
clubsRoutes.post('/:id/join', requireAuth, joinClub);
clubsRoutes.post('/:id/leave', requireAuth, leaveClub);
clubsRoutes.get('/:id/requests', requireAuth, listRequests);
clubsRoutes.post('/:id/requests/:reqId/approve', requireAuth, approveRequest);
clubsRoutes.post('/:id/requests/:reqId/deny', requireAuth, denyRequest);

// Realtime feed + recursive posts.
clubsRoutes.get('/:id/feed', optionalAuth, listFeed);
clubsRoutes.get('/:id/stream', streamClub); // auth is inline (?token=), not requireAuth
clubsRoutes.post('/:id/posts', requireAuth, createPost);
clubsRoutes.get('/:id/posts/:postId/replies', optionalAuth, listReplies);
clubsRoutes.get('/:id/posts/:postId', optionalAuth, getPost);
clubsRoutes.patch('/:id/posts/:postId', requireAuth, editPost);
clubsRoutes.delete('/:id/posts/:postId', requireAuth, deletePost);
clubsRoutes.post('/:id/posts/:postId/react', requireAuth, reactPost);
clubsRoutes.delete('/:id/posts/:postId/react', requireAuth, unreactPost);

// Member group chat (separate from the feed). Read = member; post adds player.clubs.chat.
clubsRoutes.get('/:id/messages', requireAuth, listClubMessages);
clubsRoutes.post('/:id/messages', requireAuth, sendClubMessage);
clubsRoutes.patch('/:id/messages/:msgId', requireAuth, editClubMessage);
clubsRoutes.delete('/:id/messages/:msgId', requireAuth, deleteClubMessage);

// Per-club staff — host assigns moderators. DELETE is on a global path so it
// doesn't collide with /:id/staff.
clubsRoutes.get('/:id/staff', requireAuth, getClubStaff);
clubsRoutes.post('/:id/staff', requireAuth, addClubStaff);
clubsRoutes.delete('/staff/:id', requireAuth, removeClubStaff);

// Bare /:id last so it never shadows the literal sub-routes above.
clubsRoutes.get('/:id', optionalAuth, getClub);
clubsRoutes.patch('/:id', requireAuth, updateClub);
clubsRoutes.delete('/:id', requireAuth, deleteClub);

export default clubsRoutes;
