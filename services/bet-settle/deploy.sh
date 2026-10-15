#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${APP_NAME:-oddfi-bet-settle}"
CONTAINER_NAME="${CONTAINER_NAME:-oddfi-bet-settle}"
REGISTRY="${REGISTRY:-}"
TAG="${TAG:-$(git rev-parse --short HEAD 2>/dev/null || date +%Y%m%d%H%M%S)}"
ACTION="${1:-restart}"

if [[ -n "${REGISTRY}" ]]; then
  IMAGE="${REGISTRY}/${APP_NAME}:${TAG}"
else
  IMAGE="${APP_NAME}:${TAG}"
fi

usage() {
  cat <<EOF
Usage: ./deploy.sh [build|push|run|restart]

Env:
  APP_NAME        default: oddfi-bet-settle
  CONTAINER_NAME  default: oddfi-bet-settle
  REGISTRY        optional docker registry prefix
  TAG             default: current git short sha

Examples:
  ./deploy.sh build
  REGISTRY=registry.example.com/backend TAG=v1.0.0 ./deploy.sh push
  TAG=prod ./deploy.sh restart
EOF
}

build_image() {
  docker build -t "${IMAGE}" .
}

push_image() {
  build_image
  docker push "${IMAGE}"
}

run_container() {
  # 部署脚本只启动 worker 容器，不映射端口；正式 API 由 web-api 服务承接。
  docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true
  docker run -d \
    --name "${CONTAINER_NAME}" \
    --restart unless-stopped \
    -e TZ=Asia/Shanghai \
    "${IMAGE}"
}

case "${ACTION}" in
  build)
    build_image
    ;;
  push)
    push_image
    ;;
  run)
    run_container
    ;;
  restart)
    build_image
    run_container
    ;;
  -h|--help|help)
    usage
    ;;
  *)
    usage
    echo "[ERROR] unknown action: ${ACTION}" >&2
    exit 1
    ;;
esac
