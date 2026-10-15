package model

// ─── DD002 赛事风险信号灯 · upstream 路径常量 ────────────────────────────────
//
// admin-backend 是纯 proxy 层：判级逻辑唯一实现点在 web-api（DD002 §3.0），
// 本仓只做 RBAC + 限流 + 透传。以下常量与 web-api `/internal/admin/events/*`
// 五端点一一对应（契约见 docs/dd002-risk-signal/handoff/DD002-OPS-01c-internal-endpoints.md）。
const (
	// UpstreamRiskSummaryPath 四色计数 + 全局最大敞口 + 状态分布（GET）。
	UpstreamRiskSummaryPath = "/internal/admin/events/risk/summary"
	// UpstreamRiskListPath 赛事风险列表，RawQuery 原样透传（GET）。
	UpstreamRiskListPath = "/internal/admin/events/risk/list"
	// UpstreamEventDetailPath 赛事明细，%s = event_id（GET）。
	UpstreamEventDetailPath = "/internal/admin/events/%s"
	// UpstreamAdjustHistPath 赔率调整历史，%s = event_id（GET）。
	UpstreamAdjustHistPath = "/internal/admin/events/%s/adjust-history"
	// UpstreamRiskDecisionPath 红灯人工决策落库，%s = event_id（POST）。
	UpstreamRiskDecisionPath = "/internal/admin/events/%s/risk-decision"
)

// 红灯人工决策 action 协议枚举（与 web-api / 前端三方共享，docs/api.md §3.12）。
// 散落字面量易漂移，handler 校验一律引用常量。
const (
	RiskActionApproveContinue = "approve_continue" // 人工评估后恢复开盘
	RiskActionStop            = "stop"             // 维持停止接单
)

// RiskSummary 是 web-api risk/summary 响应中 counts 聚合需要解析的镜像 DTO。
//
// 设计取舍：proxy 透传型 handler（T02 五端点）不解析 body 原样回写，
// 只有 /admin/approval/counts 聚合（T03）需要读 red_pending_count 一个字段，
// 因此 DTO 仅声明该字段、其余字段忽略——避免镜像整个 summary 造成双仓字段漂移。
//
// RedPendingCount 语义（D4 拍板：审批队列只收 red）：
//   - 链上 signal=red 且 admin_risk_decisions 无有效决策记录的赛事数
//   - 即铃铛 badge 的 event_count 来源；orange 可在列表筛选但不入队不计数
//
// 注意：若上游后续在此 DTO 增加需解析的 uint64/int64 ID 字段，
// 必须带 `,string` tag（项目记忆：audit 列表 500 根因即漏 ,string）。
type RiskSummary struct {
	RedPendingCount int `json:"red_pending_count"`
}
