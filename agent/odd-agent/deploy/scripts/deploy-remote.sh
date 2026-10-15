#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/odd_agent}"
RELEASE_DIR="${APP_DIR}/releases/$(date -u +%Y%m%d%H%M%S)"
CURRENT_DIR="${APP_DIR}/current"
LOG_DIR="${LOG_DIR:-/data/logs/odd_agent}"
CENTRIFUGO_DIR="${CENTRIFUGO_DIR:-/opt/centrifugo}"

if [[ ! -f package.json ]]; then
  echo "deploy-remote.sh must run from the odd_agent project root" >&2
  exit 1
fi

sudo mkdir -p "${APP_DIR}/releases" "${LOG_DIR}" "${CENTRIFUGO_DIR}"
sudo chown -R "$(id -u):$(id -g)" "${APP_DIR}" "${LOG_DIR}" "${CENTRIFUGO_DIR}"

npm ci
npm run build

mkdir -p "${RELEASE_DIR}"
rsync -a \
  --exclude ".git" \
  --exclude "._*" \
  --exclude "__MACOSX" \
  --exclude "node_modules" \
  --exclude "logs" \
  --exclude "tmp" \
  --exclude "coverage" \
  ./ "${RELEASE_DIR}/"

cd "${RELEASE_DIR}"
npm ci --omit=dev

mkdir -p config
if [[ ! -f "${APP_DIR}/shared/odd-agent.yaml" ]]; then
  echo "Missing ${APP_DIR}/shared/odd-agent.yaml runtime config" >&2
  exit 1
fi
cp "${APP_DIR}/shared/odd-agent.yaml" config/odd-agent.yaml
mkdir -p dist/config
cp "${APP_DIR}/shared/odd-agent.yaml" dist/config/odd-agent.yaml
mkdir -p dist/db
cp -R db/migrations dist/db/migrations

node dist/src/bin/migrate.js

ln -sfn "${RELEASE_DIR}" "${CURRENT_DIR}"
sudo cp "${CURRENT_DIR}/deploy/systemd/odd-agent.service" /etc/systemd/system/odd-agent.service

sudo mkdir -p "${CENTRIFUGO_DIR}"
cp "${CURRENT_DIR}/deploy/centrifugo/docker-compose.yml" "${CENTRIFUGO_DIR}/docker-compose.yml"
if [[ ! -f "${CENTRIFUGO_DIR}/config.json" ]]; then
  cp "${CURRENT_DIR}/deploy/centrifugo/config.example.json" "${CENTRIFUGO_DIR}/config.json"
  echo "Created ${CENTRIFUGO_DIR}/config.json from example. Replace secrets before starting." >&2
fi
sudo cp "${CURRENT_DIR}/deploy/systemd/centrifugo.service" /etc/systemd/system/centrifugo.service

sudo systemctl daemon-reload
sudo systemctl enable centrifugo.service odd-agent.service
sudo systemctl restart centrifugo.service
sudo systemctl restart odd-agent.service
sudo systemctl --no-pager --full status centrifugo.service odd-agent.service
