import assert from 'node:assert/strict';
import { test } from 'node:test';
import { z } from 'zod';
import { buildApp } from '../src/app';
import { loadConfig } from '../src/config';
import { errors } from '../src/errors';

test('config defaults work with an empty environment and integrations are null', () => {
  const c = loadConfig({});
  assert.equal(c.port, 4000);
  assert.equal(c.isProd, false);
  assert.equal(c.supabase, null);
  assert.equal(c.llm, null);
  assert.equal(c.buildsPaused, false);
});

test('config reads integrations only when every required key is present', () => {
  assert.equal(loadConfig({ STRIPE_SECRET_KEY: 'sk_test_x' }).stripe, null);
  const c = loadConfig({ STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: 'whsec_x', STRIPE_PRICE_ID: 'price_x', FOUNDER_EMAILS: 'A@x.io, b@x.io' });
  assert.equal(c.stripe?.priceId, 'price_x');
  assert.deepEqual(c.founderEmails, ['a@x.io', 'b@x.io']);
});

test('AppError becomes the error envelope with the request id', async () => {
  const app = buildApp();
  app.get('/api/_t/forbidden', async () => {
    throw errors.forbidden('nope');
  });
  const res = await app.inject({ method: 'GET', url: '/api/_t/forbidden', headers: { 'x-request-id': 'trace-12345678' } });
  assert.equal(res.statusCode, 403);
  const body = res.json() as { error: { code: string; message: string; requestId: string } };
  assert.equal(body.error.code, 'forbidden');
  assert.equal(body.error.requestId, 'trace-12345678');
  assert.equal(res.headers['x-request-id'], 'trace-12345678');
  await app.close();
});

test('zod validation errors become 400 with field paths', async () => {
  const app = buildApp();
  app.post('/api/_t/validate', async (req) => z.object({ name: z.string().min(2) }).parse(req.body));
  const res = await app.inject({ method: 'POST', url: '/api/_t/validate', payload: { name: 'x' } });
  assert.equal(res.statusCode, 400);
  const body = res.json() as { error: { code: string; details: Array<{ path: string }> } };
  assert.equal(body.error.code, 'validation_failed');
  assert.equal(body.error.details[0]?.path, 'name');
  await app.close();
});

test('unexpected errors are hidden behind a generic 500', async () => {
  const app = buildApp();
  app.get('/api/_t/boom', async () => {
    throw new Error('database password is hunter2');
  });
  const res = await app.inject({ method: 'GET', url: '/api/_t/boom' });
  assert.equal(res.statusCode, 500);
  assert.ok(!res.body.includes('hunter2'));
  await app.close();
});

test('unknown routes use the envelope too', async () => {
  const app = buildApp();
  const res = await app.inject({ method: 'GET', url: '/api/missing' });
  assert.equal(res.statusCode, 404);
  assert.equal((res.json() as { error: { code: string } }).error.code, 'not_found');
  await app.close();
});
