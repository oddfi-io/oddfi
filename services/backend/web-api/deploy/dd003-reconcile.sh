#!/usr/bin/env bash
#
# DD-003 §5 三方对账脚本（每天跑一次，72h 观察期）
#
# 用法：
#   ./web-api/deploy/dd003-reconcile.sh <cutover_start_ms>
#
# cutover_start_ms = §1 容器启动那一刻（毫秒时间戳）
# 取法：在 cutover docker run 执行那一刻跑 `date +%s%3N` 记录。
#
# 环境变量（脚本前 export，不要写进命令行避免泄密）：
#   MYSQL_PWD       — RDS admin 密码（必须）
#   WEBAPI_HOST     — ssh Host 名（默认 oddfi-backend，需 ~/.ssh/config 配好 ProxyJump）
#
# ~/.ssh/config 参考（oddfi-backend 不能直连，需 ProxyJump via oddfi-admin）：
#   Host oddfi-backend
#     HostName <SERVER_IP>
#     User ubuntu
#     IdentityFile ~/.ssh/backend-server-key.pem
#     ProxyJump oddfi-admin
#
# 三个数字（容忍 ±1 in-flight）：
#   1. web-api DB presale_admin_audit 行数
#   2. web-api DB admin_idempotency 行数（audit_id 已回填）
#   3. admin-backend journalctl 里 [webapi-client] forward success 次数

set -euo pipefail

if [ $# -lt 1 ]; then
    echo "用法: $0 <cutover_start_ms>"
    echo "      cutover_start_ms = 13 位毫秒时间戳"
    echo
    echo "环境变量（必须预先 export）："
    echo "  MYSQL_PWD    — RDS admin 密码"
    echo "  WEBAPI_HOST  — ssh Host（默认 oddfi-backend，需 ~/.ssh/config ProxyJump）"
    exit 2
fi

if [ -z "${MYSQL_PWD:-}" ]; then
    echo "❌ MYSQL_PWD 未设置，请先 export MYSQL_PWD=<rds-admin-password>"
    exit 2
fi

CUTOVER_MS="$1"
CUTOVER_LOCAL=$(date -r $((CUTOVER_MS / 1000)) '+%Y-%m-%d %H:%M:%S')

# RDS 连接参数（host network 容器内 mysql 客户端不一定存在，从 EC2 host 直连 RDS 更稳）
RDS_HOST="<RDS_HOST>"
RDS_PORT="3306"
RDS_USER="admin"
RDS_DB="project_oddfi"

# web-api EC2 ssh Host（需 ~/.ssh/config 配 ProxyJump oddfi-admin）
WEBAPI_HOST="${WEBAPI_HOST:-oddfi-backend}"

echo "=========================================="
echo "DD-003 三方对账（since $CUTOVER_LOCAL）"
echo "=========================================="
echo

# 1. web-api DB audit + idempotency 计数
# 从 web-api EC2 host 直连 RDS（同 VPC，内网可达）
# MYSQL_PWD 通过 env 传递，不写 -p<pwd> 避免泄密
echo "▶ web-api DB（via ssh $WEBAPI_HOST → RDS）"
AUDIT_OUT=$(ssh "$WEBAPI_HOST" \
    "MYSQL_PWD='$MYSQL_PWD' mysql -h $RDS_HOST -P $RDS_PORT -u $RDS_USER -N -B $RDS_DB <<'SQL'
SELECT COUNT(*) FROM presale_admin_audit WHERE created_at > $CUTOVER_MS;
SELECT COUNT(*) FROM admin_idempotency WHERE created_at > $CUTOVER_MS AND audit_id IS NOT NULL;
SQL
" 2>&1)

AUDIT_COUNT=$(echo "$AUDIT_OUT" | sed -n '1p')
IDEM_COUNT=$(echo "$AUDIT_OUT" | sed -n '2p')

echo "    audit_count : $AUDIT_COUNT"
echo "    idem_count  : $IDEM_COUNT"
echo

# 2. admin-backend journalctl forward success
echo "▶ admin-backend journalctl（ssh oddfi-admin）"
FORWARD_COUNT=$(ssh oddfi-admin "sudo journalctl -u oddfi-admin-server --since '$CUTOVER_LOCAL' --no-pager | grep -c 'webapi-client.*forward success' || true")
echo "    forward_count : $FORWARD_COUNT"
echo

# 3. 一致性判定
echo "=========================================="
echo "判定"
echo "=========================================="

diff_a=$((AUDIT_COUNT - IDEM_COUNT))
diff_b=$((AUDIT_COUNT - FORWARD_COUNT))

abs() { echo "${1#-}"; }

if [ "$(abs $diff_a)" -le 1 ] && [ "$(abs $diff_b)" -le 1 ]; then
    echo "✅ 三方数字一致（容忍 ±1 in-flight）"
    exit 0
else
    echo "❌ 三方数字不一致："
    echo "   audit  - idem    = $diff_a（允许 -1..1）"
    echo "   audit  - forward = $diff_b（允许 -1..1）"
    echo
    echo "排查方向："
    echo "  - audit > idem    → idempotency callback 没回填 audit_id（中间件 bug）"
    echo "  - audit < idem    → idempotency 命中后没写 audit（少见）"
    echo "  - audit > forward → admin-backend 没记 success 日志（看 journalctl error）"
    echo "  - audit < forward → admin 转发成功但 web-api audit 没落（事务回滚？）"
    exit 1
fi
