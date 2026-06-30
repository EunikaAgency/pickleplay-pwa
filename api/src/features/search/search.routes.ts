import { Hono } from 'hono';
import { optionalAuth } from '../../shared/middleware/auth.js';
import { search } from './search.controller.js';

const searchRoutes = new Hono();

// optionalAuth so a signed-in user can be excluded from their own people search.
searchRoutes.get('/', optionalAuth, search);

export default searchRoutes;
