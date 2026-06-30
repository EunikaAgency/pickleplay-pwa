import { Hono } from 'hono';
import { requireAuth } from '../../shared/middleware/auth.js';
import { getMe, login, logout, refresh, register, updateMe } from './auth.controller.js';

const authRoutes = new Hono();

authRoutes.post('/register', register);
authRoutes.post('/login', login);
authRoutes.post('/refresh', refresh);
authRoutes.post('/logout', logout);
authRoutes.get('/me', requireAuth, getMe);
authRoutes.patch('/me', requireAuth, updateMe);

export default authRoutes;
