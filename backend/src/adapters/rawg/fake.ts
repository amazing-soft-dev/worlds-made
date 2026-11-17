import { allowedByRating, type CatalogFilters, type CatalogGame, type Esrb, type GameCatalog, type StoreLink } from './catalog';

type Row = [name: string, genres: string[], esrb: Esrb | null, free: boolean, rating: number, platforms: string[]];

// Fictional titles: this is test data, not claims about real games.
const FIXTURES: Row[] = [
  ['Lantern Runner', ['Platformer', 'Casual'], 'E', true, 4.4, ['PC', 'iOS', 'Android']],
  ['Pixel Orchard', ['Puzzle', 'Casual'], 'E', true, 4.1, ['PC', 'Nintendo Switch']],
  ['Cloud Kitchen', ['Simulation', 'Casual'], 'E', false, 4.0, ['PC', 'Nintendo Switch', 'iOS']],
  ['Comet Chasers', ['Racing', 'Arcade'], 'E10+', false, 3.9, ['PC', 'PlayStation', 'Xbox']],
  ['Moss Knights', ['Action', 'Adventure'], 'E10+', false, 4.6, ['PC', 'Nintendo Switch']],
  ['Tiny Tide Pool', ['Puzzle', 'Indie'], 'E', true, 3.8, ['iOS', 'Android']],
  ['Foxglove Tactics', ['Strategy', 'RPG'], 'T', false, 4.3, ['PC']],
  ['Hollow Lantern', ['Action', 'Platformer'], 'T', false, 4.7, ['PC', 'PlayStation', 'Nintendo Switch']],
  ['Night Market Brawl', ['Fighting', 'Action'], 'T', true, 3.5, ['PC', 'Xbox']],
  ['Grim Harvest', ['Shooter', 'Action'], 'M', false, 4.2, ['PC', 'PlayStation', 'Xbox']],
  ['Dead Signal 9', ['Shooter', 'Adventure'], 'M', false, 4.5, ['PC', 'PlayStation']],
  ['Maple Street Racers', ['Racing', 'Family'], 'E', true, 3.6, ['PC', 'Android']],
  ['Star Postman', ['Adventure', 'Indie'], 'E10+', false, 4.2, ['PC', 'Nintendo Switch']],
  ['Brick by Brick', ['Puzzle', 'Strategy'], 'E', false, 4.0, ['PC', 'iOS']],
  ['Quiet Archive', ['Adventure', 'Puzzle'], null, false, 4.4, ['PC']],
  ['Jelly Jumpers', ['Platformer', 'Family'], 'E', false, 3.7, ['Nintendo Switch']],
  ['Tower of Teacups', ['Strategy', 'Casual'], 'E', true, 3.4, ['iOS', 'Android', 'PC']],
  ['Ironclad Dawn', ['Strategy', 'Simulation'], 'T', false, 4.1, ['PC']],
  ['Splash Dash', ['Arcade', 'Sports'], 'E', true, 3.9, ['iOS', 'Android']],
  ['Velvet Blade', ['RPG', 'Action'], 'M', false, 4.8, ['PC', 'PlayStation', 'Xbox']],
];

export const FIXTURE_GAMES: CatalogGame[] = FIXTURES.map(([name, genres, esrb, free, rating, platforms], i) => {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return {
    id: 9000 + i,
    slug,
    name,
    released: '2024-01-01',
    rating,
    esrb,
    genres,
    platforms,
    free,
    image: null,
    stores: [{ store: 'Example Store', url: `https://store.example.com/app/${9000 + i}` }],
  };
});

/** Offline catalogue with the same filtering rules as the real one. Counts calls so tests can prove caching. */
export class FakeCatalog implements GameCatalog {
  readonly name = 'fixture';
  searches = 0;
  storeCalls = 0;
  /** Set to make the next searches fail, as if the service were down. */
  failing = false;

  async search(f: CatalogFilters, limit: number): Promise<CatalogGame[]> {
    this.searches++;
    if (this.failing) throw new Error('catalog down');
    const has = (list: string[], wanted: string[]) => wanted.length === 0 || wanted.some((w) => list.some((x) => x.toLowerCase().includes(w.toLowerCase())));
    return FIXTURE_GAMES.filter(
      (g) =>
        allowedByRating(g, f.esrbMax) &&
        has(g.genres, f.genres) &&
        has(g.platforms, f.platforms) &&
        (!f.freeOnly || g.free) &&
        (f.minRating === null || g.rating >= f.minRating) &&
        (f.keywords.length === 0 || f.keywords.some((k) => `${g.name} ${g.genres.join(' ')}`.toLowerCase().includes(k.toLowerCase()))),
    )
      .sort((a, b) => b.rating - a.rating)
      .slice(0, limit)
      .map((g) => ({ ...g, stores: [] }));
  }

  async storeLinks(game: CatalogGame): Promise<StoreLink[]> {
    this.storeCalls++;
    return FIXTURE_GAMES.find((g) => g.id === game.id)?.stores ?? [];
  }
}
