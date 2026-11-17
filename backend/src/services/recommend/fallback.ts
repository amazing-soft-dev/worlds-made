import type { CatalogGame } from '../../adapters/rawg/catalog';

/**
 * Staff picks served when the catalogue is down or over quota and nothing is cached. All are rated E10+ or lower,
 * so the fallback is safe for every age. Only the name and RAWG slug matter; the page links each to its RAWG record.
 */
const pick = (id: number, slug: string, name: string, genres: string[]): CatalogGame => ({
  id,
  slug,
  name,
  released: null,
  rating: 0,
  esrb: 'E10+',
  genres,
  platforms: [],
  free: false,
  image: null,
  stores: [],
});

export const FALLBACK_PICKS: CatalogGame[] = [
  pick(-1, 'celeste', 'Celeste', ['Platformer', 'Indie']),
  pick(-2, 'stardew-valley', 'Stardew Valley', ['Simulation', 'RPG']),
  pick(-3, 'hollow-knight', 'Hollow Knight', ['Action', 'Platformer']),
  pick(-4, 'portal-2', 'Portal 2', ['Puzzle', 'Platformer']),
];
