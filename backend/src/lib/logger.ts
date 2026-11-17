import { randomUUID } from 'node:crypto';
import type { FastifyServerOptions } from 'fastify';

/** Never write credentials to logs, even by accident. */
export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["stripe-signature"]',
  'res.headers["set-cookie"]',
  // Secret-looking fields are redacted at the top level of a log object and one level down.
  'apiKey',
  'password',
  'token',
  'secret',
  '*.apiKey',
  '*.password',
  '*.token',
  '*.secret',
];

export function loggerOptions(enabled: boolean): FastifyServerOptions['logger'] {
  if (!enabled) return false;
  return { level: process.env.LOG_LEVEL ?? 'info', redact: { paths: REDACT_PATHS, censor: '[redacted]' } };
}

/** Reuses a sane incoming x-request-id, otherwise makes one, so a failure can be traced end to end. */
export function genReqId(req: { headers: Record<string, string | string[] | undefined> }): string {
  const incoming = req.headers['x-request-id'];
  const value = Array.isArray(incoming) ? incoming[0] : incoming;
  return value && /^[\w-]{8,64}$/.test(value) ? value : randomUUID();
}
