# DD002 信号灯 · 联调 curl 契约集

> 用途：①联调 A 自查（mock 上游）②联调 B 打真上游做 schema diff（响应与本文注释的 mock 输出逐字段核对，重点 `,string` ID、`signal` 字符串枚举、`max_exposure` 双义、null 组字段）。
> 契约权威：`docs/api.md` §3.12。
> 本文所有命令已在 `server(:8081) → mock-webapi(:9090)` 链路实跑通过（2026-06-05）。

## 0. 环境准备

```bash
# 终端 1：mock 上游（联调 B 时跳过，config 指向真 web-api internal）
# 默认绑 127.0.0.1:9090（无 HMAC 校验，禁止非回环监听/部署）
go run ./cmd/mock-webapi

# 终端 2：admin-server，webapi 指向 mock
ADMIN_LARK_APP_SECRET=dummy WEBAPI_INTERNAL_URL=http://127.0.0.1:9090 WEBAPI_SERVICE_TOKEN=dev-test go run ./cmd/server

# 终端 3：四角色 dev token（本地 admin_users 需有对应记录，见 docs/api.md §6.3）
TOKEN_OP=$(go run ./cmd/dev-token -user ou_dev_operator | tail -1)
TOKEN_FIN=$(go run ./cmd/dev-token -user ou_dev_finance | tail -1)
TOKEN_CS=$(go run ./cmd/dev-token -user ou_dev_cs | tail -1)
TOKEN_SUPER=$(go run ./cmd/dev-token -user <super_admin 的 lark_user_id> | tail -1)
BASE=http://127.0.0.1:8081
```

## 1. summary 成功

```bash
curl -s -H "Authorization: Bearer $TOKEN_FIN" "$BASE/admin/events/risk/summary" | jq .
# 实跑输出（mock 初始态）：
# data.red_pending_count=1, green_count=3, yellow_count=1, orange_count=2, red_count=1
# data.max_event_exposure="21300.00"（字符串 decimal），max_exposure_event_id="3"（字符串 ID）
# ⚠️ 四色计数不含未开盘 e4；max_event_exposure 是展示量 adjMaxL 非判级源
```

## 2. list 成功 + 多值筛选 + 分页排序

```bash
# 全量
curl -s -H "Authorization: Bearer $TOKEN_CS" "$BASE/admin/events/risk/list" | jq '.data.total'
# → 8；壳为 {list,total,page,page_size}

# 橙 Tab 语义：signal 逗号多值单 key（前端组装 orange,red）
curl -s -H "Authorization: Bearer $TOKEN_CS" "$BASE/admin/events/risk/list?signal=red,orange" \
  | jq '{total:.data.total, ids:[.data.list[].event_id]}'
# 实跑 → {"total":3,"ids":["3","5","7"]}（e7 链上 red 已决策展示 orange，也命中 orange 筛选）

# 状态筛选 + 排序 + 分页
curl -s -H "Authorization: Bearer $TOKEN_CS" \
  "$BASE/admin/events/risk/list?status=active&sort_by=exposure&sort_order=desc&page=1&page_size=2" \
  | jq '[.data.list[].max_exposure]'
# → 降序的 decimal 字符串数组

# null 组字段核验（联调 B schema diff 重点）
curl -s -H "Authorization: Bearer $TOKEN_CS" "$BASE/admin/events/risk/list" \
  | jq '.data.list[] | select(.event_id=="1") | {lp_pool_amount, yield_ratio, score, settle_pl, settle: .times.settle}'
# → 全部 null（真上游 OPS-01d 前同样恒 null；前端显示「—」）

# 未开盘行核验
curl -s -H "Authorization: Bearer $TOKEN_CS" "$BASE/admin/events/risk/list?status=pending" \
  | jq '.data.list[] | select(.opened==false) | {signal, bet_amount_total, max_exposure}'
# → 全 null（前端各卡置灰）
```

## 3. detail 成功 + 404

```bash
curl -s -H "Authorization: Bearer $TOKEN_FIN" "$BASE/admin/events/5" \
  | jq '{event_id:.data.event_id, markets:[.data.markets[].market_name]}'
# 实跑 → {"event_id":"5","markets":["胜负","盘数让分"]}

# 已结算事件：market.settle 非空 + direction_name 带胜负态标注
curl -s -H "Authorization: Bearer $TOKEN_FIN" "$BASE/admin/events/6" \
  | jq '{settle:.data.markets[0].settle, dirs:[.data.markets[0].directions[].direction_name]}'
# → settle={winners,payout,platform_pl}；dirs 含「✓ 胜出 / 未中 / 走盘」

# EVENT_NOT_FOUND
curl -s -w "\nHTTP %{http_code}\n" -H "Authorization: Bearer $TOKEN_FIN" "$BASE/admin/events/999"
# 实跑 → {"code":"EVENT_NOT_FOUND",...} HTTP 404

# event_id 非数字（admin-backend 门卫拦截，不打上游）
curl -s -w "\nHTTP %{http_code}\n" -H "Authorization: Bearer $TOKEN_FIN" "$BASE/admin/events/abc"
# 实跑 → {"code":"INVALID_PARAM",...} HTTP 400
```

## 4. adjust-history 成功 + 过滤

```bash
curl -s -H "Authorization: Bearer $TOKEN_OP" "$BASE/admin/events/5/adjust-history" | jq '.data.total'
# 实跑 → 3；单条含 {seq,time,odds,exposure:null,lp_ratio:null,source:"Auto",market_name,direction_name}

# 按玩法/方向过滤（URL 编码中文）
curl -s -H "Authorization: Bearer $TOKEN_OP" \
  "$BASE/admin/events/5/adjust-history?market=%E8%83%9C%E8%B4%9F" | jq '.data.total'
```

## 5. risk-decision 全状态机

```bash
# ① 成功（operator；e5 初始为红灯重升态 pending_decision=true）
curl -s -X POST -H "Authorization: Bearer $TOKEN_OP" \
  -H "X-Idempotency-Key: $(uuidgen)" -H "Content-Type: application/json" \
  -d '{"action":"stop","remark":"敞口超限，人工确认停止接单"}' \
  "$BASE/admin/events/5/risk-decision" | jq .data
# 实跑 → {"event_id":"5","action":"stop","decided_by":"lark:ou_dev_operator",
#         "decided_at":"...","effective_signal":"orange","queue_cleared":true}
# decided_by 来自 X-Admin-JWT 解码（mock 读 sub claim），不信任 body

# ② 重复决策 → RISK_DECISION_CONFLICT（HTTP 200 业务壳）
curl -s -X POST -H "Authorization: Bearer $TOKEN_OP" \
  -H "X-Idempotency-Key: $(uuidgen)" -H "Content-Type: application/json" \
  -d '{"action":"stop","remark":"重复提交验证"}' \
  "$BASE/admin/events/5/risk-decision" | jq '{code,message}'
# 实跑 → {"code":"RISK_DECISION_CONFLICT","message":"decision already exists for current risk round"}

# ③ 非红灯 → EVENT_NOT_RED_SIGNAL（HTTP 200 业务壳）
curl -s -X POST -H "Authorization: Bearer $TOKEN_OP" \
  -H "X-Idempotency-Key: $(uuidgen)" -H "Content-Type: application/json" \
  -d '{"action":"stop","remark":"对橙灯操作验证"}' \
  "$BASE/admin/events/3/risk-decision" | jq '{code,message}'
# 实跑 → {"code":"EVENT_NOT_RED_SIGNAL","message":"only red signal events allow manual decision"}

# ④ 缺幂等 key → 400 INVALID_PARAM
curl -s -w "\nHTTP %{http_code}\n" -X POST -H "Authorization: Bearer $TOKEN_OP" \
  -H "Content-Type: application/json" \
  -d '{"action":"stop","remark":"缺幂等key"}' \
  "$BASE/admin/events/5/risk-decision"
# 实跑 → {"code":"INVALID_PARAM","message":"X-Idempotency-Key header is required"} HTTP 400

# ⑤ action 非法 / remark 空白 → 400 INVALID_PARAM
curl -s -X POST -H "Authorization: Bearer $TOKEN_OP" \
  -H "X-Idempotency-Key: $(uuidgen)" -H "Content-Type: application/json" \
  -d '{"action":"pause","remark":"非法action"}' \
  "$BASE/admin/events/5/risk-decision" | jq '{code,message}'
# → {"code":"INVALID_PARAM","message":"action must be approve_continue or stop"}

# ⑥ RBAC：finance / customer_service → 403 INSUFFICIENT_ROLE
curl -s -w "\nHTTP %{http_code}\n" -X POST -H "Authorization: Bearer $TOKEN_FIN" \
  -H "X-Idempotency-Key: $(uuidgen)" -H "Content-Type: application/json" \
  -d '{"action":"stop","remark":"财务角色越权验证"}' \
  "$BASE/admin/events/5/risk-decision"
# 实跑 → {"code":"INSUFFICIENT_ROLE",...} HTTP 403
```

## 6. approval/counts + 降级

```bash
# 成功（mock 初始态 1 个红灯未决策）
curl -s -H "Authorization: Bearer $TOKEN_CS" "$BASE/admin/approval/counts" | jq .data
# 实跑 → {"event_count":1,"claim_count":0,"withdraw_count":0}
# e5 决策成功后再调 → event_count=0（badge 联动验证）

# 降级：停掉 mock 上游再调
curl -s -w "\nHTTP %{http_code}\n" -H "Authorization: Bearer $TOKEN_CS" "$BASE/admin/approval/counts"
# 实跑 → {"code":"UPSTREAM_UNAVAILABLE",...} HTTP 503
# 前端约定：badge 保持上次值不弹错，30s 轮询自动恢复
```

## 7. 鉴权与限流横切

```bash
# 无 token → 401
curl -s -o /dev/null -w "%{http_code}\n" "$BASE/admin/events/risk/summary"
# 实跑 → 401

# 限流：risk-decision 走 events_sensitive 桶 10/min/IP（burst=10），连发 12 次尾部出现 429
for i in $(seq 1 12); do
  curl -s -o /dev/null -w "%{http_code} " -X POST -H "Authorization: Bearer $TOKEN_OP" \
    -H "X-Idempotency-Key: rl-$i" -H "Content-Type: application/json" \
    -d '{"action":"stop","remark":"限流验证"}' "$BASE/admin/events/999/risk-decision"
done; echo
# 实跑 → 404 ×9 + 429 ×3（404=过限流到 handler 后上游 NOT_FOUND；本分钟内已发过请求会提前触发 429）
```

## 8. 联调 B 附加项（真上游专属，mock 不覆盖）

```bash
# HMAC 验签失败形态（联调 B 在 web-api 侧验证）：
#   - 篡改 body / 过期 X-Timestamp / 错 secret → web-api 401，admin-backend 透传
# 红灯重升回归（真库）：决策落库 → 手工抬敞口触发重判红 → pending_decision 重新 true → 重新入队
# signal=red 查询绕缓存：连续两次 ?signal=red 请求观察数据新鲜度
# 性能基线：risk/list 50 事件 p95 < 500ms（含上游往返）
```
