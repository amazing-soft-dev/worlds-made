import type { FastifyPluginAsync } from 'fastify';

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/health', async () => ({
    status: 'ok' as const,
    service: 'worlds-made-backend',
    time: new Date().toISOString(),
  }));
};
