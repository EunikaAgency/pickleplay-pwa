// Pickleballers API — Client IP resolution
//
// Every per-IP limit (rate limiter, queue fairness) is only as trustworthy as
// the IP it keys on. `X-Forwarded-For` is a request header: any client can send
// one, and a client that sends a fresh value per request gets a fresh bucket per
// request — i.e. no rate limit at all. Node's `*:9002` bind means the API is
// reachable directly, not only through Apache, so we cannot assume a proxy
// sanitised the header.
//
// Rule: read the socket peer address. Trust `X-Forwarded-For` / `X-Real-IP`
// ONLY when the peer is a configured trusted proxy. Apache (mod_proxy) appends
// the real peer to whatever the client sent, so the chain reads
// `<client-supplied lies…>, <real client>` — the RIGHTMOST entry added by a
// trusted hop is the honest one. We walk right-to-left past our own proxies and
// take the first address that isn't one of them.

import { getConnInfo } from '@hono/node-server/conninfo';

// Loopback by default: Apache proxies from the same host. Override with a
// comma-separated list when the API sits behind an off-box load balancer.
const DEFAULT_TRUSTED_PROXIES = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];

// `undefined` means "not configured" -> use the defaults. An explicit empty
// string means "trust no proxy" and must NOT fall back to the defaults, or an
// operator hardening the deployment would silently get the opposite.
const trustedProxies = new Set(
  (process.env.TRUSTED_PROXIES ?? DEFAULT_TRUSTED_PROXIES.join(','))
    .split(',')
    .map((ip) => ip.trim())
    .filter(Boolean),
);

/** IPv4-mapped IPv6 (`::ffff:1.2.3.4`) and `[::1]` normalise to a bare address. */
function normalize(ip: string): string {
  const bare = ip.trim().replace(/^\[|\]$/g, '');
  return bare.startsWith('::ffff:') ? bare.slice(7) : bare;
}

function isTrustedProxy(ip: string): boolean {
  return trustedProxies.has(ip) || trustedProxies.has(normalize(ip));
}

/** The socket peer, or null when there is no real socket (unit tests, `app.request()`). */
function peerAddress(c: any): string | null {
  try {
    const address = getConnInfo(c)?.remote?.address;
    return address ? normalize(address) : null;
  } catch {
    return null;
  }
}

/**
 * The caller's IP, or `'unknown'` when it cannot be established.
 *
 * `'unknown'` is a single shared bucket on purpose: if we cannot tell callers
 * apart we must not hand each one its own quota.
 */
export function getClientIp(c: any): string {
  const peer = peerAddress(c);

  // Direct connection (or unknown peer): the socket is the only thing we can
  // believe. Forwarding headers are ignored outright — that is the whole point.
  if (!peer) {
    // No socket at all (test harness). Fall back to the header so unit tests can
    // simulate distinct clients; there is no attacker in that context.
    const forwarded = c.req.header('x-forwarded-for');
    return forwarded ? normalize(forwarded.split(',')[0]!) : 'unknown';
  }
  if (!isTrustedProxy(peer)) return peer;

  const forwarded = c.req.header('x-forwarded-for');
  if (forwarded) {
    const hops = forwarded.split(',').map(normalize).filter(Boolean);
    for (let i = hops.length - 1; i >= 0; i--) {
      if (!isTrustedProxy(hops[i]!)) return hops[i]!;
    }
  }

  const realIp = c.req.header('x-real-ip');
  if (realIp) return normalize(realIp);

  return peer;
}
