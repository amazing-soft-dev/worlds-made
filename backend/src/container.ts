import { createStores, type BlobStore, type DataStore } from './adapters/data';
import type { Config } from './config';
import { ModerationService } from './services/moderation/service';
import { FakeModerator, OpenAiModerator } from './services/moderation/moderator';
import { ProfileService } from './services/profiles';

/** Everything the routes need, built once. Tests pass overrides to swap any piece for a fake. */
export interface Services {
  config: Config;
  store: DataStore;
  blobs: BlobStore;
  profiles: ProfileService;
  moderation: ModerationService;
}

export function createServices(config: Config, overrides: Partial<Services> = {}): Services {
  const stores = createStores(config);
  const store = overrides.store ?? stores.store;
  return {
    config,
    store,
    blobs: overrides.blobs ?? stores.blobs,
    profiles: overrides.profiles ?? new ProfileService(store),
    moderation:
      overrides.moderation ??
      new ModerationService(config.openaiKey ? new OpenAiModerator(config.openaiKey) : new FakeModerator(), config.moderationExtraTerms),
  };
}
