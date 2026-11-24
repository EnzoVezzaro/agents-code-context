#!/usr/bin/env bash
# sync-skill-copies.sh — Sync canonical skill to all agent locations.
#
# Usage:
#   ./scripts/sync-skill-copies.sh          # sync + verify
#   ./scripts/sync-skill-copies.sh --check   # verify only (no copy)
#
# This is the single source of truth for publishing skill copies.
# Run it before `npm publish` or after editing skills/acc/SKILL.md.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CANONICAL="$ROOT/skills/acc/SKILL.md"

if [ ! -f "$CANONICAL" ]; then
  echo "ERROR: canonical skill not found at $CANONICAL" >&2
  exit 1
fi

# All locations that acc install targets.
INSTALL_DIRS=(
  ".agents/skills/acc"
  ".claude/skills/acc"
  ".codex/skills/acc"
  ".cursor/skills/acc"
  ".opencode/skills/acc"
  ".gemini/skills/acc"
  ".vscode/skills/acc"
  ".windsurf/skills/acc"
)

CHECK_ONLY=false
if [ "${1:-}" = "--check" ]; then
  CHECK_ONLY=true
fi

echo "Canonical: skills/acc/SKILL.md"
echo "Mode: $([ "$CHECK_ONLY" = true ] && echo 'check only' || echo 'sync + check')"
echo ""

failed=0

for dir in "${INSTALL_DIRS[@]}"; do
  target="$ROOT/$dir/SKILL.md"
  if [ ! -d "$ROOT/$dir" ]; then
    # Location not installed yet — skip silently.
    continue
  fi

  if [ "$CHECK_ONLY" = true ]; then
    # Compare normalized versions.
    if ! diff <(sed "s/__ACC_VERSION__/$(node -p "require('$ROOT/package.json').version")/g" "$CANONICAL") "$target" > /dev/null 2>&1; then
      echo "DRIFTED: $dir/SKILL.md"
      failed=1
    else
      echo "OK: $dir/SKILL.md"
    fi
  else
    sed "s/__ACC_VERSION__/$(node -p "require('$ROOT/package.json').version")/g" "$CANONICAL" > "$target"
    echo "COPIED: $dir/SKILL.md"
  fi
done

echo ""
if [ "$failed" -eq 1 ]; then
  echo "Some copies are drifted. Run without --check to resync."
  exit 1
fi
echo "All copies in sync."
