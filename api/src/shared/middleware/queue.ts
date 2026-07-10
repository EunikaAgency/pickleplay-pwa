// Pickleballers API — Concurrency gate + fair request queue
//
// A rate limiter answers "how many requests may this client make?". It does not
// answer "how many requests may the process work on at once?" — and that second
// question is the one that decides whether the API stays up. Node runs one event
// loop against one Mongo pool; a burst of a few hundred simultaneous queries
// does not fail fast, it degrades everything (every request gets slower, health
// checks time out, PM2 restarts the process mid-flight).
//
// So instead of rejecting a burst outright, we admit a bounded number of
// requests concurrently and make the rest WAIT. A waiting request still returns
// real data, just a little later — which is what you want for a user whose app
// is loading. Only when the queue itself is full (or a request has waited past
// the timeout) do we shed load with a 503, because at that point the client is
// better off retrying than holding a socket open.
//
// Fairness is the reason for `maxConcurrentPerClient`. A plain FIFO queue lets a
// single spammer occupy every slot: their 500 queued requests sit ahead of every
// other user, so everyone else's app data waits behind the flood. Capping how
// many slots ONE client may hold at a time — and skipping over that client's
// extra waiters when a slot frees — means an abusive client only ever slows
// itself down. Other users keep loading at full speed.

import type { MiddlewareHandler } from 'hono';
import { getClientIp } from '../lib/client-ip.js';

export interface QueueConfig {
  /** Requests executing at once, process-wide. */
  maxConcurrent: number;
  /** Requests allowed to wait for a slot. Beyond this we shed with 503. */
  maxQueued: number;
  /** Slots a single client may occupy at once. The fairness lever. */
  maxConcurrentPerClient: number;
  /** Waiters a single client may have queued. Stops one client filling the queue. */
  maxQueuedPerClient: number;
  /** How long a request may wait before we give up and shed it. */
  queueTimeoutMs: number;
}

const num = (value: string | undefined, fallback: number) => {
  const parsed = parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

// Defaults sized for the single-process PM2 fork (instances: 1) in front of a
// local Mongo. 64 concurrent handlers keeps the event loop responsive; 512
// waiters is roughly 8s of backlog at typical handler latency, comfortably under
// the 10s shed timeout.
export const DEFAULT_QUEUE_CONFIG: QueueConfig = {
  maxConcurrent: num(process.env.API_MAX_CONCURRENT, 64),
  maxQueued: num(process.env.API_MAX_QUEUED, 512),
  maxConcurrentPerClient: num(process.env.API_MAX_CONCURRENT_PER_CLIENT, 8),
  maxQueuedPerClient: num(process.env.API_MAX_QUEUED_PER_CLIENT, 64),
  queueTimeoutMs: num(process.env.API_QUEUE_TIMEOUT_MS, 10_000),
};

interface Waiter {
  clientKey: string;
  resolve: (admitted: boolean) => void;
  timer: ReturnType<typeof setTimeout>;
  /** Set once the waiter is settled, so dispatch never double-resolves it. */
  settled: boolean;
}

class RequestQueue {
  private active = 0;
  private waiters: Waiter[] = [];
  private activeByClient = new Map<string, number>();
  private queuedByClient = new Map<string, number>();

  constructor(private config: QueueConfig) {}

  get stats() {
    return {
      active: this.active,
      queued: this.waiters.length,
      maxConcurrent: this.config.maxConcurrent,
      maxQueued: this.config.maxQueued,
    };
  }

  private count(map: Map<string, number>, key: string): number {
    return map.get(key) ?? 0;
  }

  private bump(map: Map<string, number>, key: string, delta: number) {
    const next = this.count(map, key) + delta;
    if (next <= 0) map.delete(key);
    else map.set(key, next);
  }

  /** A client may take a slot only if the process and the client both have room. */
  private canRunNow(clientKey: string): boolean {
    return (
      this.active < this.config.maxConcurrent &&
      this.count(this.activeByClient, clientKey) < this.config.maxConcurrentPerClient
    );
  }

  /**
   * Try to acquire a slot. Resolves `true` once admitted, `false` if the request
   * should be shed (queue full, per-client queue full, or waited too long).
   */
  acquire(clientKey: string): Promise<boolean> {
    if (this.canRunNow(clientKey)) {
      this.active++;
      this.bump(this.activeByClient, clientKey, 1);
      return Promise.resolve(true);
    }

    // Shed rather than queue when there is no room to wait. Note the per-client
    // cap is checked first: a flooding client hits ITS ceiling and gets shed
    // while the shared queue still has room for everybody else.
    if (this.count(this.queuedByClient, clientKey) >= this.config.maxQueuedPerClient) return Promise.resolve(false);
    if (this.waiters.length >= this.config.maxQueued) return Promise.resolve(false);

    return new Promise<boolean>((resolve) => {
      const waiter: Waiter = {
        clientKey,
        settled: false,
        resolve,
        timer: setTimeout(() => this.settle(waiter, false), this.config.queueTimeoutMs),
      };
      // Never let a pending timer keep the process alive at shutdown.
      if (typeof waiter.timer === 'object' && 'unref' in waiter.timer) waiter.timer.unref();

      this.waiters.push(waiter);
      this.bump(this.queuedByClient, clientKey, 1);
    });
  }

  /** Resolve a waiter exactly once, removing it from the queue and its counters. */
  private settle(waiter: Waiter, admitted: boolean) {
    if (waiter.settled) return;
    waiter.settled = true;
    clearTimeout(waiter.timer);

    const index = this.waiters.indexOf(waiter);
    if (index !== -1) this.waiters.splice(index, 1);
    this.bump(this.queuedByClient, waiter.clientKey, -1);

    if (admitted) {
      this.active++;
      this.bump(this.activeByClient, waiter.clientKey, 1);
    }
    waiter.resolve(admitted);
  }

  /** Release a held slot and hand it to the next eligible waiter. */
  release(clientKey: string) {
    this.active--;
    this.bump(this.activeByClient, clientKey, -1);
    this.dispatch();
  }

  /**
   * Fair dispatch: walk the queue in arrival order and admit the first waiter
   * whose client is under its per-client cap. Waiters belonging to a client
   * that is already at its cap are SKIPPED, not blocked on — that is what stops
   * one spammer's backlog from delaying every user behind it.
   */
  private dispatch() {
    while (this.active < this.config.maxConcurrent) {
      const next = this.waiters.find((w) => !w.settled && this.canRunNow(w.clientKey));
      if (!next) return;
      this.settle(next, true);
    }
  }

  /** Test helper: drop all state. */
  reset() {
    for (const waiter of [...this.waiters]) this.settle(waiter, false);
    this.active = 0;
    this.waiters = [];
    this.activeByClient.clear();
    this.queuedByClient.clear();
  }
}

let queue = new RequestQueue(DEFAULT_QUEUE_CONFIG);

export function getQueueStats() {
  return queue.stats;
}

/** Test helper: rebuild the queue, optionally with a different config. */
export function resetQueue(config?: Partial<QueueConfig>) {
  queue = new RequestQueue({ ...DEFAULT_QUEUE_CONFIG, ...config });
}

/**
 * Paths that must never occupy a concurrency slot:
 *  - OPTIONS — CORS preflight is bodyless and must always succeed.
 *  - /health — monitoring has to answer precisely when we are saturated,
 *    otherwise PM2/uptime checks kill a process that is merely busy.
 *  - *\/stream — Server-Sent Events hold the connection open for minutes. A
 *    handful of club feed subscribers would permanently consume every slot.
 */
function bypasses(c: any): boolean {
  return c.req.method === 'OPTIONS' || c.req.path === '/health' || c.req.path.endsWith('/stream');
}

export function requestQueue(): MiddlewareHandler {
  return async function queueMiddleware(c, next) {
    if (bypasses(c)) return next();

    // `clientIdentity` resolved this before routing: `user:<id>` when the caller
    // presented a valid token, `ip:<addr>` otherwise. Same key the rate limiter
    // charges, so "one client" means the same thing in both places.
    const clientKey = c.get('clientId') || `ip:${getClientIp(c)}`;

    const admitted = await queue.acquire(clientKey);
    if (!admitted) {
      c.header('Retry-After', '2');
      return c.json(
        {
          error: {
            code: 'SERVER_BUSY',
            message: 'The server is busy. Please retry in a moment.',
          },
          meta: { requestId: c.get('requestId') },
        },
        503,
      );
    }

    try {
      await next();
    } finally {
      queue.release(clientKey);
    }
  };
}
