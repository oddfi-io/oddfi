#!/usr/bin/env bash
# oddfi-agent-backend 本地构建并推送到 dockerhub
#
# 用法：
#   bash deploy/build-push.sh dev          # 推 dev_latest + dev_YYYYMMDD_<sha>
#   bash deploy/build-push.sh prod         # 推 prod + prod_YYYYMMDD_<sha>
#   IMAGE_NAMESPACE=alice bash deploy/build-push.sh dev   # 用自己的账号
#
# 前置：
#   1. docker login
#   2. macOS Apple Silicon → 强制 --platform linux/amd64（服务器是 amd64）

set -euo pipefail

cd "$(dirname "$0")/.."  # 回到仓库根

ENV="${1:?usage: build-push.sh <prod|dev>}"
DATE="$(date +%Y%m%d)"
SHA="$(git rev-parse --short=8 HEAD 2>/dev/null || echo nogit)"

case "$ENV" in
  prod)
    TAG="prod"
    DATED_TAG="prod_${DATE}_${SHA}"
    ;;
  dev)
    TAG="dev_latest"
    DATED_TAG="dev_${DATE}_${SHA}"
    ;;
  *)
    echo "[Build] unknown env: $ENV (expected prod|dev)" >&2
    exit 1
    ;;
esac

NAMESPACE="${IMAGE_NAMESPACE:-hankdong}"

# 校验 namespace 防供应链注入（M2）
if ! [[ "$NAMESPACE" =~ ^[a-z0-9_.-]{2,64}$ ]]; then
  echo "[Build] invalid IMAGE_NAMESPACE: $NAMESPACE" >&2
  exit 1
fi

IMAGE="${NAMESPACE}/oddfi-agent-backend"

echo "[Build] ── config ────────────────────"
echo "[Build]   image     : $IMAGE"
echo "[Build]   tags      : $TAG, $DATED_TAG"
echo "[Build]   platform  : linux/amd64"
echo "[Build] ────────────────────────────────"

# --provenance=false / --sbom=false 避免 dockerhub 多出 attestation manifest（M9）
# 不用 --cache-to=type=registry：dockerhub free tier 不兼容 OCI cache manifest，
# 实测会在 cache export 阶段返回 400 Bad Request 并连带回卷主 image push。
# 如需复用层加速，用本地 cache：--cache-to type=local,dest=/tmp/buildx-cache,mode=max
echo "[Build] buildx + push ..."
docker buildx build \
  --platform linux/amd64 \
  --provenance=false \
  --sbom=false \
  -t "${IMAGE}:${TAG}" \
  -t "${IMAGE}:${DATED_TAG}" \
  --push \
  .

echo "[Build] pushed ${IMAGE}:${TAG} and ${IMAGE}:${DATED_TAG}"
echo ""
echo "[Build] next: ssh into server and run"
echo "[Build]   bash /home/ubuntu/oddfi-agent-backend/deploy.sh $ENV"
