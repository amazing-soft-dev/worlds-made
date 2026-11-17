# Contributing

## The short version

1. Open a GitHub issue and note its number.
2. Branch from `origin/dev`: `feat/12-short-description`. Allowed prefixes: `feat/`, `fix/`, `docs/`, `ci/`, `build/`. Put the issue number first.
3. Commit with a Conventional Commit subject, for example `feat(home): add the hero section`.
4. Push. A pull request into `dev` opens by itself, CI runs, and a green run merges it.

**Never push to `dev` or `main`.** Rulesets block direct pushes, force-pushes and deletion.

## Commits

- Subject: `type(scope): imperative summary`, 72 characters or fewer. Types: `feat`, `fix`, `docs`, `ci`, `build`, `test`, `refactor`.
- One logical step per commit. A reviewer should be able to read each one on its own.
- `Closes #12` is optional when the branch name already carries the number (`Fixes` and `Resolves` work too).
  The issue closes when the `dev` to `main` pull request merges, not when the branch merges into `dev`.
- Co-author trailers go at the end of the message, after a blank line:

```
Co-authored-by: shark314 <112891100+shark314@users.noreply.github.com>
Co-authored-by: tomost8 <178904341+tomost8@users.noreply.github.com>
```

## Before you push

```bash
npm run lint && npm run typecheck && npm run check:images && npm run build
NEXT_OUTPUT=export npm run build -w frontend && npm run check:static -w frontend
```

CI runs the same checks. Warnings fail the lint job.

## Rules that matter for this product

- **Generated games are untrusted code.** Never relax the iframe `sandbox`, the game-origin CSP, the static scanner, or the `postMessage` schema without a security note in the pull request.
- **Kids are a core audience.** Do not collect personal data from under-13s, add third-party scripts, or add free-text fields they can see. Ads use child treatment when the age is under 13 or unknown.
- **No secrets in git.** Add new variables to `.env.example` with a placeholder value.
- **Photos:** each photo is used once and listed in the image manifest with its photographer. CI checks this.
- Dependabot pull requests are not automatic. A person merges or closes them.
