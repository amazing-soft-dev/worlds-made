# Deploy

Production deploys from `main` through Vercel's Git connection. GitHub Actions does not deploy; a merge
to `main` only re-runs CI. Two Vercel projects point at this one repository.

| Project | Root directory | Config | Notes |
| --- | --- | --- | --- |
| `worlds-made-frontend` | `frontend` | `frontend/vercel.json` | Next.js. Enable "Include source files outside of the Root Directory" so `shared/` and the root lockfile are available. |
| `worlds-made-backend` | `backend` | `backend/vercel.json` | Fastify as a Vercel Function (`api/index.ts`), every path rewritten to it, `maxDuration` 90 s for slow AI calls. Same "Include source files" setting. |

Both projects: Production Branch = `main`; install runs `npm ci` from the repository root.
A Pro plan is needed once ads or payments are live (Hobby is personal and non-commercial only).

## Environment variables

| Variable | Project | Purpose |
| --- | --- | --- |
| `BACKEND_URL` | frontend | Backend project URL; the server build rewrites `/api/*` to it. Defaults to `http://127.0.0.1:4000` locally. |
| `NEXT_PUBLIC_SITE_URL` | frontend | Canonical site URL for metadata and the sitemap. |
| `PORT`, `NODE_ENV` | backend | Local server only; Vercel sets its own. |

Integration keys (database, payments, AI, moderation, game data, email) are added by the issues that introduce
each adapter and are documented in `.env.example`. Never commit real values.

## Still to do outside the code

- **Game domain.** Generated games must be served from a different registrable domain than the main site
  (for example a separate domain or an R2 bucket), with no cookies. The backend route and CSP arrive in the
  game-origin issue; the domain itself has to be bought and attached to the backend project.
- **Cron.** `crons` are added to `backend/vercel.json` with the daily-challenge job, so the schedule and route ship together.
- **Spend limits.** Set a monthly spend cap in Vercel and at the AI provider before any real key is added.
- **Analytics.** Vercel Web Analytics and Speed Insights run in production only.
- **Legal.** COPPA review and the DMCA agent registration are tracked in `docs/KIDS-COMPLIANCE.md` when it is added.
