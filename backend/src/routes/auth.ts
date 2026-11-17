import { randomUUID } from 'node:crypto';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../auth/auth';
import type { Services } from '../container';
import { errors } from '../errors';
import { signJwt } from '../lib/jwt';

export const authRoutes = (services: Services): FastifyPluginAsync => async (app) => {
  /** Who am I: the token's identity plus the profile, if one exists. */
  app.get('/me', async (req) => {
    const auth = requireAuth(req);
    const profile = await services.profiles.get(auth.userId);
    return { user: { id: auth.userId, email: auth.email, emailVerified: auth.emailVerified, isFounder: auth.isFounder }, profile };
  });

  /**
   * Development and test only: mints a login token without Supabase so the app and the end-to-end tests
   * can run with no accounts. It does not exist in production.
   */
  app.post('/auth/dev-token', async (req) => {
    if (services.config.isProd || services.config.supabase) throw errors.notFound();
    const body = z.object({ email: z.string().email(), userId: z.string().uuid().optional(), verified: z.boolean().default(true) }).parse(req.body);
    const userId = body.userId ?? randomUUID();
    const token = signJwt({ sub: userId, email: body.email, email_verified: body.verified }, services.config.jwtSecret, 24 * 3600);
    return { token, userId };
  });
};
