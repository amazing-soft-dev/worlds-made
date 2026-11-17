import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildApp } from '../src/app';
import { MemoryStore } from '../src/adapters/data/memory';
import type { LlmProvider, LlmResponse } from '../src/adapters/llm/provider';
import { loadConfig } from '../src/config';
import { RateLimiter } from '../src/lib/rate-limit';
import { renderTemplate } from '../src/services/games/templates';
import { meter, reply, ScriptedLlm, signUp } from './helpers';

const GOOD = '```html\n' + renderTemplate('runner', 'Frog Hop') + '\n```';

test('the rate limiter allows up to the limit, then says how long to wait, then slides', () => {
  const l = new RateLimiter();
  assert.equal(l.hit('k', 3, 1000, 0).allowed, true);
  assert.equal(l.hit('k', 3, 1000, 100).allowed, true);
  assert.equal(l.hit('k', 3, 1000, 200).allowed, true);
  const blocked = l.hit('k', 3, 1000, 300);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterSec, 1);
  assert.equal(l.hit('other', 3, 1000, 300).allowed, true);
  assert.equal(l.hit('k', 3, 1000, 1001).allowed, true); // the first hit has left the window
  l.sweep(1000, 5000);
});

function appWith(env: Record<string, string>, provider: LlmProvider = new ScriptedLlm([reply(GOOD)])) {
  const store = new MemoryStore();
  const app = buildApp({ config: loadConfig(env), services: { store, llm: meter(provider, store) } });
  return { app, store };
}

const generate = (app: ReturnType<typeof buildApp>, headers: Record<string, string>) =>
  app.inject({ method: 'POST', url: '/api/games/generate', headers, payload: { prompt: 'a frog that hops over logs' } });

test('the off switch pauses building but the rest of the site keeps working', async () => {
  const { app } = appWith({ BUILDS_PAUSED: 'true' });
  const { headers } = await signUp(app);
  const res = await generate(app, headers);
  assert.equal(res.statusCode, 503);
  assert.equal((res.json() as { error: { code: string } }).error.code, 'builds_paused');
  assert.equal((await app.inject({ method: 'GET', url: '/api/health' })).statusCode, 200);
  await app.close();
});

test('the monthly spend cap stops builds once the logged cost reaches it', async () => {
  const { app, store } = appWith({ MONTHLY_SPEND_CAP_USD: '0.01' });
  const { headers } = await signUp(app);
  assert.equal((await generate(app, headers)).statusCode, 201); // nothing spent yet
  await store.insert('llm_calls', { purpose: 'generate', model: 'm', tokens_in: 1, tokens_out: 1, cost_usd: 0.02, ok: true });
  const res = await generate(app, headers);
  assert.equal(res.statusCode, 503);
  assert.equal((res.json() as { error: { code: string } }).error.code, 'spend_cap');
  await app.close();
});

class GatedLlm implements LlmProvider {
  readonly name = 'gated';
  release!: () => void;
  private started!: () => void;
  readonly hasStarted = new Promise<void>((r) => (this.started = r));
  private readonly gate = new Promise<void>((r) => (this.release = r));
  async complete(): Promise<LlmResponse> {
    this.started();
    await this.gate;
    return reply(GOOD);
  }
}

test('only one build runs at a time per user, and the slot is freed afterwards', async () => {
  const gated = new GatedLlm();
  const { app } = appWith({}, gated);
  const { headers } = await signUp(app);
  const first = generate(app, headers);
  await gated.hasStarted;
  const second = await generate(app, headers);
  assert.equal(second.statusCode, 429);
  assert.equal((second.json() as { error: { code: string } }).error.code, 'build_in_progress');
  gated.release();
  assert.equal((await first).statusCode, 201);
  assert.equal((await generate(app, headers)).statusCode, 201);
  await app.close();
});

test('a failed build also frees the slot', async () => {
  const { app } = appWith({}, new ScriptedLlm([new Error('network down')]));
  const { headers } = await signUp(app);
  assert.equal((await generate(app, headers)).statusCode, 500);
  assert.equal((await generate(app, headers)).statusCode, 500); // not 429 build_in_progress
  await app.close();
});

test('one client cannot flood the API: 429 with Retry-After', async () => {
  const { app } = appWith({});
  let limited = 0;
  let retryAfter = '';
  for (let i = 0; i < 650; i++) {
    const r = await app.inject({ method: 'GET', url: '/api/health' });
    if (r.statusCode === 429) {
      limited++;
      retryAfter = String(r.headers['retry-after']);
    }
  }
  assert.ok(limited > 0, 'expected some requests to be limited');
  assert.match(retryAfter, /^\d+$/);
  await app.close();
});
