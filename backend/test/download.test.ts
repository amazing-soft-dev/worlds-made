import assert from 'node:assert/strict';
import { crc32 } from 'node:zlib';
import { test } from 'node:test';
import { buildApp } from '../src/app';
import { MemoryStore } from '../src/adapters/data/memory';
import { loadConfig } from '../src/config';
import { createZip } from '../src/lib/zip';
import { fileSlug, headerComment } from '../src/services/games/download';
import { renderTemplate } from '../src/services/games/templates';
import { scanGameHtml } from '../src/services/scanner';
import { meter, reply, ScriptedLlm, signUp } from './helpers';

const GOOD = '```html\n' + renderTemplate('runner', 'Frog Hop') + '\n```';

/** Reads a ZIP's central directory: name, CRC check and content for each stored file. */
function readZip(buf: Buffer): Record<string, string> {
  const end = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = buf.readUInt16LE(end + 10);
  let p = buf.readUInt32LE(end + 16);
  const files: Record<string, string> = {};
  for (let i = 0; i < count; i++) {
    assert.equal(buf.readUInt32LE(p), 0x02014b50);
    const crc = buf.readUInt32LE(p + 16);
    const size = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString('utf8');
    const dataStart = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const data = buf.subarray(dataStart, dataStart + size);
    assert.equal(crc32(data), crc, `CRC of ${name}`);
    files[name] = data.toString('utf8');
    p += 46 + nameLen;
  }
  return files;
}

test('the zip writer produces a readable archive with correct checksums', () => {
  const files = readZip(createZip([{ name: 'a.txt', data: 'hello' }, { name: 'dir/b.html', data: '<p>ü</p>' }]));
  assert.deepEqual(files, { 'a.txt': 'hello', 'dir/b.html': '<p>ü</p>' });
});

function setup() {
  const store = new MemoryStore();
  const app = buildApp({ config: loadConfig({ SITE_URL: 'https://worldsmade.example' }), services: { store, llm: meter(new ScriptedLlm([reply(GOOD)]), store) } });
  return { app, store };
}

async function made(app: ReturnType<typeof setup>['app']) {
  const owner = await signUp(app, { displayName: 'Maple Fan' });
  const { game } = (await app.inject({ method: 'POST', url: '/api/games/generate', headers: owner.headers, payload: { prompt: 'a frog that hops' } })).json() as { game: { id: string } };
  await app.inject({ method: 'PATCH', url: `/api/games/${game.id}`, headers: owner.headers, payload: { title: 'Frog Hop', license: 'cc-by' } });
  return { owner, id: game.id };
}

test('the owner downloads a single .html file that carries the site, creator and licence and still scans clean', async () => {
  const { app } = setup();
  const { owner, id } = await made(app);
  const res = await app.inject({ method: 'GET', url: `/api/games/${id}/download`, headers: owner.headers });
  assert.equal(res.statusCode, 200);
  assert.match(res.headers['content-disposition'] as string, /attachment; filename="frog-hop\.html"/);
  assert.match(res.body, /^<!doctype html>\n<!--/i);
  assert.match(res.body, /Made on Worlds Made \(worldsmade\.example\) by Maple Fan/);
  assert.match(res.body, /Licence: Creative Commons Attribution 4\.0/);
  assert.match(res.body, /Open it only in a web browser/);
  assert.equal(scanGameHtml(res.body).ok, true);
  await app.close();
});

test('the zip has index.html and a README with the licence and itch.io steps', async () => {
  const { app } = setup();
  const { owner, id } = await made(app);
  const res = await app.inject({ method: 'GET', url: `/api/games/${id}/download?format=zip`, headers: owner.headers });
  assert.equal(res.headers['content-type'], 'application/zip');
  const files = readZip(res.rawPayload);
  assert.deepEqual(Object.keys(files).sort(), ['README.txt', 'index.html']);
  assert.match(files['README.txt'] ?? '', /LICENSE: Creative Commons Attribution 4\.0/);
  assert.match(files['README.txt'] ?? '', /UPLOAD TO ITCH\.IO/);
  assert.match(files['index.html'] ?? '', /parent\.postMessage/);
  await app.close();
});

test('others cannot download a draft; a published game needs the creator to allow it', async () => {
  const { app, store } = setup();
  const { owner, id } = await made(app);
  const other = await signUp(app);
  assert.equal((await app.inject({ method: 'GET', url: `/api/games/${id}/download`, headers: other.headers })).statusCode, 404);

  await store.update('games', { id }, { status: 'published', visibility: 'public' });
  const closed = await app.inject({ method: 'GET', url: `/api/games/${id}/download`, headers: other.headers });
  assert.equal(closed.statusCode, 403);
  assert.equal((await app.inject({ method: 'GET', url: `/api/games/${id}/download` })).statusCode, 403);

  await app.inject({ method: 'PATCH', url: `/api/games/${id}`, headers: owner.headers, payload: { allowDownload: true } });
  assert.equal((await app.inject({ method: 'GET', url: `/api/games/${id}/download`, headers: other.headers })).statusCode, 200);
  assert.equal((await app.inject({ method: 'GET', url: `/api/games/${id}/download` })).statusCode, 200);
  await app.close();
});

test('a file that no longer passes the scanner is not downloadable', async () => {
  const { app } = setup();
  const { owner, id } = await made(app);
  const game = (await app.services.games.get(id))!;
  const version = (await app.services.games.getVersion(game.current_version_id!))!;
  await app.services.blobs.put(version.html_path, '<html><body><script>eval("1")</script></body></html>');
  assert.equal((await app.inject({ method: 'GET', url: `/api/games/${id}/download`, headers: owner.headers })).statusCode, 410);
  await app.close();
});

test('header text cannot break out of the comment and file names are safe', () => {
  const comment = headerComment({
    game: { title: 'x --> <script>alert(1)</script>', license: 'cc0' } as never,
    html: '',
    creator: 'Bob --> <b>',
    siteUrl: 'https://s.example/path',
  });
  assert.equal(comment.match(/-->/g)?.length, 1, 'only the closing marker may appear');
  assert.ok(!comment.includes('<script>'));
  assert.equal(fileSlug('Frog Hop! ../../etc'), 'frog-hop-etc');
});
