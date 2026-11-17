# Worlds Made

An AI game site: describe a game, play it, publish it, and join one shared challenge a day.
The look comes from the Worlds Made fantasy portfolio design (near-black green, pale sage text,
gold accents, Cinzel and EB Garamond).

## Layout

| Directory | What it is |
| --- | --- |
| `frontend/` | Next.js 16 (App Router, React Compiler), Tailwind CSS v4, Motion |
| `backend/` | TypeScript Fastify API on Node (route handlers, services, adapters, jobs) |
| `shared/` | zod schemas and constants imported by both sides (score message, age bands, limits) |
| `docs/` | Contributor and architecture notes, including the GitHub flow |
| `.github/` | Workflows, dependabot, issue and pull request templates |

The full build plan and the issue list are in [PLAN.md](PLAN.md).

## Run it

Requires Node 24 or newer.

```bash
npm ci
npm run dev:backend    # http://127.0.0.1:4000/api/health
npm run dev:frontend   # http://localhost:3000
```

Copy `.env.example` to `backend/.env` and `frontend/.env.local` if you need to change a value.
The integrations (database, payments, AI, moderation, game data) have local fakes, so no keys are needed.

## Checks

```bash
npm run lint           # ESLint, zero warnings allowed
npm run typecheck
npm run check:images   # each photo is used once
npm run build          # server build
NEXT_OUTPUT=export npm run build -w frontend   # static build into frontend/out
```

## Two build targets

- **Server** (default `next build`): what Vercel runs. `/api` is proxied to the backend and images use Next's optimizer.
- **Static** (`NEXT_OUTPUT=export`): plain HTML in `out/`, no server, no `/api`. Responsive WebP files are built by `npm run images`.

## How changes land

Work lands on `dev` through an automatic pull request, and a green CI run promotes it to `main`.
Vercel deploys production from `main`. Read [CONTRIBUTING.md](CONTRIBUTING.md) and
[docs/GITHUB-FLOW.md](docs/GITHUB-FLOW.md) before pushing.

## License

Apache-2.0, see [LICENSE](LICENSE).
