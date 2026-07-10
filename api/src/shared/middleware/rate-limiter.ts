// Pickleballers API — Rate Limiting Middleware
// In-memory sliding window, keyed per identity (user id when authenticated, IP
// otherwise) so one caller's traffic can never spend another caller's quota.
//
// This limiter is the ABUSE backstop, not the overload backstop. Overload is
// handled by the concurrency gate in `queue.ts`, which makes excess requests
// wait for a slot instead of failing them — a user whose app is loading gets
// their data, just slightly later. Limits here are therefore deliberately
// generous: they exist to stop a script hammering the API for hours, not to
// throttle a normal burst. Tune down only if abuse shows up in logs.

import type { MiddlewareHandler } from 'hono';
import { hasPermission } from '../lib/permissions.js';
import { getClientIp } from '../lib/client-ip.js';

// A single SPA page view fans out into many parallel GETs (venue + faqs + courts
// + reviews + coaches + images), so a tight cap trips during normal browsing —
// and a tripped limit surfaces in the browser as a confusing CORS error.
const TIERS = {
  // Anonymous, keyed per IP. Must stay modest: a whole NAT shares one bucket,
  // but so does an attacker with one address.
  public:        { windowMs: 60_000,    max: 600  },
  // Dedicated bucket per IP so password attempts are neither starved by nor
  // counted against general browsing. Still tight enough to slow brute force.
  login:         { windowMs: 60_000,    max: 60   },
  // Keyed per USER from here down — a spammer only ever exhausts their own quota.
  authenticated: { windowMs: 60_000,    max: 1000 },
  // Logged in AND on a first-party origin: the PWA/web owner dashboards fan out
  // heavily. Per-user, so the higher ceiling costs nobody else anything.
  firstParty:    { windowMs: 60_000,    max: 5000 },
  admin:         { windowMs: 60_000,    max: 3000 },
  batch:         { windowMs: 60_000,    max: 60   },
  // Keyed per API key, not per IP.
  thirdParty:    { windowMs: 3_600_000, max: 5000 },
} as const;

type Tier = keyof typeof TIERS;

const DEFAULT_FIRST_PARTY_ORIGINS = [
  'https://pickleballer.eunika.xyz',
  'https://pickleballer-pwa.eunika.xyz',
];

// `undefined` -> use the fallback. An explicit empty string -> an empty set, so
// "FIRST_PARTY_ORIGINS=" really does disable the tier instead of resurrecting
// the defaults.
const csv = (value: string | undefined, fallback: string[]) =>
  new Set((value ?? fallback.join(',')).split(',').map((s) => s.trim()).filter(Boolean));

const firstPartyOrigins = csv(process.env.FIRST_PARTY_ORIGINS, DEFAULT_FIRST_PARTY_ORIGINS);
// Unset by default: with no allowlist, no `x-api-key` is honoured and the caller
// is treated as anonymous. Previously ANY value in this header bought a higher
// tier, which made the header a free upgrade for anyone who guessed it existed.
const apiKeys = csv(process.env.API_KEYS, []);

interface WindowEntry {
  timestamps: number[];
}

// In-memory store with periodic cleanup
const store = new Map<string, WindowEntry>();
const CLEANUP_INTERVAL = 60_000; // clean every 60s

// Start cleanup timer (only in non-test environments)
let cleanupTimer: ReturnType<typeof setInterval> | null = null;
if (process.env.NODE_ENV !== 'test') {
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      // Remove entries older than the longest window (1 hour)
      entry.timestamps = entry.timestamps.filter(t => now - t < 3_600_000);
      if (entry.timestamps.length === 0) store.delete(key);
    }
  }, CLEANUP_INTERVAL);
  // Allow the process to exit even if the timer is still running
  if (cleanupTimer && typeof cleanupTimer === 'object' && 'unref' in cleanupTimer) {
    (cleanupTimer as NodeJS.Timeout).unref();
  }
}

/** The API key on the request, but only if it is one we actually issued. */
function validApiKey(c: any): string | null {
  const key = c.req.header('x-api-key');
  return key && apiKeys.has(key) ? key : null;
}

function resolve(c: any): { tier: Tier; key: string } {
  // `clientIdentity` ran before us: `user:<id>` for a verified token, else `ip:<addr>`.
  const identity: string = c.get('clientId') || `ip:${getClientIp(c)}`;
  const user = c.get('clientUser') as { sub?: string; role?: string; permissions?: string[]; roles?: string[] } | null;
  const path = c.req.path;

  if (path.includes('/batch')) return { tier: 'batch', key: identity };
  if (path.endsWith('/auth/login')) return { tier: 'login', key: `ip:${getClientIp(c)}` };

  const apiKey = validApiKey(c);
  if (apiKey) return { tier: 'thirdParty', key: `key:${apiKey}` };

  if (user?.sub) {
    // Origin is set by the browser and cannot be forged by page JS. A non-browser
    // client can still send anything — but this branch requires a valid token
    // first, so the worst case is an authenticated user raising their OWN ceiling.
    const origin = c.req.header('origin');
    if (origin && firstPartyOrigins.has(origin)) return { tier: 'firstParty', key: identity };
    if (hasPermission(user, 'admin.access')) return { tier: 'admin', key: identity };
    return { tier: 'authenticated', key: identity };
  }

  return { tier: 'public', key: identity };
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number; // timestamp in ms when the window resets
}

export function rateLimiter(): MiddlewareHandler {
  return async function rateLimitMiddleware(c, next) {
    // Never rate-limit CORS preflight: OPTIONS requests are automatic, bodyless,
    // and must always succeed — counting or blocking them would break the actual
    // cross-origin request the browser is about to make. (With cors() registered
    // first these are normally answered before reaching here, but this keeps the
    // limiter correct regardless of middleware order.) /health is exempt so that
    // monitoring still answers while a noisy client is being throttled.
    if (c.req.method === 'OPTIONS' || c.req.path === '/health') return next();

    const { tier, key: identity } = resolve(c);
    const config = TIERS[tier];
    const key = `${tier}:${identity}`;
    const now = Date.now();

    let entry = store.get(key);
    if (!entry) {
      entry = { timestamps: [] };
      store.set(key, entry);
    }

    // Remove timestamps outside the window
    entry.timestamps = entry.timestamps.filter(t => now - t < config.windowMs);

    const remaining = Math.max(0, config.max - entry.timestamps.length);
    const windowStart = now - (now % config.windowMs);
    const reset = windowStart + config.windowMs;

    // Set rate limit headers
    c.header('X-RateLimit-Limit', String(config.max));
    c.header('X-RateLimit-Remaining', String(remaining));
    c.header('X-RateLimit-Reset', String(Math.ceil(reset / 1000)));

    if (remaining <= 0) {
      c.header('Retry-After', String(Math.ceil((reset - now) / 1000)));
      return c.json({
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please wait before retrying.',
          details: [{ field: 'rateLimit', message: `Limit: ${config.max} per ${config.windowMs / 1000}s`, code: 'rate_limit' }],
        },
        meta: { requestId: c.get('requestId') },
      }, 429);
    }

    entry.timestamps.push(now);
    await next();
  };
}

// Cleanup for test teardown
export function resetRateLimiter() {
  store.clear();
}

export { TIERS, type Tier };
