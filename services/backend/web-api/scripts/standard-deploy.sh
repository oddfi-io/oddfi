#!/usr/bin/env bash
#
# standard-deploy.sh — BUG-001 实战沉淀的端到端标准化部署脚本
#
# 把"build → push → migration apply + verify → web-api cutover → worker cutover → 最终验证"
# 7 步固化为单一入口，避免运维窗口手工 7 次输命令出错。
#
# 设计依据：
#   - INC-002（cutover §2.1 verify-migration 必须 🎉 PASSED）
#   - DD-001（Mac M 必须 multi-arch buildx → docker-build-and-push.sh）
#   - REV-002（凭据用 sed range，避免 awk 分词漏字符）
#   - BUG-001（2026-05-28 实战 — 这次部署的全流程沉淀）
#
# 前置条件（脚本会 sanity check）：
#   1. 已 docker login（DOCKER_USERNAME 有 push 权限）
#   2. web-api/config_prod.yaml 存在（gitignored 本地文件）
#   3. ~/.ssh/config 有 'oddfi-backend' 别名（含 ProxyJump）
#   4. 当前在 git main 分支 + 工作区干净（避免误部署本地未提交改动）
#
# 服务器端预装（一次性，已就位）：
#   - /usr/local/bin/redeploy.sh        — INC-002 cutover 自动 4 探针 + 回滚
#   - /usr/local/bin/verify-migration.sh — INC-002 协议表清单验证
#   - /usr/local/bin/verify-worker.sh    — worker 健康（leader + cursor 推进）
#
# 用法：
#   ./web-api/scripts/standard-deploy.sh [OPTIONS] <image_tag>
#
# OPTIONS:
#   --dry-run                打印计划但不执行 docker mutate / ssh mutate
#   --migration <local-path> apply 一个新 migration SQL（可多次），按出现顺序 apply
#   --skip-worker            只 cutover web-api（极少数场景：worker 已升级 / 不部署 worker）
#   --skip-final-verify      跳过最终 7 类验证（仅 debug）
#   -h, --help
#
# 例：
#   # 无 migration，纯代码更新
#   ./web-api/scripts/standard-deploy.sh hankdong/account-web-api:prod_xxx_v2
#
#   # 有 migration（含同步更新 verify-migration.sh）
#   ./web-api/scripts/standard-deploy.sh \
#       --migration web-api/migrations/0012_xxx.sql \
#       hankdong/account-web-api:prod_xxx_v2

set -euo pipefail

# ── 参数解析 ──────────────────────────────────────────────────────────────
DRY_RUN=0
SKIP_WORKER=0
SKIP_FINAL_VERIFY=0
MIGRATIONS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)             DRY_RUN=1; shift ;;
    --migration)           MIGRATIONS+=("$2"); shift 2 ;;
    --skip-worker)         SKIP_WORKER=1; shift ;;
    --skip-final-verify)   SKIP_FINAL_VERIFY=1; shift ;;
    -h|--help)
      sed -n '2,/^set -euo/p' "$0" | grep -E '^#' | sed 's/^# \?//'
      exit 0 ;;
    *) break ;;
  esac
done

IMAGE_TAG="${1:?usage: $0 [OPTIONS] <image_tag>}"

# ── 路径推算（脚本可从任意工作目录调用）─────────────────────────────────────
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WEB_API_DIR="$REPO_ROOT/web-api"
SSH_HOST="oddfi-backend"

# 阶段输出辅助
section() { echo ""; echo "════════════════════════════════════════════════════════════"; echo "▶ $*"; echo "════════════════════════════════════════════════════════════"; }
step()    { echo "  ▸ $*"; }
ok()      { echo "  ✅ $*"; }
err()     { echo "  ❌ $*" >&2; }
maybe()   { if [[ $DRY_RUN -eq 1 ]]; then echo "  (dry-run: skip) $*"; else "$@"; fi; }

# ── Sanity check ──────────────────────────────────────────────────────────
section "0. 前置 sanity check"

# 0.1 git 状态
cd "$REPO_ROOT"
CUR_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$CUR_BRANCH" != "main" ]]; then
  if [[ $DRY_RUN -eq 1 ]]; then
    echo "  ⚠️  非 main 分支（${CUR_BRANCH}）— dry-run 模式忽略此检查"
  else
    err "当前不在 main 分支（${CUR_BRANCH}）— 部署应基于 main，避免误部署 fix 分支"
    exit 2
  fi
else
  ok "git 分支: main"
fi

if [[ -n "$(git status --porcelain | grep -v '^?? ')" ]]; then
  err "工作区有未提交改动 — 部署应基于已 commit 的状态"
  git status --short
  exit 2
fi
ok "工作区干净"

# 0.2 docker login
if ! docker info >/dev/null 2>&1; then
  err "Docker daemon 未运行"
  exit 2
fi
ok "Docker daemon running"

# 0.3 config_prod.yaml
if [[ ! -f "$WEB_API_DIR/config_prod.yaml" ]]; then
  err "缺 $WEB_API_DIR/config_prod.yaml（gitignored 本地文件）"
  exit 2
fi
ok "config_prod.yaml 在本地"

# 0.4 SSH 别名
if ! ssh -o BatchMode=yes -o ConnectTimeout=5 "$SSH_HOST" 'true' 2>/dev/null; then
  err "SSH '$SSH_HOST' 不可达（检查 ~/.ssh/config 别名 + ProxyJump）"
  exit 2
fi
ok "SSH oddfi-backend reachable"

# 0.5 migration 文件存在
for m in "${MIGRATIONS[@]:-}"; do
  [[ -z "$m" ]] && continue
  if [[ ! -f "$REPO_ROOT/$m" && ! -f "$m" ]]; then
    err "migration 文件不存在: $m"
    exit 2
  fi
  ok "migration 文件: $m"
done

# 0.6 IMAGE_TAG 不能与当前 prod 已有 tag 同名（避免覆盖）
CUR_PROD_TAG=$(ssh "$SSH_HOST" "sudo docker inspect web-api --format '{{.Config.Image}}' 2>/dev/null || echo unknown")
if [[ "$IMAGE_TAG" == "$CUR_PROD_TAG" ]]; then
  err "新 tag '$IMAGE_TAG' 与当前 prod tag 相同 — 同 tag redeploy 会绕过镜像 diff 验证，请用新 tag"
  err "  当前 prod: $CUR_PROD_TAG"
  exit 2
fi
ok "新 tag: $IMAGE_TAG (prod 当前: $CUR_PROD_TAG)"

# ── Step 1: docker build + push ──────────────────────────────────────────
section "1. docker build + push（multi-arch amd64）"
step "用 docker-build-and-push.sh 构建并推送..."
maybe "$WEB_API_DIR/deploy/docker-build-and-push.sh" "$IMAGE_TAG" 2>&1 | tail -5

# 验证 push 成功
if [[ $DRY_RUN -eq 0 ]]; then
  if ! docker manifest inspect "$IMAGE_TAG" >/dev/null 2>&1; then
    err "镜像 push 验证失败 — manifest inspect 不到"
    exit 1
  fi
fi
ok "镜像 push 成功"

# ── Step 2: Migration apply（如果有）────────────────────────────────────────
if [[ ${#MIGRATIONS[@]} -gt 0 ]]; then
  section "2. Migration apply"
  for m in "${MIGRATIONS[@]}"; do
    local_path="$REPO_ROOT/$m"
    [[ -f "$m" ]] && local_path="$m"
    fname=$(basename "$local_path")
    step "scp $fname 到服务器"
    maybe scp "$local_path" "$SSH_HOST:/tmp/$fname"

    step "apply $fname 到 prod RDS"
    if [[ $DRY_RUN -eq 0 ]]; then
      ssh "$SSH_HOST" "
        set -e
        CFG=/etc/oddfi/config_prod.yaml
        MYSQL_BLOCK=\$(sudo sed -n '/^database:/,/^[a-zA-Z]/{/^database:/!{/^[a-zA-Z]/!p}}' \"\$CFG\")
        extract() { echo \"\$MYSQL_BLOCK\" | sed -nE \"s/^[[:space:]]*\$1:[[:space:]]*\\\"?([^\\\"]+)\\\"?[[:space:]]*\\\$/\\1/p\" | head -1; }
        MYSQL_PWD=\$(extract password) mysql -h\$(extract host) -u\$(extract username) \$(extract dbname) < /tmp/$fname
      "
    fi
    ok "$fname applied"
  done
fi

# ── Step 3: 同步 verify-migration.sh + verify ───────────────────────────────
section "3. 同步 verify-migration.sh + verify-worker.sh + verify"
step "scp 最新 verify-migration.sh / verify-worker.sh 到服务器"
maybe scp "$WEB_API_DIR/scripts/verify-migration.sh" "$SSH_HOST:/tmp/verify-migration.sh"
maybe scp "$WEB_API_DIR/scripts/verify-worker.sh"    "$SSH_HOST:/tmp/verify-worker.sh"
maybe ssh "$SSH_HOST" '
  sudo install -m 755 /tmp/verify-migration.sh /usr/local/bin/verify-migration.sh
  sudo install -m 755 /tmp/verify-worker.sh    /usr/local/bin/verify-worker.sh
'

step "跑 verify-migration.sh（必须 🎉 PASSED 才继续）"
if [[ $DRY_RUN -eq 0 ]]; then
  if ! ssh "$SSH_HOST" 'sudo /usr/local/bin/verify-migration.sh' 2>&1 | tee /tmp/migration-verify.log | tail -8; then
    err "verify-migration.sh 失败 — abort（不能在 schema 异常状态下 cutover）"
    exit 1
  fi
  if ! grep -q "PASSED" /tmp/migration-verify.log; then
    err "verify-migration.sh 没看到 PASSED — abort"
    exit 1
  fi
fi
ok "migration verify PASSED"

# ── Step 4: web-api cutover（自动 4 探针 + 自动回滚）────────────────────────
section "4. web-api cutover（redeploy.sh 4 探针 + 自动回滚）"
step "ssh redeploy.sh $IMAGE_TAG"
if [[ $DRY_RUN -eq 0 ]]; then
  if ! ssh "$SSH_HOST" "sudo /usr/local/bin/redeploy.sh $IMAGE_TAG" 2>&1 | tee /tmp/redeploy.log | tail -20; then
    err "redeploy.sh 失败 — 应已自动回滚到旧 tag，请人工确认"
    exit 1
  fi
  if ! grep -q "🎉 redeploy OK" /tmp/redeploy.log; then
    err "redeploy.sh 没看到 🎉 redeploy OK — abort"
    exit 1
  fi

  # TODO-017 防呆：HTTP 探针只测连通性，不测 Lark alerter 是否注入。同 worker 路径，
  # 漏注入 PRESALE_LARK_WEBHOOK_URL 时 web-api 一切探针通过但内部 alerter 是 noop。
  #
  # REV-007 M2：用 --since 5m 拉启动窗口，避免高流量 prod 下 init log 被 access log 冲出 tail。
  # 5min 远大于 cutover 总耗时（redeploy.sh 4 探针 + verify 也就 30s），稳取启动序列。
  step "防呆：web-api 启动日志含 LarkWebhookService initialized"
  if ! ssh "$SSH_HOST" 'sudo docker logs web-api --since 5m 2>&1 | grep -q "LarkWebhookService initialized"'; then
    err "web-api 起来了但 LarkWebhookService 没初始化（PRESALE_LARK_WEBHOOK_URL env 漏注入？）"
    err "→ 修复：检查 redeploy.sh 内 docker run 是否带 -e PRESALE_LARK_WEBHOOK_URL"
    err "→ 或写入 /etc/oddfi/config_prod.yaml 的 presale.lark_webhook_url 字段（永久兜底）"
    exit 1
  fi
  ok "web-api LarkWebhookService 已初始化"
fi
ok "web-api cutover OK"

# ── Step 5: presale-worker cutover（手工，redeploy.sh 不覆盖）──────────────
if [[ $SKIP_WORKER -eq 0 ]]; then
  section "5. presale-worker cutover"

  step "抽现有 worker 容器配置（mount + env）"
  if [[ $DRY_RUN -eq 0 ]]; then
    # 抽 mount + env 数组（REV-002 M1：用 ssh 远程 inspect，本地不需要 docker）
    MOUNT_LINE=$(ssh "$SSH_HOST" "sudo docker inspect presale-worker --format '{{range .Mounts}}-v {{.Source}}:{{.Destination}}{{if eq .Mode \"ro\"}}:ro{{end}} {{end}}'")
    ENV_LINES=$(ssh "$SSH_HOST" "sudo docker inspect presale-worker --format '{{range .Config.Env}}{{println .}}{{end}}'" | grep -E '^(PRESALE_|GIN_|TZ=|ADMIN_)' | sed 's/^/-e /' | tr '\n' ' ')
    ok "mounts/env 已抽取"

    step "stop + rm 旧 worker"
    ssh "$SSH_HOST" 'sudo docker stop presale-worker && sudo docker rm presale-worker'

    step "run 新镜像 worker"
    ssh "$SSH_HOST" "sudo docker run -d --name presale-worker --network host --restart unless-stopped \
        $MOUNT_LINE $ENV_LINES \
        $IMAGE_TAG ./presale-worker"

    step "等 40s 给 leader 抢锁 + 首次 tick"
    sleep 40

    step "跑 verify-worker.sh"
    if ! ssh "$SSH_HOST" 'sudo /usr/local/bin/verify-worker.sh' 2>&1 | tee /tmp/worker-verify.log | tail -12; then
      err "verify-worker.sh 失败"
      exit 1
    fi
    if ! grep -q "🎉 worker verify PASSED" /tmp/worker-verify.log; then
      err "verify-worker.sh 没看到 🎉 worker verify PASSED — abort"
      exit 1
    fi

    # TODO-017 防呆：worker 起来了不代表 alerter 注入到位。
    # ISSUE-005 v1 教训：cmd/presale-worker/main.go 漏传 larkAlerter 时 worker 跑得很欢，
    # 但每笔 deposit_confirmed 都是 noop SendAnomalyAlert，运营群悄悄无卡片。
    # 这里 grep 启动日志，未见 'LarkWebhookService initialized' 即 abort 部署。
    #
    # REV-007 M2：用 --since 5m 拉启动窗口（不 tail），避免长日志把 init 行刷出取样范围。
    step "防呆：worker 启动日志含 LarkWebhookService initialized"
    if ! ssh "$SSH_HOST" 'sudo docker logs presale-worker --since 5m 2>&1 | grep -q "LarkWebhookService initialized"'; then
      err "worker 起来了但 LarkWebhookService 没初始化（PRESALE_LARK_WEBHOOK_URL env 漏注入？）"
      err "→ 修复：检查 docker inspect presale-worker env 是否含 PRESALE_LARK_WEBHOOK_URL"
      err "→ 或写入 /etc/oddfi/config_prod.yaml 的 presale.lark_webhook_url 字段（永久兜底）"
      exit 1
    fi
    ok "worker LarkWebhookService 已初始化"
  else
    echo "  (dry-run) stop + rm + run + verify-worker.sh + LarkWebhookService probe"
  fi
  ok "presale-worker cutover OK"
else
  section "5. presale-worker cutover (--skip-worker 跳过)"
fi

# ── Step 6: 最终 7 类验证 ───────────────────────────────────────────────────
if [[ $SKIP_FINAL_VERIFY -eq 0 ]]; then
  section "6. 最终验证（7 大类 11 项机器化检查）"
  if [[ $DRY_RUN -eq 0 ]]; then
    ssh "$SSH_HOST" "
      set -uo pipefail
      PASS=0; FAIL=0
      check() {
        local name=\"\$1\"; local result=\"\$2\"
        if [[ \"\$result\" == \"PASS\" ]]; then echo \"  ✅ \$name\"; PASS=\$((PASS+1)); else echo \"  ❌ \$name → \$result\"; FAIL=\$((FAIL+1)); fi
      }

      WEBAPI_STATE=\$(sudo docker inspect web-api --format '{{.State.Status}}' 2>/dev/null || echo missing)
      WORKER_STATE=\$(sudo docker inspect presale-worker --format '{{.State.Status}}' 2>/dev/null || echo missing)
      check 'web-api running' \"\$([ \"\$WEBAPI_STATE\" == 'running' ] && echo PASS || echo \"\$WEBAPI_STATE\")\"
      check 'presale-worker running' \"\$([ \"\$WORKER_STATE\" == 'running' ] && echo PASS || echo \"\$WORKER_STATE\")\"

      WEBAPI_TAG=\$(sudo docker inspect web-api --format '{{.Config.Image}}')
      WORKER_TAG=\$(sudo docker inspect presale-worker --format '{{.Config.Image}}')
      check 'web-api tag = $IMAGE_TAG'  \"\$([ \"\$WEBAPI_TAG\" == '$IMAGE_TAG' ] && echo PASS || echo \"\$WEBAPI_TAG\")\"
      check 'worker  tag = $IMAGE_TAG'  \"\$([ \"\$WORKER_TAG\" == '$IMAGE_TAG' ] && echo PASS || echo \"\$WORKER_TAG\")\"

      HEALTH=\$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8081/health)
      CONFIG=\$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:80/api/v1/presale/config)
      POSITION=\$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:80/api/v1/presale/position)
      LOGIN=\$(curl -s -o /dev/null -w '%{http_code}' -X POST http://127.0.0.1:80/account/login_by_wallet)
      check 'health → 200'                  \"\$([ \"\$HEALTH\"   == '200' ] && echo PASS || echo \"\$HEALTH\")\"
      check 'presale/config → 200'          \"\$([ \"\$CONFIG\"   == '200' ] && echo PASS || echo \"\$CONFIG\")\"
      check 'presale/position → 401 (auth)' \"\$([ \"\$POSITION\" == '401' ] && echo PASS || echo \"\$POSITION\")\"
      check 'login_by_wallet → 400 (body)'  \"\$([ \"\$LOGIN\"    == '400' ] && echo PASS || echo \"\$LOGIN\")\"

      # TODO-015：用 exit code 判断而非 grep stdout。
      # 上次 ISSUE-005 部署遇到 grep -q 在 ssh 嵌套 + bash || 短路组合下 flaky 抓不到 PASSED 字符串，
      # 但单独跑 verify-*.sh 总是 0 exit。改成直接看 exit code，把 stdout 留到失败时 tail 出来排查。
      if sudo /usr/local/bin/verify-migration.sh > /tmp/_vm.log 2>&1; then
        check 'migration verify PASSED' PASS
      else
        check 'migration verify (see /tmp/_vm.log on host)' FAIL
        tail -8 /tmp/_vm.log
      fi
      if sudo /usr/local/bin/verify-worker.sh > /tmp/_vw.log 2>&1; then
        check 'worker verify PASSED' PASS
      else
        check 'worker verify (see /tmp/_vw.log on host)' FAIL
        tail -12 /tmp/_vw.log
      fi

      echo ''
      echo \"Summary: \$PASS passed, \$FAIL failed\"
      [[ \$FAIL -eq 0 ]] && echo '🎉 ALL VERIFICATION PASSED' || exit 1
    "
  fi
fi

section "✅ standard-deploy 完成"
echo "  image: $IMAGE_TAG"
echo "  next:  通知前端联调 / 跑业务回归 / 监控 7d Sentry"
