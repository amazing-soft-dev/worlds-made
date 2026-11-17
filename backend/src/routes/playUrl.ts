import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { Services } from '../container';
import { errors } from '../errors';
import { signPlayToken } from '../lib/play-token';

/** Issues the short-lived link the frontend puts in the sandboxed iframe. Published games are open to everyone; drafts only to their owner. */
export const playUrlRoutes = (services: Services): FastifyPluginAsync => async (app) => {
  app.get('/games/:id/play-url', async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const game = await services.games.get(id);
    const isPublic = game?.status === 'published' && game.visibility === 'public';
    const isOwner = Boolean(game && req.auth && game.owner_id === req.auth.userId);
    if (!game || !game.current_version_id || (!isPublic && !isOwner)) throw errors.notFound('Game not found');

    const token = signPlayToken(game.current_version_id, services.config.cookieSecret);
    return { url: `${services.config.gameOrigin}/g/${game.current_version_id}?t=${token}`, versionId: game.current_version_id };
  });
};
