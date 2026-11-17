import { LIMITS, type Plan } from '@worlds-made/shared';
import type { DataStore } from '../../adapters/data/store';
import type { BuildUsageRow, ProfileRow } from '../../db/tables';
import { AppError } from '../../errors';

export interface UsageSnapshot {
  plan: Plan;
  date: string;
  buildsUsed: number;
  buildsLimit: number;
  repairsUsed: number;
  /** When the daily allowance resets (next 00:00 UTC). */
  resetsAt: string;
}

const day = (now: Date) => now.toISOString().slice(0, 10);

/** The daily build allowance, enforced on the server from build_usage. Only successful builds are recorded. */
export class UsageService {
  constructor(private readonly store: DataStore) {}

  limitFor(plan: Plan): number {
    return plan === 'paid' ? LIMITS.paidBuildsPerDay : LIMITS.freeBuildsPerDay;
  }

  private async row(userId: string, date: string): Promise<BuildUsageRow | null> {
    return this.store.get<BuildUsageRow>('build_usage', { user_id: userId, date });
  }

  async snapshot(profile: ProfileRow, now: Date = new Date()): Promise<UsageSnapshot> {
    const date = day(now);
    const row = await this.row(profile.id, date);
    const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    return {
      plan: profile.plan,
      date,
      buildsUsed: row?.builds_used ?? 0,
      buildsLimit: this.limitFor(profile.plan),
      repairsUsed: row?.repairs_used ?? 0,
      resetsAt: tomorrow.toISOString(),
    };
  }

  /** Throws 429 limit_reached when today's allowance is spent. */
  async assertCanBuild(profile: ProfileRow, now: Date = new Date()): Promise<void> {
    const s = await this.snapshot(profile, now);
    if (s.buildsUsed >= s.buildsLimit) {
      throw new AppError(429, 'limit_reached', `You have used all ${s.buildsLimit} builds for today. They reset at 00:00 UTC.`, {
        limit: s.buildsLimit,
        used: s.buildsUsed,
        plan: s.plan,
        resetsAt: s.resetsAt,
      });
    }
  }

  private async bump(userId: string, field: 'builds_used' | 'repairs_used', now: Date): Promise<void> {
    const date = day(now);
    const row = await this.row(userId, date);
    await this.store.upsert<BuildUsageRow>(
      'build_usage',
      { user_id: userId, date, builds_used: (row?.builds_used ?? 0) + (field === 'builds_used' ? 1 : 0), repairs_used: (row?.repairs_used ?? 0) + (field === 'repairs_used' ? 1 : 0) },
      ['user_id', 'date'],
    );
  }

  recordBuild(userId: string, now: Date = new Date()): Promise<void> {
    return this.bump(userId, 'builds_used', now);
  }

  recordRepair(userId: string, now: Date = new Date()): Promise<void> {
    return this.bump(userId, 'repairs_used', now);
  }
}
