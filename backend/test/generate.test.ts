import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildApp } from '../src/app';
import { MemoryStore } from '../src/adapters/data/memory';
import { loadConfig } from '../src/config';
import { LlmProviderError, LlmTimeoutError } from '../src/adapters/llm/provider';
import type { GameRow, GameVersionRow } from '../src/db/tables';
import { renderTemplate } from '../src/services/games/templates';
import { meter, reply, ScriptedLlm, signUp, type Step } from './helpers';

const GOOD = '```html\n' + renderTemplate('runner', 'Frog Hop') + '\n```';
const BAD = '```html\n<!doctype html><html><body><canvas></canvas><script>fetch("/steal")</script></body></html>\n```';

function setup(steps: Step[]) {
  const store = new MemoryStore();
  const provider = new ScriptedLlm(steps);
  // An explicit empty config keeps the test hermetic: no real API keys from the developer's environment.
  const app = buildApp({ config: loadConfig({}), services: { store, llm: meter(provider, store) } });
  return { app, store, provider };
}

const generate = (app: ReturnType<typeof buildApp>, headers: Record<string, string>, prompt = 'a frog that hops over logs') =>
  app.inject({ method: 'POST', url: '/api/games/generate', headers, payload: { prompt } });

test('a prompt becomes a stored draft game with a scanned version and a logged model call', async () => {
  const { app, store, provider } = setup([reply(GOOD)]);
  const { headers, userId } = await signUp(app);
  const res = await generate(app, headers);
  assert.equal(res.statusCode, 201);
  const body = res.json() as { game: { id: string; title: string; status: string }; version: { id: string } };
  assert.equal(body.game.status, 'draft');
  assert.equal(body.game.title, 'A Frog That Hops Over');
  const game = await store.get<GameRow>('games', { id: body.game.id });
  assert.equal(game?.owner_id, userId);
  assert.equal(game?.current_version_id, body.version.id);
  const version = await store.get<GameVersionRow>('game_versions', { id: body.version.id });
  assert.match((await app.services.blobs.get(version?.html_path ?? '')) ?? '', /parent\.postMessage/);
  assert.equal(provider.calls.length, 1);
  assert.equal(await store.count('llm_calls', { ok: true }), 1);
  await app.close();
});

test('a blocked prompt is refused before the model is called', async () => {
  const { app, provider } = setup([reply(GOOD)]);
  const { headers } = await signUp(app);
  const res = await generate(app, headers, 'make a porn game');
  assert.equal(res.statusCode, 422);
  assert.equal((res.json() as { error: { code: string } }).error.code, 'prompt_blocked');
  assert.equal(provider.calls.length, 0);
  await app.close();
});

test('franchise names are swapped for original stand-ins and the swap is reported', async () => {
  const { app, provider } = setup([reply(GOOD)]);
  const { headers } = await signUp(app);
  const res = await generate(app, headers, 'a mario style jumper');
  assert.equal(res.statusCode, 201);
  assert.equal((res.json() as { swaps: unknown[] }).swaps.length, 1);
  assert.doesNotMatch(provider.calls[0]?.user ?? '', /mario/i);
  await app.close();
});

test('an unsafe first reply is regenerated once and the good one is stored', async () => {
  const { app, store, provider } = setup([reply(BAD), reply(GOOD)]);
  const { headers } = await signUp(app);
  const res = await generate(app, headers);
  assert.equal(res.statusCode, 201);
  assert.equal(provider.calls.length, 2);
  assert.equal(await store.count('games'), 1);
  await app.close();
});

test('two unsafe replies fail with nothing stored', async () => {
  const { app, store } = setup([reply(BAD)]);
  const { headers } = await signUp(app);
  const res = await generate(app, headers);
  assert.equal(res.statusCode, 502);
  assert.equal((res.json() as { error: { code: string } }).error.code, 'generation_failed');
  assert.equal(await store.count('games'), 0);
  assert.equal(await store.count('game_versions'), 0);
  await app.close();
});

test('a reply that is not HTML, or whose text is flagged, counts as a failed attempt', async () => {
  const flagged = '```html\n' + renderTemplate('runner', 'x').replace('Game over', 'Game over [[flag]]') + '\n```';
  const { app } = setup([reply('Sorry, I cannot help with that.'), reply(flagged)]);
  const { headers } = await signUp(app);
  assert.equal((await generate(app, headers)).statusCode, 502);
  await app.close();
});

test('a timeout is retried once with a smaller template, and two timeouts give 504', async () => {
  const ok = setup([new LlmTimeoutError(90_000), reply(GOOD)]);
  const a = await signUp(ok.app);
  assert.equal((await generate(ok.app, a.headers)).statusCode, 201);
  assert.match(ok.provider.calls[1]?.user ?? '', /Keep it small and simple/);
  await ok.app.close();

  const dead = setup([new LlmTimeoutError(90_000)]);
  const b = await signUp(dead.app);
  const res = await generate(dead.app, b.headers);
  assert.equal(res.statusCode, 504);
  assert.equal((res.json() as { error: { code: string } }).error.code, 'provider_timeout');
  await dead.app.close();

  const down = setup([new LlmProviderError('boom', 500)]);
  const c = await signUp(down.app);
  assert.equal((await generate(down.app, c.headers)).statusCode, 502);
  await down.app.close();
});

test('building needs a sign-in, a verified email and a profile', async () => {
  const { app } = setup([reply(GOOD)]);
  assert.equal((await generate(app, {})).statusCode, 401);
  const unverified = await signUp(app, { verified: false });
  assert.equal((await generate(app, unverified.headers)).statusCode, 403);
  const login = (await app.inject({ method: 'POST', url: '/api/auth/dev-token', payload: { email: 'noprofile@example.com' } })).json() as { token: string };
  const res = await generate(app, { authorization: `Bearer ${login.token}` });
  assert.equal((res.json() as { error: { code: string } }).error.code, 'profile_required');
  await app.close();
});
