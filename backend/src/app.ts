import Fastify, { type FastifyInstance } from 'fastify';
import { healthRoutes } from './routes/health';

/** Builds the Fastify app. Kept separate from listen() so tests and the Vercel handler can reuse it. */
export function buildApp(opts: { logger?: boolean } = {}): FastifyInstance {
  const app = Fastify({ logger: opts.logger ?? false });
  // Every route lives under /api so the frontend rewrite and Vercel routing agree.
  app.register(healthRoutes, { prefix: '/api' });
  return app;
}
