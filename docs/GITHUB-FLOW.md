# GitHub flow

Two long-lived branches. **`dev`** is where work lands. **`main`** is the release branch.
Vercel deploys Production from `main`; GitHub Actions does not deploy.

```
feat/12-thing ──push──▶ PR into dev ──CI green──▶ merge commit ──▶ dev
                                                                    │ push to dev
                                                                    ▼
                                                          PR dev ▶ main (body lists "Closes #N")
                                                                    │ CI green
                                                                    ▼
                                                          merge commit ──▶ main ──▶ issues close
```

## Workflows

| Workflow | File | Trigger | Does |
| --- | --- | --- | --- |
| Open pull request | `open-pull-request.yml` | push to a prefix branch or `dev` | Prefix branch: PR into `dev`. `dev`: opens or updates `dev` to `main` and writes the `Closes` lines |
| CI | `ci.yml` | every PR, push to `dev` or `main`, manual | Lint and type check; Build (server) and Build (static) in parallel; **CI passed** |
| Merge passing pull request | `merge-passing-pr.yml` | CI finished successfully on a PR | Merge-commits the PR if its head is still the commit CI validated |

A newer push to the same branch or pull request cancels the older CI run.

## The token

The first and third workflows use the `GH_TOKEN` repository secret instead of the default `GITHUB_TOKEN`:
pull requests and merges made with the default token do not start the next workflow, so CI would never run.
Create a fine-grained personal access token for this repository with **Contents**, **Pull requests**
and **Issues** read and write, then:

```bash
gh secret set GH_TOKEN
```

Without the secret the workflows warn and exit cleanly, and nothing opens or merges by itself.

## Branch rules

`.github/rulesets/` holds the rulesets for `dev` and `main`: no direct pushes, no force-pushes, no deletion,
changes only through a pull request, merge commits only, and the **CI passed** check must be green. No human review is required.

## Issue numbers

Issues and pull requests share one counter. Branch names carry the issue number first
(`feat/12-short-description`), and the `dev` to `main` pull request collects those numbers so GitHub closes the issues.
A closing keyword on the pull request into `dev` does not close anything.

## Dependabot

Weekly pull requests for npm and GitHub Actions. They are neither opened nor merged by the workflows above.
