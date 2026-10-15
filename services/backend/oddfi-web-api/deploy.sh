#!/bin/bash
# 用法: bash deploy.sh [image]
# 默认: herongwei/web-api:latest（向后兼容现有 prod 部署）
# 示例: bash deploy.sh hankdong/oddfi-web-api:latest
set -e

IMAGE="${1:-herongwei/web-api:latest}"
CONTAINER="oddfi-web-api"

echo "🛑 正在停止旧容器..."
docker stop "$CONTAINER" || true
docker rm "$CONTAINER" || true

echo "🏗️ 正在拉取镜像 $IMAGE ..."
docker pull "$IMAGE"

echo "🚀 正在启动新服务..."
docker run -d --name "$CONTAINER" -p 8080:8080 --network host --restart always "$IMAGE"

echo "✅ 部署完成！查看日志："
docker logs --tail 20 "$CONTAINER"