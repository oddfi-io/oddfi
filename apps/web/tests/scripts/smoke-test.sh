#!/bin/bash
# Oddfi smoke test — AI Agent 或 CI 可直接执行
# 用法: bash tests/scripts/smoke-test.sh [port]
set -euo pipefail

PORT=${1:-3099}
FAIL=0
STARTED_DEV=false
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=============================="
echo " Oddfi Smoke Test"
echo "=============================="

# --- 1. Build check ---
echo ""
echo "[1/5] Build check..."
if pnpm build 2>&1 | grep -q "Failed to compile"; then
  echo "  FAIL: build failed"
  exit 1
fi
echo "  PASS"

# --- 2. Type check ---
echo ""
echo "[2/5] Type check..."
if ! pnpm type-check 2>&1; then
  echo "  FAIL: type errors found"
  exit 1
fi
echo "  PASS"

# --- 3. Unit tests ---
echo ""
echo "[3/5] Unit tests..."
if ! pnpm test 2>&1; then
  echo "  FAIL: test failures"
  exit 1
fi
echo "  PASS"

# --- Helper: start dev server ---
start_dev_server() {
  if ! curl -s -o /dev/null http://localhost:$PORT/ 2>/dev/null; then
    npx next dev --port $PORT &
    DEV_PID=$!
    STARTED_DEV=true
    for i in $(seq 1 30); do
      if curl -s -o /dev/null http://localhost:$PORT/ 2>/dev/null; then
        break
      fi
      sleep 1
    done
  fi
}

# --- 4. Page reachability ---
echo ""
echo "[4/5] Page reachability (dev server on :$PORT)..."

start_dev_server

PAGES=(
  /en/markets
  /en/stake
  /en/swap
  /en/trade
  /en/invite
  /en/liquidity
  /en/leaderboard
  /en/stats
  /access
)

for path in "${PAGES[@]}"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT$path" 2>/dev/null || echo "000")
  if [ "$code" = "200" ]; then
    echo "  PASS  $path"
  else
    echo "  FAIL  $path -> $code"
    FAIL=1
  fi
done

# --- 5. Console error check (browser-level) ---
echo ""
echo "[5/5] Browser console error check..."
if command -v npx &>/dev/null && node -e "require('playwright')" 2>/dev/null; then
  if ! node "$SCRIPT_DIR/console-check.mjs" "$PORT"; then
    FAIL=1
  fi
else
  echo "  SKIP (playwright not installed, run: pnpm add -D playwright && npx playwright install chromium)"
fi

# --- Cleanup ---
if [ "$STARTED_DEV" = true ]; then
  kill $DEV_PID 2>/dev/null
  wait $DEV_PID 2>/dev/null || true
fi

# --- Summary ---
echo ""
echo "=============================="
if [ $FAIL -eq 0 ]; then
  echo " ALL SMOKE TESTS PASSED"
else
  echo " SOME TESTS FAILED"
  exit 1
fi
echo "=============================="
