#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SWAG_VERSION="${SWAG_VERSION:-v1.16.6}"

run_swag() {
  local service_dir="$1"
  shift

  echo "==> generating swagger for ${service_dir}"
  (
    cd "${ROOT_DIR}/${service_dir}"
    # 文档只输出 json/yaml，避免生成 Go docs 包影响服务运行时依赖和二进制体积。
    go run "github.com/swaggo/swag/cmd/swag@${SWAG_VERSION}" init "$@" --outputTypes json,yaml
  )
}

run_swag "oddfi-web-api" \
  -g main.go \
  -d . \
  -o docs/swagger

run_swag "web-api" \
  -g main.go \
  -d cmd/server,internal/handler,internal/model \
  -o docs/swagger \
  --parseInternal

echo "==> swagger files generated"
