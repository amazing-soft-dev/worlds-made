#!/usr/bin/env bash
# Opens (or updates) the pull request for the pushed branch.
#   feature branch (feat|fix|docs|ci|build)/<issue>-<slug>  ->  PR into dev
#   dev                                                      ->  PR into main (when dev is ahead)
# Environment: GH_TOKEN, GH_REPO, BRANCH. Set DRY_RUN=1 to print instead of calling gh.
set -euo pipefail

BRANCH="${BRANCH:?BRANCH is required}"
PREFIXES='feat|fix|docs|ci|build'

run() {
  if [ "${DRY_RUN:-}" = "1" ]; then printf 'DRY: %s\n' "$*"; else "$@"; fi
}

# Issue numbers named by branch names and by Closes/Fixes/Resolves lines in a git range.
issues_in_range() {
  git log "$1" --format='%s%n%b' |
    {
      grep -oE "(${PREFIXES})/[0-9]+" | grep -oE '[0-9]+$' || true
      git log "$1" --format='%s%n%b' | grep -ioE '(close[sd]?|fix(e[sd])?|resolve[sd]?) #[0-9]+' | grep -oE '[0-9]+$' || true
    } | sort -un
}

if [ "$BRANCH" = "dev" ]; then
  BASE=main
  RANGE="origin/main..origin/dev"
  TITLE="Promote dev to main"
  {
    echo "Automatic promotion of everything on \`dev\` that is not yet on \`main\`."
    echo
    echo "Merging this pull request closes the issues below once CI has passed."
    echo
    for n in $(issues_in_range "$RANGE"); do echo "Closes #$n"; done
  } > pr-body.md
else
  BASE=dev
  RANGE="origin/dev..origin/${BRANCH}"
  NUM="$(printf '%s' "$BRANCH" | sed -nE "s#^(${PREFIXES})/([0-9]+)-.*#\2#p")"
  SUBJECT="$(git log "$RANGE" --reverse --format=%s | head -n 1)"
  TITLE="${SUBJECT:-$BRANCH}"
  {
    echo "Branch \`${BRANCH}\` into \`dev\`."
    echo
    # A closing keyword here would not close the issue; only the dev -> main pull request does.
    if [ -n "$NUM" ]; then echo "Refs #$NUM"; fi
  } > pr-body.md
fi

# Nothing to open when the branch has no commits beyond its base (for example after the bootstrap merge).
AHEAD="$(git rev-list --count "$RANGE")"
if [ "$AHEAD" -eq 0 ]; then
  echo "No commits on ${BRANCH} beyond ${BASE}; no pull request needed."
  exit 0
fi

EXISTING="$(gh pr list --head "$BRANCH" --base "$BASE" --state open --json number --jq '.[0].number // empty')"

if [ -n "$EXISTING" ]; then
  if [ "$BRANCH" = "dev" ]; then
    # REST instead of `gh pr edit`: edit queries GraphQL fields that need the read:org scope, which a repo-only token lacks.
    run gh api -X PATCH "repos/${GH_REPO}/pulls/${EXISTING}" -F body=@pr-body.md --silent
    echo "Updated #$EXISTING"
  else
    echo "Pull request #$EXISTING is already open; leaving it."
  fi
  exit 0
fi

run gh pr create --base "$BASE" --head "$BRANCH" --title "$TITLE" --body-file pr-body.md
