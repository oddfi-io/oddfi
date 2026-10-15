#!/usr/bin/env bash
# init-db.sh — 等待 MySQL ready 后执行 DDL，验证表是否创建
# 依赖：docker compose（不依赖本机 mysql 客户端）
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
SQL_FILE="${REPO_ROOT}/oddfi-web-api/scripts/sql/early_access.sql"

COMPOSE="docker compose -f ${SCRIPT_DIR}/docker-compose.yml"
MYSQL_CONTAINER="oddfi-dev-mysql"

echo "[init-db] 等待 MySQL 就绪..."
MAX_WAIT=60
elapsed=0
until ${COMPOSE} exec -T mysql mysqladmin ping -h127.0.0.1 -uroot -p123456 --silent >/dev/null 2>&1; do
  if [ "${elapsed}" -ge "${MAX_WAIT}" ]; then
    echo "[init-db] ERROR: MySQL 未在 ${MAX_WAIT}s 内就绪，退出。"
    exit 1
  fi
  echo "[init-db] 等待中... (${elapsed}s)"
  sleep 3
  elapsed=$((elapsed + 3))
done
echo "[init-db] MySQL 就绪。"

echo "[init-db] 执行 DDL: ${SQL_FILE}"
${COMPOSE} exec -T mysql mysql -uroot -p123456 oddfi_dev < "${SQL_FILE}"

echo "[init-db] 验证表结构..."
${COMPOSE} exec -T mysql mysql -uroot -p123456 oddfi_dev -e "DESCRIBE early_access_registrations;"

echo "[init-db] 完成。表 early_access_registrations 已就绪。"
