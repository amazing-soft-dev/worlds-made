import Fastify, { type FastifyInstance } from 'fastify';
import { registerAuth } from './auth/auth';
import { loadConfig, type Config } from './config';
import { createServices, type Services } from './container';
import { registerErrorHandling } from './errors';
import { genReqId, loggerOptions } from './lib/logger';
import { ageRoutes } from './routes/age';
import { authRoutes } from './routes/auth';
import { healthRoutes } from './routes/health';

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
  });
  app.decorate('config', config);
  app.decorate('services', services);
  app.addHook('onSend', async (req, reply) => {
    reply.header('x-request-id', req.id);
  });
  registerErrorHandling(app);
  registerAuth(app);

  // Every route lives under /api so the frontend rewrite and Vercel routing agree.
  app.register(healthRoutes, { prefix: '/api' });
  app.register(authRoutes(services), { prefix: '/api' });
  app.register(ageRoutes(services), { prefix: '/api' });
  return app;
}
