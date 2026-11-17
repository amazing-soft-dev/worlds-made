import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MemoryStore } from '../src/adapters/data/memory';
import { allowedByRating, esrbRank, type CatalogFilters } from '../src/adapters/rawg/catalog';
import { FakeCatalog, FIXTURE_GAMES } from '../src/adapters/rawg/fake';
import { RawgCatalog, RawgError } from '../src/adapters/rawg/rawg';
import { RecCache } from '../src/services/recommend/cache';

const base: CatalogFilters = { genres: [], platforms: [], freeOnly: false, minRating: null, keywords: [], esrbMax: 'AO' };

test('ratings order from E to AO, and unknown ratings are only allowed for mature audiences', () => {
  assert.ok(esrbRank('E') < esrbRank('E10+') && esrbRank('T') < esrbRank('M'));
  assert.equal(allowedByRating({ esrb: 'T' }, 'E10+'), false);
  assert.equal(allowedByRating({ esrb: 'E10+' }, 'E10+'), true);
  assert.equal(allowedByRating({ esrb: null }, 'E10+'), false);
  assert.equal(allowedByRating({ esrb: null }, 'M'), true);
});

test('the fixture catalogue applies the same filters as the real one', async () => {
  const c = new FakeCatalog();
  const kids = await c.search({ ...base, esrbMax: 'E10+' }, 50);
  assert.ok(kids.length > 5);
  assert.ok(kids.every((g) => g.esrb === 'E' || g.esrb === 'E10+'), 'no teen, mature or unrated games for kids');
  const free = await c.search({ ...base, freeOnly: true, esrbMax: 'E10+' }, 50);
  assert.ok(free.length > 0 && free.every((g) => g.free));
  const puzzles = await c.search({ ...base, genres: ['puzzle'] }, 50);
  assert.ok(puzzles.every((g) => g.genres.includes('Puzzle')));
  const sorted = await c.search(base, 5);
  assert.deepEqual(sorted.map((g) => g.rating), [...sorted.map((g) => g.rating)].sort((a, b) => b - a));
  assert.equal(FIXTURE_GAMES.length, 20);
});

test('the RAWG adapter builds the request, maps ratings and tags, and filters by age', async () => {
  const urls: string[] = [];
  const f = (async (url: string) => {
    urls.push(url);
    return new Response(
      JSON.stringify({
        results: [
          { id: 1, slug: 'kid-game', name: 'Kid Game', released: '2020-01-01', background_image: null, rating: 4.2, esrb_rating: { slug: 'everyone' }, genres: [{ slug: 'puzzle', name: 'Puzzle' }], platforms: [{ platform: { name: 'PC' } }], tags: [{ slug: 'free-to-play' }] },
          { id: 2, slug: 'teen-game', name: 'Teen Game', released: null, background_image: null, rating: 4.9, esrb_rating: { slug: 'teen' }, genres: [], platforms: [], tags: [] },
          { id: 3, slug: 'unrated', name: 'Unrated', released: null, background_image: null, rating: 4.0, esrb_rating: null },
        ],
      }),
    );
  }) as unknown as typeof fetch;
  const c = new RawgCatalog('KEY', f);
  const out = await c.search({ ...base, genres: ['puzzle'], platforms: ['pc'], freeOnly: true, keywords: ['cozy'], esrbMax: 'E10+' }, 5);
  assert.deepEqual(out.map((g) => g.name), ['Kid Game']);
  assert.equal(out[0]?.esrb, 'E');
  assert.equal(out[0]?.free, true);
  const url = new URL(urls[0] ?? '');
  assert.equal(url.origin + url.pathname, 'https://api.rawg.io/api/games');
  assert.equal(url.searchParams.get('key'), 'KEY');
  assert.equal(url.searchParams.get('genres'), 'puzzle');
  assert.equal(url.searchParams.get('platforms'), '4');
  assert.equal(url.searchParams.get('tags'), 'free-to-play');
  assert.equal(url.searchParams.get('search'), 'cozy');
  assert.equal(c.requests, 1);
});

test('store links come from the stores endpoint, https only', async () => {
  const f = (async (url: string) =>
    new Response(
      JSON.stringify(
        url.includes('/games/1/stores')
          ? { results: [{ store_id: 1, url: 'https://store.steampowered.com/app/1' }, { store_id: 1, url: 'javascript:alert(1)' }] }
          : { results: [{ id: 1, name: 'Steam' }] },
      ),
    )) as unknown as typeof fetch;
  const links = await new RawgCatalog('K', f).storeLinks({ id: 1 } as never);
  assert.deepEqual(links, [{ store: 'Steam', url: 'https://store.steampowered.com/app/1' }]);
});

test('RAWG errors surface with their status so callers can fall back', async () => {
  const f = (async () => new Response('no', { status: 429 })) as unknown as typeof fetch;
  await assert.rejects(new RawgCatalog('K', f).search(base, 3), (e: unknown) => e instanceof RawgError && e.status === 429);
});

test('the cache keys equal filters the same way, expires after 24 hours and serves stale on demand', async () => {
  const cache = new RecCache(new MemoryStore());
  const a = RecCache.keyFor({ ...base, genres: ['Puzzle', 'Action'] });
  assert.equal(a, RecCache.keyFor({ ...base, genres: ['action', 'puzzle'] }));
  assert.notEqual(a, RecCache.keyFor({ ...base, genres: ['puzzle'] }));
  const now = new Date('2026-06-15T00:00:00Z');
  await cache.set(a, base, [FIXTURE_GAMES[0]!], now);
  assert.equal((await cache.get(a, new Date('2026-06-15T23:00:00Z')))?.length, 1);
  assert.equal(await cache.get(a, new Date('2026-06-16T00:00:01Z')), null);
  assert.equal((await cache.getStale(a))?.length, 1);
  assert.equal(await cache.get('missing'), null);
});

test('the monthly request counter persists and stops live calls near the ceiling', async () => {
  const cache = new RecCache(new MemoryStore());
  const now = new Date('2026-06-15T00:00:00Z');
  assert.equal(await cache.underQuota(now), true);
  await cache.countRequests(47_000, now);
  assert.equal(await cache.monthlyRequests(now), 47_000);
  assert.equal(await cache.underQuota(now), true);
  await cache.countRequests(1_000, now);
  assert.equal(await cache.underQuota(now), false);
  assert.equal(await cache.underQuota(new Date('2026-07-01T00:00:00Z')), true, 'a new month starts at zero');
});
