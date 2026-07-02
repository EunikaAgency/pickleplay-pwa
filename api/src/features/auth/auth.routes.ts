import { Hono } from 'hono';
import { requireAuth } from '../../shared/middleware/auth.js';
import { forgotPassword, getMe, gmailCallback, gmailOAuthUrl, gmailStatus, login, logout, refresh, register, resendVerification, resetPassword, updateMe, verifyEmail } from './auth.controller.js';

const authRoutes = new Hono();

authRoutes.post('/register', register);
authRoutes.post('/login', login);
authRoutes.post('/refresh', refresh);
authRoutes.post('/logout', logout);
authRoutes.post('/forgot-password', forgotPassword);
authRoutes.post('/reset-password', resetPassword);
authRoutes.post('/verify-email', verifyEmail);
authRoutes.post('/resend-verification', requireAuth, resendVerification);
authRoutes.get('/gmail-oauth-url', gmailOAuthUrl);
authRoutes.get('/gmail-callback', gmailCallback);
authRoutes.get('/gmail-status', gmailStatus);
authRoutes.get('/me', requireAuth, getMe);
authRoutes.patch('/me', requireAuth, updateMe);

export default authRoutes;
