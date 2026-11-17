import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildApp } from '../src/app';
import { MemoryStore } from '../src/adapters/data/memory';
import { MeteredLlm } from '../src/adapters/llm/ledger';
import type { LlmProvider, LlmPurpose, LlmRequest, LlmResponse } from '../src/adapters/llm/provider';
import { FakeCatalog } from '../src/adapters/rawg/fake';
import { loadConfig } from '../src/config';
import { addAffiliate, ratingLimitFor } from '../src/services/recommend/recommend';
import { RecCache } from '../src/services/recommend/cache';
import { signUp } from './helpers';

/** Answers by purpose, so a request's parse step and explain step each get their own reply every time. */
class PurposeLlm implements LlmProvider {
  readonly name = 'purpose';
  calls: LlmRequest[] = [];
  constructor(private readonly answers: Partial<Record<LlmPurpose, string>>) {}
  async complete(req: LlmRequest): Promise<LlmResponse> {
    this.calls.push(req);
    return { text: this.answers[req.purpose] ?? '', model: 'purpose-model', tokensIn: 10, tokensOut: 10 };
  }
}

const parse = (o: object) => JSON.stringify(o);
const lines = (l: string[]) => l.join('\n');
const FREE_PUZZLES = parse({ genres: ['puzzle'], platforms: [], priceMax: 0, ratingCeiling: null, keywords: [] });

function setup(answers: Partial<Record<LlmPurpose, string>>, env: Record<string, string> = {}) {
  const store = new MemoryStore();
  const catalog = new FakeCatalog();
  const provider = new PurposeLlm(answers);
  const app = buildApp({ config: loadConfig(env), services: { store, catalog, llm: new MeteredLlm(provider, store, { inPerM: 0, outPerM: 0 }) } });
  return { app, store, catalog, provider };
}
type Ctx = ReturnType<typeof setup>;
type Res = { source: string; picks: Array<{ name: string; price: string; rawgUrl: string; esrb: string | null; why: string; stores: Array<{ url: string; affiliate: boolean }> }>; buildYourOwn: { prefill: string } | null; attribution: { name: string; url: string }; affiliateDisclosure: boolean; ratingLimit: string; notice: string | null };
const ask = async (c: Ctx, request: string, headers: Record<string, string> = {}) => c.app.inject({ method: 'POST', url: '/api/recommend', headers, payload: { request } });

test('rating limits by age: under 13 and unknown are E and E10+ only', () => {
  assert.equal(ratingLimitFor(null), 'E10+');
  assert.equal(ratingLimitFor('under13'), 'E10+');
  assert.equal(ratingLimitFor('13to17'), 'T');
  assert.equal(ratingLimitFor('adult'), 'M');
});

test('affiliate tags are added only for configured store domains and are flagged', () => {
  const tags = { 'store.steampowered.com': 'utm_source=worldsmade&utm_medium=rec' };
  assert.deepEqual(addAffiliate('https://store.steampowered.com/app/1?x=1', tags), { url: 'https://store.steampowered.com/app/1?x=1&utm_source=worldsmade&utm_medium=rec', affiliate: true });
  assert.deepEqual(addAffiliate('https://store.example.com/app/1', tags), { url: 'https://store.example.com/app/1', affiliate: false });
  assert.deepEqual(addAffiliate('not a url', tags), { url: 'not a url', affiliate: false });
});

test('a request is parsed, searched and explained; every result is labelled, linked and credited', async () => {
  const c = setup({ parse: FREE_PUZZLES, explain: lines(['Pixel Orchard: a calm free puzzle for a quiet evening.', 'Tiny Tide Pool: relaxing free puzzles on your phone.']) });
  const res = (await ask(c, 'something free and puzzly')).json() as Res;
  assert.equal(res.source, 'live');
  assert.ok(res.picks.length >= 2);
  assert.ok(res.picks.every((p) => p.price === 'free'), 'free only');
  assert.ok(res.picks.every((p) => /^https:\/\/rawg\.io\/games\/[\w-]+$/.test(p.rawgUrl)));
  assert.match(res.picks.find((p) => p.name === 'Pixel Orchard')?.why ?? '', /calm free puzzle/);
  assert.deepEqual(res.attribution, { name: 'RAWG', url: 'https://rawg.io' });
  assert.equal(res.affiliateDisclosure, true);
  assert.ok(res.picks[0]?.stores.length, 'a store link is shown');
  assert.deepEqual(c.provider.calls.map((x) => x.purpose), ['parse', 'explain']);
  await c.app.close();
});

test('unknown ages and kids never see T or M rated games, even if the model asks for them', async () => {
  const c = setup({ parse: parse({ genres: ['shooter'], platforms: [], priceMax: null, ratingCeiling: 'M', keywords: [] }) });
  const res = (await ask(c, 'a gritty shooter')).json() as Res;
  assert.equal(res.ratingLimit, 'E10+');
  assert.ok(res.picks.every((p) => p.esrb === 'E' || p.esrb === 'E10+'));
  assert.equal(res.buildYourOwn?.prefill, 'a gritty shooter', 'nothing fits, so the build-your-own card appears');
  await c.app.close();
});

test('an adult can see mature games, a teen is capped at T', async () => {
  const mature = parse({ genres: ['shooter', 'rpg'], platforms: [], priceMax: null, ratingCeiling: null, keywords: [] });
  const adultCtx = setup({ parse: mature });
  const adult = await signUp(adultCtx.app, { yearsOld: 40 });
  const a = (await ask(adultCtx, 'dark shooters and rpgs', adult.headers)).json() as Res;
  assert.equal(a.ratingLimit, 'M');
  assert.ok(a.picks.some((p) => p.esrb === 'M'));
  const teenCtx = setup({ parse: mature });
  const teen = await signUp(teenCtx.app, { yearsOld: 16 });
  const t = (await ask(teenCtx, 'dark shooters and rpgs', teen.headers)).json() as Res;
  assert.equal(t.ratingLimit, 'T');
  assert.ok(t.picks.every((p) => p.esrb !== 'M' && p.esrb !== null));
  await adultCtx.app.close();
  await teenCtx.app.close();
});

test('lines naming a game the catalogue did not return are dropped', async () => {
  const c = setup({ parse: FREE_PUZZLES, explain: lines(['Pixel Orchard: calm and free.', 'Made Up Game: this was invented by the model.', 'Not a line at all']) });
  const res = (await ask(c, 'free puzzle')).json() as Res;
  assert.equal(res.picks.find((p) => p.name === 'Pixel Orchard')?.why, 'calm and free.');
  assert.ok(!res.picks.some((p) => p.name === 'Made Up Game'));
  assert.ok(!res.picks.some((p) => p.why.includes('invented')));
  await c.app.close();
});

test('identical requests are answered from the cache without another catalogue search', async () => {
  const c = setup({ parse: FREE_PUZZLES });
  assert.equal(((await ask(c, 'free puzzle')).json() as Res).source, 'live');
  assert.equal(((await ask(c, 'free puzzle')).json() as Res).source, 'cache');
  assert.equal(c.catalog.searches, 1);
  await c.app.close();
});

test('when the catalogue is down, stale cache is served, then staff picks', async () => {
  const c = setup({ parse: FREE_PUZZLES });
  await ask(c, 'free puzzle'); // fills the cache
  const key = RecCache.keyFor({ genres: ['puzzle'], platforms: [], freeOnly: true, minRating: null, keywords: [], esrbMax: 'E10+' });
  await c.store.update('rec_cache', { query_hash: key }, { expires_at: '2020-01-01T00:00:00Z' });
  c.catalog.failing = true;
  const stale = (await ask(c, 'free puzzle')).json() as Res;
  assert.equal(stale.source, 'cache');
  assert.match(stale.notice ?? '', /a little old/);

  const none = setup({ parse: parse({ genres: ['racing'], platforms: [], priceMax: null, ratingCeiling: null, keywords: [] }) });
  none.catalog.failing = true;
  const fallback = (await ask(none, 'racing games')).json() as Res;
  assert.equal(fallback.source, 'fallback');
  assert.ok(fallback.picks.length >= 3);
  assert.ok(fallback.picks.every((p) => p.esrb === 'E10+'));
  assert.ok(fallback.picks.every((p) => p.rawgUrl.startsWith('https://rawg.io/games/')));
  await c.app.close();
  await none.app.close();
});

test('at the monthly request ceiling the live catalogue is skipped', async () => {
  const c = setup({ parse: FREE_PUZZLES });
  await new RecCache(c.store).countRequests(48_000);
  const res = (await ask(c, 'free puzzle')).json() as Res;
  assert.equal(res.source, 'fallback');
  assert.equal(c.catalog.searches, 0);
  await c.app.close();
});

test('a model that returns junk falls back to keyword search', async () => {
  const c = setup({ parse: 'I am not JSON, sorry' });
  const res = await ask(c, 'lantern adventures');
  assert.equal(res.statusCode, 200);
  assert.ok(((res.json() as Res).picks.map((p) => p.name)).includes('Lantern Runner'));
  await c.app.close();
});

test('blocked requests are refused with a friendly message before the model is called', async () => {
  const c = setup({ parse: FREE_PUZZLES });
  const res = await ask(c, 'nude games');
  assert.equal(res.statusCode, 422);
  assert.equal(c.provider.calls.length, 0);
  await c.app.close();
});

test('logged-out visitors get 20 requests an hour per IP; signed-in players are not held to that', async () => {
  const c = setup({ parse: FREE_PUZZLES });
  for (let i = 0; i < 20; i++) assert.equal((await ask(c, `free puzzle ${i}`)).statusCode, 200);
  const limited = await ask(c, 'one more');
  assert.equal(limited.statusCode, 429);
  assert.ok(Number(limited.headers['retry-after']) > 0);
  const user = await signUp(c.app);
  assert.equal((await ask(c, 'one more', user.headers)).statusCode, 200);
  await c.app.close();
});

test('configured affiliate tags show up on store links', async () => {
  const c = setup({ parse: FREE_PUZZLES }, { AFFILIATE_TAGS: JSON.stringify({ 'store.example.com': 'ref=worldsmade' }) });
  const res = (await ask(c, 'free puzzle')).json() as Res;
  const link = res.picks[0]?.stores[0];
  assert.match(link?.url ?? '', /ref=worldsmade/);
  assert.equal(link?.affiliate, true);
  await c.app.close();
});
