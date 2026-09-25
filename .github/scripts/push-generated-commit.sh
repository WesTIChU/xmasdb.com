#!/usr/bin/env bash

set -Eeuo pipefail

# Push an already-created generated-data commit without replacing commits that
# landed on main while the generator was running. Conflicts are never resolved
# automatically: refresh output may be stale and must not replace newer
# authoritative changes.
remote=${1:-origin}
branch=${2:-main}
max_attempts=${3:-5}

if ! [[ "$max_attempts" =~ ^[1-9][0-9]*$ ]]; then
  echo "max_attempts must be a positive integer" >&2
  exit 2
fi

rebase_in_progress=0

cleanup_rebase() {
  if (( rebase_in_progress )); then
    git rebase --abort >/dev/null 2>&1 || true
    rebase_in_progress=0
  fi
}

trap cleanup_rebase EXIT

abort_rebase_with_error() {
  local conflicts
  conflicts=$(git diff --name-only --diff-filter=U || true)
  if [[ -n "$conflicts" ]]; then
    echo "Generated refresh stopped: main changed in overlapping files:" >&2
    while IFS= read -r path; do
      [[ -n "$path" ]] && echo "  - $path" >&2
    done <<< "$conflicts"
    echo "The refresh commit was not applied. No automatic conflict resolution is permitted; origin/main is preserved." >&2
  else
    echo "Generated refresh stopped: rebase failed before the generated commit could be based on current main." >&2
  fi
  git rebase --abort >/dev/null 2>&1 || true
  rebase_in_progress=0
  exit 1
}

verify_clean_worktree() {
  local status
  echo "Checking generated working tree before rebase."
  echo "git status --short:"
  git status --short
  echo "git diff --name-only:"
  git diff --name-only
  echo "git diff --cached --name-only:"
  git diff --cached --name-only
  status=$(git status --porcelain)
  if [[ -n "$status" ]]; then
    echo "Generated refresh stopped: working tree is dirty before rebase." >&2
    echo "Dirty paths:" >&2
    while IFS= read -r line; do
      [[ -n "$line" ]] && echo "  - $line" >&2
    done <<< "$status"
    echo "No rebase or cleanup was attempted; generated output was preserved." >&2
    exit 1
  fi
}

for ((attempt = 1; attempt <= max_attempts; attempt++)); do
  echo "Integrating generated commit with $remote/$branch (attempt $attempt/$max_attempts)."
  git fetch "$remote" "$branch"
  verify_clean_worktree

  rebase_in_progress=1
  if ! GIT_EDITOR=true git rebase "$remote/$branch"; then
    abort_rebase_with_error
  fi
  rebase_in_progress=0

  if git push "$remote" "HEAD:$branch"; then
    echo "Generated commit pushed successfully."
    exit 0
  fi

  echo "$remote/$branch advanced during push; retrying." >&2
done

echo "Unable to push generated commit after $max_attempts attempts because $remote/$branch kept advancing." >&2
exit 1
