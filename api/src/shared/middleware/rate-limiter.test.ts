// Pickleballers API — Rate Limiter Tests

import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { rateLimiter, resetRateLimiter, TIERS } from './rate-limiter.js';

function createTestApp() {
  const app = new Hono();
  app.use('*', rateLimiter());
  app.get('/test', (c) => c.json({ ok: true }));
  app.get('/batch', (c) => c.json({ ok: true }));
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

  it('uses the first-party tier for trusted browser origins', async () => {
    const app = createTestApp();
    const res = await app.request('/test', {
      headers: { Origin: 'https://pickleballer.eunika.xyz' },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('X-RateLimit-Limit')).toBe(String(TIERS.firstParty.max));
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
