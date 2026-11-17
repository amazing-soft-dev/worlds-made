import { createHmac, timingSafeEqual } from 'node:crypto';

export interface JwtClaims {
  sub: string;
  email?: string;
  email_verified?: boolean;
  user_metadata?: { email_verified?: boolean };
  iat?: number;
  exp?: number;
  [key: string]: unknown;
}

const b64u = (input: Buffer | string) => Buffer.from(input).toString('base64url');

function sign(data: string, secret: string): Buffer {
  return createHmac('sha256', secret).update(data).digest();
}

/** HS256 JWT, the algorithm Supabase signs access tokens with. No dependencies. */
export function signJwt(claims: Omit<JwtClaims, 'iat' | 'exp'>, secret: string, ttlSeconds = 3600, nowMs = Date.now()): string {
  const iat = Math.floor(nowMs / 1000);
  const header = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64u(JSON.stringify({ ...claims, iat, exp: iat + ttlSeconds }));
  const data = `${header}.${body}`;
  return `${data}.${b64u(sign(data, secret))}`;
}

/** Returns the claims of a valid, unexpired HS256 token, or null. Never throws on hostile input. */
export function verifyJwt(token: string, secret: string, nowMs = Date.now()): JwtClaims | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts as [string, string, string];
  try {
    const head = JSON.parse(Buffer.from(header, 'base64url').toString('utf8')) as { alg?: string };
    if (head.alg !== 'HS256') return null; // rejects alg "none" and algorithm-confusion attempts
    const expected = sign(`${header}.${body}`, secret);
    const given = Buffer.from(signature, 'base64url');
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
    const claims = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as JwtClaims;
    if (typeof claims.sub !== 'string' || !claims.sub) return null;
    if (typeof claims.exp !== 'number' || claims.exp * 1000 <= nowMs) return null;
    return claims;
  } catch {
    return null;
  }
}
