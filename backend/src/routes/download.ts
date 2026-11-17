import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { Services } from '../container';
import { errors } from '../errors';
import { prepareDownload } from '../services/games/download';

/**
 * Only the owner downloads their own game, and a published game can be downloaded by anyone only if its creator
 * allowed it. The file is scanned again and carries a header naming the site, the creator and the licence.
 */
export const downloadRoutes = (services: Services): FastifyPluginAsync => async (app) => {
  app.get('/games/:id/download', async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const { format } = z.object({ format: z.enum(['html', 'zip']).default('html') }).parse(req.query);

    const game = await services.games.get(id);
    const isOwner = Boolean(game && req.auth && game.owner_id === req.auth.userId);
    const isPublic = game?.status === 'published' && game.visibility === 'public';
    if (!game || (!isOwner && !isPublic)) throw errors.notFound('Game not found');
    if (!isOwner && !game.allow_download) throw errors.forbidden('The creator has not allowed downloads of this game');

    const version = game.current_version_id ? await services.games.getVersion(game.current_version_id) : null;
    const html = version ? await services.games.html(version) : null;
    if (html === null) throw errors.notFound('Game not found');

    const creator = (await services.profiles.get(game.owner_id))?.display_name ?? 'a player';
    const file = prepareDownload(format, { game, html, creator, siteUrl: services.config.siteUrl });
    return reply
      .header('content-disposition', `attachment; filename="${file.filename}"`)
      .header('x-content-type-options', 'nosniff')
      .header('content-security-policy', "default-src 'none'; sandbox")
      .header('cache-control', 'private, no-store')
      .type(file.contentType)
      .send(file.body);
  });
};
