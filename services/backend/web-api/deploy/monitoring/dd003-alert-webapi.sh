#!/bin/bash
# DD-003 告警检查（web-api 侧，规则 1 + 2）
#
# 必需 env：
#   LARK_WEBHOOK_URL — Lark 自定义机器人 webhook URL
#   MYSQL_PWD        — RDS admin 密码
#
# 部署：/usr/local/bin/dd003-alert-webapi.sh，cron */5min

set -euo pipefail

if [ -z "${LARK_WEBHOOK_URL:-}" ] || [ -z "${MYSQL_PWD:-}" ]; then
    echo "$(date -Is) ERROR: LARK_WEBHOOK_URL or MYSQL_PWD not set" >&2
    exit 2
fi

# 阈值（cutover-dd003.md §8）
THRESHOLD_5XX_RATIO="0.01"   # 1%
DEDUP_WINDOW_SEC=1800        # 30min 内同 rule 不重发

# RDS 连接
RDS_HOST="<RDS_HOST>"
RDS_USER="admin"
RDS_DB="project_oddfi"

# 通用工具
NOW=$(date -Is)
NGINX_LOG="/var/log/nginx/access.log"

# 去重锁（避免刷屏）
should_alert() {
    local rule="$1"
    local state_file="/tmp/.dd003-alert-state.$rule"
    local now_ts=$(date +%s)

    if [ -f "$state_file" ]; then
        local last_ts=$(cat "$state_file")
        local elapsed=$((now_ts - last_ts))
        if [ "$elapsed" -lt "$DEDUP_WINDOW_SEC" ]; then
            return 1
        fi
    fi
    echo "$now_ts" > "$state_file"
    return 0
}

send_lark() {
    local text="$1"
    curl -s -m 10 -X POST -H "Content-Type: application/json" \
        -d "{\"msg_type\":\"text\",\"content\":{\"text\":\"$text\"}}" \
        "$LARK_WEBHOOK_URL" > /dev/null
    echo "$NOW LARK_ALERT_SENT: $text"
}

# ─── 规则 1: admin internal endpoint 5xx 率 > 1% / 5min ──────────────────
# 解析 nginx access log 找 admin-api.oddfi.io 5min 内的 status code 分布
check_rule_1_5xx_ratio() {
    if [ ! -r "$NGINX_LOG" ]; then
        echo "$NOW WARN: $NGINX_LOG not readable, skip rule 1"
        return
    fi

    # 取最近 5min 的日志（按时间戳过滤）
    local since=$(date -u -d '5 minutes ago' '+%d/%b/%Y:%H:%M' 2>/dev/null || \
                  date -u -v -5M '+%d/%b/%Y:%H:%M')

    # nginx default access log format: $remote_addr - - [$time_local] "$request" $status ...
    local total=$(awk -v since="$since" '
        $4 >= "["since {total++}
        END {print total+0}
    ' "$NGINX_LOG")

    local count_5xx=$(awk -v since="$since" '
        $4 >= "["since && $9 ~ /^5/ {n++}
        END {print n+0}
    ' "$NGINX_LOG")

    if [ "$total" -lt 10 ]; then
        # 样本太少不告警
        return
    fi

    local ratio=$(awk -v c="$count_5xx" -v t="$total" 'BEGIN {printf "%.4f", c/t}')
    local breach=$(awk -v r="$ratio" -v th="$THRESHOLD_5XX_RATIO" 'BEGIN {print (r > th) ? "yes" : "no"}')

    if [ "$breach" = "yes" ]; then
        if should_alert "rule1_5xx"; then
            send_lark "[认购告警] admin-api.oddfi.io 5xx 率 ${ratio} 超阈值 ${THRESHOLD_5XX_RATIO} (5min 内 ${count_5xx}/${total})"
        fi
    fi
}

# ─── 规则 2: audit 写入失败 — idempotency 有但 audit_id NULL ────────────
# 同事务三写应该原子完成，audit_id NULL 说明事务部分提交 / callback 没回填
check_rule_2_audit_orphan() {
    local count=$(MYSQL_PWD="$MYSQL_PWD" mysql -h "$RDS_HOST" -u "$RDS_USER" -N -B "$RDS_DB" -e \
        "SELECT COUNT(*) FROM admin_idempotency WHERE audit_id IS NULL AND created_at > UNIX_TIMESTAMP(NOW()-INTERVAL 5 MINUTE)*1000;" 2>/dev/null || echo "0")

    if [ "$count" -gt 0 ]; then
        if should_alert "rule2_audit_orphan"; then
            send_lark "[认购告警] 同事务三写原子性破坏：5min 内 ${count} 行 admin_idempotency 没有 audit_id（合规事件，立刻排查）"
        fi
    fi
}

# ─── 主入口 ──────────────────────────────────────────────────────────────
check_rule_1_5xx_ratio
check_rule_2_audit_orphan

echo "$NOW dd003-alert-webapi.sh: OK"
