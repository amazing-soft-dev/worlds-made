import { createStores, type BlobStore, type DataStore } from './adapters/data';
import { MemoryMailer, ResendMailer, type Mailer } from './adapters/mail/mailer';
import { FakeLlm } from './adapters/llm/fake';
import { HttpLlmProvider } from './adapters/llm/http';
import { MeteredLlm } from './adapters/llm/ledger';
import type { Config } from './config';
import { GameBuilder } from './services/games/builder';
import { GameLibrary } from './services/games/library';
import { GalleryService } from './services/community/gallery';
import { ReportService } from './services/community/reports';
import { DailyService } from './services/daily/daily';
import { PublishService } from './services/community/publish';
import { BuildGate, SpendGuard } from './services/games/guards';
import { UsageService } from './services/games/usage';
import { BuildWorkflow } from './services/games/workflow';
import { FakeModerator, OpenAiModerator } from './services/moderation/moderator';
import { ModerationService } from './services/moderation/service';
import { RateLimiter } from './lib/rate-limit';
import { ProfileService } from './services/profiles';

/** Everything the routes need, built once. Tests pass overrides to swap any piece for a fake. */
export interface Services {
  config: Config;
  store: DataStore;
  blobs: BlobStore;
  profiles: ProfileService;
  moderation: ModerationService;
  llm: MeteredLlm;
  games: GameLibrary;
  builder: GameBuilder;
  usage: UsageService;
  workflow: BuildWorkflow;
  limiter: RateLimiter;
  gate: BuildGate;
  spend: SpendGuard;
  mailer: Mailer;
  publisher: PublishService;
  gallery: GalleryService;
  reports: ReportService;
  daily: DailyService;
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
  const games = overrides.games ?? new GameLibrary(store, blobs);
  const builder = overrides.builder ?? new GameBuilder(llm, moderation, games);
  const usage = overrides.usage ?? new UsageService(store);
  const gate = overrides.gate ?? new BuildGate();
  const mailer = overrides.mailer ?? (config.resendKey ? new ResendMailer(config.resendKey, config.mailFrom) : new MemoryMailer());
  const spend = overrides.spend ?? new SpendGuard(config, llm);
  return {
    config,
    store,
    blobs,
    profiles: overrides.profiles ?? new ProfileService(store),
    moderation,
    llm,
    games,
    builder,
    usage,
    workflow: overrides.workflow ?? new BuildWorkflow(builder, usage, store, spend, gate),
    limiter: overrides.limiter ?? new RateLimiter(),
    gate,
    spend,
    publisher: overrides.publisher ?? new PublishService(store, games, moderation),
    gallery: overrides.gallery ?? new GalleryService(store),
    mailer,
    reports: overrides.reports ?? new ReportService(store, mailer, config.mailTo),
    daily: overrides.daily ?? new DailyService(store, builder),
  };
}
