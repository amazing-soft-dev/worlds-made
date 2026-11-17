import type { AgeBand } from '@worlds-made/shared';
import { z } from 'zod';
import type { MeteredLlm } from '../../adapters/llm/ledger';
import { esrbRank, type CatalogFilters, type CatalogGame, type Esrb, type GameCatalog } from '../../adapters/rawg/catalog';
import { AppError } from '../../errors';
import type { ModerationService } from '../moderation/service';
import { RecCache } from './cache';
import { FALLBACK_PICKS } from './fallback';

const PARSE_SYSTEM = `You turn a game request into JSON filters. Reply with JSON only, no prose:
{"genres":[],"platforms":[],"priceMax":null,"ratingCeiling":null,"keywords":[]}
genres are RAWG genre names (action, adventure, puzzle, platformer, racing, shooter, rpg, strategy, simulation, sports, indie, casual, arcade, fighting, family).
platforms are pc, playstation, xbox, switch, ios, android. priceMax is 0 for free games, otherwise null.
ratingCeiling is one of E, E10+, T, M or null. Use only what the request says.`;

const EXPLAIN_SYSTEM = `For each game below write one short line (under 20 words) saying why it fits the request.
Use only the fields given: do not mention anything else about the game. Do not add games.
Reply with one line per game in the form "Game name: reason".`;

const filtersSchema = z.object({
  genres: z.array(z.string().max(30)).max(5).default([]),
  platforms: z.array(z.string().max(30)).max(5).default([]),
  priceMax: z.number().nullable().default(null),
  ratingCeiling: z.enum(['E', 'E10+', 'T', 'M']).nullable().default(null),
  keywords: z.array(z.string().max(40)).max(5).default([]),
});
type ParsedFilters = z.infer<typeof filtersSchema>;

export interface RecommendedGame {
  id: number;
  name: string;
  /** A real RAWG record, always linked. */
  rawgUrl: string;
  image: string | null;
  released: string | null;
  rating: number;
  esrb: Esrb | null;
  genres: string[];
  platforms: string[];
  /** Free and paid results are labelled. */
  price: 'free' | 'paid';
  /** Store links, with an affiliate tag where one exists. */
  stores: Array<{ store: string; url: string; affiliate: boolean }>;
  why: string;
}

export interface RecommendResult {
  source: 'live' | 'cache' | 'fallback';
  picks: RecommendedGame[];
  /** When nothing fits well: a card that opens the game maker with the request filled in. */
  buildYourOwn: { prefill: string } | null;
  attribution: { name: 'RAWG'; url: 'https://rawg.io' };
  affiliateDisclosure: true;
  notice: string | null;
  ratingLimit: Esrb;
}

/** The most mature rating an age band may see. Under 13 and unknown ages are limited to E and E10+. */
export function ratingLimitFor(band: AgeBand | null): Esrb {
  if (band === 'adult') return 'M';
  if (band === '13to17') return 'T';
  return 'E10+';
}

const lowest = (a: Esrb, b: Esrb | null): Esrb => (b !== null && esrbRank(b) < esrbRank(a) ? b : a);

export function addAffiliate(url: string, tags: Record<string, string>): { url: string; affiliate: boolean } {
  try {
    const u = new URL(url);
    const entry = Object.entries(tags).find(([domain]) => u.hostname === domain || u.hostname.endsWith(`.${domain}`));
    if (!entry) return { url, affiliate: false };
    for (const [k, v] of new URLSearchParams(entry[1])) u.searchParams.set(k, v);
    return { url: u.toString(), affiliate: true };
  } catch {
    return { url, affiliate: false };
  }
}

export class RecommendService {
  constructor(
    private readonly catalog: GameCatalog,
    private readonly cache: RecCache,
    private readonly llm: MeteredLlm,
    private readonly moderation: ModerationService,
    private readonly affiliateTags: Record<string, string> = {},
  ) {}

  /** Step 2: the model returns JSON filters only. If it fails or returns junk, plain keywords are used. */
  private async parse(request: string): Promise<ParsedFilters> {
    const keywords = request.toLowerCase().split(/\W+/).filter((w) => w.length > 3).slice(0, 5);
    try {
      const r = await this.llm.complete({ purpose: 'parse', system: PARSE_SYSTEM, user: request, maxOutputTokens: 300, timeoutMs: 20_000 });
      const json = /\{[\s\S]*\}/.exec(r.text)?.[0];
      return filtersSchema.parse(JSON.parse(json ?? '{}'));
    } catch {
      return filtersSchema.parse({ keywords });
    }
  }

  /** Step 4: one line per game, written from the catalogue fields only; lines naming a game we did not return are dropped. */
  private async explain(request: string, games: CatalogGame[]): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    try {
      const facts = games.map((g) => `GAME: ${g.name} | ${g.genres.join(', ')} | rating ${g.rating} | ESRB ${g.esrb ?? 'unrated'} | ${g.free ? 'free' : 'paid'}`).join('\n');
      const r = await this.llm.complete({ purpose: 'explain', system: EXPLAIN_SYSTEM, user: `Request: ${request}\n${facts}`, maxOutputTokens: 600, timeoutMs: 30_000 });
      const known = new Map(games.map((g) => [g.name.toLowerCase(), g.name]));
      for (const line of r.text.split('\n')) {
        const m = /^\s*(?:[-*\d.)]+\s*)?(.+?):\s+(.+)$/.exec(line);
        const name = m?.[1] ? known.get(m[1].trim().toLowerCase()) : undefined;
        if (!name || !m?.[2]) continue;
        const text = m[2].trim().slice(0, 200);
        if ((await this.moderation.checkText(text)).allowed) out.set(name, text);
      }
    } catch {
      /* generic lines are used instead */
    }
    return out;
  }

  private async toPicks(games: CatalogGame[], why: Map<string, string>): Promise<RecommendedGame[]> {
    const picks: RecommendedGame[] = [];
    for (const [i, g] of games.entries()) {
      let stores = g.stores;
      if (stores.length === 0 && i < 5) stores = await this.catalog.storeLinks(g).catch(() => []);
      picks.push({
        id: g.id,
        name: g.name,
        rawgUrl: `https://rawg.io/games/${g.slug}`,
        image: g.image,
        released: g.released,
        rating: g.rating,
        esrb: g.esrb,
        genres: g.genres,
        platforms: g.platforms,
        price: g.free ? 'free' : 'paid',
        stores: stores.map((s) => ({ store: s.store, ...addAffiliate(s.url, this.affiliateTags) })),
        why: why.get(g.name) ?? `A ${g.genres[0]?.toLowerCase() ?? 'popular'} game${g.esrb ? ` rated ${g.esrb}` : ''}.`,
      });
    }
    return picks;
  }

  async recommend(input: { request: string; ageBand: AgeBand | null }, now: Date = new Date()): Promise<RecommendResult> {
    const verdict = await this.moderation.checkText(input.request);
    if (!verdict.allowed) throw new AppError(422, 'prompt_blocked', "Let's keep it friendly. Try describing the kind of game you like.");

    const parsed = await this.parse(input.request);
    const limit = ratingLimitFor(input.ageBand);
    const filters: CatalogFilters = {
      genres: parsed.genres.map((g) => g.toLowerCase()),
      platforms: parsed.platforms.map((p) => p.toLowerCase()),
      freeOnly: parsed.priceMax === 0,
      minRating: null,
      keywords: parsed.keywords.map((k) => k.toLowerCase()),
      esrbMax: lowest(limit, parsed.ratingCeiling),
    };
    const key = RecCache.keyFor(filters);
    const base = { attribution: { name: 'RAWG', url: 'https://rawg.io' } as const, affiliateDisclosure: true as const, ratingLimit: limit };

    let games: CatalogGame[] | null = await this.cache.get(key, now);
    let source: RecommendResult['source'] = 'cache';
    let notice: string | null = null;

    if (!games) {
      if (await this.cache.underQuota(now)) {
        try {
          games = await this.catalog.search(filters, 10);
          await this.cache.countRequests(1 + Math.min(5, games.length), now);
          await this.cache.set(key, filters, games, now);
          source = 'live';
        } catch {
          games = await this.cache.getStale(key);
          notice = 'Our game catalogue is busy, so these results may be a little old.';
        }
      } else {
        games = await this.cache.getStale(key);
        notice = 'Our game catalogue is resting for now, so these results may be a little old.';
      }
    }

    if (!games) {
      // Nothing cached and nothing live: a short list of staff picks, all rated E10+ or lower.
      const picks = await this.toPicks(FALLBACK_PICKS, new Map(FALLBACK_PICKS.map((g) => [g.name, `A staff pick while the catalogue is unavailable.`])));
      return { ...base, source: 'fallback', picks, buildYourOwn: { prefill: input.request }, notice: 'Showing staff picks while our game catalogue is unavailable.' };
    }

    const why = await this.explain(input.request, games);
    const picks = await this.toPicks(games, why);
    return { ...base, source, picks, buildYourOwn: picks.length < 3 ? { prefill: input.request } : null, notice };
  }
}
