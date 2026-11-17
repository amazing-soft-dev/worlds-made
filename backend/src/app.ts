import Fastify, { type FastifyInstance } from 'fastify';
import { loadConfig, type Config } from './config';
import { registerErrorHandling } from './errors';
import { genReqId, loggerOptions } from './lib/logger';
import { healthRoutes } from './routes/health';

declare module 'fastify' {
  interface FastifyInstance {
    config: Config;
  }
}

export type AppOptions = { logger?: boolean; config?: Config };

/** Builds the Fastify app. Kept separate from listen() so tests and the Vercel handler can reuse it. */
export function buildApp(opts: AppOptions = {}): FastifyInstance {
  const config = opts.config ?? loadConfig();
  const app = Fastify({
    logger: loggerOptions(opts.logger ?? false),
    genReqId,
    requestIdHeader: false,
    bodyLimit: 512 * 1024,
  });
  app.decorate('config', config);
  app.addHook('onSend', async (req, reply) => {
    reply.header('x-request-id', req.id);
  });
  registerErrorHandling(app);

  // Every route lives under /api so the frontend rewrite and Vercel routing agree.
  app.register(healthRoutes, { prefix: '/api' });
  return app;
}
