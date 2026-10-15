#!/usr/bin/env bash
set -euo pipefail

# 同步长期部署分支（dev / pre / testnet）到 main 最新内容
#
# Usage: bin/sync-branches.sh <testnet|dev|pre|all>
#   testnet | dev | pre   只同步指定分支
#   all                   同步全部 3 条
#
# 流程（每条分支独立子流程）：
#   1. checkout <branch>
#   2. reset --hard main           — 丢弃分支独立提交，内容等于 main
#   3. commit --allow-empty        — 加触发 commit 让 SHA ≠ main，绕开 Vercel dedupe
#   4. push --force-with-lease     — 推送触发 Vercel 部署
#   5. checkout main               — 回主分支
#
# 前置校验：
#   - 当前必须在 main 分支
#   - working tree 必须 clean
#   - 本地 main 必须与 origin/main 同步
#
# all 模式下，单条分支失败不影响其他分支；最终汇总成功/失败列表。

VALID_BRANCHES="testnet dev pre"

usage() {
  echo "Usage: $0 <testnet|dev|pre|all>" >&2
  exit 1
}

[ $# -eq 1 ] || usage

case "$1" in
  testnet|dev|pre) TARGETS="$1" ;;
  all)             TARGETS="$VALID_BRANCHES" ;;
  *)               usage ;;
esac

# 1. 校验 current branch = main
CUR=$(git rev-parse --abbrev-ref HEAD)
if [ "$CUR" != "main" ]; then
  echo "❌ 当前分支：$CUR — 请先 git checkout main" >&2
  exit 1
fi

# 2. 校验 working tree clean
if [ -n "$(git status --porcelain)" ]; then
  echo "❌ 工作区有未提交改动 — 请先提交或 stash" >&2
  exit 1
fi

# 3. 校验 main 与 origin/main 同步
git fetch origin main --quiet
LOCAL=$(git rev-parse main)
REMOTE=$(git rev-parse origin/main)
if [ "$LOCAL" != "$REMOTE" ]; then
  echo "❌ 本地 main ≠ origin/main — 请先 push main" >&2
  echo "   local : $LOCAL" >&2
  echo "   remote: $REMOTE" >&2
  exit 1
fi

DATE=$(date +%Y-%m-%d)
SYNCED=()
FAILED=()

sync_one() {
  local B="$1"

  echo ""
  echo "=== Syncing $B ==="

  # 分支必须存在（本地或远端）
  if ! git show-ref --verify --quiet "refs/heads/$B" \
     && ! git show-ref --verify --quiet "refs/remotes/origin/$B"; then
    echo "⚠️  分支 $B 不存在，跳过" >&2
    FAILED+=("$B (not found)")
    return
  fi

  if ! git checkout "$B"; then
    FAILED+=("$B (checkout failed)")
    return
  fi

  if ! git reset --hard main; then
    FAILED+=("$B (reset failed)")
    git checkout main
    return
  fi

  if ! git commit --allow-empty -m "deploy($B): 同步 main $DATE"; then
    FAILED+=("$B (commit failed)")
    git checkout main
    return
  fi

  if ! git push --force-with-lease origin "$B"; then
    FAILED+=("$B (push failed)")
    git checkout main
    return
  fi

  SYNCED+=("$B")
  git checkout main
}

for B in $TARGETS; do
  sync_one "$B"
done

echo ""
echo "==============================="
echo "✅ 已同步: ${SYNCED[*]:-（无）}"
if [ ${#FAILED[@]} -gt 0 ]; then
  echo "❌ 失败:   ${FAILED[*]}"
  exit 1
fi
echo "==============================="
