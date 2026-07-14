import { Hono } from 'hono';
import { optionalAuth } from '../../shared/middleware/auth.js';
import { discoverFeed } from './play.controller.js';

const playRoutes = new Hono();

// Public, like the browse surfaces it replaces — a guest still gets a ranked feed,
// just one scored without the proximity / skill / social signals.
playRoutes.get('/discover', optionalAuth, discoverFeed);

export default playRoutes;
