import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildApp } from '../src/app';

test('GET /api/health returns ok', async () => {
  const app = buildApp();
  const res = await app.inject({ method: 'GET', url: '/api/health' });
  assert.equal(res.statusCode, 200);
  const body = res.json() as { status: string; service: string };
  assert.equal(body.status, 'ok');
  assert.equal(body.service, 'worlds-made-backend');
  await app.close();
});

test('unknown route is a 404', async () => {
  const app = buildApp();
  const res = await app.inject({ method: 'GET', url: '/api/nope' });
  assert.equal(res.statusCode, 404);
  await app.close();
});
