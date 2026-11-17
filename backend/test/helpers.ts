import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import { MemoryStore } from '../src/adapters/data/memory';
import { loadConfig } from '../src/config';
import { renderTemplate } from '../src/services/games/templates';
import { MeteredLlm } from '../src/adapters/llm/ledger';
import type { LlmProvider, LlmRequest, LlmResponse } from '../src/adapters/llm/provider';
import type { DataStore } from '../src/adapters/data/store';

/** Signs a test user up through the real age gate and profile routes. Returns headers for authenticated calls. */
export async function signUp(
  app: FastifyInstance,
  opts: { email?: string; yearsOld?: number; country?: string; verified?: boolean; displayName?: string } = {},
): Promise<{ headers: Record<string, string>; userId: string }> {
  const birthYear = new Date().getUTCFullYear() - (opts.yearsOld ?? 30) - 1;
  const age = await app.inject({ method: 'POST', url: '/api/age', payload: { birthYear, country: opts.country ?? 'US' } });
  const cookie = String(age.headers['set-cookie']).split(';')[0] as string;
  const login = await app.inject({ method: 'POST', url: '/api/auth/dev-token', payload: { email: opts.email ?? `u${Math.random().toString(36).slice(2)}@example.com`, verified: opts.verified ?? true } });
  const { token, userId } = login.json() as { token: string; userId: string };
  const headers = { authorization: `Bearer ${token}`, cookie };
  const res = await app.inject({ method: 'POST', url: '/api/me/profile', headers, payload: { displayName: opts.displayName ?? 'Tester One' } });
  if (res.statusCode !== 201 && res.statusCode !== 403) throw new Error(`profile failed: ${res.statusCode} ${res.body}`);
  return { headers, userId };
}

export type Step = LlmResponse | Error;

/** A provider that plays back a fixed script of replies and errors, and counts calls. */
export class ScriptedLlm implements LlmProvider {
  readonly name = 'scripted';
  calls: LlmRequest[] = [];
  constructor(private readonly steps: Step[]) {}
  async complete(req: LlmRequest): Promise<LlmResponse> {
    this.calls.push(req);
    const step = this.steps[Math.min(this.calls.length - 1, this.steps.length - 1)];
    if (!step) throw new Error('no scripted step');
    if (step instanceof Error) throw step;
    return step;
  }
}

export const reply = (text: string): LlmResponse => ({ text, model: 'scripted-model', tokensIn: 100, tokensOut: 200 });
export const meter = (provider: LlmProvider, store: DataStore) => new MeteredLlm(provider, store, { inPerM: 1, outPerM: 2 });

const GOOD = '```html\n' + renderTemplate('runner', 'Frog Hop') + '\n```';

/** An app with in-memory data and a model that always returns a good game, for community feature tests. */
export function communityApp() {
  const store = new MemoryStore();
  const app = buildApp({ config: loadConfig({}), services: { store, llm: meter(new ScriptedLlm([reply(GOOD)]), store) } });
  return { app, store };
}

/** Generates a draft game for the user and returns its id. */
export async function draft(app: FastifyInstance, headers: Record<string, string>): Promise<string> {
  const res = await app.inject({ method: 'POST', url: '/api/games/generate', headers, payload: { prompt: 'a frog that hops' } });
  return (res.json() as { game: { id: string } }).game.id;
}
