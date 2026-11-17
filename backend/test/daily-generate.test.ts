import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildApp } from '../src/app';
import { MemoryStore } from '../src/adapters/data/memory';
import { loadConfig } from '../src/config';
import type { DailyChallengeRow, GameRow } from '../src/db/tables';
import { genreFor, SCORE_RANGES, themeFor, THEMES } from '../src/services/daily/themes';
import { addDays, dayKey, nextRollover } from '../src/services/daily/daily';
import { FakeLlm } from '../src/adapters/llm/fake';
import { MeteredLlm } from '../src/adapters/llm/ledger';
import { scanGameHtml } from '../src/services/scanner';

const CRON = { authorization: 'Bearer cron-secret-cron-secret' };

function setup() {
  const store = new MemoryStore();
  const fake = new FakeLlm();
  const app = buildApp({ config: loadConfig({ CRON_SECRET: 'cron-secret-cron-secret' }), services: { store, llm: new MeteredLlm(fake, store, { inPerM: 0, outPerM: 0 }) } });
  return { app, store, fake };
}

test('themes and genres are deterministic per date and cover the list', () => {
  assert.equal(themeFor('2026-06-15'), themeFor('2026-06-15'));
  assert.notEqual(themeFor('2026-06-15'), themeFor('2026-06-16'));
  assert.ok(THEMES.length >= 30);
  assert.notEqual(genreFor('2026-06-15'), genreFor('2026-06-16'));
  for (const r of Object.values(SCORE_RANGES)) assert.ok(r.max > r.min);
});

test('the rollover is the next 00:00 UTC', () => {
  assert.equal(nextRollover(new Date('2026-06-15T23:59:59Z')).toISOString(), '2026-06-16T00:00:00.000Z');
  assert.equal(dayKey(addDays(new Date('2026-06-30T10:00:00Z'), 1)), '2026-07-01');
});

test('the cron job needs the secret', async () => {
  const { app } = setup();
  assert.equal((await app.inject({ method: 'GET', url: '/api/jobs/daily-generate' })).statusCode, 401);
  await app.close();
});

test('it creates tomorrow\'s challenge as pending, with an ownerless scanned game and a score range', async () => {
  const { app, store, fake } = setup();
  const res = await app.inject({ method: 'GET', url: '/api/jobs/daily-generate', headers: CRON });
  assert.equal(res.statusCode, 200);
  const body = res.json() as { created: boolean; date: string; theme: string };
  assert.equal(body.created, true);
  assert.equal(body.date, dayKey(addDays(new Date(), 1)));
  assert.equal(body.theme, themeFor(body.date));

  const [row] = await store.list<DailyChallengeRow>('daily_challenges');
  assert.equal(row?.status, 'pending');
  assert.equal(row?.date, body.date);
  assert.equal(row?.approved_by, null);
  const genre = genreFor(body.date);
  assert.deepEqual([row?.score_min, row?.score_max], [SCORE_RANGES[genre].min, SCORE_RANGES[genre].max]);

  const game = (await store.list<GameRow>('games'))[0];
  assert.equal(game?.owner_id, null);
  const version = (await app.services.games.getVersion(row!.game_version_id))!;
  assert.equal(scanGameHtml((await app.services.games.html(version))!).ok, true);
  assert.equal(fake.calls[0]?.purpose, 'daily');
  assert.match(fake.calls[0]?.user ?? '', new RegExp(body.theme));
  await app.close();
});

test('running it twice does not create a second challenge for the same day', async () => {
  const { app, store } = setup();
  await app.inject({ method: 'GET', url: '/api/jobs/daily-generate', headers: CRON });
  const again = await app.inject({ method: 'GET', url: '/api/jobs/daily-generate', headers: CRON });
  assert.equal((again.json() as { created: boolean }).created, false);
  assert.equal(await store.count('daily_challenges'), 1);
  await app.close();
});
