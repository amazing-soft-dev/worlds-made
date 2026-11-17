# Build plan: AI Game Site (Worlds Made design)

Status: **in progress.** The 71 issues exist on GitHub; Wave 1 (bootstrap) is being merged locally. Track progress in the issues and milestones, not in this file.

## 1. Decisions (from your answers)

| Topic | Decision |
|---|---|
| Product | The AI game site from *AI Game Site — V1 Build Spec* (`/create`, `/daily`, `/gallery`, `/recommend`, `/play/[id]`, `/pricing`, `/account`, `/admin`, `/parents`, `/legal/*`, `/login`) wearing the worlds-made look: near-black green `#070c09`, pale sage text, gold `#ecd08a`, Cinzel + EB Garamond, square corners, 1px gold borders, spring slide-in hero. The recruiting routes in your pasted stack (`/api/hire`, `/api/cv`, `/api/salary-guide`, AI-training apply/partner) are **dropped**. Resend stays for `/api/contact` and report notices. |
| Layout | npm-workspaces monorepo: `frontend/` (Next.js 16.4, Tailwind v4, Motion), `backend/` (TypeScript + Fastify on Node), `shared/` (zod schemas and types both sides import). |
| Deploy | Two Vercel projects from `main`: frontend, and backend (Fastify on Vercel Functions, Vercel Cron, long timeouts). `/api/*` on the frontend rewrites to the backend. Generated games are served from a **separate registrable domain** (see risk R4). |
| Integrations | Mock-first. Supabase, Stripe, RAWG, LLM and moderation each sit behind an interface in `backend/src/adapters/` with a local fake, so CI needs no keys. Real keys are config-only follow-ups. |
| GitHub flow | One-time bootstrap (issues #1 to #12 merged locally with `--no-ff` and pushed once), then every other issue goes branch → auto PR into `dev` → CI → auto merge → auto `dev`→`main` PR. Rulesets are applied last. |
| Images | Downloaded by script from Unsplash and Pexels into the repo, converted to responsive WebP, each photo used once (CI-checked), credited on `/credits`. |

## 2. What I could not read, and what I assumed

- **PDF pages 1 to 2 (overview, "1. Game maker", recommend step 1) have no extractable text** and my renderer produced blank images. Everything from "Recommend → Parse" onward was read in full. I inferred the game-maker flow from the later sections (templates per genre, build limits, repair, moderation, versions). **Please paste or confirm those pages before issues #37 to #42 start.**
- Versions in your table (Next.js 16.4, React 19.3, TypeScript `^7`, ESLint 10) are used as written. Issue #2 runs `npm view` first; if one is unpublished or breaks `typescript-eslint`/React Compiler, I pin the nearest stable and note it in the issue.
- Photo IDs are **not** chosen yet. Issue #19 picks them by opening Unsplash and Pexels and verifying each URL returns an image.

## 3. Repo layout

```
.github/{workflows,rulesets,ISSUE_TEMPLATE,dependabot.yml,pull_request_template.md}
frontend/   src/app, src/components, src/content/site.ts, src/lib, public/images, scripts/
backend/    src/{server.ts,routes,services,adapters,jobs,db/migrations,lib}, test/
shared/     src/{score-message,age-band,game,limits}.ts
docs/       ARCHITECTURE.md, SECURITY.md, KIDS-COMPLIANCE.md, GITHUB-FLOW.md
```
`audit/` and `.claude/` stay local and are gitignored (the audit contains screenshots of a third-party template). Design tokens are copied from `audit/tokens.json` in issue #13.

## 4. Per-issue procedure (applies to every issue)

1. `gh issue create` with labels (`type`, `area`, `kids-safety` where relevant), milestone, acceptance criteria. **All 71 issues are created up front** so they are #1 to #71. PRs and issues share one counter, so creating them first is the only way the numbers in branch names stay predictable. (Dependabot and auto PRs will then take #72 onward.)
2. `git switch -c <type>/<N>-<slug> origin/dev`. Prefixes used: `feat/ fix/ docs/ ci/ build/`. Issue number first.
3. Two to four commits per issue, Conventional Commit subjects, small and reviewable (types: `feat build ci docs test refactor`).
4. Every commit ends with:
```
Co-authored-by: shark314 <112891100+shark314@users.noreply.github.com>
Co-authored-by: tomost8 <178904341+tomost8@users.noreply.github.com>
Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```
   Branch name carries the issue number, so `Closes #N` is optional; I add it on the last commit anyway.
5. `git push -u origin <branch>`. Workflows open the PR into `dev`, run CI, and merge-commit on green. I watch the run and never merge by hand.
6. Concurrency: only issues touching disjoint files run in parallel (max 4). `package-lock.json` and `globals.css` are serialised; I rebase from `origin/dev` before pushing.

## 5. The 71 issues

Wave order is top to bottom; issues in a milestone are mostly sequential unless noted. `⟂` = safe to run in parallel with the neighbours in the same group.

### M0 Bootstrap and delivery (#1 to #12): merged locally, pushed once
| # | Title | Branch | Commits |
|---|---|---|---|
| 1 | Monorepo with npm workspaces | `build/1-workspaces-monorepo` | root `package.json` workspaces + `engines`; `.nvmrc`, `.editorconfig`, gitignore for workspaces/`.env*`; `.env.example` pattern |
| 2 | Next.js 16 app skeleton in `frontend/` | `build/2-frontend-nextjs-skeleton` | `create` app with TS strict; `next.config.ts` (React Compiler, `NEXT_OUTPUT` switch, image loader switch); Tailwind v4 CSS-first `globals.css`; `npm view` version check recorded |
| 3 | Fastify service in `backend/` | `build/3-backend-fastify-skeleton` | Fastify + TS + `tsx` dev script; `/health` route + test; Vercel-compatible handler export |
| 4 | `shared/` zod schemas | `feat/4-shared-schemas` | score message `{type:"score"|"error"}`; `ageBand`, game `status`/`visibility`; plan limits constants |
| 5 | ESLint 10 and typecheck, zero warnings | `ci/5-eslint-typecheck` | flat config for all workspaces; `lint` and `typecheck` scripts; `--max-warnings 0` |
| 6 | CI workflow | `ci/6-ci-workflow` | job *Lint and type check*; jobs *Build server* and *Build static* in a matrix; job *CI passed* with PR summary comment; concurrency cancel |
| 7 | Open pull request workflow | `ci/7-open-pull-request-workflow` | feature branch → PR into `dev`; `dev` → `main` PR with issue-closing body built from branch names and `Closes/Fixes/Resolves`; uses `GH_TOKEN` secret |
| 8 | Merge passing pull request workflow | `ci/8-merge-passing-pr` | `workflow_run` after green CI; merge commit with `--match-head-commit`; only prefix→`dev` and `dev`→`main` |
| 9 | Dependabot | `ci/9-dependabot` | weekly npm (3 workspaces) and Actions; excluded from auto-merge |
| 10 | CONTRIBUTING, templates, README | `docs/10-contributing-templates-readme` | issue and PR templates; GITHUB-FLOW.md; README with run commands |
| 11 | Branch rulesets | `ci/11-branch-rulesets` | `.github/rulesets/{dev,main}.json`: block push, force-push, deletion; require PR, merge commit only, check **CI passed**, no review; applied via `gh api` **after** the first green CI |
| 12 | Vercel projects | `build/12-vercel-projects-config` | `vercel.json` for both apps; `/api` rewrite; cron stub; production-only analytics flag |

### M1 Design system and static pages (#13 to #27)
| # | Title | Branch | Commits |
|---|---|---|---|
| 13 | Tailwind v4 theme tokens | `feat/13-tailwind-theme-tokens` | `@theme` colors, spacing, breakpoints 810/1200; type scale; 0 radius utilities |
| 14 | Fonts | `feat/14-fonts` | Cinzel + EB Garamond via `next/font`; fallbacks; variable names |
| 15 | UI primitives ⟂ | `feat/15-ui-primitives` | `Button` (primary/ghost/outline); `Chip`; `Eyebrow`; `SectionTitle`; `Card` with 1px gold border |
| 16 | Layout, Nav, Footer ⟂ | `feat/16-nav-footer-layout` | sticky Nav (desktop/tablet/mobile variants); Footer with Imprint-style legal links; skip-to-content |
| 17 | Motion helpers | `feat/17-motion-reveal-hero` | spring slide-in (duration .8, bounce .2, delay .2); scroll-reveal; `prefers-reduced-motion` fallback |
| 18 | Content module | `feat/18-site-content-module` | `src/content/site.ts`: nav, hero, feature copy, pricing figures, FAQ, legal summaries |
| 19 | Photo manifest and downloader ⟂ | `build/19-photo-manifest-download` | `images.manifest.json` (source URL, photographer, license, intended slot); `scripts/fetch-images.mjs` with 200/content-type checks; sources committed |
| 20 | WebP pipeline and loader | `build/20-webp-pipeline-loader` | `sharp` script to `public/images/w{640,1080,1600}`; custom loader for export; server build uses Next optimizer |
| 21 | `check:images` | `ci/21-check-images` | each photo used once; every manifest entry used; every used file in manifest; wired into lint job |
| 22 | Home: hero and how it works | `feat/22-home-hero-howitworks` | hero with sliding image frame; 5-step "describe → build → play → share → daily" strip |
| 23 | Home: feature sections | `feat/23-home-feature-sections` | create, daily, gallery, recommend sections; trust/kids-safety band; FAQ; CTA |
| 24 | `/pricing` static page | `feat/24-pricing-page-static` | Free vs Paid cards driven by `site.ts`; example limits (3 builds/day, marked "example"); adult-only note |
| 25 | SEO | `feat/25-seo-sitemap-og-llms` | `sitemap`, `robots`, per-page metadata, Open Graph image, `llms.txt` |
| 26 | Static export verification | `ci/26-static-export-checks` | script asserts `out/` has expected HTML, sitemap, icons, WebP files, and **no** `out/api`; dynamic routes (`/play/[id]`) get a client-fetch shell in export mode |
| 27 | `/credits` page | `feat/27-photo-credits-page` | generated from the manifest; photographer links; RAWG credit slot |

### M2 Backend foundation and safety services (#28 to #36)
| # | Title | Branch | Commits |
|---|---|---|---|
| 28 | Config, errors, logging | `feat/28-backend-config-errors-logging` | zod-validated env with `.env.example`; typed error envelope; request-id logging with secret redaction |
| 29 | Database migrations | `feat/29-db-migrations-tables` | SQL for `profiles games game_versions build_usage likes reports daily_challenges challenge_scores streaks subscriptions rec_cache`; indexes; enums |
| 30 | Row-level security | `feat/30-rls-policies-tests` | RLS on every table; owner-only drafts/usage/subscription rows; policy tests against local Postgres |
| 31 | Data adapter and fake | `feat/31-data-adapter-fake-supabase` | `DataStore` interface; in-memory fake used by tests/CI; Supabase implementation behind env flag |
| 32 | Auth and profiles | `feat/32-auth-session-profiles` | JWT verify middleware; `profiles` upsert; founder-role check; email verification gate |
| 33 | Age gate | `feat/33-age-gate-service` | neutral birth-year endpoint; stores birth year and `age_band` only; remembers the answer so a retry cannot change it; EEA requires 16+; under-13 gets no account |
| 34 | Anonymous IDs and retention | `feat/34-anon-id-retention` | random anon id for under-13/unknown; streak keyed to it; retention job and documented period |
| 35 | Moderation service | `feat/35-moderation-service` | adapter for OpenAI Moderation (fake in tests); blocklist (slurs, adult terms, real people); franchise→original stand-in rewrite with user notice |
| 36 | Static game scanner | `feat/36-static-scanner` | rejects external URLs, `fetch`, `XMLHttpRequest`, `WebSocket`, remote `eval`, >200 KB; fixtures of malicious games |

### M3 Game maker (#37 to #45)
| # | Title | Branch | Commits |
|---|---|---|---|
| 37 | LLM adapter and cost log | `feat/37-llm-adapter-cost-log` | provider-neutral interface; deterministic fake; per-call model/tokens/cost log; max-output-tokens cap |
| 38 | Templates and system prompt | `feat/38-game-templates-prompt` | fixed system prompt from the PDF; per-genre starter templates (runner, match-3, platformer, quiz, shooter); `postMessage` score contract |
| 39 | Generate endpoint | `feat/39-generate-endpoint` | moderate prompt → LLM → scan → moderate visible text → store; 90 s timeout; retry once with smaller template; no charge on provider failure |
| 40 | Repair, change, usage limits | `feat/40-repair-change-usage-limits` | `build_usage` daily limit enforced server-side; 2 free repairs per build; "change it" path |
| 41 | Rate limits and spend cap | `feat/41-rate-limits-spend-cap` | one build at a time per user; per-IP limits; publish 5/day; global monthly spend cap with off switch |
| 42 | Game storage and versions | `feat/42-game-storage-versions` | HTML to Storage (fake: disk); keep last 5 versions; owner CRUD |
| 43 | Game origin and CSP | `feat/43-game-origin-csp` | host-checked `/g/:id` route on the game domain; exact CSP from the PDF with `frame-ancestors`; no cookies on that host |
| 44 | Download | `feat/44-download-html-zip` | single `.html` with comment header (site + license); zip with README and itch.io steps; owner-only or `allow_download` |
| 45 | Contact email | `feat/45-contact-email-resend` | `POST /api/contact` and report notices via Resend (Node runtime); honeypot + rate limit; fake mailer in tests |

### M4 Community (#46 to #49)
| # | Title | Branch | Commits |
|---|---|---|---|
| 46 | Publish | `feat/46-publish-endpoint-licenses` | title/description/tags moderation; license choice; code re-scan; block with reason |
| 47 | Gallery API and likes | `feat/47-gallery-api-likes` | New / Most liked this week (Monday 00:00 UTC reset) / Staff picks; one like per user |
| 48 | Reports and auto-hide | `feat/48-reports-autohide` | Report endpoint; 3 reports hides game; new-account weighting; record kept |
| 49 | Admin API | `feat/49-admin-api-founder-only` | founder-only: challenge approval, report queue, restore/remove, staff pick toggle |

### M5 Daily challenge (#50 to #52)
| # | Title | Branch | Commits |
|---|---|---|---|
| 50 | Generate-ahead job | `feat/50-daily-generate-cron` | Vercel Cron handler secured by secret; theme list; creates tomorrow's challenge as pending |
| 51 | Approve and rollover | `feat/51-daily-approve-rollover` | approve API; midnight-UTC rollover; backlog fallback; next-rollover timestamp for countdown; seed script for the 14-game backlog |
| 52 | Scores, leaderboard, streaks | `feat/52-daily-scores-streaks` | sandbox-message score intake; per-game `score_min/max` range check; one per session; top 100; under-18 nicknames; consecutive-day streak |

### M6 Recommend (#53 to #54)
| # | Title | Branch | Commits |
|---|---|---|---|
| 53 | RAWG adapter and cache | `feat/53-rawg-adapter-cache` | adapter with recorded fixtures; 24 h `rec_cache`; usage counter against the 50,000/month ceiling |
| 54 | Recommend pipeline | `feat/54-recommend-pipeline` | parse (JSON filters only) → query → explain (RAWG fields only, unknown names dropped); E/E10+ for under-13/unknown; 20/h per IP; fallback to cache then staff picks; "build your own" prefill payload |

### M7 Payments (#55)
| # | Title | Branch | Commits |
|---|---|---|---|
| 55 | Stripe subscriptions | `feat/55-stripe-subscriptions` | Checkout + Customer Portal sessions (test-mode adapter); webhook is the only writer of `subscriptions`; re-sync on login; adults only |

### M8 Frontend application (#56 to #67)
| # | Title | Branch | Commits |
|---|---|---|---|
| 56 | `/login` and age gate UI | `feat/56-login-age-gate-ui` | neutral year-of-birth step; email sign-in; captcha slot; under-13 anonymous path |
| 57 | Sandboxed player component | `feat/57-sandbox-player` | `<iframe sandbox="allow-scripts">` only; message listener accepts `score`/`error` from the frame's own `contentWindow` only; Stop (reload) button; "Fix it" on errors |
| 58 | `/create` | `feat/58-create-page` | prompt box, genre templates, progress states, limit-reached state, change-it suggestions, version list |
| 59 | `/play/[id]` | `feat/59-play-page` | player, license line, like, report, download (when allowed) |
| 60 | `/gallery` | `feat/60-gallery-page` | three tabs; publish dialog with license picker |
| 61 | `/daily` | `feat/61-daily-page` | challenge player, UTC countdown, streak, top-100 board, anonymous banner |
| 62 | `/recommend` | `feat/62-recommend-page` | result cards with Free/Paid labels, store link, affiliate disclosure, RAWG credit, "build your own" card |
| 63 | `/account` and checkout | `feat/63-account-pricing-checkout` | my games, usage, plan; checkout and portal buttons; teen "ask a parent" |
| 64 | `/admin` | `feat/64-admin-ui` | challenge approval queue, report queue, founder-only guard |
| 65 | `/parents` and legal | `feat/65-parents-legal-pages` | `/parents`, `/legal/terms`, `/privacy`, `/dmca`; lawyer-review banner in docs, not on page |
| 66 | Ads with age treatment | `feat/66-adsense-age-treatment` | AdSense wrapper with `TFAT=1` for under-13/unknown and `2` for teens; off in dev; consent-safe |
| 67 | Analytics and errors | `feat/67-analytics-sentry` | Vercel Web Analytics + Speed Insights (production only); Sentry free tier; no ad pixels |

### M9 Quality (#68 to #71)
| # | Title | Branch | Commits |
|---|---|---|---|
| 68 | Error and empty states | `feat/68-error-states-fallbacks` | 404 page, error boundary, provider-outage and RAWG-down messages |
| 69 | Accessibility pass | `feat/69-accessibility-pass` | focus rings, contrast on gold-on-black, reduced motion, landmarks, keyboard play |
| 70 | Unit tests | `ci/70-unit-tests-vitest` | scanner, moderation, scoring ranges, streaks, age gate, CSP header snapshot; added to CI |
| 71 | E2E smoke | `ci/71-e2e-playwright-smoke` | create → play → publish → like with fakes; sandbox escape attempt test |

## 6. Execution order and waves

1. **Wave 0**: create labels and milestones, create issues #1 to #71, create `dev` from `main`.
2. **Wave 1 (bootstrap)**: do #1 to #10 and #12 on branches off `main`/`dev`, merge each with `git merge --no-ff` locally, push `main` and `dev` once. This is the single deliberate exception to "never push to main". Then add the `GH_TOKEN` secret (R2), confirm the first CI run is green, and only then apply #11 (rulesets).
3. **Wave 2**: M1 (#13 to #27), parallel only for ⟂ groups.
4. **Wave 3**: M2, then M3 and M4 in order; M5 to M7 can overlap with M3/M4 once #31 and #35 are in.
5. **Wave 4**: M8 frontend (needs matching backend endpoints), then M9.
6. After each wave: confirm the `dev` → `main` PR merged, CI green, issues closed.

## 7. Risks and edge cases

| # | Risk | Handling |
|---|---|---|
| R1 | Rulesets applied too early block the bootstrap (required check does not exist yet) | #11 is last in wave 1 and applied only after a green CI run on `dev` |
| R2 | The auto-PR workflow needs a `GH_TOKEN` **repository secret** and I will not copy your CLI token into one without your say-so | You run `gh secret set GH_TOKEN` (use a fine-grained PAT with contents + pull-requests + issues write); until then PRs are opened by me manually |
| R3 | Auto-merge means a bad commit reaches `main` unreviewed (no human review required) | CI includes scanner fixtures, RLS tests, CSP snapshot and e2e; no real keys or deploys on `dev` |
| R4 | Game isolation fails if the game host shares a registrable domain or cookies with the site | A second purchased domain (or Cloudflare R2 public bucket) for `/g/*`; local dev uses a different host+port; E2E asserts no cookies and `connect-src 'none'` |
| R5 | COPPA / GDPR Art. 8 / DMCA agent registration are legal, not code | Code enforces "no data from under-13s", EEA 16+; `docs/KIDS-COMPLIANCE.md` lists the lawyer-review and Copyright Office steps as open items |
| R6 | RAWG free plan bans commercial use; Business is $149/mo | Only fixtures in CI; real key arrives with a paid plan; attribution on every page using its data |
| R7 | Stripe, AdSense, Supabase need accounts, domains, verification | Adapters + test-mode; all go-live steps listed in `docs/ARCHITECTURE.md`, none block the 71 issues |
| R8 | Unsplash/Pexels: licence allows free use but not "selling the photos"; images of identifiable people or brand logos are unsuitable for a kids audience | Picks limited to landscapes, abstract light, retro-tech, board/arcade objects; photographer credit on `/credits`; no hot-linking |
| R9 | Static export cannot do dynamic API data, forms or `/play/[id]` for unknown ids | Export builds client-fetch shells and omits `/api`; verified by #26 |
| R10 | Issue numbers drift if anything else opens an issue/PR first | Issues are created in one batch before any branch exists |
| R11 | Version table (Next 16.4, TS 7, ESLint 10, Node latest) may not all be published or compatible | #2 and #5 verify with `npm view`; fall back and record |
| R12 | The PDF sets a 14-challenge launch backlog, which needs generated games | #51 ships a seed script with hand-written, scanner-passing sample games; real backlog is an ops task |

## 8. Definition of done (V1 build)

- All 71 issues closed through merged PRs; `main` equals `dev`; CI passed on `main`.
- `npm run lint && npm run typecheck && npm run check:images` clean; server and static builds green; `out/api` absent.
- A fake-provider walkthrough works end to end: sign in (adult) → create → fix → play → publish → like → report ×3 hides → daily score and streak → recommend → checkout (test mode).
- A deliberately hostile generated game (network call, `parent.location` write, cookie read) is rejected by the scanner and, if forced past it, contained by sandbox + CSP.
