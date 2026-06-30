import { Hono } from 'hono';
import { requireAuth, optionalAuth } from '../../shared/middleware/auth.js';
import {
  createCoachReview, createMyCoach, getCoach, getMyCoach, listCoaches, listCoachReviews, updateMyCoach,
} from './coaches.controller.js';

const coachesRoutes = new Hono();

coachesRoutes.get('/', listCoaches);
coachesRoutes.post('/', requireAuth, createMyCoach);
coachesRoutes.get('/me', requireAuth, getMyCoach);
coachesRoutes.patch('/me', requireAuth, updateMyCoach);
coachesRoutes.get('/:id', getCoach);
coachesRoutes.get('/:id/reviews', optionalAuth, listCoachReviews);
coachesRoutes.post('/:id/reviews', requireAuth, createCoachReview);

export default coachesRoutes;
