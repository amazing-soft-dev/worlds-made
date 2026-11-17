import { createHmac, timingSafeEqual } from 'node:crypto';

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i < 1) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export interface CookieOptions {
  maxAgeSeconds: number;
  secure: boolean;
  sameSite?: 'Lax' | 'Strict' | 'None';
}

export function serializeCookie(name: string, value: string, o: CookieOptions): string {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', `SameSite=${o.sameSite ?? 'Lax'}`, `Max-Age=${o.maxAgeSeconds}`];
  if (o.secure) parts.push('Secure');
  return parts.join('; ');
}

const mac = (data: string, secret: string) => createHmac('sha256', secret).update(data).digest('base64url');

/** `<value>.<signature>`: tamper-evident, not secret. The value must not contain a dot. */
export function signValue(value: string, secret: string): string {
  return `${value}.${mac(value, secret)}`;
}

export function readSigned(signed: string | undefined, secret: string): string | null {
  if (!signed) return null;
  const i = signed.lastIndexOf('.');
  if (i < 1) return null;
  const value = signed.slice(0, i);
  const given = Buffer.from(signed.slice(i + 1));
  const expected = Buffer.from(mac(value, secret));
  return given.length === expected.length && timingSafeEqual(given, expected) ? value : null;
}
