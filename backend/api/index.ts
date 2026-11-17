import type { IncomingMessage, ServerResponse } from 'node:http';
import { buildApp } from '../src/app';

// Vercel Function entry: vercel.json rewrites every path here; Fastify routes by URL.
const app = buildApp({ logger: true });

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await app.ready();
  app.server.emit('request', req, res);
}
