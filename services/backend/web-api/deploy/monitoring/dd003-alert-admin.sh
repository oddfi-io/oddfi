#!/bin/bash
# DD-003 告警检查（admin-backend 侧，规则 3）
#
# 必需 env：
#   LARK_WEBHOOK_URL — Lark 自定义机器人 webhook URL（与 web-api 侧共用）
#
# 部署：/usr/local/bin/dd003-alert-admin.sh，cron */5min

set -euo pipefail

if [ -z "${LARK_WEBHOOK_URL:-}" ]; then
    echo "$(date -Is) ERROR: LARK_WEBHOOK_URL not set" >&2
    exit 2
fi

DEDUP_WINDOW_SEC=1800
NOW=$(date -Is)

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

# ─── 规则 3: admin-backend → web-api retry exhausted > 0 / 5min ──────────
# 解析 journalctl 找 [webapi-client] retry exhausted 模式
check_rule_3_retry_exhausted() {
    # grep -c 即便没匹配也输出 "0"（带退出码 1），用 || true 吞掉退出码
    local count=$(journalctl -u oddfi-admin-server --since '5 minutes ago' --no-pager 2>/dev/null \
        | { grep -c -E '\[webapi-client\].*(retry exhausted|retries exhausted|max retries)' || true; })
    count=${count:-0}

    if [ "$count" -gt 0 ]; then
        if should_alert "rule3_retry_exhausted"; then
            send_lark "[认购告警] admin → web-api 调用 ${count} 次重试耗尽（5min 内），可能 admin-api.oddfi.io 不通或 web-api internal listener 异常"
        fi
    fi
}

check_rule_3_retry_exhausted

echo "$NOW dd003-alert-admin.sh: OK"
