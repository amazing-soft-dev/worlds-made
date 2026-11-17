/** Starting values from the V1 spec. Tune after measuring real cost per build. */
export const LIMITS = {
  /** Generated game file size cap (bytes). */
  maxGameBytes: 200 * 1024,
  /** Server-side timeout for one LLM call. */
  buildTimeoutMs: 90_000,
  /** Example only: free builds per day per account. */
  freeBuildsPerDay: 3,
  /** Example only: builds per day on the paid plan. Set once real cost per build is measured. */
  paidBuildsPerDay: 30,
  /** Free repairs per build before they count as builds. */
  freeRepairsPerBuild: 2,
  /** Versions kept per game. */
  gameVersionsKept: 5,
  /** Publishes per account per day. */
  publishPerDay: 5,
  /** Reports that hide a game until reviewed. */
  reportsToHide: 3,
  /** Entries shown on a daily leaderboard. */
  leaderboardSize: 100,
  /** Soft ceiling on API requests per minute from one IP (abuse guard, not a quota). */
  apiPerMinutePerIp: 600,
  /** Recommend requests per hour per IP for logged-out visitors. */
  recommendPerHourAnon: 20,
  /** Approved daily challenges that must exist before launch. */
  dailyBacklogMin: 14,
  /** RAWG Business plan monthly request ceiling. */
  rawgMonthlyRequests: 50_000,
  /** Anonymous ids, streaks and scores are deleted after this many days without play. */
  anonRetentionDays: 180,
  /** Accounts with no activity for this long (and no active subscription) are deleted. */
  inactiveAccountDays: 730,
  /** Recommend cache lifetime. */
  recCacheHours: 24,
} as const;

/** Minimum age to hold an account by region (EEA: GDPR Art. 8, V1 requires 16+). */
export const MIN_AGE_BY_REGION = { default: 13, eea: 16 } as const;
