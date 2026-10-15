#!/usr/bin/env bash
# 自动重新生成 .progress/designs/INDEX.md
# 用法: bash bin/update-designs-index.sh
# 或: pnpm update-designs-index

set -euo pipefail

DESIGNS_DIR="$(cd "$(dirname "$0")/.." && pwd)/.progress/designs"
INDEX_FILE="$DESIGNS_DIR/INDEX.md"
TODAY=$(date '+%Y-%m-%d')

# ── 统计归档数 ──────────────────────────────────────────────
archive_old=$(ls "$DESIGNS_DIR/archive/" 2>/dev/null | grep -v implemented | grep -v INDEX | wc -l | tr -d ' ')
archive_impl=$(ls "$DESIGNS_DIR/archive/implemented/" 2>/dev/null | wc -l | tr -d ' ')
archive_total=$((archive_old + archive_impl))

# ── 生成表格行（直接在 find loop 中拼接，写到临时文件）──────
tmp_rows=$(mktemp)

while IFS= read -r dir; do
  folder=$(basename "$dir")
  main_md=$(find "$dir" -maxdepth 1 -name '*.md' \
    ! -name 'INDEX.md' ! -name 'CHANGES.md' ! -name 'TEST_PLAN.md' \
    ! -name 'ACCEPTANCE.md' ! -name 'enh-todo*' \
    2>/dev/null | sort | head -1)

  if [[ -z "$main_md" ]]; then
    title="(无主文档)"
    dd_status="Draft"
  else
    title=$(grep -m1 '^# ' "$main_md" 2>/dev/null | sed 's/^# //' | sed 's/\*\*//g' || echo "$folder")
    dd_status=$(grep -m1 '\*\*Status\*\*' "$main_md" 2>/dev/null \
      | sed 's/.*\*\*Status\*\*[[:space:]]*:[[:space:]]*//' \
      | sed 's/[|[:space:]]*$//' \
      | sed 's/\*\*//g' \
      || echo "Draft")
    [[ -z "$dd_status" ]] && dd_status="Draft"
  fi

  echo "| [${folder}](./${folder}/) | ${title} | ${dd_status} |" >> "$tmp_rows"
done < <(find "$DESIGNS_DIR" -maxdepth 1 -type d -name 'DD-*' | sort)

active_count=$(wc -l < "$tmp_rows" | tr -d ' ')
table_rows=$(cat "$tmp_rows")
rm -f "$tmp_rows"

# ── 写入 INDEX.md ────────────────────────────────────────────
cat > "$INDEX_FILE" <<EOF
# designs/ — 索引

> **用途**：DD（Design Document）新功能设计文档
> **读取时机**：开始实现某功能前读对应 DD；Review 前查阅方案背景
> 最后更新：${TODAY} | 活跃 ${active_count} 个 / 归档 ${archive_total} 个

## 活跃文档

| 文件 | 摘要 | 状态 |
|------|------|------|
${table_rows}
## 归档文档 (\`archive/\`)

> ${archive_old} 个归档 DD（旧格式）+ ${archive_impl} 个 implemented DD（\`archive/implemented/\`）= ${archive_total} 个
> 详见 \`archive/INDEX.md\`
EOF

echo "✓ INDEX.md 已更新：活跃 ${active_count} 个 / 归档 ${archive_total} 个 (${TODAY})"
