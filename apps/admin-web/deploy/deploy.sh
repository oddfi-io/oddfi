#!/usr/bin/env bash
#
# 前端一键部署 · oddfi-admin-frontend → 生产 admin.oddfi.io
#
# 用法:
#   ./deploy/deploy.sh        # 交互式（部署前需确认）
#   ./deploy/deploy.sh -y     # 跳过确认（或 DEPLOY_YES=1，供 CI/自动化）
#
# 流程: 前置检查 → 构建 → rsync 上传 → sudo 安装(带备份) → 公网验证 → 打部署 tag
# 任何一步失败立即中止（set -euo pipefail）。详见 docs/ops/deploy-runbook.md。
set -euo pipefail

# ── 配置 ─────────────────────────────────────────────
HOST="oddfi-admin"                 # ~/.ssh/config 别名（需免密登录 + 免密 sudo）
REMOTE_DIR="/var/www/oddfi-admin"  # 线上静态根（属主 www-data）
DOMAIN="https://admin.oddfi.io"
TMP_REMOTE="/tmp/oddfi-admin-dist"

# 切到仓库根（脚本位于 deploy/ 下）
cd "$(dirname "$0")/.."

ASSUME_YES="${DEPLOY_YES:-0}"
[ "${1:-}" = "-y" ] && ASSUME_YES=1

say() { printf '\033[1;36m[deploy]\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m[deploy] 失败:\033[0m %s\n' "$*" >&2; exit 1; }

# mTLS 设备准入（docs/ops/mtls-runbook.md）：enforce 开启后公网验证必须带客户端证书。
# 观察模式带不带都行，有证书就统一带上；没有证书且线上 enforce=on 时验证会 403。
MTLS_PEM="$HOME/.config/oddfi-mtls/client.pem"
[ -f "$MTLS_PEM" ] || MTLS_PEM=""
pubcurl() { curl ${MTLS_PEM:+--cert "$MTLS_PEM"} "$@"; }

# ── 1. 前置检查 ───────────────────────────────────────
say "1/6 前置检查"
[ "$(git branch --show-current)" = "main" ] || die "不在 main 分支（当前: $(git branch --show-current)）"
[ -z "$(git status --porcelain)" ] || die "工作区不干净，先提交或暂存"
git pull --ff-only origin main >/dev/null || die "git pull --ff-only 失败（本地 main 与远端分叉？）"
command -v pnpm >/dev/null 2>&1 || die "未找到 pnpm"
ssh -o BatchMode=yes -o ConnectTimeout=8 "$HOST" 'sudo -n true' >/dev/null 2>&1 \
  || die "SSH 到 $HOST 或免密 sudo 不可用"
COMMIT="$(git rev-parse --short HEAD)"
say "    main @ ${COMMIT}，工作区干净，SSH+sudo OK"

# ── 部署前确认（生产）──────────────────────────────────
if [ "$ASSUME_YES" != "1" ]; then
  printf '\033[1;33m将把 %s 部署到生产 %s，继续? [y/N] \033[0m' "$COMMIT" "$DOMAIN"
  read -r ans || true
  [ "$ans" = "y" ] || [ "$ans" = "Y" ] || die "已取消"
fi

# ── 2. 构建 ──────────────────────────────────────────
say "2/6 构建（含测试 guard）"
pnpm install --frozen-lockfile >/tmp/fe-deploy.log 2>&1 || { tail -25 /tmp/fe-deploy.log; die "pnpm install 失败（lockfile 不同步？）"; }
pnpm test >>/tmp/fe-deploy.log 2>&1 || { tail -40 /tmp/fe-deploy.log; die "pnpm test 失败 — 不发版（看 /tmp/fe-deploy.log）"; }
pnpm build >>/tmp/fe-deploy.log 2>&1 || { tail -25 /tmp/fe-deploy.log; die "pnpm build 失败（看 /tmp/fe-deploy.log）"; }
LOCAL_BUNDLE="$(grep -oE 'assets/[^"]+\.js' dist/index.html | head -1)"
[ -n "$LOCAL_BUNDLE" ] || die "dist/index.html 未引用 bundle，构建产物异常"
say "    dist 就绪，bundle = $LOCAL_BUNDLE"

# ── 3. 上传到服务器临时目录 ────────────────────────────
say "3/6 上传 dist → $HOST:$TMP_REMOTE"
rsync -az --delete dist/ "$HOST:$TMP_REMOTE/" || die "rsync 上传失败"

# ── 4. 原子安装到正式目录（旧版备份）──────────────────────
BAK="$REMOTE_DIR.bak.$(date +%s)"
say "4/6 安装到 ${REMOTE_DIR}（旧版备份到 ${BAK}）"
ssh "$HOST" "
  set -e
  sudo rsync -a --delete --backup --backup-dir='$BAK' '$TMP_REMOTE/' '$REMOTE_DIR/'
  sudo chown -R www-data:www-data '$REMOTE_DIR'
  rm -rf '$TMP_REMOTE'
" || die "远程安装失败（旧版未动，可重试）"

# ── 5. 公网验证 ──────────────────────────────────────
say "5/6 公网验证"
SERVED="$(pubcurl -s -m10 "$DOMAIN/?_=$(date +%s)" | grep -oE 'assets/[^"]+\.js' | head -1)"
[ "$SERVED" = "$LOCAL_BUNDLE" ] || die "线上 bundle($SERVED) ≠ 本地($LOCAL_BUNDLE)，部署未生效（mTLS enforce 开启且本机无证书也会导致此错，见 docs/ops/mtls-runbook.md）"
[ "$(pubcurl -s -m10 -o /dev/null -w '%{http_code}' "$DOMAIN/$SERVED")" = "200" ] || die "bundle 非 200"
[ "$(pubcurl -s -m10 -o /dev/null -w '%{http_code}' "$DOMAIN/rounds")" = "200" ] || die "深链 /rounds 非 200（SPA fallback 异常）"
acode="$(pubcurl -s -m10 -o /dev/null -w '%{http_code}' "$DOMAIN/admin/presale/rounds")"
[ "$acode" = "401" ] || say "    ⚠ 后端反代返回 $acode（预期 401/无 token），请人工确认"
say "    bundle 一致 + 200，深链 200，后端反代正常"

# ── 6. 打部署 tag + 推送 ──────────────────────────────
say "6/6 打部署 tag"
TAG="deploy/$(date +%F)"; n=2
while git rev-parse "$TAG" >/dev/null 2>&1; do TAG="deploy/$(date +%F)-$n"; n=$((n + 1)); done
git tag -a "$TAG" HEAD -m "deploy: $COMMIT → $DOMAIN"
git push origin "$TAG" >/dev/null || die "tag push 失败（部署已成功，手动补: git push origin ${TAG}）"

say "✅ 部署完成: $COMMIT → $DOMAIN  (tag ${TAG}，旧版备份 $BAK)"
say "   请在 docs/ops/deploy-runbook.md §9 登一行: $(date +%F) | $TAG | $COMMIT | <内容>"
