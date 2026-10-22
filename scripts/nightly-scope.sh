#!/bin/sh
# Which jobs of the nightly workflow run (ADR-0022; tested by scripts/nightly-scope.test.ts).
#   EVENT  github.event_name   REF  github.ref   BEFORE  github.event.before (pushes)
# Prints, or appends to $GITHUB_OUTPUT: test=true|false and mutation=true|false.
#   - schedule, workflow_dispatch, a push to main: the test suite and mutation testing;
#   - a push to another branch: the test job only, when it changes the nightly's own
#     configuration (the paths below); otherwise nothing.
# A branch's first push (BEFORE all zeros or unknown) is compared with origin/main.
set -eu

out() {
  if [ -n "${GITHUB_OUTPUT:-}" ]; then
    printf 'test=%s\nmutation=%s\n' "$1" "$2" >>"$GITHUB_OUTPUT"
  fi
  printf 'test=%s\nmutation=%s\n' "$1" "$2"
}

case "$EVENT" in
schedule | workflow_dispatch)
  out true true
  exit 0
  ;;
esac
if [ "$REF" = "refs/heads/main" ]; then
  out true true
  exit 0
fi

base="${BEFORE:-}"
if [ -z "$base" ] || [ "$base" = "0000000000000000000000000000000000000000" ] ||
  ! git cat-file -e "$base^{commit}" 2>/dev/null; then
  base=$(git merge-base origin/main HEAD 2>/dev/null || true)
fi
if [ -z "$base" ]; then
  # No history to compare with: run the test job, as a full push would.
  out true false
  exit 0
fi

if git diff --name-only "$base" HEAD | grep -Eq \
  '^(\.github/workflows/nightly\.yml|stryker\.[^/]*\.json|vitest\.[^/]*\.config\.ts|scripts/mutation-shards\.ts|scripts/mutation-summary\.ts|scripts/nightly-scope\.sh)$'; then
  out true false
else
  out false false
fi
