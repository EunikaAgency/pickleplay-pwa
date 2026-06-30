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
