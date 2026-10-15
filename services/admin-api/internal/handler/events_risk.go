package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/client"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/middleware"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/model"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/pkg/errcode"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/pkg/logger"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/pkg/response"
)

// EventsRiskHandler 赛事风险信号灯 proxy 薄壳（DD002 T02）。
//
// 设计：判级逻辑唯一实现点在 web-api internal（DD002 §3.0），本 handler 零判级、
// 零业务逻辑，仅做参数门卫 + RawQuery 原样透传 + 错误翻译，照 presale_audit.go 模式。
type EventsRiskHandler struct {
	wc *client.Client
}

// NewEventsRisk 构造 handler。wc 为 nil 时仅用于 RBAC 单测。
func NewEventsRisk(wc *client.Client) *EventsRiskHandler {
	return &EventsRiskHandler{wc: wc}
}

// Summary GET /admin/events/risk/summary — 四色计数 + 全局最大敞口 + 状态分布。
func (h *EventsRiskHandler) Summary(c *gin.Context) {
	h.proxyGet(c, model.UpstreamRiskSummaryPath, "risk summary")
}

// List GET /admin/events/risk/list — 赛事风险列表。
// RawQuery 原样透传：signal 逗号多值（?signal=red,orange）/ status / sort_by /
// sort_order / page / page_size 全部不解析，由 web-api 拆分（DD002 §3.2，H-FE-1）。
func (h *EventsRiskHandler) List(c *gin.Context) {
	h.proxyGet(c, model.UpstreamRiskListPath, "risk list")
}

// Detail GET /admin/events/:event_id — 赛事明细（markets[] → directions[]）。
func (h *EventsRiskHandler) Detail(c *gin.Context) {
	eventID, ok := requireNumericEventID(c)
	if !ok {
		return
	}
	h.proxyGet(c, fmt.Sprintf(model.UpstreamEventDetailPath, eventID), "event detail")
}

// AdjustHistory GET /admin/events/:event_id/adjust-history — 赔率调整历史。
// market / direction 过滤参数随 RawQuery 透传。
func (h *EventsRiskHandler) AdjustHistory(c *gin.Context) {
	eventID, ok := requireNumericEventID(c)
	if !ok {
		return
	}
	h.proxyGet(c, fmt.Sprintf(model.UpstreamAdjustHistPath, eventID), "adjust history")
}

// riskDecisionReq 红灯人工决策入参。
// 注意：不含 operator 字段——决策人由 web-api 从透传的 X-Admin-JWT 解码注入，
// 不信任 body 传入（DD002 §3.2 修正 PRD §5.5 安全瑕疵）。body 里多余字段一律丢弃。
type riskDecisionReq struct {
	Action string `json:"action" binding:"required"`
	Remark string `json:"remark" binding:"required"`
}

// RiskDecision POST /admin/events/:event_id/risk-decision — 红灯人工决策。
//
// 门卫职责（业务规则在 web-api）：
//  1. X-Idempotency-Key 必带（缺 → 400 INVALID_PARAM）
//  2. action ∈ {approve_continue, stop}、remark 非空
//  3. 转发后 upstream 业务错误码（EVENT_NOT_RED_SIGNAL / RISK_DECISION_CONFLICT）原样透传
func (h *EventsRiskHandler) RiskDecision(c *gin.Context) {
	eventID, ok := requireNumericEventID(c)
	if !ok {
		return
	}
	// 幂等 key 由前端生成并透传，admin-backend 不代生成（与 presale 同约定）。
	// 上限 128：uuid 36 字符富余即可，防超长 header 放大到上游（review Sec-M2）
	idemKey := c.GetHeader("X-Idempotency-Key")
	if idemKey == "" {
		response.Error(c, http.StatusBadRequest, errcode.InvalidParam, "X-Idempotency-Key header is required")
		return
	}
	if len(idemKey) > 128 {
		response.Error(c, http.StatusBadRequest, errcode.InvalidParam, "X-Idempotency-Key too long (max 128)")
		return
	}

	var req riskDecisionReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, errcode.InvalidParam, "action and remark are required")
		return
	}
	if req.Action != model.RiskActionApproveContinue && req.Action != model.RiskActionStop {
		response.Error(c, http.StatusBadRequest, errcode.InvalidParam, "action must be approve_continue or stop")
		return
	}
	// remark 强制非空白（审批留痕，PRD §7.1 强制 remark）；
	// 上限 500 字符：防日志/审计存储放大（review Sec-M2），按 rune 计数对中文友好
	if strings.TrimSpace(req.Remark) == "" {
		response.Error(c, http.StatusBadRequest, errcode.InvalidParam, "remark must not be blank")
		return
	}
	if len([]rune(req.Remark)) > 500 {
		response.Error(c, http.StatusBadRequest, errcode.InvalidParam, "remark too long (max 500 chars)")
		return
	}

	path := fmt.Sprintf(model.UpstreamRiskDecisionPath, eventID)
	var out json.RawMessage
	if err := h.wc.Post(c.Request.Context(), path, extractJWT(c), idemKey, req, &out); err != nil {
		eventsProxyErr(c, err, "risk decision")
		return
	}
	// 决策属敏感操作，记审计级日志；JWT 原文绝不入日志（lark-oauth.md §4）
	logger.L().Info().
		Str("module", "events_risk").
		Str("event_id", eventID).
		Str("action", req.Action).
		Str("admin_user_id", c.GetString(middleware.CtxAdminUserID)).
		Msg("risk decision forwarded")
	response.OK(c, out)
}

// ─── 内部工具 ────────────────────────────────────────────────────────────────

// proxyGet 只读端点的统一透传：拼 RawQuery → 调上游 → data 原样回写。
// out 用 json.RawMessage 保证响应体逐字节透传，不做镜像 DTO 解析（避免双仓字段漂移）。
func (h *EventsRiskHandler) proxyGet(c *gin.Context, path, action string) {
	if q := c.Request.URL.RawQuery; q != "" {
		path += "?" + q
	}
	var out json.RawMessage
	if err := h.wc.Get(c.Request.Context(), path, extractJWT(c), "", &out); err != nil {
		eventsProxyErr(c, err, action)
		return
	}
	response.OK(c, out)
}

// requireNumericEventID 校验 path param event_id 非空、纯数字、长度 ≤ 20。
// event = fixture，ID 是 int64（D3 拍板），任何非数字直接 400 不打上游；
// 长度上限 20 = int64 最大 19 位 + 1 位余量，把超长非法 ID 挡在 proxy 层（review M-2）。
// 失败时已写响应，调用方应直接 return。
func requireNumericEventID(c *gin.Context) (string, bool) {
	id := c.Param("event_id")
	if id == "" || len(id) > 20 || !isAllDigits(id) {
		response.Error(c, http.StatusBadRequest, errcode.InvalidParam, "event_id must be a numeric id")
		return "", false
	}
	return id, true
}

// isAllDigits 判断字符串是否全为 ASCII 数字（不允许符号 / 空串）。
// 不用 strconv.ParseUint：event_id 仅做透传，避免 uint64 溢出边界误伤合法大 ID。
func isAllDigits(s string) bool {
	if s == "" {
		return false
	}
	for _, r := range s {
		if r < '0' || r > '9' {
			return false
		}
	}
	return true
}

// eventsProxyErr 将 web-api client 错误翻译为对前端的标准响应（DD002 T02）：
//   - BusinessError（HTTP 200 + code≠0）→ 原 code/message 透传（业务错误壳，如 EVENT_NOT_RED_SIGNAL）
//   - HTTPError 5xx → 503 UPSTREAM_UNAVAILABLE（降级语义：前端 badge 保持上次值不弹错）
//   - HTTPError 4xx → 透传上游状态码 + code（如 404 EVENT_NOT_FOUND）
//   - 其余（网络 / 序列化）→ 503 UPSTREAM_UNAVAILABLE
func eventsProxyErr(c *gin.Context, err error, action string) {
	var bizErr *client.BusinessError
	if errors.As(err, &bizErr) {
		// web-api 业务错误：HTTP 200 + code 字符串壳原样回写。
		// 故意绕 response 包：bizErr.Code 是 any 类型（上游可能回 int 0 或字符串码），
		// response.Error 只收 string code 无法透传（review M-1 注记）
		c.JSON(http.StatusOK, gin.H{"code": bizErr.Code, "message": bizErr.Message, "data": nil})
		return
	}
	if httpErr, ok := client.IsHTTPError(err); ok {
		if httpErr.StatusCode >= 500 {
			logger.L().Error().Err(err).
				Str("module", "events_risk").
				Str("action", action).
				Msg("upstream 5xx, degrade to UPSTREAM_UNAVAILABLE")
			response.Error(c, http.StatusServiceUnavailable, errcode.UpstreamUnavailable, "webapi internal unavailable")
			return
		}
		// 4xx：让前端直接看到上游业务错误（如 EVENT_NOT_FOUND）。
		// 留 Warn 日志便于本侧排障（review M-3）；只记状态码不记 body，防信息泄漏进日志。
		// 同样故意绕 response 包：proxyErrBody 透传上游 any 类型 code（review M-1 注记）
		logger.L().Warn().
			Str("module", "events_risk").
			Str("action", action).
			Int("upstream_status", httpErr.StatusCode).
			Msg("upstream 4xx passthrough")
		c.JSON(httpErr.StatusCode, proxyErrBody(httpErr))
		return
	}
	// 网络错误 / 响应解析失败：对前端统一降级语义
	logger.L().Error().Err(err).
		Str("module", "events_risk").
		Str("action", action).
		Msg("webapi client error, degrade to UPSTREAM_UNAVAILABLE")
	response.Error(c, http.StatusServiceUnavailable, errcode.UpstreamUnavailable, "webapi internal unavailable")
}
