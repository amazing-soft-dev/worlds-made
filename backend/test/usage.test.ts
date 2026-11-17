import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildApp } from '../src/app';
import { MemoryStore } from '../src/adapters/data/memory';
import { loadConfig } from '../src/config';
import type { BuildUsageRow, ProfileRow } from '../src/db/tables';
import { renderTemplate } from '../src/services/games/templates';
import { meter, reply, ScriptedLlm, signUp, type Step } from './helpers';

const GOOD = '```html\n' + renderTemplate('runner', 'Frog Hop') + '\n```';
const BAD = '```html\n<!doctype html><html><body><canvas></canvas><script>fetch("/x")</script></body></html>\n```';

function setup(steps: Step[] = [reply(GOOD)]) {
  const store = new MemoryStore();
  const provider = new ScriptedLlm(steps);
  const app = buildApp({ config: loadConfig({}), services: { store, llm: meter(provider, store) } });
  return { app, store, provider };
}
type App = ReturnType<typeof setup>['app'];

const post = (app: App, url: string, headers: Record<string, string>, payload: object) => app.inject({ method: 'POST', url, headers, payload });
const generate = (app: App, h: Record<string, string>) => post(app, '/api/games/generate', h, { prompt: 'a frog that hops over logs' });
const usage = async (app: App, h: Record<string, string>) => (await app.inject({ method: 'GET', url: '/api/usage', headers: h })).json() as { buildsUsed: number; buildsLimit: number; repairsUsed: number; plan: string };

test('a free account gets three builds a day, then 429 limit_reached with the reset time', async () => {
  const { app } = setup();
  const { headers } = await signUp(app);
  for (let i = 0; i < 3; i++) assert.equal((await generate(app, headers)).statusCode, 201);
  const res = await generate(app, headers);
  assert.equal(res.statusCode, 429);
  const err = (res.json() as { error: { code: string; details: { limit: number; resetsAt: string } } }).error;
  assert.equal(err.code, 'limit_reached');
  assert.equal(err.details.limit, 3);
  assert.match(err.details.resetsAt, /T00:00:00\.000Z$/);
  assert.deepEqual(await usage(app, headers), { plan: 'free', date: new Date().toISOString().slice(0, 10), buildsUsed: 3, buildsLimit: 3, repairsUsed: 0, resetsAt: err.details.resetsAt });
  await app.close();
});

test('a failed or timed-out build is not charged', async () => {
  const { app } = setup([reply(BAD)]);
  const { headers } = await signUp(app);
  assert.equal((await generate(app, headers)).statusCode, 502);
  assert.equal((await usage(app, headers)).buildsUsed, 0);
  await app.close();
});

test('two repairs per build are free, the third counts as a build', async () => {
  const { app } = setup();
  const { headers } = await signUp(app);
  const first = (await generate(app, headers)).json() as { game: { id: string } };
  const gameId = first.game.id;
  const charges: string[] = [];
  for (let i = 0; i < 3; i++) {
    const res = await post(app, `/api/games/${gameId}/repair`, headers, { errors: ['ReferenceError: x is not defined'] });
    assert.equal(res.statusCode, 201);
    charges.push((res.json() as { charged: string }).charged);
  }
  assert.deepEqual(charges, ['free-repair', 'free-repair', 'build']);
  const u = await usage(app, headers);
  assert.equal(u.buildsUsed, 2);
  assert.equal(u.repairsUsed, 2);
  await app.close();
});

test('"change it" counts as a build and adds a version to the same game', async () => {
  const { app, store } = setup();
  const { headers } = await signUp(app);
  const { game } = (await generate(app, headers)).json() as { game: { id: string } };
  const res = await post(app, `/api/games/${game.id}/change`, headers, { instruction: 'make the obstacles slower' });
  assert.equal(res.statusCode, 201);
  assert.equal((res.json() as { charged: string }).charged, 'build');
  assert.equal(await store.count('games'), 1);
  assert.equal(await store.count('game_versions', { game_id: game.id }), 2);
  assert.equal((await usage(app, headers)).buildsUsed, 2);
  await app.close();
});

test('the paid plan has a larger allowance and the day rolls over at 00:00 UTC', async () => {
  const { app, store } = setup();
  const { headers, userId } = await signUp(app);
  await store.update('profiles', { id: userId }, { plan: 'paid' });
  assert.equal((await usage(app, headers)).buildsLimit, 30);
  const profile = (await store.get<ProfileRow>('profiles', { id: userId })) as ProfileRow;
  await generate(app, headers);
  const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
  const snap = await app.services.usage.snapshot(profile, tomorrow);
  assert.equal(snap.buildsUsed, 0);
  assert.equal((await store.list<BuildUsageRow>('build_usage')).length, 1);
  await app.close();
});

test("nobody can repair or change someone else's game", async () => {
  const { app } = setup();
  const alice = await signUp(app);
  const bob = await signUp(app);
  const { game } = (await generate(app, alice.headers)).json() as { game: { id: string } };
  assert.equal((await post(app, `/api/games/${game.id}/repair`, bob.headers, { errors: [] })).statusCode, 404);
  assert.equal((await post(app, `/api/games/${game.id}/change`, bob.headers, { instruction: 'make it harder' })).statusCode, 404);
  await app.close();
});
