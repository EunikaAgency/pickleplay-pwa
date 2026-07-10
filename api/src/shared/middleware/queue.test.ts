// Pickleballers API — Request Queue Tests

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import { requestQueue, resetQueue, getQueueStats, type QueueConfig } from './queue.js';

/** A handler whose completion the test controls. */
function deferred() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => { release = resolve; });
  return { promise, release };
}

function createTestApp(clientId: string | ((c: any) => string), gate?: Promise<void>) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    c.set('clientId', typeof clientId === 'string' ? clientId : clientId(c));
    await next();
  });
  app.use('*', requestQueue());
  app.get('/health', (c) => c.json({ ok: true }));
  app.get('/test', async (c) => {
    if (gate) await gate;
    return c.json({ ok: true });
  });
  return app;
}

const config = (overrides: Partial<QueueConfig>) => resetQueue(overrides);

describe('requestQueue', () => {
  beforeEach(() => resetQueue());
  afterEach(() => resetQueue());

  it('runs requests immediately when under capacity', async () => {
    config({ maxConcurrent: 4 });
    const app = createTestApp('ip:1.1.1.1');

    const res = await app.request('/test');
    expect(res.status).toBe(200);
    expect(getQueueStats().active).toBe(0); // released after completion
  });

  it('queues excess requests and serves them rather than rejecting', async () => {
    config({ maxConcurrent: 1, maxQueued: 10, maxConcurrentPerClient: 1, maxQueuedPerClient: 10 });
    const gate = deferred();
    const app = createTestApp('ip:1.1.1.1', gate.promise);

    const inFlight = [app.request('/test'), app.request('/test'), app.request('/test')];

    // Let the middleware settle: one running, two waiting — none rejected.
    await new Promise((r) => setImmediate(r));
    expect(getQueueStats().active).toBe(1);
    expect(getQueueStats().queued).toBe(2);

    gate.release();
    const results = await Promise.all(inFlight);
    expect(results.map((r) => r.status)).toEqual([200, 200, 200]);
  });

  it('sheds with 503 once the queue is full', async () => {
    config({ maxConcurrent: 1, maxQueued: 1, maxConcurrentPerClient: 5, maxQueuedPerClient: 5 });
    const gate = deferred();
    const app = createTestApp('ip:1.1.1.1', gate.promise);

    const running = app.request('/test');
    const queued = app.request('/test');
    await new Promise((r) => setImmediate(r));

    const shed = await app.request('/test');
    expect(shed.status).toBe(503);
    expect(shed.headers.get('Retry-After')).toBe('2');
    const body = await shed.json() as any;
    expect(body.error.code).toBe('SERVER_BUSY');

    gate.release();
    expect((await running).status).toBe(200);
    expect((await queued).status).toBe(200);
  });

  it('sheds a waiter that exceeds the queue timeout', async () => {
    config({ maxConcurrent: 1, maxQueued: 10, maxConcurrentPerClient: 1, queueTimeoutMs: 30 });
    const gate = deferred();
    const app = createTestApp('ip:1.1.1.1', gate.promise);

    const running = app.request('/test');
    const timedOut = await app.request('/test');

    expect(timedOut.status).toBe(503);
    gate.release();
    expect((await running).status).toBe(200);
  });

  it('caps how many slots one client can hold, so another client is not starved', async () => {
    // The fairness guarantee: a flooding client must not push everyone else's
    // requests behind its backlog.
    config({ maxConcurrent: 2, maxQueued: 20, maxConcurrentPerClient: 1, maxQueuedPerClient: 20 });
    const gate = deferred();
    const app = createTestApp((c) => c.req.header('x-who')!, gate.promise);

    const flood = [
      app.request('/test', { headers: { 'x-who': 'user:noisy' } }),
      app.request('/test', { headers: { 'x-who': 'user:noisy' } }),
      app.request('/test', { headers: { 'x-who': 'user:noisy' } }),
    ];
    await new Promise((r) => setImmediate(r));

    // noisy holds exactly 1 slot; its other 2 requests wait.
    expect(getQueueStats().active).toBe(1);
    expect(getQueueStats().queued).toBe(2);

    // The quiet user is admitted straight away, ahead of noisy's backlog.
    const quiet = app.request('/test', { headers: { 'x-who': 'user:quiet' } });
    await new Promise((r) => setImmediate(r));
    expect(getQueueStats().active).toBe(2);

    gate.release();
    expect((await quiet).status).toBe(200);
    expect((await Promise.all(flood)).map((r) => r.status)).toEqual([200, 200, 200]);
  });

  it('sheds a single client\'s excess without consuming the shared queue', async () => {
    config({ maxConcurrent: 1, maxQueued: 20, maxConcurrentPerClient: 1, maxQueuedPerClient: 1 });
    const gate = deferred();
    const app = createTestApp((c) => c.req.header('x-who')!, gate.promise);

    const running = app.request('/test', { headers: { 'x-who': 'user:noisy' } });
    const queued = app.request('/test', { headers: { 'x-who': 'user:noisy' } });
    await new Promise((r) => setImmediate(r));

    // noisy is at its per-client queue cap -> shed, while the shared queue is
    // still 19/20 empty for other users.
    const shed = await app.request('/test', { headers: { 'x-who': 'user:noisy' } });
    expect(shed.status).toBe(503);
    expect(getQueueStats().queued).toBe(1);

    gate.release();
    expect((await running).status).toBe(200);
    expect((await queued).status).toBe(200);
  });

  it('never queues /health', async () => {
    config({ maxConcurrent: 1, maxQueued: 0, maxConcurrentPerClient: 1 });
    const gate = deferred();
    const app = createTestApp('ip:1.1.1.1', gate.promise);

    const saturating = app.request('/test');
    await new Promise((r) => setImmediate(r));

    const health = await app.request('/health');
    expect(health.status).toBe(200);

    gate.release();
    await saturating;
  });

  it('releases the slot when a handler throws', async () => {
    config({ maxConcurrent: 1 });
    const app = new Hono();
    app.use('*', async (c, next) => { c.set('clientId', 'ip:1.1.1.1'); await next(); });
    app.use('*', requestQueue());
    app.get('/boom', () => { throw new Error('handler exploded'); });
    app.onError((_e, c) => c.json({ error: 'boom' }, 500));

    expect((await app.request('/boom')).status).toBe(500);
    expect(getQueueStats().active).toBe(0);
  });
});
