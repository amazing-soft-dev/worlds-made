import { createHash } from 'node:crypto';
import { LIMITS } from '@worlds-made/shared';
import type { DataStore } from '../../adapters/data/store';
import type { CatalogFilters, CatalogGame } from '../../adapters/rawg/catalog';
import type { RecCacheRow } from '../../db/tables';

const HOUR = 3600 * 1000;

/** Identical queries are answered from the 24-hour cache, which is what keeps the RAWG request ceiling safe. */
export class RecCache {
  constructor(private readonly store: DataStore) {}

  static keyFor(filters: CatalogFilters): string {
    const sorted = (a: string[]) => [...a].map((s) => s.toLowerCase()).sort();
    const stable = { ...filters, genres: sorted(filters.genres), platforms: sorted(filters.platforms), keywords: sorted(filters.keywords) };
    return createHash('sha256').update(JSON.stringify(stable)).digest('hex');
  }

  async get(key: string, now: Date = new Date()): Promise<CatalogGame[] | null> {
    const row = await this.store.get<RecCacheRow>('rec_cache', { query_hash: key });
    return row && new Date(row.expires_at) > now ? (row.results_json as CatalogGame[]) : null;
  }

  /** Expired results, used only when the live service is unavailable. */
  async getStale(key: string): Promise<CatalogGame[] | null> {
    const row = await this.store.get<RecCacheRow>('rec_cache', { query_hash: key });
    return row ? (row.results_json as CatalogGame[]) : null;
  }

  async set(key: string, filters: CatalogFilters, results: CatalogGame[], now: Date = new Date()): Promise<void> {
    await this.store.upsert<RecCacheRow>(
      'rec_cache',
      { query_hash: key, filters_json: filters, results_json: results, expires_at: new Date(now.getTime() + LIMITS.recCacheHours * HOUR).toISOString() },
      ['query_hash'],
    );
  }

  private usageKey(now: Date) {
    return `usage:${now.toISOString().slice(0, 7)}`;
  }

  /** Requests made to RAWG this month, kept in the cache table so it survives restarts. */
  async monthlyRequests(now: Date = new Date()): Promise<number> {
    const row = await this.store.get<RecCacheRow>('rec_cache', { query_hash: this.usageKey(now) });
    return Number((row?.results_json as { count?: number } | undefined)?.count ?? 0);
  }

  async countRequests(n: number, now: Date = new Date()): Promise<void> {
    const count = (await this.monthlyRequests(now)) + n;
    await this.store.upsert<RecCacheRow>(
      'rec_cache',
      { query_hash: this.usageKey(now), filters_json: {}, results_json: { count }, expires_at: new Date(now.getTime() + 62 * 24 * HOUR).toISOString() },
      ['query_hash'],
    );
  }

  /** Stops live calls at 95% of the monthly ceiling, leaving headroom for the pages that must still work. */
  async underQuota(now: Date = new Date()): Promise<boolean> {
    return (await this.monthlyRequests(now)) < LIMITS.rawgMonthlyRequests * 0.95;
  }
}
