import type { AgeBand, GameStatus, GameVisibility, Plan } from '@worlds-made/shared';

/** Every table, in migration order. The migration tests check this list against the SQL. */
export const TABLES = [
  'profiles',
  'games',
  'game_versions',
  'build_usage',
  'likes',
  'reports',
  'daily_challenges',
  'challenge_scores',
  'streaks',
  'subscriptions',
  'rec_cache',
] as const;

export type TableName = (typeof TABLES)[number];

/** Tables whose primary key is a generated uuid `id`. */
export const UUID_ID_TABLES: ReadonlySet<TableName> = new Set([
  'games',
  'game_versions',
  'reports',
  'daily_challenges',
  'challenge_scores',
  'streaks',
]);

/** Tables with a created_at column that defaults to now(). */
export const CREATED_AT_TABLES: ReadonlySet<TableName> = new Set([
  'profiles',
  'games',
  'game_versions',
  'likes',
  'reports',
  'daily_challenges',
  'challenge_scores',
]);

export interface ProfileRow {
  id: string;
  display_name: string;
  birth_year: number;
  age_band: AgeBand;
  country: string | null;
  plan: Plan;
  created_at: string;
}

export interface GameRow {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  tags: string[];
  status: GameStatus;
  visibility: GameVisibility;
  allow_download: boolean;
  license: string;
  current_version_id: string | null;
  like_count: number;
  staff_pick: boolean;
  published_at: string | null;
  created_at: string;
}

export interface GameVersionRow {
  id: string;
  game_id: string;
  prompt: string;
  html_path: string;
  size_bytes: number;
  model: string;
  tokens_in: number;
  tokens_out: number;
  error_log: string | null;
  created_at: string;
}

export interface BuildUsageRow {
  user_id: string;
  date: string;
  builds_used: number;
  repairs_used: number;
}

export interface LikeRow {
  user_id: string;
  game_id: string;
  created_at: string;
}

export interface ReportRow {
  id: string;
  game_id: string;
  reporter_id: string;
  reason: string;
  status: 'open' | 'reviewed' | 'dismissed';
  created_at: string;
}

export interface DailyChallengeRow {
  id: string;
  date: string | null;
  game_version_id: string;
  theme: string;
  status: 'pending' | 'approved' | 'used';
  approved_by: string | null;
  score_min: number;
  score_max: number;
  created_at: string;
}

export interface ChallengeScoreRow {
  id: string;
  date: string;
  user_id: string | null;
  anon_id: string | null;
  score: number;
  created_at: string;
}

export interface StreakRow {
  id: string;
  user_id: string | null;
  anon_id: string | null;
  current: number;
  best: number;
  last_played_date: string | null;
}

export interface SubscriptionRow {
  user_id: string;
  stripe_customer_id: string;
  status: string;
  current_period_end: string | null;
}

export interface RecCacheRow {
  query_hash: string;
  filters_json: unknown;
  results_json: unknown;
  expires_at: string;
}
