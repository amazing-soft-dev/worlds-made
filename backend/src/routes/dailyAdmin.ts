import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireFounder } from '../auth/auth';
import type { Services } from '../container';
import type { DailyChallengeRow } from '../db/tables';
import { signPlayToken } from '../lib/play-token';

/** Founder-only: review tomorrow's challenge (about five minutes a day) and keep the backlog stocked. */
export const dailyAdminRoutes = (services: Services): FastifyPluginAsync => async (app) => {
  const { config } = services;
  const present = (c: DailyChallengeRow) => ({
    id: c.id,
    date: c.date,
    theme: c.theme,
    status: c.status,
    scoreMin: c.score_min,
    scoreMax: c.score_max,
    // A preview link so the founder can play it before approving.
    previewUrl: `${config.gameOrigin}/g/${c.game_version_id}?t=${signPlayToken(c.game_version_id, config.cookieSecret)}`,
  });

  app.get('/admin/challenges', async (req) => {
    requireFounder(req);
    const o = await services.daily.overview();
    return {
      pending: o.pending.map(present),
      scheduled: o.scheduled.map(present),
      backlog: o.backlog.map(present),
      backlogCount: o.backlogCount,
      backlogOk: o.backlogOk,
    };
  });

  app.post('/admin/challenges/:id/approve', async (req) => {
    const founder = requireFounder(req);
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    return { challenge: present(await services.daily.approve(id, founder.userId)) };
  });

  app.delete('/admin/challenges/:id', async (req, reply) => {
    requireFounder(req);
    await services.daily.reject(z.object({ id: z.string().uuid() }).parse(req.params).id);
    return reply.code(204).send();
  });

  /** Tops the approved backlog up to `count` (default 14) with games made from the starter templates. */
  app.post('/admin/challenges/seed-backlog', async (req) => {
    requireFounder(req);
    const { count } = z.object({ count: z.number().int().min(1).max(60).optional() }).parse(req.body ?? {});
    const made = await services.daily.seedBacklog(count);
    return { made, ...(await services.daily.overview()), pending: undefined, scheduled: undefined, backlog: undefined };
  });
};
