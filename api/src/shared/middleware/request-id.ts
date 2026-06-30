// Pickleballers API — Request ID Middleware
// Attaches a unique request ID to every request for tracing.

import type { MiddlewareHandler } from 'hono';

export const requestId: MiddlewareHandler = async (c, next) => {
  const id = c.req.header('X-Request-Id') || `req_${crypto.randomUUID()}`;
  c.set('requestId', id);
  c.header('X-Request-Id', id);
  await next();
};
