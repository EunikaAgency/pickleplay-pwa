import { Hono } from 'hono';
import { optionalAuth } from '../../shared/middleware/auth.js';
import { getPublicUser } from './users.controller.js';

const usersRoutes = new Hono();

// Public read, like a venue or club detail — the projection itself is what
// keeps private fields out, so guests may view a player's profile card.
usersRoutes.get('/:id', optionalAuth, getPublicUser);

export default usersRoutes;
