#!/bin/bash
# DD-003 公开接口告警检查（INC-002 防回归 / TODO-001）
#
# 触发场景：public /api/v1/presale/* + 主站登录链路任一接口返回非预期状态码
#   → 立即推 Lark 群（30min 同探针不重发）
#
# 与 dd003-alert-webapi.sh 的区别：
#   - webapi 脚本是被动解析 nginx access log（覆盖 admin-api.oddfi.io）
#   - 本脚本是主动探针（覆盖 api.oddfi.io，web-api 直接 host network 模式无 nginx 日志）
#
# 必需 env:
#   LARK_WEBHOOK_URL — Lark 自定义机器人 webhook URL
#
# 部署：/usr/local/bin/dd003-alert-public.sh，cron */5min

set -euo pipefail

if [ -z "${LARK_WEBHOOK_URL:-}" ]; then
    echo "$(date -Is) ERROR: LARK_WEBHOOK_URL not set" >&2
    exit 2
fi

DEDUP_WINDOW_SEC=1800   # 30min 同探针不重发
NOW=$(date -Is)

# 去重锁（沿用 webapi 脚本同款机制）
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

# probe <name> <method> <url> <expected_status> [extra_curl_args]
# 探针失败定义：实际 status 与期望不一致（既能抓 5xx，也能抓 404 路由消失 / 400→500 退化）
probe() {
    local name="$1" method="$2" url="$3" expected="$4"
    shift 4

    local actual
    actual=$(curl -s -o /dev/null -w '%{http_code}' -m 5 -X "$method" "$@" "$url" 2>/dev/null || echo "000")

    if [ "$actual" = "$expected" ]; then
        return 0
    fi

    echo "$NOW PROBE_FAIL: $name expected=$expected actual=$actual url=$url"
    if should_alert "public_$name"; then
        send_lark "[认购告警] 公开接口异常：${name} 返回 HTTP ${actual}（期望 ${expected}），路径 ${url} — 立即排查（可能 INC-002 类型缺表 / web-api crash）"
    fi
    return 1
}

# ─── 探针清单（与 cutover-dd003.md §2.4 自检 4 类路径对齐）────────────────────
# 顺序：health → 无鉴权 public → 鉴权 public → 防 INC-001 登录链路

probe health_internal GET 'http://127.0.0.1:8081/health' 200

probe presale_config GET 'http://127.0.0.1:80/api/v1/presale/config' 200

probe presale_position GET 'http://127.0.0.1:80/api/v1/presale/position' 401

probe login_by_wallet POST 'http://127.0.0.1:80/account/login_by_wallet' 400 \
    -H 'Content-Type: application/json' -d '{"address":"0x0000000000000000000000000000000000000001"}'

echo "$NOW dd003-alert-public.sh: OK"
