import { LIMITS } from '@worlds-made/shared';
import type { DataStore } from '../../adapters/data/store';
import type { Mailer } from '../../adapters/mail/mailer';
import { oneLine } from '../../adapters/mail/mailer';
import type { GameRow, ProfileRow, ReportRow } from '../../db/tables';
import { AppError, errors } from '../../errors';

const DAY_MS = 24 * 3600 * 1000;
/** Reports from accounts younger than this weigh half, so a fresh account cannot hide a game alone. */
const NEW_ACCOUNT_DAYS = 7;
const REPORTS_PER_DAY = 20;

const startOfDay = (now: Date) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();

export function reportWeight(reporter: Pick<ProfileRow, 'created_at'> | null, now: Date): number {
  if (!reporter) return 0.5;
  return now.getTime() - new Date(reporter.created_at).getTime() < NEW_ACCOUNT_DAYS * DAY_MS ? 0.5 : 1;
}

export class ReportService {
  constructor(
    private readonly store: DataStore,
    private readonly mailer: Mailer,
    private readonly notifyTo: string,
  ) {}

  /** Sum of the weights of open reports for a game. */
  async openWeight(gameId: string, now: Date = new Date()): Promise<number> {
    const reports = await this.store.list<ReportRow>('reports', { where: { game_id: gameId, status: 'open' } });
    let total = 0;
    for (const r of reports) total += reportWeight(await this.store.get<ProfileRow>('profiles', { id: r.reporter_id }), now);
    return total;
  }

  /** Records a report. Three (weighted) reports hide a published game until the founder reviews it. */
  async report(game: GameRow, reporter: ProfileRow, reason: string, now: Date = new Date()): Promise<{ hidden: boolean; alreadyReported: boolean }> {
    if (game.owner_id === reporter.id) throw errors.badRequest('You cannot report your own game');

    const existing = await this.store.get<ReportRow>('reports', { game_id: game.id, reporter_id: reporter.id });
    if (existing) return { hidden: game.status === 'hidden', alreadyReported: true };

    if ((await this.store.count('reports', { reporter_id: reporter.id, created_at: { gte: startOfDay(now) } })) >= REPORTS_PER_DAY) {
      throw new AppError(429, 'report_limit', 'You have sent a lot of reports today. Please try again tomorrow.');
    }

    await this.store.insert<ReportRow>('reports', { game_id: game.id, reporter_id: reporter.id, reason: reason.slice(0, 300), status: 'open' });

    let hidden = game.status === 'hidden';
    if (game.status === 'published' && (await this.openWeight(game.id, now)) >= LIMITS.reportsToHide) {
      await this.store.update<GameRow>('games', { id: game.id }, { status: 'hidden' });
      hidden = true;
    }

    // The founder is told; a mail failure must never fail the report itself.
    try {
      await this.mailer.send({
        to: this.notifyTo,
        subject: `${hidden ? 'HIDDEN: ' : ''}Game reported: ${oneLine(game.title).slice(0, 80)}`,
        text: `Game ${game.id} was reported.\nReason: ${oneLine(reason)}\nStatus: ${hidden ? 'hidden pending review' : 'still visible'}\nReview it in /admin within 48 hours.\n`,
      });
    } catch {
      /* ignored on purpose */
    }
    return { hidden, alreadyReported: false };
  }
}
