import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildApp } from '../src/app';
import { MemoryStore } from '../src/adapters/data/memory';
import { loadConfig } from '../src/config';
import type { GameRow } from '../src/db/tables';
import { renderTemplate } from '../src/services/games/templates';
import { draft, meter, reply, ScriptedLlm, signUp } from './helpers';

const GOOD = '```html\n' + renderTemplate('runner', 'Frog Hop') + '\n```';
const details = { title: 'Frog Hop', description: 'Hop.', tags: [], license: 'cc-by', allowDownload: false };

async function setup() {
  const store = new MemoryStore();
  const app = buildApp({ config: loadConfig({ FOUNDER_EMAILS: 'boss@worldsmade.example', MONTHLY_SPEND_CAP_USD: '50' }), services: { store, llm: meter(new ScriptedLlm([reply(GOOD)]), store) } });
  const boss = await signUp(app, { email: 'boss@worldsmade.example' });
  const owner = await signUp(app);
  const id = await draft(app, owner.headers);
  await app.inject({ method: 'POST', url: `/api/games/${id}/publish`, headers: owner.headers, payload: details });
  const reporters = [];
  for (let i = 0; i < 3; i++) {
    const u = await signUp(app);
    await store.update('profiles', { id: u.userId }, { created_at: '2020-01-01T00:00:00Z' });
    await app.inject({ method: 'POST', url: `/api/games/${id}/report`, headers: u.headers, payload: { reason: `reason ${i}` } });
    reporters.push(u);
  }
  return { app, store, boss, owner, id };
}

test('only the founder can use the admin API', async () => {
  const { app, owner } = await setup();
  for (const url of ['/api/admin/reports', '/api/admin/costs']) {
    assert.equal((await app.inject({ method: 'GET', url })).statusCode, 401);
    assert.equal((await app.inject({ method: 'GET', url, headers: owner.headers })).statusCode, 403);
  }
  await app.close();
});

test('the queue shows reported games with weighted counts and reasons', async () => {
  const { app, boss, id } = await setup();
  const res = await app.inject({ method: 'GET', url: '/api/admin/reports', headers: boss.headers });
  const { queue } = res.json() as { queue: Array<{ game: { id: string; status: string }; weight: number; reports: Array<{ reason: string }> }> };
  assert.equal(queue.length, 1);
  assert.equal(queue[0]?.game.id, id);
  assert.equal(queue[0]?.game.status, 'hidden');
  assert.equal(queue[0]?.weight, 3);
  assert.deepEqual(queue[0]?.reports.map((r) => r.reason).sort(), ['reason 0', 'reason 1', 'reason 2']);
  await app.close();
});

test('restore shows the game again and clears the queue', async () => {
  const { app, store, boss, id } = await setup();
  const res = await app.inject({ method: 'POST', url: `/api/admin/reports/${id}/resolve`, headers: boss.headers, payload: { action: 'restore' } });
  assert.equal((res.json() as { game: { status: string } }).game.status, 'published');
  assert.equal(await store.count('reports', { status: 'open' }), 0);
  assert.equal(await store.count('reports', { status: 'dismissed' }), 3);
  await app.close();
});

test('remove takes the game down for good and keeps the reports as reviewed', async () => {
  const { app, store, boss, id } = await setup();
  await app.inject({ method: 'POST', url: `/api/admin/reports/${id}/resolve`, headers: boss.headers, payload: { action: 'remove' } });
  const g = await store.get<GameRow>('games', { id });
  assert.deepEqual([g?.status, g?.visibility], ['removed', 'private']);
  assert.equal(await store.count('reports', { status: 'reviewed' }), 3);
  await app.close();
});

test('staff picks can be set, and the cost dashboard reports spend against the cap', async () => {
  const { app, boss, id } = await setup();
  const pick = await app.inject({ method: 'POST', url: `/api/admin/games/${id}/staff-pick`, headers: boss.headers, payload: { value: true } });
  assert.equal((pick.json() as { game: unknown }).game !== undefined, true);
  const costs = (await app.inject({ method: 'GET', url: '/api/admin/costs', headers: boss.headers })).json() as { capUsd: number; averageByPurpose: Record<string, { calls: number }>; buildsPaused: boolean };
  assert.equal(costs.capUsd, 50);
  assert.equal(costs.buildsPaused, false);
  assert.ok((costs.averageByPurpose.generate?.calls ?? 0) >= 1);
  assert.equal((await app.inject({ method: 'POST', url: `/api/admin/reports/${id}/resolve`, headers: boss.headers, payload: { action: 'explode' } })).statusCode, 400);
  await app.close();
});
