#!/usr/bin/env bash
# Merge-commits the pull request that a green CI run validated.
# Eligible pairs only:
#   feat|fix|docs|ci|build/<issue>-<slug>  ->  dev
#   dev                                    ->  main
# The merge is skipped if the head moved after CI started (--match-head-commit).
# Environment: GH_TOKEN, GH_REPO, HEAD_BRANCH, HEAD_SHA. Set DRY_RUN=1 to print instead of merging.
set -euo pipefail

HEAD_BRANCH="${HEAD_BRANCH:?HEAD_BRANCH is required}"
HEAD_SHA="${HEAD_SHA:?HEAD_SHA is required}"
PREFIXES='feat|fix|docs|ci|build'

PRS="$(gh pr list --head "$HEAD_BRANCH" --state open \
  --json number,baseRefName,headRefOid --jq '.[] | "\(.number) \(.baseRefName) \(.headRefOid)"')"

if [ -z "$PRS" ]; then
  echo "No open pull request for ${HEAD_BRANCH}."
  exit 0
fi

while read -r NUMBER BASE OID; do
  [ -n "$NUMBER" ] || continue

  if [ "$OID" != "$HEAD_SHA" ]; then
    echo "#${NUMBER}: head moved since CI ran (${OID} != ${HEAD_SHA}); a newer run will decide."
    continue
  fi

  ELIGIBLE=false
  if [ "$BASE" = "dev" ] && printf '%s' "$HEAD_BRANCH" | grep -qE "^(${PREFIXES})/[0-9]+-"; then ELIGIBLE=true; fi
  if [ "$BASE" = "main" ] && [ "$HEAD_BRANCH" = "dev" ]; then ELIGIBLE=true; fi

  if [ "$ELIGIBLE" != "true" ]; then
    echo "#${NUMBER}: ${HEAD_BRANCH} -> ${BASE} is not an automatic pair; leaving it."
    continue
  fi

  echo "Merging #${NUMBER} (${HEAD_BRANCH} -> ${BASE}) at ${HEAD_SHA}"
  if [ "${DRY_RUN:-}" = "1" ]; then
    echo "DRY: gh pr merge ${NUMBER} --merge --match-head-commit ${HEAD_SHA}"
  else
    gh pr merge "$NUMBER" --merge --match-head-commit "$HEAD_SHA"
  fi
done <<< "$PRS"
