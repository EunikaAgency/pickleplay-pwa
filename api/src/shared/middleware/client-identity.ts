// Pickleballers API — Client identity for rate limiting + queueing
//
// `requireAuth`/`optionalAuth` run per-route, i.e. AFTER global middleware. That
// means the rate limiter and the queue — both global — cannot read `c.get('user')`:
// it is always undefined by the time they run. The practical effect is that every
// authenticated request used to be keyed by IP, so everyone behind one NAT (an
// office, a school, a mobile carrier's CGNAT) shared a single quota and one heavy
// user could stall everybody else's app data.
//
// This middleware resolves the caller once, up front, and stashes it under its own
// context key. It deliberately does NOT set `user`: that key is the contract of
// requireAuth/optionalAuth, and populating it here would make routes that never
// applied auth appear authenticated. Verification is local HS256 — a few
// microseconds — so doing it twice per request is not worth optimising away.
//
// Anonymous callers key by IP. Authenticated callers key by user id, which is the
// whole point: one account's traffic can never consume another account's quota or
// concurrency slots.

import type { MiddlewareHandler } from 'hono';
import { verifyToken, type TokenPayload } from '../lib/jwt.js';
import { getClientIp } from '../lib/client-ip.js';

declare module 'hono' {
  interface ContextVariableMap {
    /** Bucket key for limits: `user:<id>` when authenticated, else `ip:<addr>`. */
    clientId: string;
    /** Token payload when the caller presented a valid access token, else null. */
    clientUser: TokenPayload | null;
  }
}

function readToken(c: Parameters<MiddlewareHandler>[0]): string | null {
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);
  return c.req.header('Cookie')?.match(/access_token=([^;]+)/)?.[1] ?? null;
}

export const clientIdentity: MiddlewareHandler = async (c, next) => {
  let user: TokenPayload | null = null;

  const token = readToken(c);
  if (token) {
    try {
      const payload = await verifyToken(token);
      // A refresh token presented as an access token is not an identity we trust
      // for quota purposes — treat it as anonymous and let the route reject it.
      if (!payload.type || payload.type === 'access') user = payload;
    } catch {
      // Invalid or expired: anonymous for limiting. The route's auth middleware
      // is what turns this into a 401 — we only care which bucket to charge.
    }
  }

  c.set('clientUser', user);
  c.set('clientId', user?.sub ? `user:${user.sub}` : `ip:${getClientIp(c)}`);

  await next();
};
