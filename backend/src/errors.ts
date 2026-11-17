import type { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';

/** An expected failure with an HTTP status and a stable machine-readable code. */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const errors = {
  badRequest: (message: string, details?: unknown) => new AppError(400, 'bad_request', message, details),
  unauthorized: (message = 'Sign in to continue') => new AppError(401, 'unauthorized', message),
  forbidden: (message = 'You cannot do that') => new AppError(403, 'forbidden', message),
  notFound: (message = 'Not found') => new AppError(404, 'not_found', message),
  conflict: (message: string) => new AppError(409, 'conflict', message),
  tooMany: (message = 'Too many requests, try again later', details?: unknown) => new AppError(429, 'rate_limited', message, details),
  unavailable: (message = 'Service temporarily unavailable') => new AppError(503, 'unavailable', message),
};

type Envelope = { error: { code: string; message: string; details?: unknown; requestId: string } };

/** One error shape for the whole API: { error: { code, message, details?, requestId } }. */
export function registerErrorHandling(app: FastifyInstance): void {
  app.setNotFoundHandler((req, reply) => {
    const body: Envelope = { error: { code: 'not_found', message: 'Route not found', requestId: req.id } };
    return reply.code(404).send(body);
  });

  app.setErrorHandler((err, req, reply) => {
    let status = 500;
    let code = 'internal';
    let message = 'Something went wrong';
    let details: unknown;

    if (err instanceof AppError) {
      ({ status, code, message, details } = err);
    } else if (err instanceof ZodError) {
      status = 400;
      code = 'validation_failed';
      message = 'The request is not valid';
      details = err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    } else if (typeof (err as { statusCode?: number }).statusCode === 'number' && (err as { statusCode: number }).statusCode < 500) {
      // Fastify's own 4xx errors (bad JSON, payload too large, ...).
      status = (err as { statusCode: number }).statusCode;
      code = 'bad_request';
      message = err instanceof Error ? err.message : 'Bad request';
    }

    if (status >= 500) req.log.error({ err }, 'unhandled error');
    const body: Envelope = { error: { code, message, requestId: req.id, ...(details === undefined ? {} : { details }) } };
    return reply.code(status).send(body);
  });
}
