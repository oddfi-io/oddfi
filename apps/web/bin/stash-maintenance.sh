#!/usr/bin/env bash
# .progress/stash/ 周期性归档脚本
#
# 用法：
#   bin/stash-maintenance.sh            → dry-run，仅展示待归档列表
#   bin/stash-maintenance.sh --execute  → 实际执行归档
#   bin/stash-maintenance.sh --days N   → 修改过期阈值（默认 7 天）

set -euo pipefail

STASH_DIR=".progress/stash"
ARCHIVE_BASE="$STASH_DIR/archive"

DAYS=7
EXECUTE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --execute) EXECUTE=true; shift ;;
    --days)    DAYS="$2"; shift 2 ;;
    *) echo "未知参数: $1"; exit 1 ;;
  esac
done

WEEK_TAG=$(date +%Y-W%V)
ARCHIVE_DIR="$ARCHIVE_BASE/$WEEK_TAG"
MTIME_THRESHOLD="$((DAYS - 1))"

# 统计过期文件/目录
STALE_FILES=$(find "$STASH_DIR" -maxdepth 1 -type f -mtime +"$MTIME_THRESHOLD" \
  ! -name "INDEX.md" 2>/dev/null)
STALE_DIRS=$(find "$STASH_DIR" -maxdepth 1 -mindepth 1 -type d \
  ! -path "$ARCHIVE_BASE" -mtime +"$MTIME_THRESHOLD" 2>/dev/null)

FILE_COUNT=$(echo "$STALE_FILES" | grep -c . 2>/dev/null || echo 0)
DIR_COUNT=$(echo "$STALE_DIRS" | grep -c . 2>/dev/null || echo 0)
[[ -z "$STALE_FILES" ]] && FILE_COUNT=0
[[ -z "$STALE_DIRS" ]] && DIR_COUNT=0
TOTAL=$((FILE_COUNT + DIR_COUNT))

echo ""
echo "╔══════════════════════════════════════════════════"
echo "║  .progress/stash/ 归档预检  (阈值: ${DAYS} 天)"
echo "║  归档目标: $ARCHIVE_DIR"
echo "╚══════════════════════════════════════════════════"
echo ""

if [[ $TOTAL -eq 0 ]]; then
  echo "✅ 无需归档：没有超过 ${DAYS} 天未操作的文件/目录"
  echo ""
  exit 0
fi

if [[ $FILE_COUNT -gt 0 ]]; then
  echo "📦 待归档文件（${FILE_COUNT} 个）："
  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    MTIME=$(stat -f "%Sm" -t "%Y-%m-%d" "$f" 2>/dev/null || date -r "$f" "+%Y-%m-%d" 2>/dev/null || echo "unknown")
    printf "   %-50s  最后修改: %s\n" "$(basename "$f")" "$MTIME"
  done <<< "$STALE_FILES"
fi

if [[ $DIR_COUNT -gt 0 ]]; then
  echo ""
  echo "📁 待归档目录（${DIR_COUNT} 个）："
  while IFS= read -r d; do
    [[ -z "$d" ]] && continue
    MTIME=$(stat -f "%Sm" -t "%Y-%m-%d" "$d" 2>/dev/null || date -r "$d" "+%Y-%m-%d" 2>/dev/null || echo "unknown")
    printf "   %-50s  最后修改: %s\n" "$(basename "$d")/" "$MTIME"
  done <<< "$STALE_DIRS"
fi

echo ""

if [[ "$EXECUTE" == "false" ]]; then
  echo "ℹ️  Dry-run 模式。加 --execute 执行归档："
  echo "   bin/stash-maintenance.sh --execute"
  echo ""
  exit 0
fi

# ── 执行归档 ──────────────────────────────────────────
mkdir -p "$ARCHIVE_DIR"
ARCHIVED=0

if [[ $FILE_COUNT -gt 0 ]]; then
  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    mv "$f" "$ARCHIVE_DIR/"
    echo "  ✓ 已归档: $(basename "$f")"
    ARCHIVED=$((ARCHIVED + 1))
  done <<< "$STALE_FILES"
fi

if [[ $DIR_COUNT -gt 0 ]]; then
  while IFS= read -r d; do
    [[ -z "$d" ]] && continue
    mv "$d" "$ARCHIVE_DIR/"
    echo "  ✓ 已归档: $(basename "$d")/"
    ARCHIVED=$((ARCHIVED + 1))
  done <<< "$STALE_DIRS"
fi

# 写 archive 索引
INDEX="$ARCHIVE_DIR/INDEX.md"
{
  echo "# 归档记录 — $WEEK_TAG"
  echo ""
  echo "归档时间：$(date '+%Y-%m-%d %H:%M')"
  echo "过期阈值：${DAYS} 天未操作"
  echo "文件数量：${ARCHIVED}"
  echo ""
  echo "## 文件列表"
  ls -1 "$ARCHIVE_DIR" | grep -v "INDEX.md" | while IFS= read -r name; do
    echo "- $name"
  done
} > "$INDEX"

echo ""
echo "✅ 归档完成：共 ${ARCHIVED} 个文件/目录 → $ARCHIVE_DIR"
echo ""
