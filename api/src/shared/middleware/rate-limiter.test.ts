// Pickleballers API — Rate Limiter Tests

import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { rateLimiter, resetRateLimiter, TIERS } from './rate-limiter.js';

/**
 * Stand in for the `clientIdentity` middleware. Tests set the identity directly
 * rather than minting a JWT, so the limiter is exercised in isolation (and the
 * test suite needs no JWT_SECRET).
 */
function identity(clientId: string, clientUser: Record<string, unknown> | null = null) {
  return async (c: any, next: () => Promise<void>) => {
    c.set('clientId', clientId);
    c.set('clientUser', clientUser);
    await next();
  };
}

function createTestApp(identityMw?: ReturnType<typeof identity>) {
  const app = new Hono();
  if (identityMw) app.use('*', identityMw);
  app.use('*', rateLimiter());
  app.get('/test', (c) => c.json({ ok: true }));
  app.get('/batch', (c) => c.json({ ok: true }));
  app.get('/health', (c) => c.json({ ok: true }));
  return app;
}

describe('rateLimiter', () => {
  beforeEach(() => {
    resetRateLimiter();
  });

  it('allows requests within the limit', async () => {
    const app = createTestApp();
    const publicLimit = TIERS.public.max;

    for (let i = 0; i < publicLimit; i++) {
      const res = await app.request('/test');
      expect(res.status).toBe(200);
    }
  });

  it('blocks requests exceeding the limit', async () => {
    const app = createTestApp();
    const publicLimit = TIERS.public.max;

    // Exhaust the limit
    for (let i = 0; i < publicLimit; i++) {
      await app.request('/test');
    }

    // Next request should be rate limited
    const res = await app.request('/test');
    expect(res.status).toBe(429);

    const body = await res.json() as Record<string, unknown>;
    expect((body.error as Record<string, unknown>).code).toBe('RATE_LIMITED');
  });

  it('sets rate limit headers', async () => {
    const app = createTestApp();
    const res = await app.request('/test');

    expect(res.headers.get('X-RateLimit-Limit')).toBeTruthy();
    expect(res.headers.get('X-RateLimit-Remaining')).toBeTruthy();
    expect(res.headers.get('X-RateLimit-Reset')).toBeTruthy();
  });

  it('does not grant the first-party tier to an anonymous caller', async () => {
    // Origin alone is not proof of anything outside a browser — curl can send it.
    const app = createTestApp();
    const res = await app.request('/test', {
      headers: { Origin: 'https://pickleballer.eunika.xyz' },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('X-RateLimit-Limit')).toBe(String(TIERS.public.max));
  });

  it('uses the first-party tier for an authenticated caller on a trusted origin', async () => {
    const app = createTestApp(identity('user:u1', { sub: 'u1', role: 'player' }));
    const res = await app.request('/test', {
      headers: { Origin: 'https://pickleballer.eunika.xyz' },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('X-RateLimit-Limit')).toBe(String(TIERS.firstParty.max));
  });

  it('uses the authenticated tier for a token without a first-party origin', async () => {
    const app = createTestApp(identity('user:u1', { sub: 'u1', role: 'player' }));
    const res = await app.request('/test');

    expect(res.headers.get('X-RateLimit-Limit')).toBe(String(TIERS.authenticated.max));
  });

  it('ignores an x-api-key that is not in the allowlist', async () => {
    const app = createTestApp();
    const res = await app.request('/test', { headers: { 'x-api-key': 'made-up' } });

    // Must fall back to public, not silently grant the third-party tier.
    expect(res.headers.get('X-RateLimit-Limit')).toBe(String(TIERS.public.max));
  });

  it('does not let one user exhaust another user\'s quota', async () => {
    // The whole point of keying by user id: a spammer degrades only themselves,
    // so everyone else's app data keeps loading.
    const noisy = createTestApp(identity('user:noisy', { sub: 'noisy', role: 'player' }));
    for (let i = 0; i < TIERS.authenticated.max; i++) {
      await noisy.request('/test');
    }
    expect((await noisy.request('/test')).status).toBe(429);

    // `quiet` still sees a full, untouched bucket. (Remaining is reported before
    // the current request is counted, so an unused bucket reads exactly `max`.)
    const quiet = createTestApp(identity('user:quiet', { sub: 'quiet', role: 'player' }));
    const res = await quiet.request('/test');
    expect(res.status).toBe(200);
    expect(res.headers.get('X-RateLimit-Remaining')).toBe(String(TIERS.authenticated.max));
  });

  it('does not rate limit preflight requests', async () => {
    const app = createTestApp();

    for (let i = 0; i < TIERS.public.max + 1; i++) {
      await app.request('/test', { method: 'OPTIONS' });
    }

    const res = await app.request('/test', { method: 'OPTIONS' });
    expect(res.status).not.toBe(429);
    expect(res.headers.get('X-RateLimit-Limit')).toBeNull();
  });

  it('never rate limits /health so monitoring answers under load', async () => {
    const app = createTestApp();

    for (let i = 0; i < TIERS.public.max + 5; i++) {
      await app.request('/health');
    }

    const res = await app.request('/health');
    expect(res.status).toBe(200);
  });

  it('uses batch tier for /batch paths', async () => {
    const app = createTestApp();
    const batchLimit = TIERS.batch.max;

    // Exhaust batch limit
    for (let i = 0; i < batchLimit; i++) {
      await app.request('/batch');
    }

    const res = await app.request('/batch');
    expect(res.status).toBe(429);
  });
});
