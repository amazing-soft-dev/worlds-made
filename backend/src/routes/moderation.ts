import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { Services } from '../container';

export const moderationRoutes = (services: Services): FastifyPluginAsync => async (app) => {
  /** Lets the game maker show the franchise stand-in notice, or a friendly block, before a build is started. */
  app.post('/prompt/check', async (req) => {
    const { prompt } = z.object({ prompt: z.string().trim().min(3).max(1000) }).parse(req.body);
    return services.moderation.checkPrompt(prompt);
  });
};
