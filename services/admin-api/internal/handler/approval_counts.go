package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/client"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/model"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/pkg/errcode"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/pkg/logger"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/pkg/response"
)

// ApprovalCountsHandler 铃铛红点聚合端点（DD002 T03）。
//
// event_count = upstream summary.red_pending_count（D4 拍板：审批队列只收 red，
// orange 仅列表可筛不入队不计数）。claim/withdraw 为占位 0。
type ApprovalCountsHandler struct {
	wc *client.Client
}

// NewApprovalCounts 构造 handler。wc 为 nil 时仅用于 RBAC 单测。
func NewApprovalCounts(wc *client.Client) *ApprovalCountsHandler {
	return &ApprovalCountsHandler{wc: wc}
}

// approvalCountsResp /admin/approval/counts 响应体。
type approvalCountsResp struct {
	EventCount int `json:"event_count"`
	// ClaimCount / WithdrawCount 占位 0：Claim / Withdraw 审批接入时替换为真实聚合。
	// 届时改为 errgroup 并发聚合多上游——本期单上游不引入并发（T03 实施要点预留）。
	ClaimCount    int `json:"claim_count"`
	WithdrawCount int `json:"withdraw_count"`
}

// Counts GET /admin/approval/counts — 审批计数聚合。
//
// 降级语义（M-Arch-4）：上游不可达 / 5xx / 业务错 → 503 UPSTREAM_UNAVAILABLE，
// 前端约定 badge 保持上次值不弹错（T08 配套）。
// 不做本地缓存：上游 summary 已有 60s 缓存；红灯计数走 red_pending 绕缓存口径由 web-api 保证。
// 不在本层重试：client 已带 3 次重试，叠加会放大上游故障期压力。
func (h *ApprovalCountsHandler) Counts(c *gin.Context) {
	var summary model.RiskSummary
	if err := h.wc.Get(c.Request.Context(), model.UpstreamRiskSummaryPath, extractJWT(c), "", &summary); err != nil {
		// 任何上游失败（5xx / 网络 / 业务错 code≠0）统一降级——badge 是非关键路径，
		// 不区分错误形态，避免前端分支爆炸
		logger.L().Error().Err(err).
			Str("module", "approval_counts").
			Msg("fetch risk summary failed, degrade to UPSTREAM_UNAVAILABLE")
		response.Error(c, http.StatusServiceUnavailable, errcode.UpstreamUnavailable, "webapi internal unavailable")
		return
	}
	response.OK(c, approvalCountsResp{
		EventCount:    summary.RedPendingCount,
		ClaimCount:    0,
		WithdrawCount: 0,
	})
}
