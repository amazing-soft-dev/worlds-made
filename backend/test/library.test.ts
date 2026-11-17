import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildApp } from '../src/app';
import { MemoryStore } from '../src/adapters/data/memory';
import { loadConfig } from '../src/config';
import { renderTemplate } from '../src/services/games/templates';
import { meter, reply, ScriptedLlm, signUp } from './helpers';

const GOOD = '```html\n' + renderTemplate('runner', 'Frog Hop') + '\n```';

function setup() {
  const store = new MemoryStore();
  const app = buildApp({ config: loadConfig({}), services: { store, llm: meter(new ScriptedLlm([reply(GOOD)]), store) } });
  return { app, store };
}
type App = ReturnType<typeof setup>['app'];

async function makeGame(app: App, headers: Record<string, string>) {
  const res = await app.inject({ method: 'POST', url: '/api/games/generate', headers, payload: { prompt: 'a frog that hops' } });
  return (res.json() as { game: { id: string } }).game.id;
}

test('only the last 5 versions are kept, the current one always, and removed HTML is deleted', async () => {
  const { app, store } = setup();
  const { headers, userId } = await signUp(app);
  const gameId = await makeGame(app, headers);
  const first = (await app.services.games.versions(gameId))[0]!;
  for (let i = 0; i < 6; i++) {
    await app.services.games.addVersion(gameId, { prompt: `change: v${i}`, html: `<html><body>v${i}</body></html>`, model: 'm', tokensIn: 1, tokensOut: 1 });
  }
  const versions = await app.services.games.versions(gameId);
  assert.equal(versions.length, 5);
  assert.equal(await store.count('game_versions', { game_id: gameId }), 5);
  assert.equal(await app.services.blobs.get(first.html_path), null, 'the oldest HTML should be deleted');
  assert.equal((await app.services.games.get(gameId))?.current_version_id, versions[0]?.id);
  assert.equal((await app.services.games.get(gameId))?.owner_id, userId);
  await app.close();
});

test('restoring an older version makes it current; another game’s version is refused', async () => {
  const { app } = setup();
  const { headers } = await signUp(app);
  const a = await makeGame(app, headers);
  const b = await makeGame(app, headers);
  const second = await app.services.games.addVersion(a, { prompt: 'change: x', html: '<html></html>', model: 'm', tokensIn: 1, tokensOut: 1 });
  const original = (await app.services.games.versions(a)).find((v) => v.id !== second.id)!;
  const ok = await app.inject({ method: 'POST', url: `/api/games/${a}/restore`, headers, payload: { versionId: original.id } });
  assert.equal(ok.statusCode, 200);
  assert.equal((ok.json() as { game: { currentVersionId: string } }).game.currentVersionId, original.id);
  const foreign = (await app.services.games.versions(b))[0]!;
  assert.equal((await app.inject({ method: 'POST', url: `/api/games/${a}/restore`, headers, payload: { versionId: foreign.id } })).statusCode, 404);
  await app.close();
});

test('list, read and delete work for the owner and give everyone else a 404', async () => {
  const { app, store } = setup();
  const alice = await signUp(app);
  const bob = await signUp(app);
  const id = await makeGame(app, alice.headers);
  const list = (await app.inject({ method: 'GET', url: '/api/games', headers: alice.headers })).json() as { games: Array<{ id: string }> };
  assert.deepEqual(list.games.map((g) => g.id), [id]);
  assert.deepEqual(((await app.inject({ method: 'GET', url: '/api/games', headers: bob.headers })).json() as { games: unknown[] }).games, []);
  const detail = (await app.inject({ method: 'GET', url: `/api/games/${id}`, headers: alice.headers })).json() as { versions: unknown[] };
  assert.equal(detail.versions.length, 1);
  assert.equal((await app.inject({ method: 'GET', url: `/api/games/${id}`, headers: bob.headers })).statusCode, 404);
  assert.equal((await app.inject({ method: 'DELETE', url: `/api/games/${id}`, headers: bob.headers })).statusCode, 404);
  assert.equal((await app.inject({ method: 'DELETE', url: `/api/games/${id}`, headers: alice.headers })).statusCode, 204);
  assert.equal(await store.count('games'), 0);
  assert.equal(await store.count('game_versions'), 0);
  await app.close();
});

test('title, description and tags are moderated on every edit', async () => {
  const { app } = setup();
  const { headers } = await signUp(app);
  const id = await makeGame(app, headers);
  const bad = await app.inject({ method: 'PATCH', url: `/api/games/${id}`, headers, payload: { title: 'Gory fun' } });
  assert.equal(bad.statusCode, 422);
  assert.equal((bad.json() as { error: { code: string } }).error.code, 'text_blocked');
  const ok = await app.inject({ method: 'PATCH', url: `/api/games/${id}`, headers, payload: { title: 'Frog Hop', description: 'Hop over logs.', tags: ['runner', 'cute'], allowDownload: true, license: 'cc-by' } });
  assert.equal(ok.statusCode, 200);
  const g = (ok.json() as { game: { title: string; allowDownload: boolean; license: string; tags: string[] } }).game;
  assert.deepEqual([g.title, g.allowDownload, g.license, g.tags], ['Frog Hop', true, 'cc-by', ['runner', 'cute']]);
  assert.equal((await app.inject({ method: 'PATCH', url: `/api/games/${id}`, headers, payload: { license: 'made-up' } })).statusCode, 400);
  await app.close();
});
