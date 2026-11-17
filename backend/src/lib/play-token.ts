import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * The game origin has no logins and no cookies, so access to a game is a short-lived signed link instead:
 * `<exp>.<signature>` over the version id. A token for one game version works for no other.
 */
const mac = (versionId: string, exp: number, secret: string) => createHmac('sha256', `play:${secret}`).update(`${versionId}.${exp}`).digest('base64url');

export function signPlayToken(versionId: string, secret: string, ttlSeconds = 600, nowMs = Date.now()): string {
  const exp = Math.floor(nowMs / 1000) + ttlSeconds;
  return `${exp}.${mac(versionId, exp, secret)}`;
}

export function verifyPlayToken(token: string | undefined, versionId: string, secret: string, nowMs = Date.now()): boolean {
  if (!token) return false;
  const [expRaw, sig] = token.split('.');
  const exp = Number(expRaw);
  if (!sig || !Number.isInteger(exp) || exp * 1000 <= nowMs) return false;
  const expected = Buffer.from(mac(versionId, exp, secret));
  const given = Buffer.from(sig);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
