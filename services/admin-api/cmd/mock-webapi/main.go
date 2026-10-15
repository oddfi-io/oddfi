// mock-webapi 是 DD002 联调 A 专用的 web-api internal mock 上游（:9090）。
//
// ⚠️ 仅本地联调使用，禁止部署到任何服务器：
//   - 不做 HMAC 校验（X-Service-Sig 不验）
//   - X-Admin-JWT 只做无签名验证的 payload 解码（取 decided_by 演示用）
//   - risk-decision 状态存内存，重启复位
//
// 用法：
//
//	go run ./cmd/mock-webapi           # 监听 :9090
//	go run ./cmd/mock-webapi -addr :9191
//
// 之后把 admin-backend config 的 webapi.internal_url 指到 http://127.0.0.1:9090，
// 即可在没有 C 端 OPS-01c 交付的情况下联调全部 6 条 /admin 路由。
package main

import (
	"encoding/base64"
	"encoding/json"
	"flag"
	"net/http"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"github.com/shopspring/decimal"
)

func main() {
	// 默认只绑回环：mock 无 HMAC 校验，绑 0.0.0.0 误部署即裸内网通道（review Sec-M1）。
	// 确需跨机联调时显式传 -addr 0.0.0.0:9090，风险自担。
	addr := flag.String("addr", "127.0.0.1:9090", "listen address（默认仅回环）")
	flag.Parse()

	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})

	s := newStore()
	mux := http.NewServeMux()

	// Go 1.22+ ServeMux：静态段优先于通配段，/risk/summary 不会被 {event_id} 吞掉
	mux.HandleFunc("GET /internal/admin/events/risk/summary", s.handleSummary)
	mux.HandleFunc("GET /internal/admin/events/risk/list", s.handleList)
	mux.HandleFunc("GET /internal/admin/events/{event_id}", s.handleDetail)
	mux.HandleFunc("GET /internal/admin/events/{event_id}/adjust-history", s.handleAdjustHistory)
	mux.HandleFunc("POST /internal/admin/events/{event_id}/risk-decision", s.handleRiskDecision)

	log.Info().Str("module", "mock_webapi").Str("addr", *addr).Msg("mock-webapi listening (联调 A 专用，禁止部署)")
	if err := http.ListenAndServe(*addr, mux); err != nil {
		log.Fatal().Err(err).Str("module", "mock_webapi").Msg("listen failed")
	}
}

// ─── 响应壳 ──────────────────────────────────────────────────────────────────

// okJSON 写 {code:0,message:"ok",data:...} 成功壳。
func okJSON(w http.ResponseWriter, data any) {
	writeJSON(w, http.StatusOK, map[string]any{"code": 0, "message": "ok", "data": data})
}

// bizErr 写 HTTP 200 + code 非 0 字符串的业务错误壳（web-api 统一形态）。
func bizErr(w http.ResponseWriter, code, msg string) {
	writeJSON(w, http.StatusOK, map[string]any{"code": code, "message": msg, "data": nil})
}

// httpErr 写 HTTP 4xx + code 字符串壳。
func httpErr(w http.ResponseWriter, status int, code, msg string) {
	writeJSON(w, status, map[string]any{"code": code, "message": msg, "data": nil})
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(body); err != nil {
		log.Error().Err(err).Str("module", "mock_webapi").Msg("encode response")
	}
}

// ─── 端点实现 ────────────────────────────────────────────────────────────────

func (s *store) handleSummary(w http.ResponseWriter, _ *http.Request) {
	okJSON(w, s.summaryData())
}

// handleList 支持联调 A 必测的筛选形态：
// status=all/active/pending/settled、signal 逗号多值（?signal=red,orange）、
// sort_by=bet/exposure/time + sort_order、page/page_size。
func (s *store) handleList(w http.ResponseWriter, r *http.Request) {
	s.mu.Lock()
	defer s.mu.Unlock()

	q := r.URL.Query()
	status := q.Get("status")
	signalSet := map[string]bool{}
	if raw := q.Get("signal"); raw != "" && raw != "all" {
		for _, sig := range strings.Split(raw, ",") {
			if sig = strings.TrimSpace(sig); sig != "" {
				signalSet[sig] = true
			}
		}
	}

	filtered := make([]*mockEvent, 0, len(s.events))
	for _, e := range s.events {
		if status != "" && status != "all" && e.Status != status {
			continue
		}
		// signal 筛选用展示信号；未开盘（Signal=nil）在显式筛灯色时排除
		if len(signalSet) > 0 {
			if e.Signal == nil || !signalSet[*e.Signal] {
				continue
			}
		}
		filtered = append(filtered, e)
	}

	sortEvents(filtered, q.Get("sort_by"), q.Get("sort_order"))

	page, _ := strconv.Atoi(q.Get("page"))
	if page < 1 {
		page = 1
	}
	pageSize, _ := strconv.Atoi(q.Get("page_size"))
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	total := len(filtered)
	start := (page - 1) * pageSize
	if start > total {
		start = total
	}
	end := start + pageSize
	if end > total {
		end = total
	}

	okJSON(w, map[string]any{
		"list": filtered[start:end], "total": total,
		"page": page, "page_size": pageSize,
	})
}

// sortEvents 按 sort_by 排序：bet=下注总额 / exposure=最大敞口 / time=开赛时间。
// 默认 desc；null 值排尾。
func sortEvents(list []*mockEvent, sortBy, order string) {
	if sortBy == "" {
		return
	}
	asc := order == "asc"
	dec := func(p *string) decimal.Decimal {
		if p == nil {
			return decimal.New(-1, 18) // null 排尾哨兵
		}
		d, err := decimal.NewFromString(*p)
		if err != nil {
			return decimal.New(-1, 18)
		}
		return d
	}
	sort.SliceStable(list, func(i, j int) bool {
		var less bool
		switch sortBy {
		case "bet":
			less = dec(list[i].BetAmountTotal).LessThan(dec(list[j].BetAmountTotal))
		case "exposure":
			less = dec(list[i].MaxExposure).LessThan(dec(list[j].MaxExposure))
		case "time":
			ti, tj := "", ""
			if list[i].Times.Kickoff != nil {
				ti = *list[i].Times.Kickoff
			}
			if list[j].Times.Kickoff != nil {
				tj = *list[j].Times.Kickoff
			}
			less = ti < tj
		default:
			return false
		}
		if asc {
			return less
		}
		return !less
	})
}

func (s *store) handleDetail(w http.ResponseWriter, r *http.Request) {
	s.mu.Lock()
	defer s.mu.Unlock()

	e := s.findEvent(r.PathValue("event_id"))
	if e == nil {
		httpErr(w, http.StatusNotFound, "EVENT_NOT_FOUND", "event not found")
		return
	}
	// 明细 = 列表行字段 + markets 展开
	detail := map[string]any{}
	raw, err := json.Marshal(e)
	if err != nil {
		httpErr(w, http.StatusInternalServerError, "INTERNAL_ERROR", "marshal event")
		return
	}
	if err := json.Unmarshal(raw, &detail); err != nil {
		httpErr(w, http.StatusInternalServerError, "INTERNAL_ERROR", "unmarshal event")
		return
	}
	detail["markets"] = s.details[e.EventID]
	okJSON(w, detail)
}

func (s *store) handleAdjustHistory(w http.ResponseWriter, r *http.Request) {
	s.mu.Lock()
	defer s.mu.Unlock()

	e := s.findEvent(r.PathValue("event_id"))
	if e == nil {
		httpErr(w, http.StatusNotFound, "EVENT_NOT_FOUND", "event not found")
		return
	}
	market := r.URL.Query().Get("market")
	direction := r.URL.Query().Get("direction")

	records := make([]mockAdjustRecord, 0)
	for _, rec := range s.adjustHist[e.EventID] {
		if market != "" && rec.MarketName != market {
			continue
		}
		if direction != "" && rec.DirectionName != direction {
			continue
		}
		records = append(records, rec)
	}
	okJSON(w, map[string]any{"list": records, "total": len(records)})
}

// riskDecisionReq 决策入参（operator 不收 body，从 X-Admin-JWT 解码——DD §3.2）。
type riskDecisionReq struct {
	Action string `json:"action"`
	Remark string `json:"remark"`
}

// handleRiskDecision 有状态决策（DD §3.3 状态机的 mock 实现）：
//   - 事件不存在 → 404 EVENT_NOT_FOUND
//   - 链上信号非 red → EVENT_NOT_RED_SIGNAL（业务错误壳）
//   - 已决策且未重升（pending_decision=false）→ RISK_DECISION_CONFLICT
//   - 成功 → 落 decision、pending=false、展示信号降级 orange、badge 减一
func (s *store) handleRiskDecision(w http.ResponseWriter, r *http.Request) {
	s.mu.Lock()
	defer s.mu.Unlock()

	e := s.findEvent(r.PathValue("event_id"))
	if e == nil {
		httpErr(w, http.StatusNotFound, "EVENT_NOT_FOUND", "event not found")
		return
	}

	var req riskDecisionReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpErr(w, http.StatusBadRequest, "INVALID_PARAM", "invalid json body")
		return
	}
	if e.ChainSignal != "red" {
		bizErr(w, "EVENT_NOT_RED_SIGNAL", "only red signal events allow manual decision")
		return
	}
	if !e.PendingDecision {
		// 本轮风险已有决策（admin_risk_decisions 唯一约束的 mock 等价行为）
		bizErr(w, "RISK_DECISION_CONFLICT", "decision already exists for current risk round")
		return
	}

	now := time.Now().UTC().Format(time.RFC3339)
	decidedBy := decodeJWTUserID(r.Header.Get("X-Admin-JWT"))
	e.Decision = &mockDecision{
		Action: req.Action, DecidedBy: decidedBy, DecidedAt: now, Remark: req.Remark,
	}
	e.PendingDecision = false
	// 决策态盖过展示：链上仍 red，但展示降级 orange（原型 :4429）
	e.Signal = strPtr("orange")

	log.Info().Str("module", "mock_webapi").Str("event_id", e.EventID).
		Str("action", req.Action).Str("decided_by", decidedBy).Msg("risk decision recorded")

	okJSON(w, map[string]any{
		"event_id": e.EventID, "action": req.Action,
		"decided_by": decidedBy, "decided_at": now,
		"effective_signal": "orange", "queue_cleared": true,
	})
}

// findEvent 按 event_id 查事件；调用方需持锁。
func (s *store) findEvent(id string) *mockEvent {
	for _, e := range s.events {
		if e.EventID == id {
			return e
		}
	}
	return nil
}

// decodeJWTUserID 无签名验证地解出 JWT payload 的 user_id（仅 mock 演示
// 「decided_by=JWT 身份」联调项；生产侧由 web-api 验签后解码）。
func decodeJWTUserID(jwt string) string {
	parts := strings.Split(jwt, ".")
	if len(parts) != 3 {
		return "lark:ou_mock_admin"
	}
	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return "lark:ou_mock_admin"
	}
	// admin JWT 的用户标识在标准 sub claim（internal/pkg/jwt internalClaims 嵌
	// RegisteredClaims）；user_id 字段作兼容兜底
	var claims struct {
		Sub    string `json:"sub"`
		UserID string `json:"user_id"`
	}
	if err := json.Unmarshal(payload, &claims); err != nil {
		return "lark:ou_mock_admin"
	}
	if claims.Sub != "" {
		return claims.Sub
	}
	if claims.UserID != "" {
		return claims.UserID
	}
	return "lark:ou_mock_admin"
}
