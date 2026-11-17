import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { GameRow } from '../src/db/tables';
import { weekStart } from '../src/services/community/gallery';
import { communityApp, draft, signUp } from './helpers';

const details = { title: 'Frog Hop', description: 'Hop.', tags: [], license: 'cc-by', allowDownload: false };

async function published(app: ReturnType<typeof communityApp>['app'], title: string) {
  const owner = await signUp(app, { displayName: 'Maple Fan' });
  const id = await draft(app, owner.headers);
  await app.inject({ method: 'POST', url: `/api/games/${id}/publish`, headers: owner.headers, payload: { ...details, title } });
  return { owner, id };
}

type GalleryRes = { games: Array<{ id: string; title: string; likeCount: number; weeklyLikes: number; creator: string; liked: boolean }> };
const gallery = async (app: ReturnType<typeof communityApp>['app'], q: string, headers: Record<string, string> = {}) =>
  (await app.inject({ method: 'GET', url: `/api/gallery?${q}`, headers })).json() as GalleryRes;

test('the week starts on Monday 00:00 UTC', () => {
  assert.equal(weekStart(new Date('2026-06-17T15:30:00Z')), '2026-06-15T00:00:00.000Z'); // Wednesday
  assert.equal(weekStart(new Date('2026-06-15T00:00:00Z')), '2026-06-15T00:00:00.000Z'); // Monday
  assert.equal(weekStart(new Date('2026-06-21T23:59:59Z')), '2026-06-15T00:00:00.000Z'); // Sunday
});

test('New lists published games newest first with the creator display name, and hides drafts', async () => {
  const { app } = communityApp();
  const a = await published(app, 'First Game');
  await new Promise((r) => setTimeout(r, 5));
  const b = await published(app, 'Second Game');
  await draft(app, (await signUp(app)).headers); // a draft must not appear
  const list = await gallery(app, 'tab=new');
  assert.deepEqual(list.games.map((g) => g.id), [b.id, a.id]);
  assert.equal(list.games[0]?.creator, 'Maple Fan');
  assert.equal((await gallery(app, 'tab=new&limit=1&offset=1')).games[0]?.id, a.id);
  assert.equal((await app.inject({ method: 'GET', url: '/api/gallery?tab=nope' })).statusCode, 400);
  await app.close();
});

test('a like counts once per user, can be undone, and the owner cannot like their own game', async () => {
  const { app } = communityApp();
  const g = await published(app, 'Likable');
  const fan = await signUp(app);
  for (let i = 0; i < 3; i++) {
    const res = await app.inject({ method: 'PUT', url: `/api/games/${g.id}/like`, headers: fan.headers });
    assert.equal((res.json() as { likeCount: number }).likeCount, 1);
  }
  assert.equal((await gallery(app, 'tab=new', fan.headers)).games[0]?.liked, true);
  assert.equal((await gallery(app, 'tab=new')).games[0]?.liked, false);
  assert.equal((await app.inject({ method: 'PUT', url: `/api/games/${g.id}/like`, headers: g.owner.headers })).statusCode, 400);
  const un = await app.inject({ method: 'DELETE', url: `/api/games/${g.id}/like`, headers: fan.headers });
  assert.equal((un.json() as { likeCount: number }).likeCount, 0);
  assert.equal((await app.inject({ method: 'PUT', url: `/api/games/${g.id}/like` })).statusCode, 401);
  await app.close();
});

test('unpublished games cannot be liked or viewed', async () => {
  const { app } = communityApp();
  const owner = await signUp(app);
  const id = await draft(app, owner.headers);
  const fan = await signUp(app);
  assert.equal((await app.inject({ method: 'PUT', url: `/api/games/${id}/like`, headers: fan.headers })).statusCode, 404);
  assert.equal((await app.inject({ method: 'GET', url: `/api/gallery/${id}` })).statusCode, 404);
  await app.close();
});

test('Most liked this week only counts likes since Monday 00:00 UTC', async () => {
  const { app, store } = communityApp();
  const old = await published(app, 'Old Favourite');
  const fresh = await published(app, 'This Week');
  const fans = [await signUp(app), await signUp(app), await signUp(app)];
  for (const f of fans) await app.inject({ method: 'PUT', url: `/api/games/${old.id}/like`, headers: f.headers });
  // Push those three likes back into last week; one like for the other game stays this week.
  await store.update('likes', { game_id: old.id }, { created_at: new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString() });
  await app.inject({ method: 'PUT', url: `/api/games/${fresh.id}/like`, headers: fans[0]!.headers });
  const top = await gallery(app, 'tab=top-week');
  assert.deepEqual(top.games.map((g) => [g.title, g.weeklyLikes]), [['This Week', 1], ['Old Favourite', 0]]);
  assert.equal(top.games[1]?.likeCount, 3, 'all-time likes are still shown');
  await app.close();
});

test('Staff picks lists only picked games', async () => {
  const { app, store } = communityApp();
  const a = await published(app, 'Picked');
  await published(app, 'Not Picked');
  await store.update<GameRow>('games', { id: a.id }, { staff_pick: true });
  assert.deepEqual((await gallery(app, 'tab=staff-picks')).games.map((g) => g.title), ['Picked']);
  await app.close();
});
