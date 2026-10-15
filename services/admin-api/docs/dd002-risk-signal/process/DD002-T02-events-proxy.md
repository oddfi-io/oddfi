# DD002-T02 · events proxy handler ×5 + mock 上游 + 单测

> 方案：[`../DD.md`](../DD.md) §3.2/§3.3
> 索引：[`./README.md`](./README.md)
> 前置：T01（errcode/路径常量）
> 下游：T04（路由注册）、联调 A（mock 上游）

## 目标

五个 events 端点的 proxy 薄壳（照 `presale_audit.go` RawQuery 透传模式），加一个可独立启动的 mock 上游供联调 A 与前端开发使用。

## 文件清单

- `internal/handler/events_risk.go` — 新建：`EventsRisk` handler（Summary / List / Detail / AdjustHistory / RiskDecision 五方法）
- `internal/handler/events_risk_test.go` — 新建：httptest mock 上游单测
- `cmd/mock-webapi/main.go` — 新建：mock 上游 server（:9090，固定夹具）
- `cmd/mock-webapi/fixtures.go` — 新建：8 事件夹具数据

## 接口设计 / 行为约定

| 方法 | 行为 |
|---|---|
| `Summary(c)` | GET 透传 → `UpstreamRiskSummaryPath`，响应原样回写 |
| `List(c)` | GET 透传，**RawQuery 原样拼接**（signal 逗号多值 / status / sort_by / sort_order / page / page_size 全部不解析） |
| `Detail(c)` | path param `event_id` 仅做非空 + 数字校验后拼 upstream 路径 |
| `AdjustHistory(c)` | 同上 + RawQuery 透传（market/direction 过滤） |
| `RiskDecision(c)` | POST：①校验 `X-Idempotency-Key` 必带（缺 → 400 INVALID_PARAM）②body 仅校验 `action ∈ {approve_continue, stop}`、`remark` 非空，**不注入 operator**（由 web-api 从透传的 X-Admin-JWT 解码）③转发，upstream 业务错误码（EVENT_NOT_RED_SIGNAL / RISK_DECISION_CONFLICT）原样透传 |

错误翻译：client 返回 `HTTPError`（5xx/网络）→ 503 `UPSTREAM_UNAVAILABLE`；`BusinessError` → 原 code 透传（HTTP 200 业务错误壳）。

**mock 上游夹具**（联调 A 的契约真值，schema 与 OPS-01c 契约逐字段一致）：
8 个事件覆盖——green/yellow/orange/red 各一、未开盘（null 组）、已结算（score+settle_pl+卡替换）、红灯已决策（pending_decision=false + decision 对象 + effective_signal=orange）、红灯重升（决策后 quote_version 更新，pending_decision 重新 true）。risk-decision 在 mock 内有状态（内存 map），支持联调 A 演练决策闭环与 RISK_DECISION_CONFLICT。

## 实施要点

- 复用 `client.Client`，不开 service/repository 层
- zerolog：`module=events_risk`，记 `event_id`/`action`/`admin_user_id`，**不记 JWT 原文**
- mock-webapi 不做 HMAC 校验（本地联调用），main.go 顶部中文注释声明"仅联调，禁止部署"

## 测试要求

table-driven，P0：
| 用例 | 期望 |
|---|---|
| List RawQuery 透传（含 `signal=red,orange`） | upstream 收到原样 query |
| Detail event_id 非数字 | 400 INVALID_PARAM |
| RiskDecision 缺幂等 key / action 非法 / remark 空 | 400 |
| upstream 5xx | 503 UPSTREAM_UNAVAILABLE |
| upstream 业务错（EVENT_NOT_RED_SIGNAL） | code 原样透传 |
| 正常链路 ×5 端点 | 响应体逐字节一致 |

## 验收

`go vet && go test ./...` 绿；`go run ./cmd/mock-webapi` + `curl :9090/internal/admin/events/risk/summary` 返回夹具。
