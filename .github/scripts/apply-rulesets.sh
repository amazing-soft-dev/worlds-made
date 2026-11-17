#!/usr/bin/env bash
# Creates or updates the branch rulesets in .github/rulesets/*.json on the repository.
# Needs repository admin: run it yourself with `gh` logged in; it is not part of any workflow.
#   bash .github/scripts/apply-rulesets.sh           # apply
#   DRY_RUN=1 bash .github/scripts/apply-rulesets.sh # show what would happen
set -euo pipefail

REPO="${GH_REPO:-$(gh repo view --json nameWithOwner --jq .nameWithOwner)}"
DIR="$(cd "$(dirname "$0")/../rulesets" && pwd)"

for file in "$DIR"/*.json; do
  name="$(node -e 'process.stdout.write(require(process.argv[1]).name)' "$file")"
  id="$(gh api "repos/${REPO}/rulesets" --jq ".[] | select(.name == \"${name}\") | .id")"
  if [ -n "$id" ]; then
    echo "update ruleset ${name} (#${id})"
    [ "${DRY_RUN:-}" = "1" ] || gh api -X PUT "repos/${REPO}/rulesets/${id}" --input "$file" --silent
  else
    echo "create ruleset ${name}"
    [ "${DRY_RUN:-}" = "1" ] || gh api -X POST "repos/${REPO}/rulesets" --input "$file" --silent
  fi
done
