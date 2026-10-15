#!/usr/bin/env bash
#
# DD-003 prod binary 构建脚本（Mac M 系列 → Linux amd64 交叉编译）
#
# 用法：
#   cd /Users/hang/work/oddfi-backend
#   ./web-api/deploy/build-prod-binary.sh [server|presale-worker]
#
# 默认构建 server；指定 presale-worker 构建独立 worker。
# 产物：web-api/bin/<name>-linux-amd64
#
# 设计依据：feedback_docker_deploy_arch（Mac M 必须 multi-arch；DD-001 5/14 事故经验）。
# CGO_ENABLED=0 避免 glibc 依赖；GOFLAGS -trimpath 不在 binary 里嵌本地路径。

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WEB_API_DIR="$REPO_ROOT/web-api"
BIN_DIR="$WEB_API_DIR/bin"

TARGET="${1:-server}"

case "$TARGET" in
    server)
        CMD_PATH="./cmd/server"
        OUT_NAME="web-api-linux-amd64"
        ;;
    presale-worker)
        CMD_PATH="./cmd/presale-worker"
        OUT_NAME="presale-worker-linux-amd64"
        ;;
    *)
        echo "❌ 未知 target: $TARGET（支持 server / presale-worker）"
        exit 2
        ;;
esac

mkdir -p "$BIN_DIR"

COMMIT=$(cd "$REPO_ROOT" && git rev-parse --short HEAD)
BUILD_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ)
GO_VERSION=$(go version | awk '{print $3}')

# go.mod 在 web-api/ 下，必须从这里跑 go build
cd "$WEB_API_DIR"

echo "▶ 目标         : $TARGET"
echo "▶ commit       : $COMMIT"
echo "▶ build_time   : $BUILD_TIME"
echo "▶ go version   : $GO_VERSION"
echo "▶ 输出         : $BIN_DIR/$OUT_NAME"
echo "▶ 平台         : linux/amd64（CGO_ENABLED=0）"
echo

GOOS=linux GOARCH=amd64 CGO_ENABLED=0 \
    go build \
    -trimpath \
    -ldflags "-s -w -X main.gitCommit=$COMMIT -X main.buildTime=$BUILD_TIME" \
    -o "$BIN_DIR/$OUT_NAME" \
    "$CMD_PATH"

echo "✅ 构建完成"
ls -lh "$BIN_DIR/$OUT_NAME"
file "$BIN_DIR/$OUT_NAME" 2>/dev/null || true

echo
echo "下一步（cutover §2.3）："
case "$TARGET" in
    server)
        echo "  scp $BIN_DIR/$OUT_NAME oddfi-backend:/tmp/web-api.new"
        echo "  ssh oddfi-backend 'sudo install -m 755 -o root -g root /tmp/web-api.new /usr/local/bin/web-api && sudo systemctl restart web-api'"
        ;;
    presale-worker)
        echo "  scp $BIN_DIR/$OUT_NAME oddfi-backend:/tmp/presale-worker.new"
        echo "  ssh oddfi-backend 'sudo install -m 755 -o root -g root /tmp/presale-worker.new /usr/local/bin/presale-worker && sudo systemctl restart presale-worker'"
        ;;
esac
