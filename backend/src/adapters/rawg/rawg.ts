import { allowedByRating, type CatalogFilters, type CatalogGame, type Esrb, type GameCatalog, type StoreLink } from './catalog';

type FetchFn = typeof fetch;

const PLATFORM_IDS: Record<string, number> = { pc: 4, playstation: 187, xbox: 186, switch: 7, ios: 3, android: 21, mac: 5, linux: 6 };
const ESRB_BY_SLUG: Record<string, Esrb> = { everyone: 'E', 'everyone-10-plus': 'E10+', teen: 'T', mature: 'M', 'adults-only': 'AO' };

interface RawgGame {
  id: number;
  slug: string;
  name: string;
  released: string | null;
  background_image: string | null;
  rating: number;
  esrb_rating: { slug: string } | null;
  genres?: Array<{ slug: string; name: string }>;
  platforms?: Array<{ platform: { name: string } }>;
  tags?: Array<{ slug: string }>;
}

export class RawgError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'RawgError';
  }
}

/**
 * RAWG, Business plan (commercial use, store links). Every call counts against the monthly request ceiling, which the
 * recommend service tracks. The key stays on the server.
 */
export class RawgCatalog implements GameCatalog {
  readonly name = 'rawg';
  requests = 0;

  constructor(
    private readonly apiKey: string,
    private readonly fetchFn: FetchFn = fetch,
  ) {}

  private async get<T>(path: string, params: Record<string, string>): Promise<T> {
    this.requests++;
    const qs = new URLSearchParams({ key: this.apiKey, ...params });
    const res = await this.fetchFn(`https://api.rawg.io/api/${path}?${qs}`);
    if (!res.ok) throw new RawgError(`RAWG returned ${res.status}`, res.status);
    return (await res.json()) as T;
  }

  async search(f: CatalogFilters, limit: number): Promise<CatalogGame[]> {
    const params: Record<string, string> = { page_size: String(Math.min(40, limit * 3)), ordering: '-rating', search_precise: 'true' };
    if (f.keywords.length) params.search = f.keywords.join(' ');
    if (f.genres.length) params.genres = f.genres.join(',');
    const platforms = f.platforms.map((p) => PLATFORM_IDS[p]).filter((x): x is number => x !== undefined);
    if (platforms.length) params.platforms = platforms.join(',');
    if (f.freeOnly) params.tags = 'free-to-play';
    const body = await this.get<{ results: RawgGame[] }>('games', params);

    return body.results
      .map<CatalogGame>((g) => ({
        id: g.id,
        slug: g.slug,
        name: g.name,
        released: g.released,
        rating: g.rating,
        esrb: g.esrb_rating ? (ESRB_BY_SLUG[g.esrb_rating.slug] ?? null) : null,
        genres: (g.genres ?? []).map((x) => x.name),
        platforms: (g.platforms ?? []).map((x) => x.platform.name),
        free: (g.tags ?? []).some((t) => t.slug === 'free-to-play'),
        image: g.background_image,
        stores: [],
      }))
      // RAWG has no rating filter, so age limits are applied here, before anything is shown or explained.
      .filter((g) => allowedByRating(g, f.esrbMax) && (f.minRating === null || g.rating >= f.minRating))
      .slice(0, limit);
  }

  async storeLinks(game: CatalogGame): Promise<StoreLink[]> {
    const body = await this.get<{ results: Array<{ store_id: number; url: string }> }>(`games/${game.id}/stores`, {});
    const names = await this.storeNames();
    return body.results.map((r) => ({ store: names.get(r.store_id) ?? 'Store', url: r.url })).filter((l) => /^https:\/\//.test(l.url));
  }

  private storeNameCache: Map<number, string> | null = null;
  private async storeNames(): Promise<Map<number, string>> {
    if (!this.storeNameCache) {
      const body = await this.get<{ results: Array<{ id: number; name: string }> }>('stores', {});
      this.storeNameCache = new Map(body.results.map((s) => [s.id, s.name]));
    }
    return this.storeNameCache;
  }
}
