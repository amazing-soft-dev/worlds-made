import { randomUUID } from 'node:crypto';
import type { BlobStore, DataStore } from '../../adapters/data/store';
import type { GameRow, GameVersionRow } from '../../db/tables';
import { errors } from '../../errors';
import { safeTitle } from './templates';

export interface NewVersion {
  prompt: string;
  html: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  errorLog?: string | null;
}

/** First few words of the request as a plain title, e.g. "a frog that hops" becomes "A Frog That Hops". */
export function titleFromPrompt(prompt: string): string {
  const words = prompt.replace(/[^A-Za-z0-9 '-]/g, ' ').split(/\s+/).filter(Boolean).slice(0, 5);
  const title = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  return safeTitle(title);
}

/** Games and their versions. HTML lives in the blob store; rows only point at it. */
export class GameService {
  constructor(
    protected readonly store: DataStore,
    protected readonly blobs: BlobStore,
  ) {}

  htmlPath(gameId: string, versionId: string): string {
    return `games/${gameId}/${versionId}.html`;
  }

  async get(id: string): Promise<GameRow | null> {
    return this.store.get<GameRow>('games', { id });
  }

  /** The game if it exists and belongs to the user. Others get 404, so ids cannot be probed. */
  async getOwned(id: string, ownerId: string): Promise<GameRow> {
    const game = await this.get(id);
    if (!game || game.owner_id !== ownerId) throw errors.notFound('Game not found');
    return game;
  }

  async getVersion(id: string): Promise<GameVersionRow | null> {
    return this.store.get<GameVersionRow>('game_versions', { id });
  }

  async html(version: GameVersionRow): Promise<string | null> {
    return this.blobs.get(version.html_path);
  }

  async createWithVersion(ownerId: string, title: string, v: NewVersion): Promise<{ game: GameRow; version: GameVersionRow }> {
    const game = await this.store.insert<GameRow>('games', {
      owner_id: ownerId,
      title,
      description: '',
      tags: [],
      status: 'draft',
      visibility: 'private',
      allow_download: false,
      license: 'all-rights-reserved',
      current_version_id: null,
      like_count: 0,
      staff_pick: false,
      published_at: null,
    });
    const version = await this.addVersion(game.id, v);
    return { game: { ...game, current_version_id: version.id }, version };
  }

  /** Stores the HTML, records the version and makes it current. */
  async addVersion(gameId: string, v: NewVersion): Promise<GameVersionRow> {
    const id = randomUUID();
    const path = this.htmlPath(gameId, id);
    await this.blobs.put(path, v.html);
    const version = await this.store.insert<GameVersionRow>('game_versions', {
      id,
      game_id: gameId,
      prompt: v.prompt,
      html_path: path,
      size_bytes: Buffer.byteLength(v.html, 'utf8'),
      model: v.model,
      tokens_in: v.tokensIn,
      tokens_out: v.tokensOut,
      error_log: v.errorLog ?? null,
    });
    await this.store.update<GameRow>('games', { id: gameId }, { current_version_id: id });
    return version;
  }
}
