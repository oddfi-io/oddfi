#!/usr/bin/env bash
#
# DD-003 prod Docker 镜像构建 + push 脚本（Mac M 系列 → linux/amd64 多架构 buildx）
#
# 用法：
#   cd /Users/hang/work/oddfi-backend
#   ./web-api/deploy/docker-build-and-push.sh [IMAGE_TAG]
#
# IMAGE_TAG 默认 hankdong/account-web-api:prod
# 也可临时覆盖：
#   ./web-api/deploy/docker-build-and-push.sh hankdong/account-web-api:v1.2.3
#
# 构建上下文是 web-api/ 目录（go.mod 在那里，Dockerfile 期望在此目录下运行）。
# config_prod.yaml 必须存在（gitignored），Dockerfile 会 COPY 进镜像。
#
# 前置条件：
#   1. docker buildx 已初始化 multi-arch builder
#   2. docker login 已完成（herongwei 账号）
#   3. web-api/config_prod.yaml 已填好密钥
#
# 设计依据：feedback_docker_deploy_arch（Mac M 必须 multi-arch；DD-001 5/14 事故经验）。

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WEB_API_DIR="$REPO_ROOT/web-api"
DOCKERFILE="$WEB_API_DIR/Dockerfile"
CONFIG_PROD="$WEB_API_DIR/config_prod.yaml"

IMAGE_TAG="${1:-hankdong/account-web-api:prod}"

# ── 前置检查 ────────────────────────────────────────────────────────────────

echo "▶ 检查 docker login 状态..."
# `docker info` 失败说明 Docker daemon 没跑；credStore 有无 token 靠 docker pull 验
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker daemon 未运行，请先启动 Docker Desktop"
    exit 1
fi
# 简单验证：尝试对目标 registry 执行 token check（不拉镜像，快速失败）
REGISTRY_HOST=$(echo "$IMAGE_TAG" | cut -d'/' -f1)
if ! docker login "$REGISTRY_HOST" --username "${DOCKER_USERNAME:-}" 2>/dev/null | grep -q "Login Succeeded" 2>/dev/null; then
    # 非交互式：检查 credStore 里是否有凭据
    if ! docker system info 2>&1 | grep -q "Username\|Registry: https"; then
        echo "⚠️  无法确认 docker login 状态，请确保已执行 docker login 并有 push 权限"
        echo "   如需登录：docker login -u herongwei"
        echo "   继续构建（push 阶段会报错若未登录）..."
    fi
fi

echo "▶ 检查 config_prod.yaml..."
if [ ! -f "$CONFIG_PROD" ]; then
    echo "❌ 找不到 $CONFIG_PROD"
    echo "   config_prod.yaml 包含密钥，gitignored，需手动创建后才能构建镜像"
    echo "   参考：web-api/docs/dd-invest/ops/dd003-secrets-checklist.md"
    exit 1
fi
echo "   ✅ config_prod.yaml 存在"

echo "▶ 检查 buildx multi-arch builder..."
if ! docker buildx inspect multiarch-builder > /dev/null 2>&1; then
    echo "   builder 'multiarch-builder' 不存在，创建中..."
    docker buildx create --name multiarch-builder --use
    docker buildx inspect --bootstrap
else
    docker buildx use multiarch-builder
    echo "   ✅ 使用已有 builder: multiarch-builder"
fi

# ── 构建信息 ─────────────────────────────────────────────────────────────────

COMMIT=$(cd "$REPO_ROOT" && git rev-parse --short HEAD)
BUILD_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ)

echo
echo "=========================================="
echo "DD-003 Docker 镜像构建 + Push"
echo "=========================================="
echo "▶ image        : $IMAGE_TAG"
echo "▶ platform     : linux/amd64（buildx multi-arch，避坑 Mac M arm64）"
echo "▶ build ctx    : $WEB_API_DIR"
echo "▶ commit       : $COMMIT"
echo "▶ build_time   : $BUILD_TIME"
echo "=========================================="
echo

# ── buildx 构建 + push ───────────────────────────────────────────────────────

# 构建上下文是 web-api/，Dockerfile 里 COPY go.mod / COPY . / COPY config_prod.yaml
# 都相对于该目录，与本地 go.mod 位置一致。
#
# --push 直接推送 manifest（buildx 不像普通 build 会落本地 image layer，
# 如需本地 load 加 --load，但 --load 不支持多架构）。
docker buildx build \
    --platform linux/amd64 \
    --build-arg GIT_COMMIT="$COMMIT" \
    --build-arg BUILD_TIME="$BUILD_TIME" \
    -f "$DOCKERFILE" \
    -t "$IMAGE_TAG" \
    --push \
    "$WEB_API_DIR"

echo
echo "✅ 镜像构建并 push 完成：$IMAGE_TAG"
echo

# ── 下一步提示 ───────────────────────────────────────────────────────────────

echo "下一步：ssh oddfi-backend 跑 docker pull + 替换容器"
echo
echo "  # oddfi-backend 不能直连，需 ProxyJump via oddfi-admin："
echo "  # ~/.ssh/config 建议预先配好："
echo "  #   Host oddfi-backend"
echo "  #     HostName <SERVER_IP>"
echo "  #     User ubuntu"
echo "  #     IdentityFile ~/.ssh/backend-server-key.pem"
echo "  #     ProxyJump oddfi-admin"
echo
echo "  # 前置：/etc/oddfi/config_prod.yaml 已部署到 host（chmod 0400 root）"
echo "  ssh oddfi-backend 'sudo docker pull $IMAGE_TAG'"
echo "  ssh oddfi-backend 'sudo docker stop web-api || true'"
echo "  ssh oddfi-backend 'sudo docker rm web-api   || true'"
echo "  ssh oddfi-backend \\"
echo "    'sudo docker run -d --name web-api --network host --restart unless-stopped \\"
echo "       -v /etc/oddfi/config_prod.yaml:/app/config.yaml:ro \\"
echo "       -e PRESALE_VAULT_POOL=<vault address> \\"
echo "       -e PRESALE_BSC_RPC_URL=<bsc rpc url> \\"
echo "       $IMAGE_TAG'"
echo
echo "  # ⚠️ Phase 3 重构后 config 不在镜像里，必须挂载 host /etc/oddfi/config_prod.yaml"
echo "  # ⚠️ secrets 通过 -v 挂载或 -e 注入，不要 docker inspect 时泄漏到 logs"
echo
echo "  # 验证（稍等 5s 启动）："
echo "  ssh oddfi-backend 'sudo docker logs web-api --tail 30'"
