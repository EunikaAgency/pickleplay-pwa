import { Hono } from 'hono';
import { optionalAuth, requireAuth } from '../../shared/middleware/auth.js';
import {
  listFeed, getPost, listReplies, createPost, editPost, deletePost, reactPost, unreactPost,
  setSignal, hidePost, reportPost, subscribePost, unsubscribePost,
} from './feed.controller.js';

const feedRoutes = new Hono();

// The global PickleFeed. Reading is public (guests can browse, like Threads
// logged-out); writing needs auth and is self-scoped (edit/delete = author-only,
// enforced in the controller). Literal segments before the bare param routes.
feedRoutes.get('/', optionalAuth, listFeed);
feedRoutes.post('/posts', requireAuth, createPost);
feedRoutes.post('/signals', requireAuth, setSignal);
feedRoutes.get('/posts/:postId/replies', optionalAuth, listReplies);
feedRoutes.get('/posts/:postId', optionalAuth, getPost);
feedRoutes.patch('/posts/:postId', requireAuth, editPost);
feedRoutes.delete('/posts/:postId', requireAuth, deletePost);
feedRoutes.post('/posts/:postId/react', requireAuth, reactPost);
feedRoutes.delete('/posts/:postId/react', requireAuth, unreactPost);
feedRoutes.post('/posts/:postId/hide', requireAuth, hidePost);
feedRoutes.post('/posts/:postId/report', requireAuth, reportPost);
feedRoutes.post('/posts/:postId/notify', requireAuth, subscribePost);
feedRoutes.delete('/posts/:postId/notify', requireAuth, unsubscribePost);

export default feedRoutes;
