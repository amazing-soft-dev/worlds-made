import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { Services } from '../container';
import { dayKey } from '../services/daily/daily';
import { ensureAnonId } from '../services/anon';
import type { Identity } from '../services/daily/scores';

/**
 * Signed-in players with a profile play as themselves. Everyone else, including every under-13, plays as a random
 * anonymous id kept in a cookie: no name, no sign-in, no free text.
 */
async function identityOf(req: FastifyRequest, reply: FastifyReply, services: Services): Promise<Identity> {
  if (req.auth) {
    const profile = await services.profiles.get(req.auth.userId);
    if (profile) return { kind: 'user', id: profile.id };
  }
  return { kind: 'anon', id: ensureAnonId(req, reply, services.config) };
}

export const dailyScoreRoutes = (services: Services): FastifyPluginAsync => async (app) => {
  /** The game page calls this when play begins; the token it returns is needed to submit a score. */
  app.post('/daily/start', async (req, reply) => {
    const challenge = await services.daily.resolveToday();
    const who = await identityOf(req, reply, services);
    return { sessionToken: services.dailyScores.startSession(challenge.date as string, who), date: challenge.date };
  });

  /** The page forwards the score the sandboxed game reported through the fixed message format. */
  app.post('/daily/score', async (req, reply) => {
    const body = z.object({ sessionToken: z.string().max(300), value: z.number() }).parse(req.body);
    const challenge = await services.daily.resolveToday();
    const who = await identityOf(req, reply, services);
    return services.dailyScores.submit({ challenge, who, token: body.sessionToken, value: body.value });
  });

  app.get('/daily/leaderboard', async (req) => {
    const { date } = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default(dayKey(new Date())) }).parse(req.query);
    return { date, entries: await services.dailyScores.leaderboard(date) };
  });

  /** My best score today, my rank and my streak. */
  app.get('/daily/me', async (req, reply) => {
    const who = await identityOf(req, reply, services);
    return services.dailyScores.mine(who, dayKey(new Date()));
  });
};
