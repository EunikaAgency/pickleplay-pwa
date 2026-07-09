import { Hono } from 'hono';
import { requireAuth } from '../../shared/middleware/auth.js';
import { getOwnerPartners } from './partners.controller.js';

const partnersRoutes = new Hono();

partnersRoutes.get('/owner', requireAuth, getOwnerPartners);

export default partnersRoutes;
