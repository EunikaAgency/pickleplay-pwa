import { Hono } from 'hono';
import { requireAuth, optionalAuth } from '../../shared/middleware/auth.js';
import { getMedia, uploadMedia } from './media.controller.js';

const mediaRoutes = new Hono();

mediaRoutes.post('/upload', requireAuth, uploadMedia);
mediaRoutes.get('/:id', optionalAuth, getMedia);

export default mediaRoutes;
