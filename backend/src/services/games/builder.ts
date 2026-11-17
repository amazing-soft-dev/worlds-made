import { LIMITS } from '@worlds-made/shared';
import type { MeteredLlm } from '../../adapters/llm/ledger';
import { LlmProviderError, LlmTimeoutError } from '../../adapters/llm/provider';
import type { GameRow, GameVersionRow } from '../../db/tables';
import { AppError } from '../../errors';
import type { ModerationService } from '../moderation/service';
import type { Swap } from '../moderation/franchise';
import { extractVisibleText, scanGameHtml } from '../scanner';
import type { GameService } from './games';
import { titleFromPrompt } from './games';
import { buildUserPrompt, extractHtml, GAME_SYSTEM_PROMPT, type BuildKind } from './prompts';
import { pickGenre, type Genre } from './templates';

export interface BuildInput {
  /** The player. Null only for platform games (the daily challenge). */
  userId: string | null;
  kind: BuildKind;
  /** The player's words: the request for generate, the instruction for change, ignored for repair. */
  prompt: string;
  genre?: Genre;
  /** Required for repair and change. The game must belong to the user. */
  gameId?: string;
  errors?: string[];
}

export interface BuildResult {
  game: GameRow;
  version: GameVersionRow;
  swaps: Swap[];
  warnings: string[];
  costUsd: number;
}

const MAX_OUTPUT_TOKENS = 30_000;
const MAX_ATTEMPTS = 2;

export class GameBuilder {
  constructor(
    private readonly llm: MeteredLlm,
    private readonly moderation: ModerationService,
    private readonly games: GameService,
  ) {}

  /**
   * Moderate the prompt, ask the model, extract and scan the HTML, moderate its visible text, then store it.
   * A bad result is regenerated once; a provider timeout is retried once with a smaller template. Nothing is stored
   * unless every check passes, and the caller only charges the user after this returns.
   */
  async build(input: BuildInput): Promise<BuildResult> {
    let request = input.prompt;
    let swaps: Swap[] = [];
    if (input.kind !== 'repair') {
      const verdict = await this.moderation.checkPrompt(request);
      if (!verdict.allowed) throw new AppError(422, 'prompt_blocked', verdict.message);
      request = verdict.text;
      swaps = verdict.swaps;
    }

    let existing: GameRow | null = null;
    let currentHtml: string | undefined;
    if (input.kind === 'repair' || input.kind === 'change') {
      existing = await this.games.getOwned(input.gameId ?? '', input.userId ?? '');
      const current = existing.current_version_id ? await this.games.getVersion(existing.current_version_id) : null;
      currentHtml = current ? ((await this.games.html(current)) ?? undefined) : undefined;
      if (!currentHtml) throw new AppError(409, 'no_current_version', 'This game has no saved version to change');
    }

    const genre = input.genre ?? pickGenre(request);
    let lastProblem = 'unknown';
    let timedOut = false;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      let reply;
      try {
        reply = await this.llm.complete(
          {
            purpose: input.kind,
            system: GAME_SYSTEM_PROMPT,
            user: buildUserPrompt({ kind: input.kind, genre, request, currentHtml, errors: input.errors, compact: attempt > 0 }),
            maxOutputTokens: MAX_OUTPUT_TOKENS,
            timeoutMs: LIMITS.buildTimeoutMs,
          },
          input.userId,
        );
      } catch (err) {
        timedOut = err instanceof LlmTimeoutError;
        lastProblem = timedOut ? 'timeout' : 'provider error';
        if (!(err instanceof LlmTimeoutError) && !(err instanceof LlmProviderError)) throw err;
        continue;
      }
      timedOut = false;

      const html = extractHtml(reply.text);
      if (!html) {
        lastProblem = 'the reply was not an HTML file';
        continue;
      }
      const scan = scanGameHtml(html);
      if (!scan.ok) {
        lastProblem = `scanner: ${scan.problems.join(', ')}`;
        continue;
      }
      const text = await this.moderation.checkText(extractVisibleText(html).join('\n'));
      if (!text.allowed) {
        lastProblem = 'the game text was not allowed';
        continue;
      }

      const version = {
        prompt: input.kind === 'generate' ? input.prompt : `${input.kind}: ${input.prompt || (input.errors ?? []).join('; ')}`.slice(0, 1200),
        html,
        model: reply.model,
        tokensIn: reply.tokensIn,
        tokensOut: reply.tokensOut,
        errorLog: input.errors?.length ? input.errors.join('\n').slice(0, 2000) : null,
      };
      if (existing) {
        const saved = await this.games.addVersion(existing.id, version);
        return { game: { ...existing, current_version_id: saved.id }, version: saved, swaps, warnings: scan.warnings, costUsd: reply.costUsd };
      }
      const created = await this.games.createWithVersion(input.userId, titleFromPrompt(request), version);
      return { ...created, swaps, warnings: scan.warnings, costUsd: reply.costUsd };
    }

    if (timedOut) throw new AppError(504, 'provider_timeout', 'The game maker took too long. No build was used. Please try again.');
    throw new AppError(502, 'generation_failed', `We could not make a safe, working game from that (${lastProblem}). No build was used. Try rewording it.`);
  }
}
