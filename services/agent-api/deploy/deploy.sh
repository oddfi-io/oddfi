#!/usr/bin/env bash
# oddfi-agent-backend 服务器侧部署脚本
#
# 用法：
#   bash deploy.sh prod                          # 拉 :prod 标签
#   bash deploy.sh dev                           # 拉 :dev_latest 标签
#   bash deploy.sh prod prod_20260519_v1         # 回滚到指定历史 tag
#   IMAGE_NAMESPACE=alice bash deploy.sh dev     # 用别人的 dockerhub 账号
#
# 前置一次性操作（首次部署，需 sudo）：
#   sudo install -d -o 1000 -g 1000 -m 700 /var/lib/oddfi-agent-backend/prod
#   sudo install -d -o 1000 -g 1000 -m 700 /var/lib/oddfi-agent-backend/dev
#
# uid 1000 与 Dockerfile 内 app 用户严格一致；EC2 ubuntu 用户通常也是 1000
# 但脚本会显式校验（M-1 防 root 跑容器 + Dockerfile/host uid 漂移）。
#
# 部署遵循 DD-002 §3.4：校验 → prune dangling → pull → 替换 → healthz → 失败回滚提示

set -euo pipefail

# ── 输入校验 ────────────────────────────────
ENV="${1:?usage: deploy.sh <prod|dev> [tag]}"
TAG_INPUT="${2:-}"

case "$ENV" in
  prod)
    DEFAULT_TAG="prod"
    ENV_FILE="/home/ubuntu/oddfi-agent-backend/.env.prod"
    MEM_LIMIT="512m"
    ;;
  dev)
    DEFAULT_TAG="dev_latest"
    ENV_FILE="/home/ubuntu/oddfi-agent-backend/.env.dev"
    MEM_LIMIT="256m"
    ;;
  *)
    echo "[Deploy] unknown env: $ENV (expected prod|dev)" >&2
    exit 1
    ;;
esac

TAG="${TAG_INPUT:-$DEFAULT_TAG}"
NAMESPACE="${IMAGE_NAMESPACE:-hankdong}"

# 白名单校验 namespace / tag，防供应链注入 / 日志污染（M2 安全）
if ! [[ "$NAMESPACE" =~ ^[a-z0-9_.-]{2,64}$ ]]; then
  echo "[Deploy] invalid IMAGE_NAMESPACE: $NAMESPACE" >&2
  exit 1
fi
if ! [[ "$TAG" =~ ^[A-Za-z0-9._-]{1,128}$ ]]; then
  echo "[Deploy] invalid tag: $TAG" >&2
  exit 1
fi

IMAGE="${NAMESPACE}/oddfi-agent-backend:${TAG}"
CONTAINER="oddfi-agent-backend"
DATA_DIR="/var/lib/oddfi-agent-backend/${ENV}"

# ── 用户身份守卫（M-1）：禁止 root 直接跑（避免容器以 root + host network 出风险） ──
if [ "$(id -u)" = "0" ]; then
  echo "[Deploy] do not run as root; switch to ubuntu user (uid=1000)" >&2
  exit 1
fi
if [ "$(id -u)" != "1000" ]; then
  echo "[Deploy] warning: current uid=$(id -u), expected 1000 — /data write may fail" >&2
fi

echo "[Deploy] ── config ────────────────────"
echo "[Deploy]   env       : $ENV"
echo "[Deploy]   image     : $IMAGE"
echo "[Deploy]   container : $CONTAINER"
echo "[Deploy]   data_dir  : $DATA_DIR"
echo "[Deploy]   env_file  : $ENV_FILE"
echo "[Deploy]   mem_limit : $MEM_LIMIT"
echo "[Deploy] ────────────────────────────────"

# ── 前置防御 ────────────────────────────────
[ -f "$ENV_FILE" ] || { echo "[Deploy] missing env file: $ENV_FILE"; exit 1; }
if [ ! -d "$DATA_DIR" ]; then
  echo "[Deploy] missing data dir: $DATA_DIR"
  echo "[Deploy]   run once: sudo install -d -o 1000 -g 1000 -m 700 $DATA_DIR"
  exit 1
fi

# ── 拉新镜像（先拉再清，pull 失败时旧 image 仍可用作回滚源） ──
echo "[Deploy] pulling $IMAGE ..."
docker pull "$IMAGE"

# ── 清理 dangling 镜像（去 -a 避免误删 sibling 项目镜像，仅清未被引用层） ──
echo "[Deploy] pruning dangling images (> 72h) ..."
docker image prune -f --filter "until=72h" || true
docker container prune -f --filter "until=72h" || true

# ── 备份旧容器名 → 启新 → 失败回滚 ────────────
if docker ps -a --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "[Deploy] renaming current container to ${CONTAINER}_prev (rollback safety) ..."
  docker stop "$CONTAINER" 2>/dev/null || true
  docker rm -f "${CONTAINER}_prev" 2>/dev/null || true
  docker rename "$CONTAINER" "${CONTAINER}_prev" 2>/dev/null || true
fi

echo "[Deploy] starting new container ..."
# 注意：不传 --user —— Dockerfile USER app(uid=1000) 生效，与宿主 DATA_DIR owner=1000 严格一致
# --network host 与 sibling web-api 一致；后端代码层只 listen 127.0.0.1:8090（DD-002 约束）
docker run -d \
  --name "$CONTAINER" \
  --network host \
  --restart always \
  --memory="$MEM_LIMIT" \
  --memory-swap="$MEM_LIMIT" \
  --env-file "$ENV_FILE" \
  -v "$DATA_DIR":/data \
  "$IMAGE"

# ── 健康检查（retry loop 替代固定 sleep；冷启动 / Kimi 初始化偶发慢） ──
echo "[Deploy] waiting for healthz ..."
OK=0
for i in {1..15}; do
  if curl -sf --max-time 3 http://127.0.0.1:8090/healthz >/dev/null 2>&1; then
    OK=1
    break
  fi
  sleep 1
done

if [ "$OK" != "1" ]; then
  echo "[Deploy] healthz FAILED — dumping last 80 lines:"
  docker logs --tail 80 "$CONTAINER" || true
  echo "[Deploy] rolling back: keeping ${CONTAINER}_prev for manual recovery"
  echo "[Deploy]   manual rollback:"
  echo "[Deploy]     docker stop $CONTAINER && docker rm $CONTAINER"
  echo "[Deploy]     docker rename ${CONTAINER}_prev $CONTAINER"
  echo "[Deploy]     docker start $CONTAINER"
  exit 1
fi

echo "[Deploy] healthz OK"

# 健康通过 → 删掉旧容器
docker rm -f "${CONTAINER}_prev" 2>/dev/null || true

echo "[Deploy] recent logs:"
docker logs --tail 20 "$CONTAINER"

echo "[Deploy] done — image=$IMAGE"
