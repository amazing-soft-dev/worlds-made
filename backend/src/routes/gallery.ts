import type { FastifyPluginAsync } from 'fastify';
import { galleryTabSchema } from '@worlds-made/shared';
import { z } from 'zod';
import { requireProfile } from '../auth/profile';
import type { Services } from '../container';

const idParam = z.object({ id: z.string().uuid() });

export const galleryRoutes = (services: Services): FastifyPluginAsync => async (app) => {
  /** Public. Signed-in viewers also get a `liked` flag on each game. */
  app.get('/gallery', async (req) => {
    const q = z
      .object({
        tab: galleryTabSchema.default('new'),
        limit: z.coerce.number().int().min(1).max(24).default(12),
        offset: z.coerce.number().int().min(0).max(1000).default(0),
      })
      .parse(req.query);
    const games = await services.gallery.list(q.tab, { limit: q.limit, offset: q.offset }, req.auth?.userId ?? null);
    return { tab: q.tab, games };
  });

  app.get('/gallery/:id', async (req) => ({ game: await services.gallery.detail(idParam.parse(req.params).id, req.auth?.userId ?? null) }));

  app.put('/games/:id/like', async (req) => {
    const { profile } = await requireProfile(req, services.profiles, { verified: false });
    return { liked: true, likeCount: await services.gallery.like(idParam.parse(req.params).id, profile.id) };
  });

  app.delete('/games/:id/like', async (req) => {
    const { profile } = await requireProfile(req, services.profiles, { verified: false });
    return { liked: false, likeCount: await services.gallery.unlike(idParam.parse(req.params).id, profile.id) };
  });
};
