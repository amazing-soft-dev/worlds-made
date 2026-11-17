import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderTemplate } from '../src/services/games/templates';
import { communityApp, draft, signUp } from './helpers';

const details = { title: 'Frog Hop', description: 'Hop over the logs.', tags: ['runner'], license: 'cc-by', allowDownload: true };

test('publishing makes a game public with its title, tags and licence', async () => {
  const { app, store } = communityApp();
  const { headers } = await signUp(app);
  const id = await draft(app, headers);
  const res = await app.inject({ method: 'POST', url: `/api/games/${id}/publish`, headers, payload: details });
  assert.equal(res.statusCode, 200);
  const g = (res.json() as { game: { status: string; visibility: string; license: string; tags: string[] } }).game;
  assert.deepEqual([g.status, g.visibility, g.license, g.tags], ['published', 'public', 'cc-by', ['runner']]);
  assert.ok((await store.get('games', { id }))?.published_at);
  await app.close();
});

test('blocked text is refused with the reason and the game stays a draft', async () => {
  const { app, store } = communityApp();
  const { headers } = await signUp(app);
  const id = await draft(app, headers);
  const res = await app.inject({ method: 'POST', url: `/api/games/${id}/publish`, headers, payload: { ...details, title: 'Porn Hop' } });
  assert.equal(res.statusCode, 422);
  assert.equal((res.json() as { error: { code: string } }).error.code, 'text_blocked');
  assert.equal((await store.get('games', { id }))?.status, 'draft');
  await app.close();
});

test('code that no longer passes the scan or moderation cannot be published', async () => {
  const { app } = communityApp();
  const { headers } = await signUp(app);
  const id = await draft(app, headers);
  const game = (await app.services.games.get(id))!;
  const version = (await app.services.games.getVersion(game.current_version_id!))!;
  await app.services.blobs.put(version.html_path, '<html><body><script>fetch("/x")</script></body></html>');
  const scanFail = await app.inject({ method: 'POST', url: `/api/games/${id}/publish`, headers, payload: details });
  assert.equal(scanFail.statusCode, 422);
  assert.equal((scanFail.json() as { error: { code: string } }).error.code, 'code_blocked');

  await app.services.blobs.put(version.html_path, renderTemplate('runner', 'x').replace('Game over', 'Game over [[flag]]'));
  assert.equal((await app.inject({ method: 'POST', url: `/api/games/${id}/publish`, headers, payload: details })).statusCode, 422);
  await app.close();
});

test('five publishes a day per account, then 429', async () => {
  const { app } = communityApp();
  const { headers } = await signUp(app);
  const ids: string[] = [];
  for (let i = 0; i < 3; i++) ids.push(await draft(app, headers)); // free plan: 3 builds a day
  await app.services.store.update('profiles', {}, { plan: 'paid' });
  for (let i = 0; i < 3; i++) ids.push(await draft(app, headers));
  for (const id of ids.slice(0, 5)) assert.equal((await app.inject({ method: 'POST', url: `/api/games/${id}/publish`, headers, payload: details })).statusCode, 200);
  const sixth = await app.inject({ method: 'POST', url: `/api/games/${ids[5]}/publish`, headers, payload: details });
  assert.equal(sixth.statusCode, 429);
  assert.equal((sixth.json() as { error: { code: string } }).error.code, 'publish_limit');
  // Re-saving an already published game is not a new publish.
  assert.equal((await app.inject({ method: 'POST', url: `/api/games/${ids[0]}/publish`, headers, payload: { ...details, title: 'Frog Hop 2' } })).statusCode, 200);
  await app.close();
});

test('only the owner can publish, hidden games stay hidden, and unpublish returns to draft', async () => {
  const { app, store } = communityApp();
  const alice = await signUp(app);
  const bob = await signUp(app);
  const id = await draft(app, alice.headers);
  assert.equal((await app.inject({ method: 'POST', url: `/api/games/${id}/publish`, headers: bob.headers, payload: details })).statusCode, 404);
  await app.inject({ method: 'POST', url: `/api/games/${id}/publish`, headers: alice.headers, payload: details });
  const un = await app.inject({ method: 'POST', url: `/api/games/${id}/unpublish`, headers: alice.headers });
  assert.equal((un.json() as { game: { status: string } }).game.status, 'draft');
  await store.update('games', { id }, { status: 'hidden' });
  const res = await app.inject({ method: 'POST', url: `/api/games/${id}/publish`, headers: alice.headers, payload: details });
  assert.equal((res.json() as { error: { code: string } }).error.code, 'under_review');
  await app.close();
});
