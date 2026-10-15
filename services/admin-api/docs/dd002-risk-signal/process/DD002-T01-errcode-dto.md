# DD002-T01 · errcode + 共享 DTO + upstream 路径常量

> 方案：[`../DD.md`](../DD.md) §3.2/§3.3
> 索引：[`./README.md`](./README.md)
> 前置：无
> 下游：T02（handler 用 errcode/DTO）、T03（counts 解析 summary DTO）

## 目标

落地信号灯模块的公共地基：错误码常量、与 web-api internal 契约对齐的镜像 DTO（仅 counts 聚合需要解析的部分）、upstream 路径常量。proxy 透传型 handler 不解析 body，**只有 T03 聚合需要 summary DTO**，避免过度建模。

## 文件清单

- `internal/pkg/errcode/errcode.go` — 修改：新增 4 常量
- `internal/model/events_risk.go` — 新建：`RiskSummary` DTO（counts 聚合解析用）+ upstream 路径常量
- `internal/model/events_risk_test.go` — 新建：DTO 反序列化测试

## 接口设计 / 行为约定

```go
// errcode 新增
EventNotFound        = "EVENT_NOT_FOUND"
EventNotRedSignal    = "EVENT_NOT_RED_SIGNAL"     // 仅红灯允许人工决策（PRD §5.5）
RiskDecisionConflict = "RISK_DECISION_CONFLICT"   // admin_risk_decisions 唯一约束冲突
UpstreamUnavailable  = "UPSTREAM_UNAVAILABLE"     // web-api internal 不可达

// model/events_risk.go
const (
    UpstreamRiskSummaryPath  = "/internal/admin/events/risk/summary"
    UpstreamRiskListPath     = "/internal/admin/events/risk/list"
    UpstreamEventDetailPath  = "/internal/admin/events/%s"                 // event_id
    UpstreamAdjustHistPath   = "/internal/admin/events/%s/adjust-history"
    UpstreamRiskDecisionPath = "/internal/admin/events/%s/risk-decision"
)

// RiskSummary 仅声明 counts 聚合需要的字段，其余字段 proxy 原样透传不解析
type RiskSummary struct {
    RedPendingCount int `json:"red_pending_count"`
}
```

## 实施要点

- ID 类字段若后续需解析，一律 `uint64 + ,string` tag（项目记忆：audit 500 根因）
- 错误码字符串与 docs/api.md §1.2 完全一致（T05 同步）
- 中文注释说明 `RedPendingCount` 与 D4 拍板（队列只收 red）的关系

## 测试要求

table-driven：`RiskSummary` 反序列化（正常 / 缺字段零值 / 多余字段忽略）。

## 验收

`go vet ./... && go test ./internal/...` 绿；errcode 无重复值。
