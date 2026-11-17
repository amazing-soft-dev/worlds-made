import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireProfile } from '../auth/profile';
import type { Services } from '../container';
import type { Charged } from '../services/games/workflow';
import { GENRES } from '../services/games/templates';

export const publicGame = (g: { id: string; title: string; status: string; visibility: string; current_version_id: string | null }) => ({
  id: g.id,
  title: g.title,
  status: g.status,
  visibility: g.visibility,
  currentVersionId: g.current_version_id,
});

const built = (r: Charged) => ({
  game: publicGame(r.game),
  version: { id: r.version.id, sizeBytes: r.version.size_bytes },
  swaps: r.swaps,
  warnings: r.warnings,
  /** 'build' counted against today's allowance; 'free-repair' did not. */
  charged: r.charged,
});

const idParam = z.object({ id: z.string().uuid() });

export const gameRoutes = (services: Services): FastifyPluginAsync => async (app) => {
  /** Describe a game, get a game. Needs a verified account with a profile. */
  app.post('/games/generate', async (req, reply) => {
    const { profile } = await requireProfile(req, services.profiles);
    const body = z.object({ prompt: z.string().trim().min(3).max(1000), genre: z.enum(GENRES).optional() }).parse(req.body);
    return reply.code(201).send(built(await services.workflow.generate(profile, body)));
  });

  /** "Fix it": sends the errors the sandboxed frame reported back for a repair pass. Two are free per build. */
  app.post('/games/:id/repair', async (req, reply) => {
    const { profile } = await requireProfile(req, services.profiles);
    const { id } = idParam.parse(req.params);
    const body = z.object({ errors: z.array(z.string().max(500)).max(10).default([]) }).parse(req.body ?? {});
    return reply.code(201).send(built(await services.workflow.repair(profile, id, body.errors)));
  });

  /** "Change it": a player-directed rewrite such as "slower enemies". Counts as a build. */
  app.post('/games/:id/change', async (req, reply) => {
    const { profile } = await requireProfile(req, services.profiles);
    const { id } = idParam.parse(req.params);
    const body = z.object({ instruction: z.string().trim().min(3).max(500) }).parse(req.body);
    return reply.code(201).send(built(await services.workflow.change(profile, id, body.instruction)));
  });

  /** Today's allowance, for the "builds left" counter and the limit-reached screen. */
  app.get('/usage', async (req) => {
    const { profile } = await requireProfile(req, services.profiles, { verified: false });
    return services.usage.snapshot(profile);
  });
};
