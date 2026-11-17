import type { GalleryTab } from '@worlds-made/shared';
import type { DataStore } from '../../adapters/data/store';
import type { GameRow, LikeRow, ProfileRow } from '../../db/tables';
import { errors } from '../../errors';

/** Monday 00:00 UTC of the week containing `now`. The weekly top list resets here. */
export function weekStart(now: Date): string {
  const sinceMonday = (now.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - sinceMonday)).toISOString();
}

export interface GalleryItem {
  id: string;
  title: string;
  description: string;
  tags: string[];
  license: string;
  allowDownload: boolean;
  likeCount: number;
  weeklyLikes: number;
  staffPick: boolean;
  publishedAt: string | null;
  /** Display name only. Accounts under 18 always show a generated nickname. */
  creator: string;
  liked: boolean;
}

export class GalleryService {
  constructor(private readonly store: DataStore) {}

  private published(extra: Record<string, boolean> = {}) {
    return { status: 'published' as const, visibility: 'public' as const, ...extra };
  }

  private async toItems(games: GameRow[], viewerId: string | null, now: Date): Promise<GalleryItem[]> {
    if (games.length === 0) return [];
    const ids = games.map((g) => g.id);
    const owners = [...new Set(games.map((g) => g.owner_id).filter((x): x is string => Boolean(x)))];
    const profiles = owners.length ? await this.store.list<ProfileRow>('profiles', { where: { id: { in: owners } } }) : [];
    const names = new Map(profiles.map((p) => [p.id, p.display_name]));
    const week = await this.store.list<LikeRow>('likes', { where: { game_id: { in: ids }, created_at: { gte: weekStart(now) } } });
    const weekly = new Map<string, number>();
    for (const l of week) weekly.set(l.game_id, (weekly.get(l.game_id) ?? 0) + 1);
    const mine = viewerId ? new Set((await this.store.list<LikeRow>('likes', { where: { user_id: viewerId, game_id: { in: ids } } })).map((l) => l.game_id)) : new Set<string>();
    return games.map((g) => ({
      id: g.id,
      title: g.title,
      description: g.description,
      tags: g.tags,
      license: g.license,
      allowDownload: g.allow_download,
      likeCount: g.like_count,
      weeklyLikes: weekly.get(g.id) ?? 0,
      staffPick: g.staff_pick,
      publishedAt: g.published_at,
      creator: (g.owner_id && names.get(g.owner_id)) || 'Worlds Made',
      liked: mine.has(g.id),
    }));
  }

  /** New, Most liked this week (resets Monday 00:00 UTC), or Staff picks. */
  async list(tab: GalleryTab, page: { limit: number; offset: number }, viewerId: string | null, now: Date = new Date()): Promise<GalleryItem[]> {
    if (tab === 'top-week') {
      const all = await this.store.list<GameRow>('games', { where: this.published(), orderBy: 'published_at', desc: true });
      const items = await this.toItems(all, viewerId, now);
      items.sort((a, b) => b.weeklyLikes - a.weeklyLikes || b.likeCount - a.likeCount || String(b.publishedAt).localeCompare(String(a.publishedAt)));
      return items.slice(page.offset, page.offset + page.limit);
    }
    const games = await this.store.list<GameRow>('games', {
      where: tab === 'staff-picks' ? this.published({ staff_pick: true }) : this.published(),
      orderBy: 'published_at',
      desc: true,
      limit: page.limit,
      offset: page.offset,
    });
    return this.toItems(games, viewerId, now);
  }

  async detail(id: string, viewerId: string | null, now: Date = new Date()): Promise<GalleryItem> {
    const game = await this.store.get<GameRow>('games', { id, ...this.published() });
    if (!game) throw errors.notFound('Game not found');
    return (await this.toItems([game], viewerId, now))[0] as GalleryItem;
  }

  private async publicGame(id: string): Promise<GameRow> {
    const game = await this.store.get<GameRow>('games', { id, ...this.published() });
    if (!game) throw errors.notFound('Game not found');
    return game;
  }

  private async recount(gameId: string): Promise<number> {
    const n = await this.store.count('likes', { game_id: gameId });
    await this.store.update<GameRow>('games', { id: gameId }, { like_count: n });
    return n;
  }

  /** One like per user per game; liking again changes nothing. Creators cannot like their own games. */
  async like(gameId: string, userId: string): Promise<number> {
    const game = await this.publicGame(gameId);
    if (game.owner_id === userId) throw errors.badRequest('You cannot like your own game');
    await this.store.upsert<LikeRow>('likes', { user_id: userId, game_id: gameId }, ['user_id', 'game_id']);
    return this.recount(gameId);
  }

  async unlike(gameId: string, userId: string): Promise<number> {
    await this.publicGame(gameId);
    await this.store.delete('likes', { user_id: userId, game_id: gameId });
    return this.recount(gameId);
  }
}
