import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { renderTemplate } from '../src/services/games/templates';
import { gameCsp } from '../src/routes/gameOrigin';
import { BackendProcess, Client, MockLlm, rawGet } from './harness';

/**
 * End to end against the real server process over real HTTP, with a mock model and in-memory fakes:
 * hostile model output, create, play on the isolated game origin, publish, like, daily challenge, reports.
 */
const llm = new MockLlm();
const backend = new BackendProcess();
let owner: Client;

before(async () => {
  await llm.start(renderTemplate('runner', 'Frog Hop'));
  await backend.start(llm.port);
  owner = new Client(backend.base);
  await owner.signUp('owner@example.com', 30, 'Maple Fan');
});

after(async () => {
  await backend.stop();
  await llm.stop();
});

test('a hostile model reply is refused and nothing is stored (sandbox escape attempt)', async () => {
  llm.mode = 'hostile';
  const before = llm.calls;
  const res = await owner.call('POST', '/api/games/generate', { prompt: 'a frog that hops over logs' });
  assert.equal(res.status, 502);
  assert.equal(res.json.error.code, 'generation_failed');
  assert.equal(llm.calls - before, 2, 'regenerated once, then failed');
  assert.deepEqual((await owner.call('GET', '/api/games')).json.games, []);
  const usage = (await owner.call('GET', '/api/usage')).json;
  assert.equal(usage.buildsUsed, 0, 'a failed build is never charged');
});

let gameId = '';
let playUrl = '';
let versionId = '';

test('create: a good reply becomes a draft game that the owner can play on the game origin', async () => {
  llm.mode = 'good';
  const res = await owner.call('POST', '/api/games/generate', { prompt: 'a frog that hops over logs' });
  assert.equal(res.status, 201);
  gameId = res.json.game.id;
  const link = await owner.call('GET', `/api/games/${gameId}/play-url`);
  playUrl = link.json.url;
  versionId = link.json.versionId;
  assert.ok(playUrl.startsWith(`${backend.base}/g/${versionId}?t=`));
});

test('play: the game is served with the strict CSP, no cookies, and only on the game host', async () => {
  const path = playUrl.replace(backend.base, '');
  const game = await rawGet(backend.port, path, `127.0.0.1:${backend.port}`);
  assert.equal(game.status, 200);
  assert.equal(game.headers['content-security-policy'], gameCsp('http://localhost:3000'));
  assert.equal(game.headers['set-cookie'], undefined);
  assert.match(game.body, /parent\.postMessage/);
  assert.doesNotMatch(game.body, /https?:\/\/(?!www\.w3\.org)/, 'the served game has no external URL');

  // The same server answering as any other host (the API, the site) must not serve untrusted code.
  for (const host of [`localhost:${backend.port}`, 'localhost:3000', 'api.worldsmade.example']) {
    assert.equal((await rawGet(backend.port, path, host)).status, 404, host);
  }
  // No token, no game.
  assert.equal((await rawGet(backend.port, `/g/${versionId}`, `127.0.0.1:${backend.port}`)).status, 403);
});

test('publish and like: a published game shows in the gallery and a fan can like it once', async () => {
  const pub = await owner.call('POST', `/api/games/${gameId}/publish`, { title: 'Frog Hop', description: 'Hop over logs.', tags: ['runner'], license: 'cc-by', allowDownload: true });
  assert.equal(pub.status, 200);

  const fan = new Client(backend.base);
  await fan.signUp('fan@example.com', 25, 'Fan One');
  const before = (await fan.call('GET', '/api/gallery?tab=new')).json.games;
  assert.equal(before.length, 1);
  assert.equal(before[0].creator, 'Maple Fan');
  for (let i = 0; i < 2; i++) assert.equal((await fan.call('PUT', `/api/games/${gameId}/like`)).json.likeCount, 1);
  const after = (await fan.call('GET', '/api/gallery?tab=new')).json.games[0];
  assert.deepEqual([after.likeCount, after.liked], [1, true]);

  const dl = await fan.call('GET', `/api/games/${gameId}/download`);
  assert.equal(dl.status, 200, 'download was allowed by the creator');
});

test('daily: the founder seeds the backlog, a guest plays, scores and keeps a streak', async () => {
  const boss = new Client(backend.base);
  await boss.signUp('boss@worldsmade.example', 40, 'Founder');
  const seeded = await boss.call('POST', '/api/admin/challenges/seed-backlog', {});
  assert.equal(seeded.json.backlogOk, true);

  const guest = new Client(backend.base);
  const today = (await guest.call('GET', '/api/daily')).json;
  assert.match(today.playUrl, /\/g\/.+\?t=/);

  const { sessionToken } = (await guest.call('POST', '/api/daily/start', {})).json;
  assert.equal((await guest.call('POST', '/api/daily/score', { sessionToken, value: 1 })).json.error.code, 'too_fast');
  await new Promise((r) => setTimeout(r, 3200));
  const scored = await guest.call('POST', '/api/daily/score', { sessionToken, value: 150 });
  assert.equal(scored.status, 200, JSON.stringify(scored.json));
  assert.deepEqual([scored.json.best, scored.json.rank, scored.json.streak.current], [150, 1, 1]);
  assert.equal((await guest.call('POST', '/api/daily/score', { sessionToken, value: 160 })).json.error.code, 'already_submitted');

  const board = (await guest.call('GET', '/api/daily/leaderboard')).json.entries;
  assert.deepEqual(board, [{ rank: 1, name: 'Guest', score: 150 }]);
});

test('reports: enough reports hide a published game from the gallery', async () => {
  for (let i = 0; i < 6; i++) {
    const reporter = new Client(backend.base);
    await reporter.signUp(`reporter${i}@example.com`, 30, `Reporter ${i}`);
    await reporter.call('POST', `/api/games/${gameId}/report`, { reason: 'This is not appropriate' });
  }
  const gallery = (await new Client(backend.base).call('GET', '/api/gallery?tab=new')).json.games;
  assert.deepEqual(gallery, [], 'six new-account reports weigh three, which hides the game');
  assert.equal((await owner.call('GET', `/api/games/${gameId}`)).json.game.status, 'hidden');
});

test('error envelope and request ids work over the real server', async () => {
  const res = await new Client(backend.base).call('GET', '/api/nope');
  assert.equal(res.status, 404);
  assert.equal(res.json.error.code, 'not_found');
  assert.match(res.headers.get('x-request-id') ?? '', /^[0-9a-f-]{36}$/);
});
