import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildApp } from '../src/app';
import { MemoryStore } from '../src/adapters/data/memory';
import { FakeLlm } from '../src/adapters/llm/fake';
import { MeteredLlm } from '../src/adapters/llm/ledger';
import { loadConfig } from '../src/config';
import type { DailyChallengeRow } from '../src/db/tables';
import { dayKey } from '../src/services/daily/daily';
import { DailyScoreService } from '../src/services/daily/scores';
import { signUp } from './helpers';

const SECRET = 'cookie-secret-cookie-secret';

async function setup(minPlayMs = 0) {
  const store = new MemoryStore();
  const config = loadConfig({ COOKIE_SECRET: SECRET });
  const app = buildApp({
    config,
    services: { store, llm: new MeteredLlm(new FakeLlm(), store, { inPerM: 0, outPerM: 0 }), dailyScores: new DailyScoreService(store, SECRET, { minPlayMs, maxPlayMs: 6 * 3600 * 1000 }) },
  });
  await app.services.daily.seedBacklog(1);
  const [row] = await store.list<DailyChallengeRow>('daily_challenges');
  await store.update('daily_challenges', { id: row!.id }, { date: dayKey(new Date()), status: 'approved' });
  return { app, store };
}
type Ctx = Awaited<ReturnType<typeof setup>>;

const start = async (c: Ctx, headers: Record<string, string> = {}) => {
  const res = await c.app.inject({ method: 'POST', url: '/api/daily/start', headers });
  return { token: (res.json() as { sessionToken: string }).sessionToken, cookie: String(res.headers['set-cookie'] ?? '').split(';')[0] ?? '' };
};
const submit = (c: Ctx, headers: Record<string, string>, token: string, value: number) =>
  c.app.inject({ method: 'POST', url: '/api/daily/score', headers, payload: { sessionToken: token, value } });
type Result = { score: number; best: number; rank: number; streak: { current: number; best: number } };

test('a play session scores once; the same token cannot be reused', async () => {
  const c = await setup();
  const { headers } = await signUp(c.app);
  const { token } = await start(c, headers);
  const ok = await submit(c, headers, token, 120);
  assert.equal(ok.statusCode, 200);
  assert.deepEqual(ok.json(), { score: 120, best: 120, rank: 1, streak: { current: 1, best: 1 } });
  const again = await submit(c, headers, token, 130);
  assert.equal(again.statusCode, 409);
  assert.equal((again.json() as { error: { code: string } }).error.code, 'already_submitted');
  await c.app.close();
});

test('scores outside the challenge range and non-numbers are rejected', async () => {
  const c = await setup();
  const { headers } = await signUp(c.app);
  for (const value of [-1, 1e9, 3001 /* runner ceiling is 3000 */]) {
    const { token } = await start(c, headers);
    const res = await submit(c, headers, token, value);
    assert.equal(res.statusCode, 400, String(value));
    assert.equal((res.json() as { error: { code: string } }).error.code, 'score_out_of_range');
  }
  const { token } = await start(c, headers);
  assert.equal((await c.app.inject({ method: 'POST', url: '/api/daily/score', headers, payload: { sessionToken: token, value: 'lots' } })).statusCode, 400);
  assert.equal(await c.store.count('challenge_scores'), 0);
  await c.app.close();
});

test('a score that arrives too fast after the session started is refused', async () => {
  const c = await setup(3000);
  const { headers } = await signUp(c.app);
  const { token } = await start(c, headers);
  const res = await submit(c, headers, token, 50);
  assert.equal((res.json() as { error: { code: string } }).error.code, 'too_fast');
  await c.app.close();
});

test('tokens are bound to the player and cannot be forged', async () => {
  const c = await setup();
  const alice = await signUp(c.app);
  const bob = await signUp(c.app);
  const { token } = await start(c, alice.headers);
  assert.equal((await submit(c, bob.headers, token, 10)).statusCode, 403);
  assert.equal((await submit(c, alice.headers, token.replace(/.$/, 'x'), 10)).statusCode, 403);
  assert.equal((await submit(c, alice.headers, 'nonsense', 10)).statusCode, 403);
  const old = token.replace(/^\d{4}-\d{2}-\d{2}/, '2020-01-01');
  assert.equal((await submit(c, alice.headers, old, 10)).statusCode, 403);
  await c.app.close();
});

test('only the best score of the day is kept', async () => {
  const c = await setup();
  const { headers } = await signUp(c.app);
  const play = async (v: number) => (await submit(c, headers, (await start(c, headers)).token, v)).json() as Result;
  assert.equal((await play(100)).best, 100);
  assert.equal((await play(40)).best, 100);
  assert.equal((await play(250)).best, 250);
  assert.equal(await c.store.count('challenge_scores'), 1);
  const me = (await c.app.inject({ method: 'GET', url: '/api/daily/me', headers })).json() as { best: number; rank: number };
  assert.deepEqual([me.best, me.rank], [250, 1]);
  await c.app.close();
});

test('anonymous players keep a streak and score under a cookie id, and appear as Guest', async () => {
  const c = await setup();
  const first = await start(c);
  assert.match(first.cookie, /^wm_anon=/);
  const res = await submit(c, { cookie: first.cookie }, first.token, 77);
  assert.equal(res.statusCode, 200);
  const board = (await c.app.inject({ method: 'GET', url: '/api/daily/leaderboard' })).json() as { entries: Array<{ name: string; score: number; rank: number }> };
  assert.deepEqual(board.entries, [{ rank: 1, name: 'Guest', score: 77 }]);
  // No identifying fields leak into the stored row.
  const row = (await c.store.list<{ user_id?: string | null; anon_id?: string | null }>('challenge_scores'))[0];
  assert.ok(row?.anon_id?.startsWith('a_'));
  assert.ok(!row?.user_id);
  await c.app.close();
});

test('the leaderboard shows the top 100 by score with display names, and teens show a generated nickname', async () => {
  const c = await setup();
  const adult = await signUp(c.app, { displayName: 'Maple Fan' });
  const teen = await signUp(c.app, { yearsOld: 16, displayName: 'RealName' });
  await submit(c, adult.headers, (await start(c, adult.headers)).token, 300);
  await submit(c, teen.headers, (await start(c, teen.headers)).token, 200);
  for (let i = 0; i < 120; i++) await c.store.insert('challenge_scores', { date: dayKey(new Date()), anon_id: `a_bulk${i}`, score: i });
  const { entries } = (await c.app.inject({ method: 'GET', url: '/api/daily/leaderboard' })).json() as { entries: Array<{ rank: number; name: string; score: number }> };
  assert.equal(entries.length, 100);
  assert.deepEqual([entries[0]?.name, entries[0]?.score], ['Maple Fan', 300]);
  assert.equal(entries[1]?.score, 200);
  assert.notEqual(entries[1]?.name, 'RealName');
  assert.match(entries[1]?.name ?? '', /^[A-Z][a-z]+[A-Z][a-z]+\d{2}$/);
  assert.ok(entries.every((e, i) => e.rank === i + 1 && (i === 0 || (entries[i - 1]?.score ?? 0) >= e.score)));
  await c.app.close();
});

test('streaks count consecutive days, hold within a day, reset after a gap and keep the best', async () => {
  const store = new MemoryStore();
  const s = new DailyScoreService(store, SECRET);
  const who = { kind: 'anon' as const, id: 'a_x' };
  assert.deepEqual(await s.recordPlay(who, '2026-06-10'), { current: 1, best: 1 });
  assert.deepEqual(await s.recordPlay(who, '2026-06-10'), { current: 1, best: 1 });
  assert.deepEqual(await s.recordPlay(who, '2026-06-11'), { current: 2, best: 2 });
  assert.deepEqual(await s.recordPlay(who, '2026-06-12'), { current: 3, best: 3 });
  assert.deepEqual(await s.recordPlay(who, '2026-06-15'), { current: 1, best: 3 });
  assert.deepEqual(await s.streakFor(who, '2026-06-16'), { current: 1, best: 3 }); // played yesterday: alive
  assert.deepEqual(await s.streakFor(who, '2026-06-17'), { current: 0, best: 3 }); // missed a day: ended
  assert.deepEqual(await s.streakFor({ kind: 'user', id: 'nobody' }, '2026-06-17'), { current: 0, best: 0 });
  assert.equal(await store.count('streaks'), 1);
});
