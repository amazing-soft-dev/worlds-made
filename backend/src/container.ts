import { createStores, type BlobStore, type DataStore } from './adapters/data';
import { FakeLlm } from './adapters/llm/fake';
import { HttpLlmProvider } from './adapters/llm/http';
import { MeteredLlm } from './adapters/llm/ledger';
import type { Config } from './config';
import { GameBuilder } from './services/games/builder';
import { GameService } from './services/games/games';
import { FakeModerator, OpenAiModerator } from './services/moderation/moderator';
import { ModerationService } from './services/moderation/service';
import { ProfileService } from './services/profiles';

/** Everything the routes need, built once. Tests pass overrides to swap any piece for a fake. */
export interface Services {
  config: Config;
  store: DataStore;
  blobs: BlobStore;
  profiles: ProfileService;
  moderation: ModerationService;
  llm: MeteredLlm;
  games: GameService;
  builder: GameBuilder;
}

export function createServices(config: Config, overrides: Partial<Services> = {}): Services {
  const stores = createStores(config);
  const store = overrides.store ?? stores.store;
  const blobs = overrides.blobs ?? stores.blobs;
  const moderation =
    overrides.moderation ??
    new ModerationService(config.openaiKey ? new OpenAiModerator(config.openaiKey) : new FakeModerator(), config.moderationExtraTerms);
  const provider = config.llm ? new HttpLlmProvider({ url: config.llm.url, key: config.llm.key, model: config.llm.model }) : new FakeLlm();
  const prices = { inPerM: config.llm?.priceInPerM ?? 0, outPerM: config.llm?.priceOutPerM ?? 0 };
  const llm = overrides.llm ?? new MeteredLlm(provider, store, prices);
  const games = overrides.games ?? new GameService(store, blobs);
  return {
    config,
    store,
    blobs,
    profiles: overrides.profiles ?? new ProfileService(store),
    moderation,
    llm,
    games,
    builder: overrides.builder ?? new GameBuilder(llm, moderation, games),
  };
}
