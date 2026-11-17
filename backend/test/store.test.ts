import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MemoryBlobStore, MemoryStore } from '../src/adapters/data/memory';
import { SupabaseBlobStore, SupabaseStore, toFilters } from '../src/adapters/data/supabase';
import type { GameRow } from '../src/db/tables';

test('memory store inserts with generated ids and timestamps', async () => {
  const s = new MemoryStore();
  const g = await s.insert<GameRow>('games', { owner_id: 'u1', title: 'A' });
  assert.match(g.id, /^[0-9a-f-]{36}$/);
  assert.ok(g.created_at);
  assert.equal((await s.get<GameRow>('games', { id: g.id }))?.title, 'A');
});

test('memory store filters with operators, orders, pages and counts', async () => {
  const s = new MemoryStore();
  for (const [i, n] of [5, 1, 9, 3].entries()) await s.insert('game_versions', { game_id: 'g', prompt: `p${i}`, html_path: 'x', size_bytes: n, model: 'm' });
  const big = await s.list('game_versions', { where: { size_bytes: { gte: 3, lt: 9 } }, orderBy: 'size_bytes', desc: true });
  assert.deepEqual(big.map((r) => r.size_bytes), [5, 3]);
  assert.equal((await s.list('game_versions', { orderBy: 'size_bytes', limit: 2, offset: 1 })).length, 2);
  assert.equal(await s.count('game_versions', { size_bytes: { in: [1, 9] } }), 2);
});

test('memory store update, delete and upsert', async () => {
  const s = new MemoryStore();
  await s.insert('build_usage', { user_id: 'u', date: '2026-01-01', builds_used: 1, repairs_used: 0 });
  await s.upsert('build_usage', { user_id: 'u', date: '2026-01-01', builds_used: 2 }, ['user_id', 'date']);
  assert.equal(await s.count('build_usage'), 1);
  assert.equal((await s.get('build_usage', { user_id: 'u' }))?.builds_used, 2);
  assert.equal((await s.update('build_usage', { user_id: 'u' }, { repairs_used: 1 })).length, 1);
  assert.equal(await s.delete('build_usage', { user_id: 'u' }), 1);
  assert.equal(await s.count('build_usage'), 0);
});

test('memory store returns copies, so callers cannot mutate stored rows', async () => {
  const s = new MemoryStore();
  const g = await s.insert<GameRow>('games', { owner_id: 'u', tags: ['a'] });
  g.tags.push('b');
  assert.deepEqual((await s.get<GameRow>('games', { id: g.id }))?.tags, ['a']);
});

test('PostgREST filters are built from conditions', () => {
  assert.deepEqual(toFilters({ a: 'x y', b: null, c: { gte: 3, lt: 9 }, d: { in: ['p', 'q'] } }), [
    'a=eq.x%20y',
    'b=is.null',
    'c=gte.3',
    'c=lt.9',
    'd=in.("p","q")',
  ]);
});

test('Supabase store sends the service key and the right URL', async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fakeFetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify([{ id: '1' }]), { status: 200, headers: { 'content-range': '0-0/7' } });
  }) as unknown as typeof fetch;
  const s = new SupabaseStore('https://x.supabase.co', 'KEY', fakeFetch);
  await s.list('games', { where: { owner_id: 'u' }, orderBy: 'created_at', desc: true, limit: 5 });
  assert.equal(calls[0]?.url, 'https://x.supabase.co/rest/v1/games?owner_id=eq.u&order=created_at.desc&limit=5');
  assert.equal((calls[0]?.init.headers as Record<string, string>).apikey, 'KEY');
  assert.equal(await s.count('games'), 7);
});

test('blob stores round-trip and return null for missing paths', async () => {
  const b = new MemoryBlobStore();
  await b.put('a/b.html', '<p>');
  assert.equal(await b.get('a/b.html'), '<p>');
  await b.remove('a/b.html');
  assert.equal(await b.get('a/b.html'), null);

  const seen: string[] = [];
  const f = (async (url: string) => {
    seen.push(url);
    return new Response('nope', { status: 404 });
  }) as unknown as typeof fetch;
  assert.equal(await new SupabaseBlobStore('https://x.supabase.co', 'K', 'games', f).get('a b/c.html'), null);
  assert.equal(seen[0], 'https://x.supabase.co/storage/v1/object/games/a%20b/c.html');
});
