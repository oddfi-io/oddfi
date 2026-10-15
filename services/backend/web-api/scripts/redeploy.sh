#!/usr/bin/env bash
#
# redeploy.sh <image_tag> — 一条命令完成 web-api 容器 cutover
#
# 流程：
#   1. 从现有容器抽配置（mount + env + image tag）— 不依赖外部 env 文件
#   2. 拉新镜像
#   3. stop + remove 旧容器
#   4. 启动新容器（host network + 同 mount + 同 env）
#   5. 等 8s + 跑 4 探针 + verify-migration.sh
#   6. 失败自动回滚到旧镜像 tag
#
# 设计原则：
#   - 不读外部凭据文件 — 配置全部从 docker inspect 复用，避免漂移
#   - INC-001 + INC-002 同步防御 — verify-migration 检查表 + login_by_wallet 检查 DB
#   - 探针任意失败即触发回滚，保证 prod 永远在已知良态
#
# 用法（在 oddfi-backend EC2 上 sudo 跑）：
#   sudo /usr/local/bin/redeploy.sh hankdong/account-web-api:prod_dd003-v4
#
# 部署本身（本机 build + push 略）参见 web-api/deploy/docker-build-and-push.sh

set -euo pipefail

DRY_RUN=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help)
      echo "Usage: $0 [--dry-run] <image_tag>"
      echo "  --dry-run  跳过 docker pull/stop/rm/run，只跑 probes，验证脚本逻辑"
      exit 0 ;;
    *) break ;;
  esac
done

NEW_TAG="${1:?usage: $0 [--dry-run] <image_tag, e.g. hankdong/account-web-api:prod_dd003-v4>}"
CONTAINER="web-api"

[[ $DRY_RUN -eq 1 ]] && echo "⚠️  DRY-RUN: docker mutate 操作将被跳过，仅验证 inspect + probes 路径"

# ── 1. 抽现有容器配置 ────────────────────────────────────────────
echo "▶ 1. inspect current container"
if ! sudo docker inspect "$CONTAINER" >/dev/null 2>&1; then
  echo "❌ 容器 $CONTAINER 不存在 — 首次部署请走 cutover-dd003.md §2.3" >&2
  exit 2
fi

OLD_TAG=$(sudo docker inspect "$CONTAINER" --format '{{.Config.Image}}')
echo "  current image : $OLD_TAG"
echo "  new image     : $NEW_TAG"

if [[ "$OLD_TAG" == "$NEW_TAG" ]]; then
  echo "⚠️  new == old，确认要 redeploy 同 tag？(用于 config 改动后重启)"
  echo "    5s 后继续 ... Ctrl-C 取消"
  sleep 5
fi

# REV-002 M1：用数组传 mount / env，避免 value 含空格 / 引号被 word-split 丢字段
# 抽 mount → MOUNT_ARGS 数组
MOUNT_ARGS=()
while IFS= read -r m; do
  [[ -z "$m" ]] && continue
  MOUNT_ARGS+=( -v "$m" )
done < <(sudo docker inspect "$CONTAINER" \
  --format '{{range .Mounts}}{{.Source}}:{{.Destination}}{{if eq .Mode "ro"}}:ro{{end}}
{{end}}')

# 抽 env → ENV_ARGS 数组（只复用 PRESALE_ / GIN_ / TZ / ADMIN_ prefix，不复用 PATH 等系统 env）
ENV_ARGS=()
while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  ENV_ARGS+=( -e "$line" )
done < <(sudo docker inspect "$CONTAINER" \
  --format '{{range .Config.Env}}{{println .}}{{end}}' \
  | grep -E '^(PRESALE_|GIN_|TZ=|ADMIN_)')

# 抽 restart policy（沿用现有）
RESTART=$(sudo docker inspect "$CONTAINER" --format '{{.HostConfig.RestartPolicy.Name}}')
RESTART="${RESTART:-unless-stopped}"

echo "  mounts (${#MOUNT_ARGS[@]} args): ${MOUNT_ARGS[*]}"
echo "  env keys      : $(printf '%s\n' "${ENV_ARGS[@]}" | grep -oE '^[A-Z_]+=' | tr -d '=' | tr '\n' ' ')"
echo "  restart       : $RESTART"

# ── 2. 拉新镜像 ─────────────────────────────────────────────────
echo ""
echo "▶ 2. pull $NEW_TAG"
if [[ $DRY_RUN -eq 0 ]]; then
  sudo docker pull "$NEW_TAG"
else
  echo "  (dry-run: skip pull)"
fi

# ── 3. 启动新容器（先 stop 旧 + 立即 run 新）────────────────────
# REV-002 M3：swap_to 包 set +e 防 docker run 失败时 set -e 提前退出绕过 verify/rollback
swap_to() {
  local target_tag="$1"
  echo "▶ swap to $target_tag"
  if [[ $DRY_RUN -eq 1 ]]; then
    echo "  (dry-run: skip stop/rm/run)"
    return 0
  fi
  sudo docker stop "$CONTAINER" 2>/dev/null || true
  sudo docker rm "$CONTAINER" 2>/dev/null || true

  set +e
  # REV-002 M1：数组展开 + 完整引号化，env value 含空格也不会被切碎
  sudo docker run -d \
    --name "$CONTAINER" \
    --restart "$RESTART" \
    --network host \
    --log-opt max-size=1000m --log-opt max-file=3 \
    "${MOUNT_ARGS[@]}" \
    "${ENV_ARGS[@]}" \
    "$target_tag" >/dev/null
  local run_rc=$?
  set -e

  if [[ $run_rc -ne 0 ]]; then
    echo "  ❌ docker run exit=$run_rc" >&2
    return 1
  fi

  # 等 2s 确认容器 State.Running=true（防 ENTRYPOINT 启动后秒退）
  sleep 2
  local running
  running=$(sudo docker inspect "$CONTAINER" --format '{{.State.Running}}' 2>/dev/null || echo "false")
  if [[ "$running" != "true" ]]; then
    echo "  ❌ container 启动后未在 Running 状态" >&2
    echo "  --- 最近 30 行日志 ---" >&2
    sudo docker logs --tail 30 "$CONTAINER" 2>&1 | sed 's/^/    /' >&2 || true
    return 1
  fi
  echo "  ✅ container Running"
  return 0
}

# REV-002 M4：rollback 也失败时把告警送到 Lark + dd003-alert.log 让 monitoring 兜住
send_critical_alert() {
  local msg="$1"
  echo "$(date -Is) REDEPLOY_CRITICAL: $msg" | sudo tee -a /var/log/dd003-alert.log >/dev/null 2>&1 || true
  if [[ -r /etc/oddfi/dd003-alert.env ]]; then
    # shellcheck disable=SC1091
    . /etc/oddfi/dd003-alert.env
    if [[ -n "${LARK_WEBHOOK_URL:-}" ]]; then
      curl -s -m 10 -X POST -H 'Content-Type: application/json' \
        -d "{\"msg_type\":\"text\",\"content\":{\"text\":\"[认购告警] redeploy CRITICAL: $msg\"}}" \
        "$LARK_WEBHOOK_URL" >/dev/null 2>&1 || true
    fi
  fi
}

echo ""
echo "▶ 3. swap container → $NEW_TAG"
if ! swap_to "$NEW_TAG"; then
  echo "❌ 新容器启动失败 — 尝试回滚到 $OLD_TAG"
  if ! swap_to "$OLD_TAG"; then
    send_critical_alert "swap to NEW_TAG=$NEW_TAG failed AND rollback to OLD_TAG=$OLD_TAG also failed — 手工介入"
    echo "💥 ROLLBACK ALSO FAILED — 手工 docker run 或检查 image" >&2
    exit 99
  fi
  echo "✅ rolled back to $OLD_TAG (NEW_TAG 启动失败)"
  exit 1
fi

# ── 4. 等启动 ────────────────────────────────────────────────────
echo ""
if [[ $DRY_RUN -eq 0 ]]; then
  echo "▶ 4. wait 8s for boot"
  sleep 8
else
  echo "▶ 4. wait skipped (dry-run; 容器未实际切换)"
fi

# ── 5. verify - 4 probes + migration check ─────────────────────
echo ""
echo "▶ 5. verify"
FAIL=0

probe() {
  local name="$1" expected="$2" method="$3" url="$4"
  shift 4
  local actual
  actual=$(curl -s -o /dev/null -w '%{http_code}' -m 5 -X "$method" "$@" "$url" 2>/dev/null || echo "000")
  if [[ "$actual" == "$expected" ]]; then
    echo "  ✅ $name → $url HTTP $actual"
  else
    echo "  ❌ $name → $url expected=$expected actual=$actual"
    FAIL=1
  fi
}

probe health           200 GET http://127.0.0.1:8081/health
probe presale_config   200 GET http://127.0.0.1:80/api/v1/presale/config
probe presale_position 401 GET http://127.0.0.1:80/api/v1/presale/position
probe login_by_wallet  400 POST http://127.0.0.1:80/account/login_by_wallet \
  -H 'Content-Type: application/json' -d '{"address":"0x0000000000000000000000000000000000000001"}'

if [[ -x /usr/local/bin/verify-migration.sh ]]; then
  echo "  ▶ verify-migration.sh"
  if sudo /usr/local/bin/verify-migration.sh > /tmp/verify-mig.out 2>&1; then
    echo "  ✅ migration verify PASSED"
  else
    echo "  ❌ migration verify FAIL"
    tail -5 /tmp/verify-mig.out
    FAIL=1
  fi
fi

# ── 6. 收尾：成功 / 回滚 ────────────────────────────────────────
echo ""
if [[ $FAIL -eq 0 ]]; then
  echo "🎉 redeploy OK — running $NEW_TAG"
  exit 0
fi

echo "❌ verify failed — rolling back to $OLD_TAG"
if ! swap_to "$OLD_TAG"; then
  send_critical_alert "verify failed AND rollback swap_to(OLD_TAG=$OLD_TAG) also failed — 手工介入"
  echo "💥 ROLLBACK ALSO FAILED — 手工介入！查 docker logs $CONTAINER" >&2
  exit 99
fi
sleep 5
ROLLBACK_HEALTH=$(curl -s -o /dev/null -w '%{http_code}' -m 5 http://127.0.0.1:8081/health 2>/dev/null || echo "000")
echo "  rollback health: HTTP $ROLLBACK_HEALTH"
if [[ "$ROLLBACK_HEALTH" == "200" ]]; then
  echo "✅ rolled back to $OLD_TAG"
  exit 1
fi
send_critical_alert "rolled back to $OLD_TAG 但 /health=$ROLLBACK_HEALTH 不健康"
echo "💥 ROLLBACK 容器起来但 /health 异常 — 手工介入！" >&2
exit 99
