import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireProfile } from '../auth/profile';
import type { Services } from '../container';
import { GENRES } from '../services/games/templates';

const publicGame = (g: { id: string; title: string; status: string; visibility: string; current_version_id: string | null }) => ({
  id: g.id,
  title: g.title,
  status: g.status,
  visibility: g.visibility,
  currentVersionId: g.current_version_id,
});

export const gameRoutes = (services: Services): FastifyPluginAsync => async (app) => {
  /** Describe a game, get a game. Needs a verified account with a profile. */
  app.post('/games/generate', async (req, reply) => {
    const { auth } = await requireProfile(req, services.profiles);
    const body = z.object({ prompt: z.string().trim().min(3).max(1000), genre: z.enum(GENRES).optional() }).parse(req.body);
    const result = await services.builder.build({ userId: auth.userId, kind: 'generate', prompt: body.prompt, genre: body.genre });
    return reply.code(201).send({
      game: publicGame(result.game),
      version: { id: result.version.id, sizeBytes: result.version.size_bytes },
      swaps: result.swaps,
      warnings: result.warnings,
    });
  });
};
