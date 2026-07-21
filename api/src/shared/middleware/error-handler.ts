// Pickleballers API — Central Error Handler
// Translates all errors into the standard API error envelope.

import { HTTPException } from 'hono/http-exception';
import type { ErrorHandler } from 'hono';

export const errorHandler: ErrorHandler = (err, c) => {
  const requestId = c.get('requestId') || `req_${Date.now()}`;

  // Known HTTP exceptions
  if (err instanceof HTTPException) {
    return c.json({
      error: {
        code: err.res ? err.res.status.toString() : 'HTTP_ERROR',
        message: err.message,
        details: [],
      },
      meta: { requestId },
    }, err.status);
  }

  // Zod validation errors
  if (err.name === 'ZodError') {
    const zodError = err as any;
    return c.json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: zodError.issues?.map((issue: any) => ({
          field: issue.path?.join('.') || 'unknown',
          message: issue.message,
          code: issue.code,
        })) || [],
      },
      meta: { requestId },
    }, 400);
  }

  const anyErr = err as any;

  // Malformed / empty JSON body — `c.req.json()` throws a SyntaxError before Zod
  // ever runs. Return a clean 400 instead of a generic 500 (A9, ~127 sites).
  if (err instanceof SyntaxError || err.name === 'SyntaxError') {
    return c.json({
      error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON.', details: [] },
      meta: { requestId },
    }, 400);
  }

  // Invalid ObjectId (mistyped / stale link) — Mongoose throws a CastError which
  // would otherwise 500. Return 400 so bad input reads as a client error (A10,
  // ~267 findById sites).
  if (err.name === 'CastError') {
    return c.json({
      error: { code: 'INVALID_ID', message: 'Invalid identifier.', details: [] },
      meta: { requestId },
    }, 400);
  }

  // Duplicate-key race (E11000) — an "already exists" collision (double-booking,
  // duplicate application, registration slot). Map to 409 Conflict, not 500
  // (A12; also the safety net for the A1/A2 unique-index guards).
  if (anyErr.code === 11000 || anyErr.name === 'MongoServerError' && anyErr.code === 11000) {
    return c.json({
      error: { code: 'CONFLICT', message: 'That already exists or was just taken. Please try again.', details: [] },
      meta: { requestId },
    }, 409);
  }

  // Unexpected errors
  console.error('[API Error]', err);
  return c.json({
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred'
        : err.message || 'An unexpected error occurred',
      details: [],
    },
    meta: { requestId },
  }, 500);
};
