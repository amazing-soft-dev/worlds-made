import type { AgeBand, License, Plan } from '@worlds-made/shared';

/** Shapes returned by the backend API (see backend/src/routes). */
export interface MeResponse {
  user: { id: string; email: string | null; emailVerified: boolean; isFounder: boolean };
  profile: { id: string; display_name: string; age_band: AgeBand; plan: Plan } | null;
}

export interface AgeState {
  answered: boolean;
  band?: AgeBand;
  canHaveAccount?: boolean;
}

export interface Game {
  id: string;
  title: string;
  description: string;
  tags: string[];
  status: 'draft' | 'published' | 'hidden' | 'removed';
  visibility: 'private' | 'public';
  allowDownload: boolean;
  license: License;
  likeCount: number;
  currentVersionId: string | null;
  createdAt: string;
}

export interface GalleryItem {
  id: string;
  title: string;
  description: string;
  tags: string[];
  license: License;
  allowDownload: boolean;
  likeCount: number;
  weeklyLikes: number;
  staffPick: boolean;
  publishedAt: string | null;
  creator: string;
  liked: boolean;
}

export interface Usage {
  plan: Plan;
  date: string;
  buildsUsed: number;
  buildsLimit: number;
  repairsUsed: number;
  resetsAt: string;
}

export interface BuiltGame {
  game: { id: string; title: string; currentVersionId: string | null };
  version: { id: string; sizeBytes: number };
  swaps: Array<{ from: string; to: string }>;
  warnings: string[];
  charged: 'build' | 'free-repair';
}

export interface DailyInfo {
  date: string;
  theme: string;
  versionId: string;
  playUrl: string;
  nextRolloverAt: string;
  secondsToRollover: number;
}

export interface BoardEntry {
  rank: number;
  name: string;
  score: number;
}

export interface Pick {
  id: number;
  name: string;
  rawgUrl: string;
  image: string | null;
  released: string | null;
  rating: number;
  esrb: string | null;
  genres: string[];
  platforms: string[];
  price: 'free' | 'paid';
  stores: Array<{ store: string; url: string; affiliate: boolean }>;
  why: string;
}

export interface RecommendResult {
  source: 'live' | 'cache' | 'fallback';
  picks: Pick[];
  buildYourOwn: { prefill: string } | null;
  attribution: { name: string; url: string };
  affiliateDisclosure: boolean;
  notice: string | null;
  ratingLimit: string;
}
