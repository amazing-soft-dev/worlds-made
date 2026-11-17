/** ESRB ratings from least to most mature. Unknown ratings are `null`. */
export const ESRB_ORDER = ['E', 'E10+', 'T', 'M', 'AO'] as const;
export type Esrb = (typeof ESRB_ORDER)[number];

export const esrbRank = (r: Esrb | null): number => (r === null ? -1 : ESRB_ORDER.indexOf(r));

export interface StoreLink {
  store: string;
  url: string;
}

export interface CatalogGame {
  id: number;
  slug: string;
  name: string;
  released: string | null;
  rating: number;
  esrb: Esrb | null;
  genres: string[];
  platforms: string[];
  free: boolean;
  image: string | null;
  stores: StoreLink[];
}

export interface CatalogFilters {
  genres: string[];
  platforms: string[];
  freeOnly: boolean;
  minRating: number | null;
  keywords: string[];
  /** The most mature ESRB rating allowed. Games with no rating are excluded when this is E10+ or lower. */
  esrbMax: Esrb;
}

/** A searchable catalogue of real games. RAWG in production, a fixture everywhere else. */
export interface GameCatalog {
  readonly name: string;
  search(filters: CatalogFilters, limit: number): Promise<CatalogGame[]>;
  /** Where to get a game. May cost an extra request, so callers ask only for the picks they show. */
  storeLinks(game: CatalogGame): Promise<StoreLink[]>;
}

export function allowedByRating(game: Pick<CatalogGame, 'esrb'>, max: Esrb): boolean {
  if (game.esrb === null) return esrbRank(max) >= esrbRank('M');
  return esrbRank(game.esrb) <= esrbRank(max);
}
