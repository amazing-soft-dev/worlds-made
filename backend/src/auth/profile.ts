import type { FastifyRequest } from 'fastify';
import type { ProfileRow } from '../db/tables';
import { AppError } from '../errors';
import type { ProfileService } from '../services/profiles';
import { requireAuth, requireVerified, type AuthContext } from './auth';

/** A signed-in user with a profile. Builders also need a verified email (anti free-limit farming). */
export async function requireProfile(
  req: FastifyRequest,
  profiles: ProfileService,
  opts: { verified?: boolean } = {},
): Promise<{ auth: AuthContext; profile: ProfileRow }> {
  const auth = opts.verified === false ? requireAuth(req) : requireVerified(req);
  const profile = await profiles.get(auth.userId);
  if (!profile) throw new AppError(403, 'profile_required', 'Finish setting up your account first');
  return { auth, profile };
}
