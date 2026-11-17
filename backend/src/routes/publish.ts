import type { FastifyPluginAsync } from 'fastify';
import { licenseSchema } from '@worlds-made/shared';
import { z } from 'zod';
import { requireProfile } from '../auth/profile';
import type { Services } from '../container';
import { fullGame } from './library';

const idParam = z.object({ id: z.string().uuid() });

export const publishRoutes = (services: Services): FastifyPluginAsync => async (app) => {
  /** Publish to the gallery with a title, a short description, tags and a licence. Text and code are moderated first. */
  app.post('/games/:id/publish', async (req) => {
    const { profile } = await requireProfile(req, services.profiles);
    const game = await services.games.getOwned(idParam.parse(req.params).id, profile.id);
    const body = z
      .object({
        title: z.string().trim().min(2).max(60),
        description: z.string().trim().max(300).default(''),
        tags: z.array(z.string().trim().min(1).max(20)).max(6).default([]),
        license: licenseSchema.default('all-rights-reserved'),
        allowDownload: z.boolean().default(false),
      })
      .parse(req.body);
    return { game: fullGame(await services.publisher.publish(game, body)) };
  });

  app.post('/games/:id/unpublish', async (req) => {
    const { profile } = await requireProfile(req, services.profiles, { verified: false });
    const game = await services.games.getOwned(idParam.parse(req.params).id, profile.id);
    return { game: fullGame(await services.publisher.unpublish(game)) };
  });
};
