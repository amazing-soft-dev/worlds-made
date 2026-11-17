import { LIMITS } from '@worlds-made/shared';
import type { DataStore } from '../../adapters/data/store';
import type { DailyChallengeRow } from '../../db/tables';
import { AppError, errors } from '../../errors';
import type { GameBuilder } from '../games/builder';
import type { GameLibrary } from '../games/library';
import { GENRES, renderTemplate } from '../games/templates';
import { genreFor, SCORE_RANGES, themeFor, THEMES } from './themes';

export const dayKey = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 24 * 3600 * 1000);

/** The next 00:00 UTC. The challenge rolls over then, and the page counts down to it. */
export function nextRollover(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}

export class DailyService {
  constructor(
    private readonly store: DataStore,
    private readonly games: GameLibrary,
    private readonly builder: GameBuilder,
  ) {}

  /**
   * Cron: creates tomorrow's challenge as pending, from the theme list. The founder approves it in /admin (about
   * five minutes a day). Does nothing if tomorrow already has one.
   */
  async generateTomorrow(now: Date = new Date()): Promise<{ created: boolean; date: string; theme: string }> {
    const date = dayKey(addDays(now, 1));
    const theme = themeFor(date);
    if (await this.store.get<DailyChallengeRow>('daily_challenges', { date })) return { created: false, date, theme };

    const genre = genreFor(date);
    const built = await this.builder.build({ userId: null, kind: 'daily', prompt: theme, genre });
    const range = SCORE_RANGES[genre];
    await this.store.insert<DailyChallengeRow>('daily_challenges', {
      date,
      game_version_id: built.version.id,
      theme,
      status: 'pending',
      approved_by: null,
      score_min: range.min,
      score_max: range.max,
    });
    return { created: true, date, theme };
  }

  /** Pending (needs review), scheduled (approved with a date) and the approved backlog. */
  async overview(now: Date = new Date()) {
    const all = await this.store.list<DailyChallengeRow>('daily_challenges', { orderBy: 'created_at' });
    const today = dayKey(now);
    const backlog = all.filter((c) => !c.date && c.status === 'approved');
    return {
      pending: all.filter((c) => c.status === 'pending'),
      scheduled: all.filter((c) => c.date && c.date >= today && c.status !== 'pending'),
      backlog,
      backlogCount: backlog.length,
      backlogOk: backlog.length >= LIMITS.dailyBacklogMin,
    };
  }

  async approve(id: string, founderId: string): Promise<DailyChallengeRow> {
    const [row] = await this.store.update<DailyChallengeRow>('daily_challenges', { id }, { status: 'approved', approved_by: founderId });
    if (!row) throw errors.notFound('Challenge not found');
    return row;
  }

  /** Rejecting a pending challenge removes it; tomorrow's will be regenerated or the backlog used. */
  async reject(id: string): Promise<void> {
    const removed = await this.store.delete('daily_challenges', { id, status: 'pending' });
    if (!removed) throw errors.notFound('Pending challenge not found');
  }

  /**
   * Today's challenge. If nothing was approved for today, the next approved backlog entry takes today's date, and
   * stays today's for everyone. A pending entry that missed the deadline goes back to the review pool.
   */
  async resolveToday(now: Date = new Date()): Promise<DailyChallengeRow> {
    const date = dayKey(now);
    const existing = await this.store.get<DailyChallengeRow>('daily_challenges', { date });
    if (existing && existing.status !== 'pending') return existing;
    if (existing) await this.store.update('daily_challenges', { id: existing.id }, { date: null });

    const [next] = await this.store.list<DailyChallengeRow>('daily_challenges', { where: { date: null, status: 'approved' }, orderBy: 'created_at', limit: 1 });
    if (!next) throw new AppError(503, 'no_challenge', 'Today\'s challenge is not ready yet. Please check back soon.');
    await this.store.update('daily_challenges', { id: next.id }, { date, status: 'used' });
    // Two requests may race here; whoever wrote the date first wins, and both read it back.
    const settled = await this.store.get<DailyChallengeRow>('daily_challenges', { date });
    if (!settled) throw new AppError(503, 'no_challenge', 'Today\'s challenge is not ready yet. Please check back soon.');
    return settled;
  }

  /** Approved, undated challenges made from the starter templates, so launch has a backlog of at least 14. */
  async seedBacklog(count: number = LIMITS.dailyBacklogMin): Promise<number> {
    const have = (await this.overview()).backlogCount;
    let made = 0;
    for (let i = have; i < count; i++) {
      const genre = GENRES[i % GENRES.length] as (typeof GENRES)[number];
      const theme = THEMES[(i * 7) % THEMES.length] as string;
      const html = renderTemplate(genre, theme, (i * 37) % 360);
      const { version } = await this.games.createWithVersion(null, theme, { prompt: `backlog: ${theme}`, html, model: 'template', tokensIn: 0, tokensOut: 0 });
      const range = SCORE_RANGES[genre];
      await this.store.insert<DailyChallengeRow>('daily_challenges', {
        date: null,
        game_version_id: version.id,
        theme,
        status: 'approved',
        approved_by: null,
        score_min: range.min,
        score_max: range.max,
      });
      made++;
    }
    return made;
  }
}
