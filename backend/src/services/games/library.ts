import { LIMITS } from '@worlds-made/shared';
import type { BlobStore, DataStore } from '../../adapters/data/store';
import type { GameRow, GameVersionRow } from '../../db/tables';
import { errors } from '../../errors';
import { GameService } from './games';

/** Owner-facing operations on saved games: version history, restore and delete. */
export class GameLibrary extends GameService {
  constructor(store: DataStore, blobs: BlobStore) {
    super(store, blobs);
  }

  /** Newest first. */
  async versions(gameId: string): Promise<GameVersionRow[]> {
    return this.store.list<GameVersionRow>('game_versions', { where: { game_id: gameId }, orderBy: 'created_at', desc: true });
  }

  async listOwned(ownerId: string): Promise<GameRow[]> {
    return this.store.list<GameRow>('games', { where: { owner_id: ownerId }, orderBy: 'created_at', desc: true });
  }

  /** Stores the version, then drops everything beyond the last 5. The current version is always kept. */
  override async addVersion(gameId: string, v: Parameters<GameService['addVersion']>[1]): Promise<GameVersionRow> {
    const version = await super.addVersion(gameId, v);
    await this.prune(gameId);
    return version;
  }

  async prune(gameId: string): Promise<number> {
    const game = await this.get(gameId);
    const all = await this.versions(gameId);
    const keep = new Set(all.slice(0, LIMITS.gameVersionsKept).map((x) => x.id));
    if (game?.current_version_id) keep.add(game.current_version_id);
    let removed = 0;
    for (const old of all) {
      if (keep.has(old.id)) continue;
      await this.blobs.remove(old.html_path);
      await this.store.delete('game_versions', { id: old.id });
      removed++;
    }
    return removed;
  }

  /** Makes an older version current again. */
  async restore(gameId: string, versionId: string): Promise<GameRow> {
    const version = await this.getVersion(versionId);
    if (!version || version.game_id !== gameId) throw errors.notFound('Version not found');
    const [game] = await this.store.update<GameRow>('games', { id: gameId }, { current_version_id: versionId });
    if (!game) throw errors.notFound('Game not found');
    return game;
  }

  /** Deletes the game, its versions and their stored HTML. */
  async remove(game: GameRow): Promise<void> {
    for (const v of await this.versions(game.id)) await this.blobs.remove(v.html_path);
    await this.store.delete('game_versions', { game_id: game.id });
    await this.store.delete('likes', { game_id: game.id });
    await this.store.delete('reports', { game_id: game.id });
    await this.store.delete('games', { id: game.id });
  }

  async updateMeta(gameId: string, patch: Partial<Pick<GameRow, 'title' | 'description' | 'tags' | 'allow_download' | 'license'>>): Promise<GameRow> {
    const [game] = await this.store.update<GameRow>('games', { id: gameId }, patch);
    if (!game) throw errors.notFound('Game not found');
    return game;
  }
}
