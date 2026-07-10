import 'dotenv/config';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { compress } from 'hono/compress';

import { errorHandler } from './shared/middleware/error-handler.js';
import { requestId } from './shared/middleware/request-id.js';
import { clientIdentity } from './shared/middleware/client-identity.js';
import { rateLimiter } from './shared/middleware/rate-limiter.js';
import { requestQueue } from './shared/middleware/queue.js';
import routesRouter from './routes/index.js';
import { connectDb } from './shared/db/index.js';
import { loadRolePermissionsCache, seedSystemRoles } from './features/roles/roles.controller.js';

const app = new Hono();

/* ─── Global Middleware ──────────────────────────────────── */

app.use('*', logger());
// CORP defaults to 'same-origin' under secureHeaders(); for a public API
// being read from sibling subdomains (pickleballer.eunika.xyz,
// pickleballer-pwa.eunika.xyz) we need 'cross-origin', or browsers
// reject responses with ERR_BLOCKED_BY_RESPONSE.NotSameOrigin even
// when CORS headers are correct.
app.use('*', secureHeaders({
  crossOriginResourcePolicy: 'cross-origin',
  crossOriginEmbedderPolicy: false,
}));
app.use('*', requestId);

/* ─── CORS — must run BEFORE anything that can short-circuit ──
 * CORS is registered ahead of the rate limiter, the body-size guard, and the
 * route handlers on purpose. Hono's cors() sets the Access-Control-* headers on
 * c.res *before* calling next(), and Hono merges those headers onto whatever
 * response downstream produces. So an early 429 (rate limiter), 413 (body size),
 * 404, or 500 (onError) all still carry Access-Control-Allow-Origin. If cors ran
 * last, those early responses would reach the browser with no CORS header and
 * surface as a misleading "No 'Access-Control-Allow-Origin' header" error that
 * masks the real status (this is exactly what a rate-limited PWA hit). Putting
 * cors first also means OPTIONS preflights are answered (204) here and never
 * reach — or get counted by — the rate limiter.
 *
 * CORS_ORIGIN supports a single value, a comma-separated list, or '*' to
 * allow all. With credentials, browsers reject '*' on responses to credentialed
 * requests, so reflect the request Origin only if it's in the allowlist.
 *
 * Default allowlist: only the app (PWA) and web frontends. When CORS_ORIGIN is
 * unset we fall back to this — never to '*' — so a missing/typo'd env can't
 * silently open the API to every origin. Production sets CORS_ORIGIN explicitly
 * via PM2 (ecosystem.config.json); set CORS_ORIGIN='*' to deliberately allow all.
 */
const DEFAULT_CORS_ORIGINS = [
  'https://pickleballer.eunika.xyz',      // web
  'https://pickleballer-pwa.eunika.xyz',  // app (PWA)
  'http://localhost:9001',                // web dev/preview
  'http://localhost:9000',                // app dev/preview
  'http://localhost:5173',                // vite dev default
];
const corsAllowlist = (process.env.CORS_ORIGIN || DEFAULT_CORS_ORIGINS.join(','))
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
const corsAllowAll = corsAllowlist.includes('*');

app.use('*', cors({
  origin: (origin) => {
    if (!origin) return undefined;
    if (corsAllowAll) return origin;
    return corsAllowlist.includes(origin) ? origin : null;
  },
  credentials: true,
  allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: [
    'Accept',
    'Authorization',
    'Content-Type',
    'Origin',
    'X-Client-Version',
    'X-Requested-With',
    'X-Request-ID',
  ],
  exposeHeaders: [
    'Content-Length',
    'Retry-After',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
    'X-Request-ID',
  ],
  maxAge: 86_400,
}));

// Compress everything EXCEPT Server-Sent Events streams: compress() buffers the
// response, which would stall a text/event-stream so clients see nothing until
// the connection closes. The club feed stream (/clubs/:id/stream) must flush.
const compressMw = compress();
app.use('*', (c, next) => (c.req.path.endsWith('/stream') ? next() : compressMw(c, next)));

// Resolve who is calling BEFORE anything that meters them. Route-level
// requireAuth/optionalAuth run too late for the limiter and the queue to see a
// user, so both would otherwise key every request by IP — lumping a whole NAT
// (office, campus, mobile carrier) into one shared bucket.
app.use('*', clientIdentity);
app.use('*', rateLimiter());

/* ─── Request Body Size Limit ──────────────────────────── */

app.use('*', async (c, next) => {
  // Media uploads (cover photos, post images/gifs) are multipart and legitimately
  // larger than JSON requests — the 10MB cap is enforced inside the media handler
  // (media.controller.ts). Exempt only that one path; every other route keeps the
  // 1MB JSON guard.
  const isMediaUpload = c.req.path.endsWith('/media/upload');
  const contentLength = parseInt(c.req.header('Content-Length') || '0', 10);
  if (!isMediaUpload && contentLength > 1_048_576) {
    return c.json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body exceeds 1MB limit' } }, 413);
  }
  await next();
});

/* ─── Static assets (/images/* → uploads/images/*) ──────── */
// Image URLs in Mongo are stored as `/images/venues/<slug>/<file>`.
// The import script mirrors the JPEG payload from
// real-data/handoff/images/ into uploads/images/. If the source
// payload is missing, requests 404 cleanly.

app.use('/images/*', serveStatic({ root: './uploads' }));

// Owner-uploaded media (media.controller writes to ./uploads/<file> and returns
// `/uploads/<file>`). Serve it from the repo root so `/uploads/<file>` resolves
// to `./uploads/<file>` — without this, freshly uploaded photos 404.
app.use('/uploads/*', serveStatic({ root: './' }));

/* ─── Concurrency gate ─────────────────────────────────── */
// Registered after the static mounts and before the API routes, so it only
// meters DB-bound handlers — the actual choke point. Serving an image off disk
// should never wait behind a queue, and an SSE stream must never hold a slot
// (see the bypass list in queue.ts).
//
// Excess requests WAIT here rather than being rejected: a burst gets served a
// little slower instead of erroring, and only a full queue sheds 503s.
app.use('*', requestQueue());

/* ─── Directory Routes ─────────────────────────────────── */

app.route('/', routesRouter);

/* ─── Error Handler ────────────────────────────────────── */

app.onError(errorHandler);

/* ─── Start Server ─────────────────────────────────────── */

const port = parseInt(process.env.PORT || '3000', 10);

if (process.env.NODE_ENV !== 'test') {
  connectDb()
    .then(async () => {
      await seedSystemRoles();
      await loadRolePermissionsCache();
      console.log(`⚡ Pickleballers API listening on :${port}`);
      console.log(`   Health check: http://localhost:${port}/health`);
      serve({ fetch: app.fetch, port });

      // ── Automated dynamic pricing cron ──
      // Runs once every 24h at ~3am local time. Scans all opted-in venues,
      // computes demand-based suggestions, and auto-applies high-confidence
      // adjustments without owner intervention.
      const scheduleAutoPricing = () => {
        const now = new Date();
        const msUntil3am = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 3, 0, 0).getTime() - now.getTime();
        const oneDay = 24 * 60 * 60 * 1000;
        setTimeout(() => {
          console.log('[auto-pricing] Starting daily run...');
          import('./features/demand/demand.controller.js')
            .then(({ runAutoDynamicPricing }) => runAutoDynamicPricing(null as any))
            .then((result) => console.log('[auto-pricing]', result.summary))
            .catch((err) => console.warn('[auto-pricing] run failed:', (err as Error).message));
          setInterval(() => {
            console.log('[auto-pricing] Starting daily run...');
            import('./features/demand/demand.controller.js')
              .then(({ runAutoDynamicPricing }) => runAutoDynamicPricing(null as any))
              .then((result) => console.log('[auto-pricing]', result.summary))
              .catch((err) => console.warn('[auto-pricing] run failed:', (err as Error).message));
          }, oneDay);
        }, msUntil3am);
        console.log(`[auto-pricing] Scheduled. First run in ${Math.round(msUntil3am / 3600000)}h.`);
      };
      scheduleAutoPricing();
    })
    .catch((err) => {
      console.error('Failed to connect to MongoDB:', err);
      process.exit(1);
    });
}

export default app;
export type AppType = typeof app;
