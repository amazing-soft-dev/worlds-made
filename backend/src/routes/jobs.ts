import type { FastifyPluginAsync } from 'fastify';
import { LIMITS } from '@worlds-made/shared';
import type { Services } from '../container';
import { requireCron } from '../lib/cron';
import { purgeAnonymous, purgeInactiveAccounts } from '../services/retention';

/** Scheduled jobs. Vercel Cron issues GET requests with the cron secret. */
export const jobRoutes = (services: Services): FastifyPluginAsync => async (app) => {
  app.get('/jobs/retention', async (req) => {
    requireCron(req, services.config);
    const now = new Date();
    const anonymous = await purgeAnonymous(services.store, now, LIMITS.anonRetentionDays);
    const accounts = await purgeInactiveAccounts(services.store, now, LIMITS.inactiveAccountDays);
    return { ok: true, anonymous, accounts };
  });
};
