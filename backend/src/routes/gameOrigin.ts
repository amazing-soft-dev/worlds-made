import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { Services } from '../container';
import { AppError, errors } from '../errors';
import { verifyPlayToken } from '../lib/play-token';
import { scanGameHtml } from '../services/scanner';

/**
 * The Content-Security-Policy for every generated game. Scripts and styles must be inline, nothing can load or send
 * anything over the network, and only the main site may frame the game.
 */
export function gameCsp(siteOrigin: string): string {
  return [
    "default-src 'none'",
    "script-src 'unsafe-inline'",
    "style-src 'unsafe-inline'",
    'img-src data: blob:',
    'media-src data: blob:',
    'font-src data:',
    "connect-src 'none'",
    "form-action 'none'",
    `frame-ancestors ${siteOrigin}`,
    "base-uri 'none'",
  ].join('; ');
}

/**
 * Serves generated game HTML. This route only answers on the separate game domain: on any other host it is a 404,
 * so the main site and the API can never serve untrusted code. Responses never carry cookies.
 */
export const gameOriginRoutes = (services: Services): FastifyPluginAsync => async (app) => {
  const { config } = services;
  const gameHost = new URL(config.gameOrigin).host;
  const siteOrigin = new URL(config.siteUrl).origin;

  app.get('/g/:versionId', async (req, reply) => {
    if (req.headers.host !== gameHost) throw errors.notFound();
    const { versionId } = z.object({ versionId: z.string().uuid() }).parse(req.params);
    const { t } = z.object({ t: z.string().max(200).optional() }).parse(req.query);
    if (!verifyPlayToken(t, versionId, config.cookieSecret)) throw errors.forbidden('This game link has expired');

    const version = await services.games.getVersion(versionId);
    const html = version ? await services.games.html(version) : null;
    if (!version || html === null) throw errors.notFound('Game not found');

    // Scanned again on the way out: storage is not trusted either.
    if (!scanGameHtml(html).ok) throw new AppError(410, 'game_unavailable', 'This game is no longer available');

    return reply
      .header('content-security-policy', gameCsp(siteOrigin))
      .header('x-content-type-options', 'nosniff')
      .header('referrer-policy', 'no-referrer')
      .header('permissions-policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()')
      .header('cache-control', 'private, no-store')
      .type('text/html; charset=utf-8')
      .send(html);
  });
};
