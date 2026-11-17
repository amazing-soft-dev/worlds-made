import type { IncomingMessage, ServerResponse } from 'node:http';
import { buildApp } from '../src/app';
import { assertProductionReady, loadConfig } from '../src/config';

// Vercel Function entry: vercel.json rewrites every path here; Fastify routes by URL.
const config = loadConfig();
assertProductionReady(config);
const app = buildApp({ logger: true, config });

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await app.ready();
  app.server.emit('request', req, res);
}
