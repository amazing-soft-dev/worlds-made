import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireFounder } from '../auth/auth';
import type { Services } from '../container';
import type { GameRow, ProfileRow, ReportRow } from '../db/tables';
import { errors } from '../errors';
import { reportWeight } from '../services/community/reports';
import { fullGame } from './library';

const idParam = z.object({ id: z.string().uuid() });

/** Founder-only: the report queue, review actions, staff picks and the cost dashboard. */
export const adminRoutes = (services: Services): FastifyPluginAsync => async (app) => {
  const { store } = services;

  /** Open reports grouped by game, the heaviest first. Reviewed within 48 hours. */
  app.get('/admin/reports', async (req) => {
    requireFounder(req);
    const open = await store.list<ReportRow>('reports', { where: { status: 'open' }, orderBy: 'created_at' });
    const byGame = new Map<string, ReportRow[]>();
    for (const r of open) byGame.set(r.game_id, [...(byGame.get(r.game_id) ?? []), r]);
    const now = new Date();
    const queue = [];
    for (const [gameId, reports] of byGame) {
      const game = await store.get<GameRow>('games', { id: gameId });
      if (!game) continue;
      const owner = game.owner_id ? await store.get<ProfileRow>('profiles', { id: game.owner_id }) : null;
      let weight = 0;
      const items = [];
      for (const r of reports) {
        const w = reportWeight(await store.get<ProfileRow>('profiles', { id: r.reporter_id }), now);
        weight += w;
        items.push({ id: r.id, reason: r.reason, weight: w, createdAt: r.created_at });
      }
      queue.push({ game: fullGame(game), creator: owner?.display_name ?? null, weight, reports: items });
    }
    queue.sort((a, b) => b.weight - a.weight);
    return { queue };
  });

  /** restore: show it again and dismiss the reports. dismiss: dismiss the reports only. remove: take it down for good. */
  app.post('/admin/reports/:id/resolve', async (req) => {
    requireFounder(req);
    const { id } = idParam.parse(req.params);
    const { action } = z.object({ action: z.enum(['restore', 'dismiss', 'remove']) }).parse(req.body);
    const game = await store.get<GameRow>('games', { id });
    if (!game) throw errors.notFound('Game not found');
    if (action === 'remove') {
      await store.update<GameRow>('games', { id }, { status: 'removed', visibility: 'private' });
      await store.update<ReportRow>('reports', { game_id: id, status: 'open' }, { status: 'reviewed' });
    } else {
      if (action === 'restore' && game.status === 'hidden') await store.update<GameRow>('games', { id }, { status: 'published' });
      await store.update<ReportRow>('reports', { game_id: id, status: 'open' }, { status: 'dismissed' });
    }
    return { game: fullGame((await store.get<GameRow>('games', { id })) as GameRow) };
  });

  app.post('/admin/games/:id/staff-pick', async (req) => {
    requireFounder(req);
    const { id } = idParam.parse(req.params);
    const { value } = z.object({ value: z.boolean() }).parse(req.body);
    const [game] = await store.update<GameRow>('games', { id }, { staff_pick: value });
    if (!game) throw errors.notFound('Game not found');
    return { game: fullGame(game) };
  });

  /** Real cost per build, the month's spend against the cap, and whether building is paused. */
  app.get('/admin/costs', async (req) => {
    requireFounder(req);
    return {
      monthlySpendUsd: await services.llm.monthlySpendUsd(),
      capUsd: services.config.spendCapUsd,
      buildsPaused: services.config.buildsPaused,
      averageByPurpose: await services.llm.averageCostByPurpose(),
    };
  });
};
