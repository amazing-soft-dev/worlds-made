import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { MemoryMailer } from '../src/adapters/mail/mailer';
import type { GameRow } from '../src/db/tables';
import { reportWeight } from '../src/services/community/reports';
import { communityApp, draft, signUp } from './helpers';

const details = { title: 'Frog Hop', description: 'Hop.', tags: [], license: 'cc-by', allowDownload: false };

async function setup() {
  const ctx = communityApp();
  const owner = await signUp(ctx.app);
  const id = await draft(ctx.app, owner.headers);
  await ctx.app.inject({ method: 'POST', url: `/api/games/${id}/publish`, headers: owner.headers, payload: details });
  return { ...ctx, owner, id };
}

/** A reporter whose account is old enough to count in full. */
async function veteran(ctx: Awaited<ReturnType<typeof setup>>) {
  const u = await signUp(ctx.app);
  await ctx.store.update('profiles', { id: u.userId }, { created_at: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString() });
  return u;
}

const report = (app: Awaited<ReturnType<typeof setup>>['app'], id: string, headers: Record<string, string>) =>
  app.inject({ method: 'POST', url: `/api/games/${id}/report`, headers, payload: { reason: 'This is not appropriate' } });

test('reports from new accounts weigh half', () => {
  const now = new Date('2026-06-15T00:00:00Z');
  assert.equal(reportWeight({ created_at: '2026-06-14T00:00:00Z' }, now), 0.5);
  assert.equal(reportWeight({ created_at: '2026-05-01T00:00:00Z' }, now), 1);
  assert.equal(reportWeight(null, now), 0.5);
});

test('three reports from established accounts hide the game', async () => {
  const ctx = await setup();
  for (let i = 0; i < 2; i++) assert.equal((await report(ctx.app, ctx.id, (await veteran(ctx)).headers)).statusCode, 201);
  assert.equal((await ctx.store.get<GameRow>('games', { id: ctx.id }))?.status, 'published');
  const third = await report(ctx.app, ctx.id, (await veteran(ctx)).headers);
  assert.equal(third.statusCode, 201);
  assert.equal((await ctx.store.get<GameRow>('games', { id: ctx.id }))?.status, 'hidden');
  // A hidden game leaves the gallery.
  assert.deepEqual(((await ctx.app.inject({ method: 'GET', url: '/api/gallery' })).json() as { games: unknown[] }).games, []);
  await ctx.app.close();
});

test('new accounts need six reports to do the same', async () => {
  const ctx = await setup();
  for (let i = 0; i < 5; i++) await report(ctx.app, ctx.id, (await signUp(ctx.app)).headers);
  assert.equal((await ctx.store.get<GameRow>('games', { id: ctx.id }))?.status, 'published');
  await report(ctx.app, ctx.id, (await signUp(ctx.app)).headers);
  assert.equal((await ctx.store.get<GameRow>('games', { id: ctx.id }))?.status, 'hidden');
  await ctx.app.close();
});

test('reporting twice does not count twice, and owners cannot report themselves', async () => {
  const ctx = await setup();
  const v = await veteran(ctx);
  assert.equal((await report(ctx.app, ctx.id, v.headers)).statusCode, 201);
  assert.equal((await report(ctx.app, ctx.id, v.headers)).statusCode, 200);
  assert.equal(await ctx.store.count('reports', { game_id: ctx.id }), 1);
  assert.equal((await report(ctx.app, ctx.id, ctx.owner.headers)).statusCode, 400);
  await ctx.app.close();
});

test('drafts cannot be reported, reports need a sign-in, and the founder is emailed', async () => {
  const ctx = await setup();
  const other = await signUp(ctx.app);
  const draftId = await draft(ctx.app, other.headers);
  assert.equal((await report(ctx.app, draftId, (await veteran(ctx)).headers)).statusCode, 404);
  assert.equal((await ctx.app.inject({ method: 'POST', url: `/api/games/${ctx.id}/report`, payload: { reason: 'bad one' } })).statusCode, 401);
  await report(ctx.app, ctx.id, (await veteran(ctx)).headers);
  const mailer = ctx.app.services.mailer as MemoryMailer;
  assert.match(mailer.sent[0]?.subject ?? '', /Game reported: Frog Hop/);
  assert.match(mailer.sent[0]?.text ?? '', /within 48 hours/);
  await ctx.app.close();
});
