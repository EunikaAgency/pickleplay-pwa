import { Hono } from 'hono';
import { optionalAuth, requireAuth } from '../../shared/middleware/auth.js';
import { getSettings, updateSettings } from './settings.controller.js';

const settingsRoutes = new Hono();

// Read is public (checkout needs it); write is admin-gated inside the handler.
settingsRoutes.get('/', optionalAuth, getSettings);
settingsRoutes.patch('/', requireAuth, updateSettings);

export default settingsRoutes;
