import type { DataStore } from '../../adapters/data/store';
import type { DailyChallengeRow } from '../../db/tables';
import type { GameBuilder } from '../games/builder';
import { genreFor, SCORE_RANGES, themeFor } from './themes';

export const dayKey = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 24 * 3600 * 1000);

/** The next 00:00 UTC. The challenge rolls over then, and the page counts down to it. */
export function nextRollover(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}

export class DailyService {
  constructor(
    protected readonly store: DataStore,
    protected readonly builder: GameBuilder,
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
}
