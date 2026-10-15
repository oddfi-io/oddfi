# DD002-T03 · approval/counts 聚合 + 降级语义 + 单测

> 方案：[`../DD.md`](../DD.md) §3.2/§3.3
> 索引：[`./README.md`](./README.md)
> 前置：T01（RiskSummary DTO）
> 下游：T04（路由注册）、T08（铃铛 badge 消费）

## 目标

`GET /admin/approval/counts` —— 铃铛红点聚合端点。本期 `event_count = upstream summary.red_pending_count`（D4 拍板：队列只收 red），claim/withdraw 占位 0。

## 文件清单

- `internal/handler/approval_counts.go` — 新建
- `internal/handler/approval_counts_test.go` — 新建

## 接口设计 / 行为约定

```json
// 成功:  {"code":0,"data":{"event_count":1,"claim_count":0,"withdraw_count":0}}
// 上游挂: 503 {"code":"UPSTREAM_UNAVAILABLE",...}   ← 前端 badge 保持上次值（T08 约定）
```

- 调 `client.Get(UpstreamRiskSummaryPath)` 解析 `RiskSummary.RedPendingCount`
- claim_count / withdraw_count 硬编码 0，中文注释标注「占位，Claim/Withdraw 审批接入时替换为真实聚合」
- 不做本地缓存（上游 summary 已有 60s 缓存；红灯计数走 `red_pending` 绕缓存口径由 OPS-01c 保证）

## 实施要点

- zerolog `module=approval_counts`；上游失败记 Error 但**不重试**（client 已带 3 次重试，避免叠加放大）
- 未来扩展 claim/withdraw 时改为 `errgroup` 并发聚合——本期单上游不引入并发，注释预留说明

## 测试要求

table-driven：正常（red_pending_count 透出）/ 上游 5xx → 503 / 上游响应缺字段 → event_count=0 不报错 / 上游业务错 code≠0 → 503。

## 验收

`go test ./internal/handler/ -run TestApprovalCounts` 绿；对 mock-webapi 实测 curl 返回 `event_count=1`（夹具含 1 个红灯未决策）。
