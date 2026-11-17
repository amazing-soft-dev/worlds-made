import { timingSafeEqual } from 'node:crypto';
import type { FastifyRequest } from 'fastify';
import type { Config } from '../config';
import { errors } from '../errors';

/** Vercel Cron calls with `Authorization: Bearer $CRON_SECRET`. Anything else is refused, and so is every call when no secret is set. */
export function requireCron(req: FastifyRequest, config: Config): void {
  const expected = config.cronSecret ? Buffer.from(`Bearer ${config.cronSecret}`) : null;
  const given = Buffer.from(req.headers.authorization ?? '');
  if (!expected || given.length !== expected.length || !timingSafeEqual(given, expected)) {
    throw errors.unauthorized('Scheduled jobs need the cron secret');
  }
}
