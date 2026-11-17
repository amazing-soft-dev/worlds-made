import { randomBytes } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { LIMITS } from '@worlds-made/shared';
import type { Config } from '../config';
import { parseCookies, readSigned, serializeCookie, signValue } from '../lib/cookies';

export const ANON_COOKIE = 'wm_anon';

/** A random id with no link to a person: the only thing stored for under-13s and signed-out players. */
export function newAnonId(): string {
  return `a_${randomBytes(16).toString('base64url')}`;
}

export function readAnonId(req: FastifyRequest, config: Config): string | null {
  return readSigned(parseCookies(req.headers.cookie)[ANON_COOKIE], config.cookieSecret);
}

/** Returns the visitor's anonymous id, creating and setting the cookie on first use. The cookie lives as long as the retention period. */
export function ensureAnonId(req: FastifyRequest, reply: FastifyReply, config: Config): string {
  const existing = readAnonId(req, config);
  if (existing) return existing;
  const id = newAnonId();
  reply.header(
    'set-cookie',
    serializeCookie(ANON_COOKIE, signValue(id, config.cookieSecret), {
      maxAgeSeconds: LIMITS.anonRetentionDays * 24 * 3600,
      secure: config.isProd,
    }),
  );
  return id;
}
