import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HttpLlmProvider } from '../src/adapters/llm/http';
import { MeteredLlm } from '../src/adapters/llm/ledger';
import { LlmProviderError, LlmTimeoutError, type LlmProvider, type LlmRequest } from '../src/adapters/llm/provider';
import { MemoryStore } from '../src/adapters/data/memory';
import { buildCostUsd, callCostUsd, monthStart } from '../src/lib/cost';

const req: LlmRequest = { purpose: 'generate', system: 's', user: 'u', maxOutputTokens: 100, timeoutMs: 50 };

test('the cost formula matches the spec', () => {
  // 2,000 in at $3/M and 8,000 out at $15/M = 0.006 + 0.12
  assert.ok(Math.abs(callCostUsd(2000, 8000, 3, 15) - 0.126) < 1e-9);
  assert.ok(Math.abs(buildCostUsd(2000, 8000, 3, 15, 0.25) - 0.1575) < 1e-9);
  assert.equal(callCostUsd(0, 0, 3, 15), 0);
  assert.equal(monthStart(new Date('2026-06-15T12:00:00Z')), '2026-06-01T00:00:00.000Z');
});

const okProvider: LlmProvider = {
  name: 'stub',
  complete: async () => ({ text: 'hi', model: 'm1', tokensIn: 1000, tokensOut: 2000 }),
};

test('every call is logged with model, tokens and cost, and spend adds up', async () => {
  const store = new MemoryStore();
  const lines: object[] = [];
  const llm = new MeteredLlm(okProvider, store, { inPerM: 1, outPerM: 2 }, { info: (o) => lines.push(o) });
  const r = await llm.complete(req, 'user-1');
  assert.ok(Math.abs(r.costUsd - 0.005) < 1e-9);
  await llm.complete({ ...req, purpose: 'repair' });
  const rows = await store.list('llm_calls');
  assert.equal(rows.length, 2);
  assert.equal(rows[0]?.model, 'm1');
  assert.equal(lines.length, 2);
  assert.ok(Math.abs((await llm.monthlySpendUsd()) - 0.01) < 1e-9);
  const avg = await llm.averageCostByPurpose();
  assert.equal(avg.generate?.calls, 1);
});

test('failed calls are logged as not ok and cost nothing', async () => {
  const store = new MemoryStore();
  const failing: LlmProvider = { name: 'down', complete: async () => { throw new LlmProviderError('boom', 500); } };
  const llm = new MeteredLlm(failing, store, { inPerM: 1, outPerM: 2 });
  await assert.rejects(llm.complete(req), LlmProviderError);
  const rows = await store.list('llm_calls');
  assert.equal(rows[0]?.ok, false);
  assert.equal(await llm.monthlySpendUsd(), 0);
});

test('the HTTP provider sends the key and reads text and usage', async () => {
  const sent: Array<{ url: string; auth: string; body: { model: string; max_tokens: number } }> = [];
  const f = (async (url: string, init: RequestInit) => {
    sent.push({ url, auth: (init.headers as Record<string, string>).authorization as string, body: JSON.parse(init.body as string) });
    return new Response(JSON.stringify({ model: 'm-real', choices: [{ message: { content: 'game' } }], usage: { prompt_tokens: 10, completion_tokens: 20 } }));
  }) as unknown as typeof fetch;
  const r = await new HttpLlmProvider({ url: 'https://llm.example/v1/chat/completions', key: 'K', model: 'm' }, f).complete(req);
  assert.deepEqual(r, { text: 'game', model: 'm-real', tokensIn: 10, tokensOut: 20 });
  assert.equal(sent[0]?.auth, 'Bearer K');
  assert.equal(sent[0]?.body.max_tokens, 100);
});

test('the HTTP provider times out and reports provider errors', async () => {
  const hang = ((_url: string, init: RequestInit) =>
    new Promise((_, reject) => init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))))) as unknown as typeof fetch;
  await assert.rejects(new HttpLlmProvider({ url: 'https://x', key: 'K', model: 'm' }, hang).complete(req), LlmTimeoutError);
  const bad = (async () => new Response('no', { status: 429 })) as unknown as typeof fetch;
  await assert.rejects(new HttpLlmProvider({ url: 'https://x', key: 'K', model: 'm' }, bad).complete(req), (e: unknown) => e instanceof LlmProviderError && e.status === 429);
  const empty = (async () => new Response(JSON.stringify({ choices: [] }))) as unknown as typeof fetch;
  await assert.rejects(new HttpLlmProvider({ url: 'https://x', key: 'K', model: 'm' }, empty).complete(req), LlmProviderError);
});
