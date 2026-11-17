import type { FastifyInstance, FastifyRequest } from 'fastify';
import { errors } from '../errors';
import { verifyJwt } from '../lib/jwt';

export interface AuthContext {
  userId: string;
  email: string | null;
  emailVerified: boolean;
  isFounder: boolean;
}

declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthContext | null;
  }
}

/** Reads `Authorization: Bearer <jwt>` on every request. An invalid token is treated as signed out. */
export function registerAuth(app: FastifyInstance): void {
  app.decorateRequest('auth', null);
  app.addHook('onRequest', async (req) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return;
    const claims = verifyJwt(header.slice(7).trim(), app.config.jwtSecret);
    if (!claims) return;
    const email = typeof claims.email === 'string' ? claims.email.toLowerCase() : null;
    req.auth = {
      userId: claims.sub,
      email,
      emailVerified: claims.email_verified === true || claims.user_metadata?.email_verified === true,
      isFounder: email !== null && app.config.founderEmails.includes(email),
    };
  });
}

export function requireAuth(req: FastifyRequest): AuthContext {
  if (!req.auth) throw errors.unauthorized();
  return req.auth;
}

/** Sign-up needs a verified email before the first build (anti free-limit farming). */
export function requireVerified(req: FastifyRequest): AuthContext {
  const auth = requireAuth(req);
  if (!auth.emailVerified) throw errors.forbidden('Verify your email address to continue');
  return auth;
}

export function requireFounder(req: FastifyRequest): AuthContext {
  const auth = requireAuth(req);
  if (!auth.isFounder) throw errors.forbidden('Founder only');
  return auth;
}
