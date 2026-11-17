import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { birthYearSchema } from '@worlds-made/shared';
import { z } from 'zod';
import { requireAuth } from '../auth/auth';
import type { Services } from '../container';
import { AppError, errors } from '../errors';
import { parseCookies, readSigned, serializeCookie, signValue } from '../lib/cookies';
import { evaluateAge, type AgeAnswer } from '../services/age';
import { generateNickname } from '../services/nickname';

export const AGE_COOKIE = 'wm_age';
const ONE_YEAR = 365 * 24 * 3600;

/** The remembered answer, from the signed cookie. Null if there is none or it was tampered with. */
export function readAgeAnswer(req: FastifyRequest, secret: string): AgeAnswer | null {
  const raw = readSigned(parseCookies(req.headers.cookie)[AGE_COOKIE], secret);
  if (!raw) return null;
  const [year, country] = raw.split('|');
  const parsed = birthYearSchema.safeParse(Number(year));
  return parsed.success ? evaluateAge(parsed.data, country || null) : null;
}

function present(a: AgeAnswer) {
  return { band: a.band, canHaveAccount: a.canHaveAccount };
}

export const ageRoutes = (services: Services): FastifyPluginAsync => async (app) => {
  const { config } = services;

  app.get('/age', async (req) => {
    const a = readAgeAnswer(req, config.cookieSecret);
    return a ? { answered: true, ...present(a) } : { answered: false };
  });

  /**
   * Neutral age question: the response says nothing about which answer unlocks more. The first answer is
   * remembered in a signed cookie, and later answers are ignored, so a child cannot retry with another year.
   */
  app.post('/age', async (req, reply: FastifyReply) => {
    const remembered = readAgeAnswer(req, config.cookieSecret);
    if (remembered) return { answered: true, ...present(remembered) };

    const body = z.object({ birthYear: birthYearSchema, country: z.string().length(2).optional() }).parse(req.body);
    const answer = evaluateAge(body.birthYear, body.country);
    reply.header(
      'set-cookie',
      serializeCookie(AGE_COOKIE, signValue(`${answer.birthYear}|${answer.country ?? ''}`, config.cookieSecret), {
        maxAgeSeconds: ONE_YEAR,
        secure: config.isProd,
      }),
    );
    return { answered: true, ...present(answer) };
  });

  /** Creates the profile from the remembered age answer. Under-13s and under-age EEA visitors get no account. */
  app.post('/me/profile', async (req, reply) => {
    const auth = requireAuth(req);
    const age = readAgeAnswer(req, config.cookieSecret);
    if (!age) throw errors.badRequest('Answer the age question first');
    if (!age.canHaveAccount) throw new AppError(403, 'age_blocked', 'Accounts are not available here. You can still play.');

    const body = z.object({ displayName: z.string().trim().min(2).max(24).optional() }).parse(req.body ?? {});
    // Anyone under 18 gets a generated nickname; only adults choose their own name.
    const displayName = age.band === 'adult' ? body.displayName : generateNickname(auth.userId);
    if (!displayName) throw errors.badRequest('Choose a display name');

    const profile = await services.profiles.create({
      id: auth.userId,
      displayName,
      birthYear: age.birthYear,
      ageBand: age.band,
      country: age.country,
    });
    return reply.code(201).send({ profile });
  });
};
