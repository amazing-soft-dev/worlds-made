# Architecture

```
 browser ──────────────▶ frontend (Next.js 16)  ── /api/* rewrite ──▶ backend (Fastify)  ──▶ Supabase · LLM · Stripe · RAWG · Resend
   │                                                                          │
   └── iframe (sandbox="allow-scripts") ◀── game origin: /g/:version?t=<token> ◀─┘   (a different registrable domain)
```

| Workspace | What it is |
| --- | --- |
| `frontend/` | Next.js 16 App Router, React Compiler, Tailwind v4, Motion. UI only; every data call goes to `/api`. |
| `backend/` | TypeScript Fastify on Node. `routes → services → adapters`, wired in `src/container.ts`. |
| `shared/` | zod schemas and constants both sides import: the game message format, age bands, limits, licences. |

## Backend layers

- **routes/** parse input with zod and call a service. No business rules live here.
- **services/** hold the rules: age gate, moderation, scanning, building, usage, gallery, reports, daily challenge, recommendations, billing.
- **adapters/** are the only code that talks to a vendor, each behind an interface with a local fake:

| Interface | Production | Fake (tests, CI, local) |
| --- | --- | --- |
| `DataStore`, `BlobStore` | Supabase PostgREST and Storage | in-memory |
| `LlmProvider` | any OpenAI-style HTTP endpoint | deterministic template-based model |
| `Moderator` | OpenAI Moderation | keyword fake |
| `GameCatalog` | RAWG | fictional fixture catalogue |
| `BillingProvider` | Stripe over HTTPS | in-memory |
| `Mailer` | Resend | in-memory |

`createServices(config, overrides)` builds everything once; tests pass overrides to swap any piece.

## A game's life

1. **Describe** → `POST /api/games/generate`. Spend guard, one-build-at-a-time gate and the daily allowance are checked first.
2. **Moderate the prompt** (blocklist, franchise → original stand-in, classifier). A block costs nothing.
3. **Generate** from a genre template and the fixed system prompt (90 s timeout, one retry with a smaller template).
4. **Scan** the HTML (no external URLs, network APIs, `eval`, storage, window escapes; ≤ 200 KB), then **moderate its visible text**. A bad result is regenerated once.
5. **Store** the HTML in the blob store and a `game_versions` row (last 5 kept). Only now is the player charged.
6. **Play** in `sandbox="allow-scripts"` on the game domain with the strict CSP, through a short-lived signed link.
7. **Publish** (limits, text and code moderation, licence) → **gallery**, likes, reports (3 weighted reports hide it).

## The daily challenge

Cron at 20:00 UTC generates tomorrow's challenge as *pending* → the founder approves it in `/admin` → at 00:00 UTC it becomes today's
for everyone (an approved backlog entry is used if nothing was approved). A play session token is bound to the player and the day;
a score needs it, is range-checked per genre, and the best of the day is kept. Streaks count consecutive days.

## Data

Migrations are in `backend/src/db/migrations/` (apply in order). Every table has row-level security; the backend's service role
is the only writer of moderated state. See `docs/SECURITY.md` and `docs/KIDS-COMPLIANCE.md`.

## Testing

| Layer | Command | What it proves |
| --- | --- | --- |
| Unit and route tests | `npm test` | rules and routes against the fakes (shared, backend, frontend) |
| End to end | `npm run test:e2e` | the real server process over HTTP with a mock model: hostile reply, game-origin isolation, publish/like, daily, reports |
| Static guards | `npm run check:images`, `check:a11y`, `check:sandbox` | each photo used once, text contrast, iframe sandbox never loosened |
| Builds | `npm run build`, `NEXT_OUTPUT=export` + `check:static` | server and static targets |

CI runs all of it; **CI passed** is the one required status check.
