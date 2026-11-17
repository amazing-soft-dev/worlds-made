import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildApp } from '../src/app';
import { MemoryStore } from '../src/adapters/data/memory';
import { FakeLlm } from '../src/adapters/llm/fake';
import { MeteredLlm } from '../src/adapters/llm/ledger';
import { loadConfig } from '../src/config';
import type { DailyChallengeRow, GameRow } from '../src/db/tables';
import { addDays, dayKey } from '../src/services/daily/daily';
import { scanGameHtml } from '../src/services/scanner';
import { signUp } from './helpers';

const CRON = { authorization: 'Bearer cron-secret-cron-secret' };

async function setup() {
  const store = new MemoryStore();
  const app = buildApp({
    config: loadConfig({ CRON_SECRET: 'cron-secret-cron-secret', FOUNDER_EMAILS: 'boss@worldsmade.example', GAME_ORIGIN: 'https://games.example' }),
    services: { store, llm: new MeteredLlm(new FakeLlm(), store, { inPerM: 0, outPerM: 0 }) },
  });
  const boss = await signUp(app, { email: 'boss@worldsmade.example' });
  return { app, store, boss };
}
type Ctx = Awaited<ReturnType<typeof setup>>;

const today = () => dayKey(new Date());
const get = async (c: Ctx, url: string, headers: Record<string, string> = {}) => c.app.inject({ method: 'GET', url, headers });

test('the backlog seed makes 14 approved, ownerless, scanner-clean games and tops up without duplicating', async () => {
  const c = await setup();
  const res = await c.app.inject({ method: 'POST', url: '/api/admin/challenges/seed-backlog', headers: c.boss.headers, payload: {} });
  assert.equal((res.json() as { made: number; backlogOk: boolean }).made, 14);
  assert.equal((res.json() as { backlogOk: boolean }).backlogOk, true);
  const again = await c.app.inject({ method: 'POST', url: '/api/admin/challenges/seed-backlog', headers: c.boss.headers, payload: {} });
  assert.equal((again.json() as { made: number }).made, 0);
  const rows = await c.store.list<DailyChallengeRow>('daily_challenges');
  assert.equal(rows.length, 14);
  for (const r of rows) {
    assert.equal(r.status, 'approved');
    assert.equal(r.date, null);
    const html = await c.app.services.games.html((await c.app.services.games.getVersion(r.game_version_id))!);
    assert.equal(scanGameHtml(html!).ok, true);
  }
  assert.ok((await c.store.list<GameRow>('games')).every((g) => g.owner_id === null));
  await c.app.close();
});

test('the founder reviews tomorrow\'s pending challenge: preview, approve, or reject', async () => {
  const c = await setup();
  await c.app.inject({ method: 'GET', url: '/api/jobs/daily-generate', headers: CRON });
  const overview = (await get(c, '/api/admin/challenges', c.boss.headers)).json() as { pending: Array<{ id: string; previewUrl: string; status: string }> };
  assert.equal(overview.pending.length, 1);
  assert.match(overview.pending[0]?.previewUrl ?? '', /^https:\/\/games\.example\/g\/[0-9a-f-]{36}\?t=\d+\./);

  const id = overview.pending[0]!.id;
  const approved = await c.app.inject({ method: 'POST', url: `/api/admin/challenges/${id}/approve`, headers: c.boss.headers });
  assert.equal((approved.json() as { challenge: { status: string } }).challenge.status, 'approved');
  const row = (await c.store.get<DailyChallengeRow>('daily_challenges', { id }))!;
  assert.equal(row.approved_by, c.boss.userId);

  // A different day's pending challenge can be rejected; an approved one cannot.
  await c.store.insert('daily_challenges', { date: dayKey(addDays(new Date(), 5)), game_version_id: row.game_version_id, theme: 't', status: 'pending', score_min: 0, score_max: 10 });
  const pending = (await c.store.list<DailyChallengeRow>('daily_challenges', { where: { status: 'pending' } }))[0]!;
  assert.equal((await c.app.inject({ method: 'DELETE', url: `/api/admin/challenges/${pending.id}`, headers: c.boss.headers })).statusCode, 204);
  assert.equal((await c.app.inject({ method: 'DELETE', url: `/api/admin/challenges/${id}`, headers: c.boss.headers })).statusCode, 404);
  await c.app.close();
});

test('an approved challenge for today is today\'s challenge for everyone', async () => {
  const c = await setup();
  await c.app.inject({ method: 'POST', url: '/api/admin/challenges/seed-backlog', headers: c.boss.headers, payload: { count: 1 } });
  const seeded = (await c.store.list<DailyChallengeRow>('daily_challenges'))[0]!;
  await c.store.update('daily_challenges', { id: seeded.id }, { date: today(), status: 'approved' });
  const res = (await get(c, '/api/daily')).json() as { date: string; theme: string; versionId: string; playUrl: string; secondsToRollover: number; nextRolloverAt: string };
  assert.equal(res.date, today());
  assert.equal(res.versionId, seeded.game_version_id);
  assert.match(res.playUrl, /^https:\/\/games\.example\/g\/.+\?t=/);
  assert.ok(res.secondsToRollover > 0 && res.secondsToRollover <= 86400);
  assert.match(res.nextRolloverAt, /T00:00:00\.000Z$/);
  assert.equal(((await get(c, '/api/daily')).json() as { versionId: string }).versionId, seeded.game_version_id);
  await c.app.close();
});

test('with nothing approved for today the next backlog game is used, and stays today\'s for everyone', async () => {
  const c = await setup();
  await c.app.inject({ method: 'POST', url: '/api/admin/challenges/seed-backlog', headers: c.boss.headers, payload: {} });
  // Today has a pending challenge nobody approved by midnight.
  const [backlogFirst] = await c.store.list<DailyChallengeRow>('daily_challenges', { orderBy: 'created_at' });
  await c.store.insert('daily_challenges', { date: today(), game_version_id: backlogFirst!.game_version_id, theme: 'unapproved', status: 'pending', score_min: 0, score_max: 10 });

  const first = (await get(c, '/api/daily')).json() as { versionId: string; theme: string };
  assert.notEqual(first.theme, 'unapproved');
  const second = (await get(c, '/api/daily')).json() as { versionId: string };
  assert.equal(second.versionId, first.versionId);
  assert.equal(await c.store.count('daily_challenges', { date: today() }), 1);
  assert.equal(await c.store.count('daily_challenges', { date: null, status: 'approved' }), 13);
  // The unapproved one went back to the review pool instead of being lost.
  assert.equal(await c.store.count('daily_challenges', { theme: 'unapproved', status: 'pending' }), 1);
  await c.app.close();
});

test('with no approved challenge and an empty backlog the daily page says it is not ready', async () => {
  const c = await setup();
  const res = await get(c, '/api/daily');
  assert.equal(res.statusCode, 503);
  assert.equal((res.json() as { error: { code: string } }).error.code, 'no_challenge');
  await c.app.close();
});

test('the daily admin routes are founder-only', async () => {
  const c = await setup();
  const other = await signUp(c.app);
  assert.equal((await get(c, '/api/admin/challenges')).statusCode, 401);
  assert.equal((await get(c, '/api/admin/challenges', other.headers)).statusCode, 403);
  assert.equal((await c.app.inject({ method: 'POST', url: '/api/admin/challenges/seed-backlog', headers: other.headers, payload: {} })).statusCode, 403);
  await c.app.close();
});
