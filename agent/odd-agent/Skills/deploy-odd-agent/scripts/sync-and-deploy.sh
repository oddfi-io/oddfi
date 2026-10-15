#!/usr/bin/env bash
# 本机一键部署：把当前 odd_agent 工作树同步到目标机并触发远端构建发布。
#
# 背景：仓库自带的 deploy/scripts/deploy-remote.sh 只覆盖「在目标机仓库根目录之后」的步骤，
# 缺失「本机代码如何到目标机」这前置一步。历史上靠手工 rsync 到 /tmp 下随机命名的 stage 目录
# （odd-sync / odd_agent_deploy_src / odd_agent_source / odd_agent_src 各部署一个名），本脚本
# 把这步标准化：统一 stage 目录 + 统一排除规则 + 同步后远程执行官方部署脚本 + 远程只读验收。
#
# 用法：
#   bash Skills/deploy-odd-agent/scripts/sync-and-deploy.sh
#   REMOTE=oddfi-market STAGE=/tmp/odd_agent_src bash Skills/deploy-odd-agent/scripts/sync-and-deploy.sh
#   DRY_RUN=1 bash ...   # 只打印将要执行的动作，不真正同步/部署
set -euo pipefail

REMOTE="${REMOTE:-oddfi-market}"        # ~/.ssh/config 别名，禁止写 -i 绝对路径
STAGE="${STAGE:-/tmp/odd_agent_src}"    # 目标机统一 stage 目录（取代历史 4 个随机命名）
DRY_RUN="${DRY_RUN:-0}"

# 脚本位于 Skills/deploy-odd-agent/scripts/，向上三级即仓库根。
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
if [[ ! -f "${REPO_ROOT}/package.json" ]]; then
  echo "未在 ${REPO_ROOT} 找到 package.json，确认脚本位置未被移动" >&2
  exit 1
fi

# 排除规则与 deploy-remote.sh 内部 rsync 对齐，并额外剔除 macOS AppleDouble（._* 会被 migration
# runner 误当成 SQL 执行）、本地真实配置（含 secret，目标机用 shared/odd-agent.yaml 覆盖）、
# 以及 .omc / .claude 等本地工具状态。
RSYNC_EXCLUDES=(
  --exclude '.git'
  --exclude 'node_modules'
  --exclude 'dist'
  --exclude 'logs'
  --exclude 'tmp'
  --exclude 'coverage'
  --exclude '.DS_Store'
  --exclude '._*'
  --exclude '__MACOSX'
  --exclude '.omc'
  --exclude '.claude'
  --exclude 'config/odd-agent.yaml'
)

echo "本机仓库根 : ${REPO_ROOT}"
echo "目标机     : ${REMOTE}"
echo "Stage 目录 : ${STAGE}"
echo "本机分支   : $(git -C "${REPO_ROOT}" branch --show-current 2>/dev/null || echo '非 git')"
echo "本机 HEAD  : $(git -C "${REPO_ROOT}" log --oneline -1 2>/dev/null || echo '-')"
echo

if [[ "${DRY_RUN}" == "1" ]]; then
  echo "[DRY_RUN] rsync -az --delete ${RSYNC_EXCLUDES[*]} ${REPO_ROOT}/ ${REMOTE}:${STAGE}/"
  echo "[DRY_RUN] ssh ${REMOTE} 'cd ${STAGE} && bash deploy/scripts/deploy-remote.sh'"
  echo "[DRY_RUN] 远程验收 health + systemctl is-active"
  exit 0
fi

echo "[1/3] rsync 工作树 -> ${REMOTE}:${STAGE}"
rsync -az --delete "${RSYNC_EXCLUDES[@]}" "${REPO_ROOT}/" "${REMOTE}:${STAGE}/"

echo "[2/3] 远程执行 deploy-remote.sh（npm ci + build + release + migrate + systemd restart）"
ssh "${REMOTE}" "cd ${STAGE} && bash deploy/scripts/deploy-remote.sh"

echo "[3/3] 远程只读验收（轮询等 node 服务 ready，避免刚重启就 curl 的误报）"
ssh "${REMOTE}" 'set -e
  echo "odd-agent : $(systemctl is-active odd-agent.service)"
  echo "centrifugo: $(systemctl is-active centrifugo.service)"
  # node 服务初始化 DB/Pinecone/Memory 需数秒；最多等 30s 再判失败。
  for i in $(seq 1 15); do
    if curl -fsS -m3 http://127.0.0.1:3000/health 2>/dev/null; then echo "  <- health OK"; exit 0; fi
    sleep 2
  done
  echo "  health 30s 内未就绪 → 查 journalctl -u odd-agent.service" >&2; exit 1'
echo "完成。如部署 DD-134，请先按 references/dd-134-deployment.md 补 internal_auth 配置与 SERVICE_TOKEN。"
