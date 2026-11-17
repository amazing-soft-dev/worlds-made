import type { DataStore } from '../data/store';
import { callCostUsd, monthStart } from '../../lib/cost';
import type { LlmProvider, LlmPurpose, LlmRequest, LlmResponse } from './provider';

export interface LlmCallRow {
  id: string;
  purpose: LlmPurpose;
  model: string;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  user_id: string | null;
  ok: boolean;
  created_at: string;
}

/** Wraps a provider so every call, successful or not, is logged with model, tokens and cost. */
export class MeteredLlm {
  constructor(
    private readonly inner: LlmProvider,
    private readonly store: DataStore,
    private readonly prices: { inPerM: number; outPerM: number },
    private readonly log: { info: (o: object, m: string) => void } = { info: () => {} },
  ) {}

  async complete(req: LlmRequest, userId: string | null = null): Promise<LlmResponse & { costUsd: number }> {
    try {
      const res = await this.inner.complete(req);
      const costUsd = callCostUsd(res.tokensIn, res.tokensOut, this.prices.inPerM, this.prices.outPerM);
      await this.store.insert<LlmCallRow>('llm_calls', {
        purpose: req.purpose,
        model: res.model,
        tokens_in: res.tokensIn,
        tokens_out: res.tokensOut,
        cost_usd: costUsd,
        user_id: userId,
        ok: true,
      });
      this.log.info({ purpose: req.purpose, model: res.model, tokensIn: res.tokensIn, tokensOut: res.tokensOut, costUsd }, 'llm call');
      return { ...res, costUsd };
    } catch (err) {
      await this.store.insert<LlmCallRow>('llm_calls', { purpose: req.purpose, model: this.inner.name, cost_usd: 0, user_id: userId, ok: false });
      throw err;
    }
  }

  /** Spend since the first of the month (UTC), from the persisted log. */
  async monthlySpendUsd(now: Date = new Date()): Promise<number> {
    const rows = await this.store.list<LlmCallRow>('llm_calls', { where: { created_at: { gte: monthStart(now) } } });
    return rows.reduce((sum, r) => sum + Number(r.cost_usd), 0);
  }

  /** Average cost of one successful call per purpose, for the cost-per-build dashboard. */
  async averageCostByPurpose(now: Date = new Date()): Promise<Record<string, { calls: number; avgUsd: number }>> {
    const rows = (await this.store.list<LlmCallRow>('llm_calls', { where: { created_at: { gte: monthStart(now) } } })).filter((r) => r.ok);
    const out: Record<string, { calls: number; total: number }> = {};
    for (const r of rows) {
      const o = (out[r.purpose] ??= { calls: 0, total: 0 });
      o.calls++;
      o.total += Number(r.cost_usd);
    }
    return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, { calls: v.calls, avgUsd: v.total / v.calls }]));
  }
}
