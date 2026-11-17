import { LIMITS } from '@worlds-made/shared';
import type { DataStore } from '../../adapters/data/store';
import type { GameRow } from '../../db/tables';
import { AppError, errors } from '../../errors';
import type { GameLibrary } from '../games/library';
import type { ModerationService } from '../moderation/service';
import { extractVisibleText, scanGameHtml } from '../scanner';

export interface PublishInput {
  title: string;
  description: string;
  tags: string[];
  license: string;
  allowDownload: boolean;
}

const startOfDay = (now: Date) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();

/** Publishing: limits first, then text and code moderation, then the game goes public. */
export class PublishService {
  constructor(
    private readonly store: DataStore,
    private readonly games: GameLibrary,
    private readonly moderation: ModerationService,
  ) {}

  async publish(game: GameRow, input: PublishInput, now: Date = new Date()): Promise<GameRow> {
    if (game.status === 'removed') throw errors.notFound('Game not found');
    if (game.status === 'hidden') throw new AppError(409, 'under_review', 'This game is hidden while it is reviewed.');
    if (!game.current_version_id) throw errors.badRequest('This game has nothing to publish yet');

    // Exact, from the database: 5 publishes a day per account.
    const today = await this.store.count('games', { owner_id: game.owner_id ?? '', published_at: { gte: startOfDay(now) } });
    if (game.status !== 'published' && today >= LIMITS.publishPerDay) {
      throw new AppError(429, 'publish_limit', `You can publish ${LIMITS.publishPerDay} games a day. Try again tomorrow.`);
    }

    // Text: title, description and tags.
    const textVerdict = await this.moderation.checkText([input.title, input.description, ...input.tags].join('\n'));
    if (!textVerdict.allowed) throw new AppError(422, 'text_blocked', textVerdict.message);

    // Code: the scan again, then the game's own visible text.
    const version = await this.games.getVersion(game.current_version_id);
    const html = version ? await this.games.html(version) : null;
    if (html === null) throw errors.notFound('Game not found');
    const scan = scanGameHtml(html);
    if (!scan.ok) throw new AppError(422, 'code_blocked', 'This game did not pass our safety check and cannot be published.', { problems: scan.problems });
    const codeVerdict = await this.moderation.checkText(extractVisibleText(html).join('\n'));
    if (!codeVerdict.allowed) throw new AppError(422, 'code_blocked', 'Text inside this game is not allowed on the site.');

    const [published] = await this.store.update<GameRow>(
      'games',
      { id: game.id },
      {
        title: input.title,
        description: input.description,
        tags: input.tags,
        license: input.license,
        allow_download: input.allowDownload,
        status: 'published',
        visibility: 'public',
        published_at: game.published_at ?? now.toISOString(),
      },
    );
    if (!published) throw errors.notFound('Game not found');
    return published;
  }

  async unpublish(game: GameRow): Promise<GameRow> {
    const [row] = await this.store.update<GameRow>('games', { id: game.id }, { status: 'draft', visibility: 'private' });
    if (!row) throw errors.notFound('Game not found');
    return row;
  }
}
