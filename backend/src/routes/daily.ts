import type { FastifyPluginAsync } from 'fastify';
import type { Services } from '../container';
import { signPlayToken } from '../lib/play-token';
import { nextRollover } from '../services/daily/daily';

export const dailyRoutes = (services: Services): FastifyPluginAsync => async (app) => {
  /** Today's challenge: the same game for everyone, with the time left until the next one. Public. */
  app.get('/daily', async () => {
    const now = new Date();
    const challenge = await services.daily.resolveToday(now);
    const next = nextRollover(now);
    const token = signPlayToken(challenge.game_version_id, services.config.cookieSecret);
    return {
      date: challenge.date,
      theme: challenge.theme,
      versionId: challenge.game_version_id,
      playUrl: `${services.config.gameOrigin}/g/${challenge.game_version_id}?t=${token}`,
      nextRolloverAt: next.toISOString(),
      secondsToRollover: Math.max(0, Math.ceil((next.getTime() - now.getTime()) / 1000)),
    };
  });
};
