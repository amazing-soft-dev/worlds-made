import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireProfile } from '../auth/profile';
import type { Services } from '../container';
import { errors } from '../errors';

export const reportRoutes = (services: Services): FastifyPluginAsync => async (app) => {
  /** Every game has a Report button. Only published games can be reported. */
  app.post('/games/:id/report', async (req, reply) => {
    const { profile } = await requireProfile(req, services.profiles, { verified: false });
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const { reason } = z.object({ reason: z.string().trim().min(3).max(300) }).parse(req.body);
    const game = await services.games.get(id);
    if (!game || (game.status !== 'published' && game.status !== 'hidden')) throw errors.notFound('Game not found');
    const result = await services.reports.report(game, profile, reason);
    return reply.code(result.alreadyReported ? 200 : 201).send({ reported: true, alreadyReported: result.alreadyReported });
  });
};
