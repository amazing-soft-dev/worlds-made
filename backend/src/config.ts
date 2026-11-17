import { z } from 'zod';

const flag = z
  .enum(['true', 'false', '1', '0'])
  .optional()
  .transform((v) => v === 'true' || v === '1');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  /** Public origin of the main site (used for CORS-free links, Stripe return URLs, frame-ancestors). */
  SITE_URL: z.string().url().default('http://localhost:3000'),
  /** Separate registrable domain that serves generated games. Never the main site's origin. */
  GAME_ORIGIN: z.string().url().default('http://127.0.0.1:4100'),

  /** Secret that signs the age and anonymous-id cookies. */
  COOKIE_SECRET: z.string().min(16).optional(),
  /** Shared secret for Vercel Cron and other scheduled callers. */
  CRON_SECRET: z.string().min(16).optional(),
  /** Comma-separated emails that may use /api/admin. */
  FOUNDER_EMAILS: z.string().default(''),

  /** Supabase: service-role access for the data and storage adapters, JWT secret for login tokens. */
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_KEY: z.string().optional(),
  SUPABASE_JWT_SECRET: z.string().optional(),
  /** Local-only signing secret used when Supabase is not configured (fake auth). */
  AUTH_DEV_SECRET: z.string().optional(),

  /** Any hosted model API with a chat-completions style endpoint (provider is open). */
  LLM_API_URL: z.string().url().optional(),
  LLM_API_KEY: z.string().optional(),
  LLM_MODEL: z.string().optional(),
  LLM_PRICE_IN_PER_M: z.coerce.number().nonnegative().default(0),
  LLM_PRICE_OUT_PER_M: z.coerce.number().nonnegative().default(0),

  OPENAI_API_KEY: z.string().optional(),
  /** Extra blocklist terms (comma separated), supplied by whoever runs trust and safety. */
  MODERATION_EXTRA_TERMS: z.string().default(""),
  RAWG_API_KEY: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_ID: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  MAIL_FROM: z.string().default('Worlds Made <no-reply@worldsmade.example>'),
  MAIL_TO: z.string().default('hello@worldsmade.example'),

  MONTHLY_SPEND_CAP_USD: z.coerce.number().nonnegative().default(100),
  /** Off switch: pauses all builds when set. */
  BUILDS_PAUSED: flag,
});

export type Env = z.infer<typeof envSchema>;

/** Parsed, typed configuration. Integrations are `null` when their keys are absent, and the fakes are used instead. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const e = envSchema.parse(env);
  const secret = e.COOKIE_SECRET ?? 'dev-only-cookie-secret-change-me';
  return {
    env: e.NODE_ENV,
    isProd: e.NODE_ENV === 'production',
    port: e.PORT,
    siteUrl: e.SITE_URL,
    gameOrigin: e.GAME_ORIGIN,
    cookieSecret: secret,
    cronSecret: e.CRON_SECRET ?? null,
    founderEmails: e.FOUNDER_EMAILS.split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
    jwtSecret: e.SUPABASE_JWT_SECRET ?? e.AUTH_DEV_SECRET ?? 'dev-only-jwt-secret-change-me',
    supabase: e.SUPABASE_URL && e.SUPABASE_SERVICE_KEY ? { url: e.SUPABASE_URL, serviceKey: e.SUPABASE_SERVICE_KEY } : null,
    llm:
      e.LLM_API_URL && e.LLM_API_KEY && e.LLM_MODEL
        ? {
            url: e.LLM_API_URL,
            key: e.LLM_API_KEY,
            model: e.LLM_MODEL,
            priceInPerM: e.LLM_PRICE_IN_PER_M,
            priceOutPerM: e.LLM_PRICE_OUT_PER_M,
          }
        : null,
    openaiKey: e.OPENAI_API_KEY ?? null,
    moderationExtraTerms: e.MODERATION_EXTRA_TERMS.split(",").map((s) => s.trim()).filter(Boolean),
    rawgKey: e.RAWG_API_KEY ?? null,
    stripe:
      e.STRIPE_SECRET_KEY && e.STRIPE_WEBHOOK_SECRET && e.STRIPE_PRICE_ID
        ? { secretKey: e.STRIPE_SECRET_KEY, webhookSecret: e.STRIPE_WEBHOOK_SECRET, priceId: e.STRIPE_PRICE_ID }
        : null,
    resendKey: e.RESEND_API_KEY ?? null,
    mailFrom: e.MAIL_FROM,
    mailTo: e.MAIL_TO,
    spendCapUsd: e.MONTHLY_SPEND_CAP_USD,
    buildsPaused: e.BUILDS_PAUSED,
  } as const;
}

export type Config = ReturnType<typeof loadConfig>;

/** Production must not silently run on development secrets. Called by the server entry points only. */
export function assertProductionReady(config: Config): void {
  if (!config.isProd) return;
  const missing: string[] = [];
  if (!process.env.COOKIE_SECRET) missing.push('COOKIE_SECRET');
  if (!process.env.SUPABASE_JWT_SECRET) missing.push('SUPABASE_JWT_SECRET');
  if (!config.cronSecret) missing.push('CRON_SECRET');
  if (missing.length) throw new Error(`Missing required production settings: ${missing.join(', ')}`);
}
