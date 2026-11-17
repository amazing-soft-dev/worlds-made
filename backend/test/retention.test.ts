import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildApp } from '../src/app';
import { loadConfig } from '../src/config';
import { MemoryStore } from '../src/adapters/data/memory';
import { newAnonId, readAnonId } from '../src/services/anon';
import { purgeAnonymous, purgeInactiveAccounts } from '../src/services/retention';

const now = new Date('2026-06-15T00:00:00Z');

test('anonymous ids are random and unlinkable', () => {
  const a = newAnonId();
  assert.match(a, /^a_[\w-]{22}$/);
  assert.notEqual(a, newAnonId());
});

test('old anonymous streaks and scores are purged, recent ones and account rows are kept', async () => {
  const s = new MemoryStore();
  await s.insert('streaks', { anon_id: 'a_old', current: 3, best: 3, last_played_date: '2025-01-01' });
  await s.insert('streaks', { anon_id: 'a_new', current: 1, best: 1, last_played_date: '2026-06-10' });
  await s.insert('streaks', { user_id: 'u1', current: 9, best: 9, last_played_date: '2025-01-01' });
  await s.insert('challenge_scores', { date: '2025-01-01', anon_id: 'a_old', score: 10 });
  await s.insert('challenge_scores', { date: '2026-06-10', anon_id: 'a_new', score: 10 });
  const out = await purgeAnonymous(s, now, 180);
  assert.deepEqual(out, { streaks: 1, scores: 1 });
  assert.equal(await s.count('streaks'), 2);
  assert.equal(await s.count('challenge_scores'), 1);
  assert.ok(await s.get('streaks', { user_id: 'u1' }));
});

test('inactive accounts are deleted unless active or subscribed', async () => {
  const s = new MemoryStore();
  const mk = (id: string) => s.insert('profiles', { id, display_name: id, birth_year: 1990, age_band: 'adult', plan: 'free', created_at: '2023-01-01T00:00:00Z' });
  for (const id of ['idle', 'builder', 'payer']) await mk(id);
  await s.insert('games', { owner_id: 'idle', title: 'old', created_at: '2023-02-01T00:00:00Z' });
  await s.insert('build_usage', { user_id: 'builder', date: '2026-06-01', builds_used: 1, repairs_used: 0 });
  await s.insert('subscriptions', { user_id: 'payer', stripe_customer_id: 'cus_1', status: 'active' });
  assert.equal(await purgeInactiveAccounts(s, now, 730), 1);
  assert.equal(await s.get('profiles', { id: 'idle' }), null);
  assert.equal(await s.count('games'), 0);
  assert.ok(await s.get('profiles', { id: 'builder' }));
  assert.ok(await s.get('profiles', { id: 'payer' }));
});

test('the retention job needs the cron secret', async () => {
  const app = buildApp({ config: loadConfig({ CRON_SECRET: 'cron-secret-cron-secret' }) });
  assert.equal((await app.inject({ method: 'GET', url: '/api/jobs/retention' })).statusCode, 401);
  assert.equal((await app.inject({ method: 'GET', url: '/api/jobs/retention', headers: { authorization: 'Bearer wrong-wrong-wrong-wr' } })).statusCode, 401);
  const ok = await app.inject({ method: 'GET', url: '/api/jobs/retention', headers: { authorization: 'Bearer cron-secret-cron-secret' } });
  assert.equal(ok.statusCode, 200);
  await app.close();
  const none = buildApp({ config: loadConfig({}) });
  assert.equal((await none.inject({ method: 'GET', url: '/api/jobs/retention', headers: { authorization: 'Bearer undefined' } })).statusCode, 401);
  await none.close();
});

test('readAnonId returns null without a valid cookie', () => {
  const req = { headers: { cookie: 'wm_anon=a_x.badsig' } } as never;
  assert.equal(readAnonId(req, loadConfig({})), null);
});
