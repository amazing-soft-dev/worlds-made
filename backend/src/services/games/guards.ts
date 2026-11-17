import type { MeteredLlm } from '../../adapters/llm/ledger';
import type { Config } from '../../config';
import { AppError } from '../../errors';

/** At most one build at a time per user (per server instance; the daily limit is what is exact). */
export class BuildGate {
  private readonly running = new Set<string>();

  acquire(userId: string): () => void {
    if (this.running.has(userId)) {
      throw new AppError(429, 'build_in_progress', 'A build is already running. Wait for it to finish.');
    }
    this.running.add(userId);
    return () => this.running.delete(userId);
  }
}

/** The off switch and the monthly spend cap. Either one stops new builds before any money is spent. */
export class SpendGuard {
  constructor(
    private readonly config: Config,
    private readonly llm: MeteredLlm,
  ) {}

  async assertAllowed(now: Date = new Date()): Promise<void> {
    if (this.config.buildsPaused) {
      throw new AppError(503, 'builds_paused', 'Building is paused for a short while. Playing still works.');
    }
    const spent = await this.llm.monthlySpendUsd(now);
    if (spent >= this.config.spendCapUsd) {
      throw new AppError(503, 'spend_cap', 'We have reached this month\'s building budget. Playing still works. Building returns next month.');
    }
  }
}
