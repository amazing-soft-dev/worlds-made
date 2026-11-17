import type { FastifyPluginAsync } from 'fastify';
import { LIMITS } from '@worlds-made/shared';
import { z } from 'zod';
import type { Services } from '../container';
import { enforce } from '../lib/rate-limit';
import { readAgeAnswer } from './age';

export const recommendRoutes = (services: Services): FastifyPluginAsync => async (app) => {
  /** Describe what you feel like playing. Open to everyone; results are limited by age and cached for 24 hours. */
  app.post('/recommend', async (req, reply) => {
    const { request } = z.object({ request: z.string().trim().min(3).max(300) }).parse(req.body);

    const profile = req.auth ? await services.profiles.get(req.auth.userId) : null;
    // Logged-out visitors: 20 an hour per IP. Signed-in players get more, counted per account.
    if (profile) enforce(services.limiter, reply, `rec:user:${profile.id}`, 60, 3600_000, 'That is a lot of searches. Please try again in a while.');
    else enforce(services.limiter, reply, `rec:ip:${req.ip}`, LIMITS.recommendPerHourAnon, 3600_000, 'That is a lot of searches. Sign in for more, or try again in a while.');

    // Unknown age is treated as under 13: only E and E10+ results.
    const ageBand = profile?.age_band ?? readAgeAnswer(req, services.config.cookieSecret)?.band ?? null;
    return services.recommender.recommend({ request, ageBand });
  });
};
