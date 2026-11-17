import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildApp } from '../src/app';
import { MemoryStore } from '../src/adapters/data/memory';
import { loadConfig } from '../src/config';
import { signPlayToken, verifyPlayToken } from '../src/lib/play-token';
import { gameCsp } from '../src/routes/gameOrigin';
import { renderTemplate } from '../src/services/games/templates';
import { meter, reply, ScriptedLlm, signUp } from './helpers';

const GOOD = '```html\n' + renderTemplate('runner', 'Frog Hop') + '\n```';
const env = { GAME_ORIGIN: 'https://games.example', SITE_URL: 'https://worldsmade.example', COOKIE_SECRET: 'cookie-secret-cookie-secret' };

function setup() {
  const store = new MemoryStore();
  const app = buildApp({ config: loadConfig(env), services: { store, llm: meter(new ScriptedLlm([reply(GOOD)]), store) } });
  return { app, store };
}

async function gameWithUrl(app: ReturnType<typeof setup>['app']) {
  const { headers } = await signUp(app);
  const { game } = (await app.inject({ method: 'POST', url: '/api/games/generate', headers, payload: { prompt: 'a frog that hops' } })).json() as { game: { id: string } };
  const { url, versionId } = (await app.inject({ method: 'GET', url: `/api/games/${game.id}/play-url`, headers })).json() as { url: string; versionId: string };
  return { headers, gameId: game.id, url, versionId, path: url.replace('https://games.example', '') };
}

test('play tokens are bound to one version and expire', () => {
  const t = signPlayToken('v1', 'secret', 60, 0);
  assert.equal(verifyPlayToken(t, 'v1', 'secret', 1000), true);
  assert.equal(verifyPlayToken(t, 'v2', 'secret', 1000), false);
  assert.equal(verifyPlayToken(t, 'v1', 'other', 1000), false);
  assert.equal(verifyPlayToken(t, 'v1', 'secret', 61_000), false);
  assert.equal(verifyPlayToken(undefined, 'v1', 'secret'), false);
  assert.equal(verifyPlayToken('garbage', 'v1', 'secret'), false);
});

test('the CSP blocks all network access and only the main site may frame the game', () => {
  assert.equal(
    gameCsp('https://worldsmade.example'),
    "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data:; connect-src 'none'; form-action 'none'; frame-ancestors https://worldsmade.example; base-uri 'none'",
  );
});

test('a game is served only on the game domain, with the CSP, hardening headers and no cookies', async () => {
  const { app } = setup();
  const g = await gameWithUrl(app);
  const res = await app.inject({ method: 'GET', url: g.path, headers: { host: 'games.example' } });
  assert.equal(res.statusCode, 200);
  assert.match(res.headers['content-type'] as string, /^text\/html; charset=utf-8/);
  assert.equal(res.headers['content-security-policy'], gameCsp('https://worldsmade.example'));
  assert.equal(res.headers['x-content-type-options'], 'nosniff');
  assert.equal(res.headers['referrer-policy'], 'no-referrer');
  assert.equal(res.headers['set-cookie'], undefined);
  assert.match(res.body, /parent\.postMessage/);

  // On the main site's host or the API host the same path does not exist.
  for (const host of ['worldsmade.example', 'api.worldsmade.example', 'localhost:4000']) {
    assert.equal((await app.inject({ method: 'GET', url: g.path, headers: { host } })).statusCode, 404, host);
  }
  await app.close();
});

test('a missing, wrong or expired token is refused', async () => {
  const { app } = setup();
  const g = await gameWithUrl(app);
  const base = `/g/${g.versionId}`;
  const h = { host: 'games.example' };
  assert.equal((await app.inject({ method: 'GET', url: base, headers: h })).statusCode, 403);
  assert.equal((await app.inject({ method: 'GET', url: `${base}?t=1.abc`, headers: h })).statusCode, 403);
  const expired = signPlayToken(g.versionId, env.COOKIE_SECRET, 60, Date.now() - 3600_000);
  assert.equal((await app.inject({ method: 'GET', url: `${base}?t=${expired}`, headers: h })).statusCode, 403);
  await app.close();
});

test('stored HTML that no longer passes the scanner is not served', async () => {
  const { app } = setup();
  const g = await gameWithUrl(app);
  const version = (await app.services.games.getVersion(g.versionId))!;
  await app.services.blobs.put(version.html_path, '<html><body><script>fetch("/x")</script></body></html>');
  const res = await app.inject({ method: 'GET', url: g.path, headers: { host: 'games.example' } });
  assert.equal(res.statusCode, 410);
  assert.doesNotMatch(res.body, /fetch/);
  await app.close();
});

test('drafts get a play link only for their owner', async () => {
  const { app } = setup();
  const g = await gameWithUrl(app);
  const other = await signUp(app);
  assert.equal((await app.inject({ method: 'GET', url: `/api/games/${g.gameId}/play-url`, headers: other.headers })).statusCode, 404);
  assert.equal((await app.inject({ method: 'GET', url: `/api/games/${g.gameId}/play-url` })).statusCode, 404);
  await app.close();
});
