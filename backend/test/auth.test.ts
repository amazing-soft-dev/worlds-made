import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildApp } from '../src/app';
import { loadConfig } from '../src/config';
import { signJwt, verifyJwt } from '../src/lib/jwt';

const secret = 'test-secret-test-secret';

test('a signed token verifies and carries its claims', () => {
  const t = signJwt({ sub: 'u1', email: 'a@x.io' }, secret, 60);
  assert.equal(verifyJwt(t, secret)?.sub, 'u1');
});

test('tampered, wrong-secret, expired and alg:none tokens are rejected', () => {
  const t = signJwt({ sub: 'u1' }, secret, 60);
  const [h, b, s] = t.split('.') as [string, string, string];
  const forgedBody = Buffer.from(JSON.stringify({ sub: 'admin', exp: 9999999999 })).toString('base64url');
  assert.equal(verifyJwt(`${h}.${forgedBody}.${s}`, secret), null);
  assert.equal(verifyJwt(t, 'another-secret-another'), null);
  assert.equal(verifyJwt(t, secret, Date.now() + 120_000), null);
  const none = `${Buffer.from('{"alg":"none"}').toString('base64url')}.${b}.`;
  assert.equal(verifyJwt(none, secret), null);
  assert.equal(verifyJwt('garbage', secret), null);
});

async function login(app: ReturnType<typeof buildApp>, email: string, verified = true) {
  const res = await app.inject({ method: 'POST', url: '/api/auth/dev-token', payload: { email, verified } });
  return res.json() as { token: string; userId: string };
}

test('/api/me needs a token and returns the identity without a profile yet', async () => {
  const app = buildApp({ config: loadConfig({ FOUNDER_EMAILS: 'boss@x.io' }) });
  assert.equal((await app.inject({ method: 'GET', url: '/api/me' })).statusCode, 401);
  const { token, userId } = await login(app, 'Boss@x.io');
  const res = await app.inject({ method: 'GET', url: '/api/me', headers: { authorization: `Bearer ${token}` } });
  const body = res.json() as { user: { id: string; isFounder: boolean; emailVerified: boolean }; profile: unknown };
  assert.equal(body.user.id, userId);
  assert.equal(body.user.isFounder, true);
  assert.equal(body.user.emailVerified, true);
  assert.equal(body.profile, null);
  await app.close();
});

test('a bad token is treated as signed out, not as an error', async () => {
  const app = buildApp();
  const res = await app.inject({ method: 'GET', url: '/api/me', headers: { authorization: 'Bearer nope.nope.nope' } });
  assert.equal(res.statusCode, 401);
  await app.close();
});

test('the dev token endpoint does not exist in production', async () => {
  const app = buildApp({ config: loadConfig({ NODE_ENV: 'production', COOKIE_SECRET: 'x'.repeat(20) }) });
  const res = await app.inject({ method: 'POST', url: '/api/auth/dev-token', payload: { email: 'a@x.io' } });
  assert.equal(res.statusCode, 404);
  await app.close();
});
