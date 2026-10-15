#!/usr/bin/env bash
#
# prune-old-images.sh — 清理 prod EC2 上自己 namespace 的旧 docker 镜像
#
# 范围：仅 `hankdong/account-web-api:prod_dd003-v*` tag
#   - **不**碰 herongwei / knightjohn257 / provectuslabs 等其他人维护的镜像
#   - **不**做 `docker image prune -a`（无差别清理太危险）
#
# 策略：按 Created 时间倒序保留最近 N（默认 3）个 tag，其余删除。
#   保留 3 个 = 当前 + 上一版（回滚用）+ 上上版（应急二次回滚）。
#
# 安全保护：
#   - docker 自己拒绝删除被运行容器引用的 image（即便它在删除列表里）
#   - 默认 dry-run，需要 --apply 才真删
#
# 用法：
#   ./prune-old-images.sh           # dry-run，列出将被删的 tag
#   ./prune-old-images.sh --apply   # 真删
#   ./prune-old-images.sh --keep 5  # 改保留数量
#
# 部署：oddfi-backend EC2 /usr/local/bin/prune-old-images.sh
# Cron 建议：每周日 04:00 跑 --apply（避开 03:00 备份）

set -euo pipefail

NAMESPACE="hankdong/account-web-api"
TAG_PREFIX="prod_dd003-"
KEEP=3
APPLY=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --apply) APPLY=1; shift ;;
    --keep)  KEEP="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: $0 [--apply] [--keep N]"
      exit 0 ;;
    *) echo "unknown arg: $1" >&2; exit 1 ;;
  esac
done

echo "▶ namespace : $NAMESPACE"
echo "▶ tag prefix: $TAG_PREFIX*"
echo "▶ keep      : $KEEP most-recent tags"
echo "▶ mode      : $([ $APPLY -eq 1 ] && echo APPLY || echo DRY-RUN)"

# REV-002 M5：抽当前 prod 容器在跑的 tag，强制保护
# （用户改 --keep 1 时也可能误删运行中 tag，docker 拒删但容器重启后会 puff）
RUNNING_TAG=""
RUNNING_FULL=$(sudo docker inspect web-api --format '{{.Config.Image}}' 2>/dev/null || echo "")
if [[ -n "$RUNNING_FULL" && "$RUNNING_FULL" == "$NAMESPACE:"* ]]; then
  RUNNING_TAG="${RUNNING_FULL#${NAMESPACE}:}"
  echo "▶ running   : $RUNNING_TAG (force-protected, 不会被删除)"
fi
echo ""

# 按 CreatedAt 时间倒序列出匹配 tag（最新在前）
mapfile -t TAGS < <(
  sudo docker images "$NAMESPACE" --format '{{.Tag}}\t{{.CreatedAt}}' \
    | grep -E "^${TAG_PREFIX}" \
    | sort -k2,2 -r \
    | awk '{print $1}'
)

if (( ${#TAGS[@]} == 0 )); then
  echo "ℹ️  no matching tags, nothing to do"
  exit 0
fi

echo "▶ matching tags（最新在前）:"
for i in "${!TAGS[@]}"; do
  marker=$([ $i -lt $KEEP ] && echo "  保留" || echo "🗑 删除")
  echo "  [$i] $marker  ${NAMESPACE}:${TAGS[$i]}"
done
echo ""

if (( ${#TAGS[@]} <= KEEP )); then
  echo "✅ tag 总数 ${#TAGS[@]} ≤ keep $KEEP，无需删除"
  exit 0
fi

TO_DELETE=()
for t in "${TAGS[@]:$KEEP}"; do
  if [[ -n "$RUNNING_TAG" && "$t" == "$RUNNING_TAG" ]]; then
    echo "  ⚠️  跳过 ${NAMESPACE}:${t}（当前 prod 容器在跑，force-protected）"
    continue
  fi
  TO_DELETE+=("$t")
done
echo "▶ 计划删除 ${#TO_DELETE[@]} 个 tag"

if [[ $APPLY -eq 0 ]]; then
  echo ""
  echo "💡 这是 dry-run，加 --apply 真删"
  exit 0
fi

# 真删（docker 会拒删被引用的 image）
for tag in "${TO_DELETE[@]}"; do
  echo "▶ rmi ${NAMESPACE}:${tag}"
  if sudo docker rmi "${NAMESPACE}:${tag}" 2>&1; then
    echo "  ✅ done"
  else
    echo "  ⚠️ skip（可能被容器引用）"
  fi
done

echo ""
echo "▶ 同时清理悬空层（dangling，无 tag 的 image layer）"
sudo docker image prune -f

echo "✅ prune-old-images: done"
