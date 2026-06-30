import { Hono } from 'hono';
import { requireAuth } from '../../shared/middleware/auth.js';
import { deleteCoachReview, updateCoachReview } from './coach-reviews.controller.js';

const coachReviewsRoutes = new Hono();

coachReviewsRoutes.patch('/:id', requireAuth, updateCoachReview);
coachReviewsRoutes.delete('/:id', requireAuth, deleteCoachReview);

export default coachReviewsRoutes;
