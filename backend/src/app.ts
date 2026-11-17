import Fastify, { type FastifyInstance } from 'fastify';
import { LIMITS } from '@worlds-made/shared';
import { registerAuth } from './auth/auth';
import { loadConfig, type Config } from './config';
import { createServices, type Services } from './container';
import { registerErrorHandling } from './errors';
import { genReqId, loggerOptions } from './lib/logger';
import { enforce } from './lib/rate-limit';
import { ageRoutes } from './routes/age';
import { authRoutes } from './routes/auth';
import { adminRoutes } from './routes/admin';
import { billingRoutes } from './routes/billing';
import { contactRoutes } from './routes/contact';
import { dailyAdminRoutes } from './routes/dailyAdmin';
import { dailyRoutes } from './routes/daily';
import { dailyScoreRoutes } from './routes/dailyScores';
import { downloadRoutes } from './routes/download';
import { galleryRoutes } from './routes/gallery';
import { gameOriginRoutes } from './routes/gameOrigin';
import { gameRoutes } from './routes/games';
import { healthRoutes } from './routes/health';
import { jobRoutes } from './routes/jobs';
import { libraryRoutes } from './routes/library';
import { moderationRoutes } from './routes/moderation';
import { playUrlRoutes } from './routes/playUrl';
import { recommendRoutes } from './routes/recommend';
import { reportRoutes } from './routes/reports';
import { publishRoutes } from './routes/publish';

declare module 'fastify' {
  interface FastifyInstance {
    config: Config;
    services: Services;
  }
}

export type AppOptions = { logger?: boolean; config?: Config; services?: Partial<Services> };

/** Builds the Fastify app. Kept separate from listen() so tests and the Vercel handler can reuse it. */
export function buildApp(opts: AppOptions = {}): FastifyInstance {
  const config = opts.config ?? loadConfig();
  const services = createServices(config, opts.services);
  const app = Fastify({
    logger: loggerOptions(opts.logger ?? false),
    genReqId,
    requestIdHeader: false,
    bodyLimit: 512 * 1024,
    // Behind Vercel the real client address is in X-Forwarded-For.
    trustProxy: config.isProd,
  });
  app.decorate('config', config);
  app.decorate('services', services);
  app.addHook('onSend', async (req, reply) => {
    reply.header('x-request-id', req.id);
  });
  registerErrorHandling(app);
  registerAuth(app);
  // A soft per-IP ceiling against floods; real quotas are enforced per account elsewhere.
  app.addHook('onRequest', async (req, reply) => {
    if (req.url.startsWith('/api/')) enforce(services.limiter, reply, `ip:${req.ip}`, LIMITS.apiPerMinutePerIp, 60_000);
  });

  // Every route lives under /api so the frontend rewrite and Vercel routing agree.
  app.register(healthRoutes, { prefix: '/api' });
  app.register(authRoutes(services), { prefix: '/api' });
  app.register(ageRoutes(services), { prefix: '/api' });
  app.register(jobRoutes(services), { prefix: '/api' });
  app.register(moderationRoutes(services), { prefix: '/api' });
  app.register(gameRoutes(services), { prefix: '/api' });
  app.register(libraryRoutes(services), { prefix: '/api' });
  app.register(playUrlRoutes(services), { prefix: '/api' });
  app.register(downloadRoutes(services), { prefix: '/api' });
  app.register(contactRoutes(services), { prefix: '/api' });
  app.register(publishRoutes(services), { prefix: '/api' });
  app.register(galleryRoutes(services), { prefix: '/api' });
  app.register(reportRoutes(services), { prefix: '/api' });
  app.register(recommendRoutes(services), { prefix: '/api' });
  app.register(billingRoutes(services), { prefix: '/api' });
  app.register(adminRoutes(services), { prefix: '/api' });
  app.register(dailyAdminRoutes(services), { prefix: '/api' });
  app.register(dailyRoutes(services), { prefix: '/api' });
  app.register(dailyScoreRoutes(services), { prefix: '/api' });
  // The game origin route lives outside /api on purpose; it answers only on GAME_ORIGIN's host.
  app.register(gameOriginRoutes(services));
  return app;
}
