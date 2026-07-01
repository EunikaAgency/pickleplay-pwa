// Pickleballers API — Auth Middleware
// Protects routes by verifying JWT from Authorization header or cookie.

import type { MiddlewareHandler } from 'hono';
import { verifyToken, type TokenPayload } from '../lib/jwt.js';
import { User } from '../../features/auth/auth.model.js';

// Extend Hono's context variables
declare module 'hono' {
  interface ContextVariableMap {
    user: TokenPayload;
  }
}

function getRequestToken(c: Parameters<MiddlewareHandler>[0]): string | null {
  const authHeader = c.req.header('Authorization');
  const cookieToken = c.req.header('Cookie')?.match(/access_token=([^;]+)/)?.[1];

  return authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : cookieToken || null;
}

// Verify a token and confirm it's an access token (not a refresh token used in
// the wrong place). Returns null for anything we won't trust.
async function resolveUser(token: string | null): Promise<TokenPayload | null> {
  if (!token) return null;
  try {
    const user = await verifyToken(token);
    if (user.type && user.type !== 'access') return null;
    return user;
  } catch {
    return null;
  }
}

const unauthorized = (c: Parameters<MiddlewareHandler>[0], message: string) =>
  c.json({ error: { code: 'UNAUTHORIZED', message } }, 401);

/**
 * Require a valid access token. Missing or invalid tokens get a 401 — there is
 * no dev-admin fallback, so unauthenticated requests can never act as a real
 * (or fake) user.
 */
export const requireAuth: MiddlewareHandler = async (c, next) => {
  const token = getRequestToken(c);
  if (!token) return unauthorized(c, 'Authentication required');

  const user = await resolveUser(token);
  if (!user) return unauthorized(c, 'Invalid or expired token');

  c.set('user', user);

  // Fire-and-forget: bump lastActiveAt for presence indicators (chat, etc.).
  // Not awaited — we don't block the response on this write.
  User.updateOne({ _id: user.sub }, { $set: { lastActiveAt: new Date() } }).catch(() => {});

  await next();
};

/**
 * Attach user info when a valid token is present; continue anonymously when none
 * is sent. A token that IS present but invalid/expired is a stale session, not an
 * anonymous request — return 401 so the client transparently refreshes and
 * retries, instead of silently serving anonymous data (e.g. an empty "my games"
 * list for a still-logged-in user whose access token just lapsed).
 */
export const optionalAuth: MiddlewareHandler = async (c, next) => {
  const token = getRequestToken(c);
  if (token) {
    const user = await resolveUser(token);
    if (!user) return unauthorized(c, 'Invalid or expired token');
    c.set('user', user);
  }
  await next();
};
