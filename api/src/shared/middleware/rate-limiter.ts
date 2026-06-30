// Pickleballers API — Rate Limiting Middleware
// In-memory sliding window with 5 tiers (Public, Authenticated, Batch, Admin, Third-Party).
// Falls back to a no-op limiter if Redis is unavailable (graceful degradation).
import { hasPermission } from '../lib/permissions.js';

// Limits are intentionally generous: a single SPA page view fans out into many
// parallel GETs (venue + faqs + courts + reviews + coaches + images), so a tight
// public cap trips during normal browsing — and a tripped limit surfaces in the
// browser as a confusing CORS error. Tune down only if abuse shows up in logs.
const TIERS = {
  public:      { windowMs: 60_000,  max: 300  },  // 300 req/min per IP (anonymous browsing)
  login:       { windowMs: 60_000,  max: 60   },  // 60 login attempts/min per IP — dedicated bucket, brute-force guard
  firstParty:  { windowMs: 60_000,  max: 5000 },  // first-party web/PWA origins can fan out heavily during owner/admin workflows
  authenticated: { windowMs: 60_000,  max: 1000 }, // 1000 req/min per user
  batch:       { windowMs: 60_000,  max: 60   },  // 60 req/min (POST /batch)
  admin:       { windowMs: 60_000,  max: 2000 },  // 2000 req/min
  thirdParty:  { windowMs: 3_600_000, max: 5000 }, // 5000 req/hr per API key
} as const;

type Tier = keyof typeof TIERS;

const DEFAULT_FIRST_PARTY_ORIGINS = [
  'https://pickleballer.eunika.xyz',
  'https://pickleballer-pwa.eunika.xyz',
];

const firstPartyOrigins = new Set(
  (process.env.FIRST_PARTY_ORIGINS || DEFAULT_FIRST_PARTY_ORIGINS.join(','))
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
);

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

function getClientKey(c: any): string {
  // For authenticated users, key by userId; otherwise by IP
  const user = c.get('user') as { sub?: string } | undefined;
  if (user?.sub) return `user:${user.sub}`;

  const forwarded = c.req.header('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || c.req.header('x-real-ip') || 'unknown';
  return `ip:${ip}`;
}

function getTier(c: any): Tier {
  const user = c.get('user') as { role?: string } | undefined;
  const path = c.req.path;
  const origin = c.req.header('origin');

  if (path.includes('/batch')) return 'batch';
  // Login gets its own lenient bucket so password attempts aren't starved by
  // (or counted against) general public browsing — a forgetful user shouldn't
  // get locked out of the whole API after a few tries. Still capped per IP to
  // slow brute force.
  if (path.endsWith('/auth/login')) return 'login';
  if (hasPermission(user, 'admin.access')) return 'admin';

  // Third-party API key check
  const apiKey = c.req.header('x-api-key');
  if (apiKey) return 'thirdParty';

  if (origin && firstPartyOrigins.has(origin)) return 'firstParty';

  if (user) return 'authenticated';
  return 'public';
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number; // timestamp in ms when the window resets
}

export function rateLimiter() {
  return async function rateLimitMiddleware(c: any, next: () => Promise<void>) {
    // Never rate-limit CORS preflight: OPTIONS requests are automatic, bodyless,
    // and must always succeed — counting or blocking them would break the actual
    // cross-origin request the browser is about to make. (With cors() registered
    // first these are normally answered before reaching here, but this keeps the
    // limiter correct regardless of middleware order.)
    if (c.req.method === 'OPTIONS') return next();

    const tier = getTier(c);
    const config = TIERS[tier];
    const key = `${tier}:${getClientKey(c)}`;
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
