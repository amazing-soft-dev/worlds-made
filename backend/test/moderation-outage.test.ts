import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildApp } from '../src/app';
import { MemoryStore } from '../src/adapters/data/memory';
import { loadConfig } from '../src/config';
import { AppError } from '../src/errors';
import type { Moderator } from '../src/services/moderation/moderator';
import { ModerationService } from '../src/services/moderation/service';
import { communityApp, signUp } from './helpers';

const down: Moderator = {
  check: async () => {
    throw new Error('Moderation request failed: 401');
  },
};

test('when the classifier is down, checks fail closed with a clear 503 instead of letting text through', async () => {
  const svc = new ModerationService(down);
  for (const run of [() => svc.checkPrompt('a frog that hops'), () => svc.checkText('hello there')]) {
    await assert.rejects(run(), (e: unknown) => e instanceof AppError && e.status === 503 && e.code === 'moderation_unavailable');
  }
  // The blocklist needs no network, so a blocked prompt is still a normal block, not an outage.
  const blocked = await svc.checkPrompt('a porn game');
  assert.equal(blocked.allowed, false);
});

test('a moderation outage during a build is a 503 that costs the player nothing', async () => {
  const store = new MemoryStore();
  const app = buildApp({ config: loadConfig({}), services: { store, moderation: new ModerationService(down) } });
  const { headers } = await signUp(app);
  const res = await app.inject({ method: 'POST', url: '/api/games/generate', headers, payload: { prompt: 'a frog that hops over logs' } });
  assert.equal(res.statusCode, 503);
  const err = (res.json() as { error: { code: string; message: string } }).error;
  assert.equal(err.code, 'moderation_unavailable');
  assert.match(err.message, /try again/i);
  assert.equal(await store.count('games'), 0);
  assert.equal(((await app.inject({ method: 'GET', url: '/api/usage', headers })).json() as { buildsUsed: number }).buildsUsed, 0);
  await app.close();
});

test('recommendations also fail closed when moderation is down', async () => {
  const store = new MemoryStore();
  const app = buildApp({ config: loadConfig({}), services: { store, moderation: new ModerationService(down) } });
  const res = await app.inject({ method: 'POST', url: '/api/recommend', payload: { request: 'a cozy puzzle game' } });
  assert.equal(res.statusCode, 503);
  await app.close();
  void communityApp;
});
