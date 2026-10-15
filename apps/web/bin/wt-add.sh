#!/usr/bin/env bash
set -euo pipefail

# ENH-013 · 创建 git worktree 并 symlink 个人/运行时文件
#
# Usage: bin/wt-add.sh <name> <branch>
#   name:   worktree 目录名（会创建在 .claude/worktrees/<name>）
#   branch: 分支名（存在则 checkout，不存在则从当前 HEAD 创建）
#
# 自动 symlink 回主工作目录：
#   .env.local                      — 默认 env（pnpm dev）
#   .env.dev.local                  — dev:test env（端口 4001，主工作区存在才 link）
#   .env.testnet.local              — dev:testnet env（端口 4002，主工作区存在才 link）
#   .env.earlybird.local            — dev:earlybird env（端口 4003，主工作区存在才 link）
#   .claude/settings.local.json     — 个人 Bash/MCP 允许清单
#   .claude/skills                  — 个人工作流 skill 资源（104MB，共享复用）
#
# ⚠️ 缺 .env.testnet.local 时 dotenv 静默回落到默认 env，导致 dev:testnet 实际跑 mainnet
#    （NEXT_PUBLIC_NETWORK_MODE 空 → lib/network-mode.ts 安全回落 mainnet）。

if [ $# -lt 2 ]; then
  echo "Usage: $0 <worktree-name> <branch-name>" >&2
  exit 1
fi

NAME="$1"
BRANCH="$2"
WT_DIR=".claude/worktrees/$NAME"

# 1. 创建 worktree（存在分支则 checkout，否则新建）
if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  git worktree add "$WT_DIR" "$BRANCH"
else
  git worktree add "$WT_DIR" -b "$BRANCH"
fi

# 2. Symlink 个人/运行时文件
# Worktree 位于 .claude/worktrees/<name>/，回主目录需 ../../../
REPO_ROOT="$(pwd)"
cd "$WT_DIR"

LINKED=()
ln -sf ../../../.env.local .env.local && LINKED+=(".env.local")

# 多环境 env：仅当主工作区存在时才 symlink，缺失时静默跳过
for ENV_FILE in .env.dev.local .env.testnet.local .env.earlybird.local; do
  if [ -f "$REPO_ROOT/$ENV_FILE" ]; then
    ln -sf "../../../$ENV_FILE" "$ENV_FILE"
    LINKED+=("$ENV_FILE")
  fi
done

mkdir -p .claude
ln -sf ../../../../.claude/settings.local.json .claude/settings.local.json && LINKED+=(".claude/settings.local.json")
ln -sf ../../../../.claude/skills .claude/skills && LINKED+=(".claude/skills/")

echo ""
echo "✅ Worktree created at $WT_DIR"
echo "   Branch:    $BRANCH"
echo "   Symlinked: ${LINKED[*]}"
