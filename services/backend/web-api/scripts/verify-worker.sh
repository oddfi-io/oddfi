#!/usr/bin/env bash
#
# verify-worker.sh — 验证 presale-worker 是否真的跑起来了（不只是容器存在）
#
# 用途：worker 部署 / 重启后必须运行此脚本，exit 0 才能标"worker verify"完成。
# 防止 worker 部署同型问题：容器在跑但 leader 没抢到、RPC 没连上、cursor 没推进
# 时仍标 completed（参考 INC-002 同型故障模式）。
#
# 用法（在 oddfi-backend EC2 上运行，自动从 container 配置读 RDS 凭据）：
#   ./scripts/verify-worker.sh
#
# 或显式传环境变量（任意环境）：
#   MYSQL_HOST=<host> MYSQL_USER=<user> MYSQL_PWD=<pwd> MYSQL_DB=<db> \
#     ./scripts/verify-worker.sh
#
# Exit code：
#   0 — worker 容器 + leader 锁 + 启动日志 + cursor 推进 全部正常
#   1 — 任何一项不通过
#   2 — 无法读 DB 凭据 / 无法连 DB

set -euo pipefail

CONTAINER_NAME="${CONTAINER_NAME:-presale-worker}"
LEADER_KEY="${LEADER_KEY:-presale:worker:leader}"
CURSOR_SLEEP_SEC=8

# ── 1) 容器在跑 ──────────────────────────────────────────────────────────────
echo "▶ 检查 docker 容器 '$CONTAINER_NAME' 状态"
STATUS=$(sudo docker inspect "$CONTAINER_NAME" --format '{{.State.Status}}' 2>/dev/null || echo "missing")
if [[ "$STATUS" != "running" ]]; then
  echo "❌ 容器状态 = $STATUS（期望 running）"
  exit 1
fi
echo "   ✅ 容器 running"

# ── 2) Redis leader 锁存在 ───────────────────────────────────────────────────
echo "▶ 检查 Redis leader 锁 '$LEADER_KEY'"
LOCK_VAL=$(redis-cli get "$LEADER_KEY" 2>/dev/null || true)
if [[ -z "$LOCK_VAL" ]]; then
  echo "❌ leader 锁不存在（worker 还没抢到锁 或 Redis 不通）"
  exit 1
fi
LOCK_TTL=$(redis-cli ttl "$LEADER_KEY" 2>/dev/null || echo 0)
if [[ "$LOCK_TTL" -lt 5 ]]; then
  echo "❌ leader 锁 TTL=${LOCK_TTL}s 过低，可能续约失败"
  exit 1
fi
echo "   ✅ leader=$LOCK_VAL TTL=${LOCK_TTL}s"

# ── 3) 启动日志含 3 个关键句 ─────────────────────────────────────────────────
echo "▶ 检查启动日志关键句"
LOGS=$(sudo docker logs --tail 200 "$CONTAINER_NAME" 2>&1)
declare -a EXPECT_KEYS=(
  "bsc rpc connected"
  "ensured cursors"
  "acquired leader lock"
)
for KEY in "${EXPECT_KEYS[@]}"; do
  if ! echo "$LOGS" | grep -qi "$KEY"; then
    echo "❌ 日志未见: '$KEY'"
    echo "── 最近 30 行 ───────────────────"
    echo "$LOGS" | tail -30
    exit 1
  fi
  echo "   ✅ 见到: '$KEY'"
done

# ── 4) cursor 在推进 ────────────────────────────────────────────────────────
# 读 DB 凭据（复用 verify-migration.sh 风格）
if [[ -z "${MYSQL_HOST:-}" ]]; then
  if [[ -r /etc/oddfi/config_prod.yaml ]]; then
    CFG=/etc/oddfi/config_prod.yaml
    MYSQL_BLOCK=$(sed -n '/^database:/,/^[a-zA-Z]/{/^database:/!{/^[a-zA-Z]/!p}}' "$CFG")
    extract_val() {
      echo "$MYSQL_BLOCK" | sed -nE "s/^[[:space:]]*$1:[[:space:]]*\"?([^\"]+)\"?[[:space:]]*$/\1/p" | head -1
    }
    MYSQL_HOST=$(extract_val host)
    MYSQL_USER=$(extract_val username)
    MYSQL_PWD=$(extract_val password)
    MYSQL_DB=$(extract_val name)
    MYSQL_DB="${MYSQL_DB:-project_oddfi}"
  else
    echo "❌ 缺 DB 凭据：未设置 MYSQL_HOST 且无法读 /etc/oddfi/config_prod.yaml"
    exit 2
  fi
fi

echo "▶ 检查 cursor 推进（${CURSOR_SLEEP_SEC}s 间隔取两次 last_block_number）"
read_cursor() {
  MYSQL_PWD="$MYSQL_PWD" mysql -h "$MYSQL_HOST" -u "$MYSQL_USER" -N -B "$MYSQL_DB" \
    -e 'SELECT MAX(last_block_number) FROM presale_event_cursor;' 2>/dev/null
}
B1=$(read_cursor)
if [[ -z "$B1" || "$B1" == "NULL" ]]; then
  echo "❌ presale_event_cursor 表空 — worker 还没初始化 cursor（EnsureAll 没跑）"
  exit 1
fi
sleep "$CURSOR_SLEEP_SEC"
B2=$(read_cursor)
if (( B2 <= B1 )); then
  echo "❌ cursor 没推进：${B1} → ${B2}（worker 卡住 或 RPC 慢）"
  exit 1
fi
echo "   ✅ cursor 推进 ${B1} → ${B2} (+$((B2 - B1)) blocks)"

echo
echo "🎉 worker verify PASSED"
