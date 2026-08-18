#!/bin/bash
# Local CI simulation — run this before pushing to catch CI failures early.
# Mirrors .github/workflows/ci.yml jobs.
#
# Usage:
#   ./scripts/ci-local.sh          # run all checks
#   ./scripts/ci-local.sh dogfood  # run a specific job
#   ./scripts/ci-local.sh --fast   # skip slow jobs (tests, determinism)

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

passed=0
failed=0
skipped=0
errors=""

run_job() {
  local name="$1"
  local cmd="$2"
  echo -e "${CYAN}${BOLD}━━━ $name ━━━${RESET}"
  if eval "$cmd" > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓ $name${RESET}"
    passed=$((passed + 1))
  else
    echo -e "  ${RED}✗ $name${RESET}"
    failed=$((failed + 1))
    errors="${errors}  - $name\n"
  fi
}

skip_job() {
  local name="$1"
  echo -e "  ${YELLOW}○ $name (skipped)${RESET}"
  skipped=$((skipped + 1))
}

# Parse args
TARGET="all"
FAST=""
for arg in "$@"; do
  case "$arg" in
    --fast) FAST="--fast" ;;
    *) TARGET="$arg" ;;
  esac
done

echo -e "${CYAN}${BOLD}Installing dependencies...${RESET}"
npm install --no-audit --no-fund 2>&1 | tail -1
echo ""

# ── test-cli ───────────────────────────────────────────────────────────
if [ "$TARGET" = "all" ] || [ "$TARGET" = "test-cli" ]; then
  if [ "$FAST" = "--fast" ]; then
    skip_job "Test CLI"
  else
    run_job "Test CLI" "node --test test/*.test.js"
  fi
fi

# ── dogfood ────────────────────────────────────────────────────────────
if [ "$TARGET" = "all" ] || [ "$TARGET" = "dogfood" ]; then
  run_job "Dogfood: acc check" "node bin/acc.js check --json > /dev/null"
  run_job "Dogfood: acc graph" "node bin/acc.js graph --json > /dev/null"
  run_job "Dogfood: acc context" "node bin/acc.js context docs --depth 1 --json > /dev/null"
  run_job "Dogfood: acc inspect" "node bin/acc.js inspect docs --json > /dev/null"
  run_job "Dogfood: acc discover" "node bin/acc.js discover --json > /dev/null"
fi

# ── determinism ────────────────────────────────────────────────────────
if [ "$TARGET" = "all" ] || [ "$TARGET" = "determinism" ]; then
  if [ "$FAST" = "--fast" ]; then
    skip_job "Determinism"
  else
    run_job "Determinism: context" "node bin/acc.js context docs --depth 1 --json > /tmp/ci_ctx1.json && node bin/acc.js context docs --depth 1 --json > /tmp/ci_ctx2.json && diff /tmp/ci_ctx1.json /tmp/ci_ctx2.json"
    run_job "Determinism: graph" "node bin/acc.js graph --json > /tmp/ci_g1.json && node bin/acc.js graph --json > /tmp/ci_g2.json && diff /tmp/ci_g1.json /tmp/ci_g2.json"
    run_job "Determinism: check" "node bin/acc.js check --json > /tmp/ci_c1.json && node bin/acc.js check --json > /tmp/ci_c2.json && diff /tmp/ci_c1.json /tmp/ci_c2.json"
  fi
fi

# ── schema-validation ──────────────────────────────────────────────────
if [ "$TARGET" = "all" ] || [ "$TARGET" = "schema-validation" ]; then
  run_job "JSON Schema Validation" 'for cmd in check graph "inspect docs" discover "dependencies docs" "dependents docs" "impact docs"; do node bin/acc.js $cmd --json > /dev/null || { echo invalid JSON: acc $cmd; exit 1; }; done'
fi

# ── consistency ────────────────────────────────────────────────────────
if [ "$TARGET" = "all" ] || [ "$TARGET" = "consistency" ]; then
  run_job "Consistency: check:versions" "npm run check:versions"
  run_job "Consistency: check:skill-copies" "npm run check:skill-copies"
fi

# ── publish-safety ─────────────────────────────────────────────────────
if [ "$TARGET" = "all" ] || [ "$TARGET" = "publish-safety" ]; then
  run_job "Publish Safety" 'PKG_NAME=$(node -p "require('"'"'./package.json'"'"').name") && [ "$PKG_NAME" = "acc-code-context" ] && DOCS_PRIVATE=$(node -p "require('"'"'./docs/package.json'"'"').private") && [ "$DOCS_PRIVATE" = "true" ] && FILES=$(node -p "JSON.stringify(require('"'"'./package.json'"'"').files)") && [ "$FILES" = '"'"'["bin","lib","skills"]'"'"' ]'
fi

# ── invariant ──────────────────────────────────────────────────────────
if [ "$TARGET" = "all" ] || [ "$TARGET" = "invariant" ]; then
  run_job "Hard Invariant" 'node -e "const { parse } = require('"'"'./lib/core/agents.js'"'"'); const fs = require('"'"'fs'"'"'); const path = require('"'"'path'"'"'); const { walkFiles } = require('"'"'./lib/core/util.js'"'"'); const files = walkFiles('"'"'.'"'"', '"'"'.'"'"', [], []); const a = files.filter((f) => path.basename(f).toLowerCase() === '"'"'agents.md'"'"'); if (!a.length) { process.exit(1); } for (const f of a) parse(fs.readFileSync(f, '"'"'utf8'"'"')); console.log('"'"'OK'"'"')"'
fi

# ── Summary ────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}${BOLD}━━━ Summary ━━━${RESET}"
echo -e "  ${GREEN}Passed:  $passed${RESET}"
echo -e "  ${RED}Failed:  $failed${RESET}"
echo -e "  ${YELLOW}Skipped: $skipped${RESET}"

if [ $failed -gt 0 ]; then
  echo ""
  echo -e "${RED}${BOLD}CI FAILED — fix errors before pushing:${RESET}"
  printf "${errors}"
  echo ""
  exit 1
else
  echo ""
  echo -e "${GREEN}${BOLD}CI PASSED — safe to push.${RESET}"
  exit 0
fi
