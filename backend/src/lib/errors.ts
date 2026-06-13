import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

/**
 * Tiny JSON error helper. Produces a consistent error envelope and never leaks
 * stack traces, tokens, or Aadhaar data to the client.
 */
export interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/** Application error with an HTTP status, thrown from routes/middleware. */
export class AppError extends Error {
  constructor(
    public readonly status: ContentfulStatusCode,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function jsonError(
  c: Context,
  status: ContentfulStatusCode,
  code: string,
  message: string,
  details?: unknown,
): Response {
  const body: ErrorBody = { error: { code, message } };
  if (details !== undefined) {
    body.error.details = details;
  }
  return c.json(body, status);
}
