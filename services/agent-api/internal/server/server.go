// Package server 提供 HTTP/SSE 入口。
//
// 路由（DD-001 §5.3）：
//
//	GET  /healthz                 健康检查
//	GET  /api/push                首屏 / 翻页（cursor 分页 + 冷热路径）
//	GET  /api/push/stream         SSE 持续推送（Origin 白名单 + 全局连接上限）
//	POST /api/chat                Kimi 聊天
//	POST /api/dev/inject          注入成型卡（DEV_API_ENABLED=true 时才挂载）
//	POST /api/dev/inject-tweet    注入原始 tweet 走全链路（同上）
package server

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"sync/atomic"
	"time"

	"github.com/Crypto-Barrett/oddfi-agent-backend/internal/analysis"
	"github.com/Crypto-Barrett/oddfi-agent-backend/internal/enrich"
	"github.com/Crypto-Barrett/oddfi-agent-backend/internal/events"
	"github.com/Crypto-Barrett/oddfi-agent-backend/internal/kimi"
	"github.com/Crypto-Barrett/oddfi-agent-backend/internal/persist"
	"github.com/Crypto-Barrett/oddfi-agent-backend/internal/pushtypes"
	"github.com/Crypto-Barrett/oddfi-agent-backend/internal/store"
	"github.com/Crypto-Barrett/oddfi-agent-backend/internal/tweetcatcher"
	"golang.org/x/time/rate"
)

// 安全 / 性能常量（DD-001 §6.4 / §8.D7 / §8.D8）。
const (
	// MaxRequestBytes：POST 请求 body 上限（1 MiB），防 DoS。
	MaxRequestBytes = int64(1 << 20)
	// MaxLookbackMs：REST `before` 和 SSE `since` 的最大回溯窗口（72h）。
	MaxLookbackMs = int64(72 * 60 * 60 * 1000)
	// MaxBacklogPerSSE：SSE 连接首次补发的最大条数。
	MaxBacklogPerSSE = 500
	// MaxRESTPageLimit：单次 REST 翻页返回的最大条数。
	MaxRESTPageLimit = 100
	// DefaultRESTPageLimit：未指定 limit 时的默认值。
	DefaultRESTPageLimit = 20
	// SSEHeartbeatInterval：SSE ping 心跳间隔，防代理超时。
	// 30s 远低于 nginx/cloudflare 默认 60s 代理读超时，又把心跳开销减半（100 连接每分钟 200 帧 vs 400）。
	SSEHeartbeatInterval = 30 * time.Second
	// PersistLagBufferMs：SSE backlog 查询时往前 buffer，容忍 persist 异步写延迟。
	PersistLagBufferMs = int64(100)
	// SubBufSize：每个 SSE 订阅 channel 容量。
	SubBufSize = 64
)

// Options 装配依赖。所有字段均可为 nil 用于单测局部隔离。
type Options struct {
	Store          *store.MemoryStore
	Repo           *persist.Repo
	Bus            *events.Bus
	Persister      *persist.Persister
	Kimi           *kimi.Client
	Analysis       *analysis.Store // 欧冠决赛分析单 slot 缓存（远程整合）
	AllowedOrigins string
	MaxSSEConns    int  // 默认 100
	DevAPIEnabled  bool // 默认 false

	// ENH-002 限流相关（任一为 0 时使用下方注释中的默认值）
	SSEPerIPLimit    int // 单 IP 同时 SSE 连接上限，默认 10
	SSESoftLimitPct  int // 全局 SSE 软上限百分比 [1,100]，默认 80
	SSEMaxTrackedIPs int // SSE per-IP map 硬上限，默认 50000
	PushRatePerIP    int // /api/push per-IP 每分钟请求数，默认 60
	PushRateBurst    int // /api/push 突发，默认 3
	ChatRatePerIP    int // /api/chat per-IP 每分钟请求数，默认 10
	ChatRateBurst    int // /api/chat 突发，默认 2
	RateLimitMaxIPs  int // REST IPLimiter map 硬上限，默认 50000
}

type Server struct {
	store     *store.MemoryStore
	repo      *persist.Repo
	bus       *events.Bus
	persist   *persist.Persister
	kimi      *kimi.Client
	analysis  *analysis.Store
	origins   map[string]bool
	devAPI    bool
	maxSSE    int64
	activeSSE atomic.Int64

	// ENH-002 限流（详见 ratelimit.go）
	sseTracker  *SSEConnTracker
	pushLimiter *IPLimiter
	chatLimiter *IPLimiter
	sseSoftCap  int64 // 全局 SSE 软上限（int64 MaxSSEConns × pct/100）
}

// New 创建 Server。
func New(opt Options) *Server {
	origins := make(map[string]bool)
	for _, o := range strings.Split(opt.AllowedOrigins, ",") {
		o = strings.TrimSpace(o)
		if o != "" {
			origins[o] = true
		}
	}
	max := int64(opt.MaxSSEConns)
	if max <= 0 {
		max = 100
	}

	// ENH-002 限流参数 —— 0 值走默认，便于单测和最小配置部署
	perIPLim := opt.SSEPerIPLimit
	if perIPLim <= 0 {
		// React Strict Mode(×2) + 热重载余量 + 正常多 tab 容忍（BUG-019）
		perIPLim = 10
	}
	sseMaxIPs := opt.SSEMaxTrackedIPs
	if sseMaxIPs <= 0 {
		sseMaxIPs = 50000
	}
	pct := opt.SSESoftLimitPct
	if pct <= 0 || pct > 100 {
		pct = 80
	}
	sseSoft := max * int64(pct) / 100

	rlMaxIPs := opt.RateLimitMaxIPs
	if rlMaxIPs <= 0 {
		rlMaxIPs = 50000
	}
	pushRate := opt.PushRatePerIP
	if pushRate <= 0 {
		pushRate = 60
	}
	pushBurst := opt.PushRateBurst
	if pushBurst <= 0 {
		pushBurst = 3
	}
	chatRate := opt.ChatRatePerIP
	if chatRate <= 0 {
		chatRate = 10
	}
	chatBurst := opt.ChatRateBurst
	if chatBurst <= 0 {
		chatBurst = 2
	}

	return &Server{
		store:    opt.Store,
		repo:     opt.Repo,
		bus:      opt.Bus,
		persist:  opt.Persister,
		kimi:     opt.Kimi,
		analysis: opt.Analysis,
		origins:  origins,
		devAPI:   opt.DevAPIEnabled,
		maxSSE:   max,

		sseTracker:  NewSSEConnTracker(perIPLim, sseMaxIPs),
		sseSoftCap:  sseSoft,
		pushLimiter: NewIPLimiter(rate.Limit(float64(pushRate)/60.0), pushBurst, rlMaxIPs),
		chatLimiter: NewIPLimiter(rate.Limit(float64(chatRate)/60.0), chatBurst, rlMaxIPs),
	}
}

// StartRateLimitGC 启动后台 GC goroutine 清理 IPLimiter 过期 IP 条目。
// 必须在 New 之后调用一次；ctx cancel 时 goroutine 自动退出。
// 单测可不调用（gc 缺席不影响功能，只是内存不会回收）。
func (s *Server) StartRateLimitGC(ctx context.Context) {
	if s.pushLimiter != nil {
		s.pushLimiter.RunGC(ctx, 5*time.Minute, 60*time.Minute)
	}
	if s.chatLimiter != nil {
		s.chatLimiter.RunGC(ctx, 5*time.Minute, 60*time.Minute)
	}
}

// Routes 返回完整路由。
//
// /api/push 与 /api/chat 包裹 per-IP rate limit middleware（ENH-002）。
// /api/push/stream 不在此层限流 —— 它在 handleStream 内做 per-IP 连接计数
// 和全局软上限（因为 SSE 的连接生命周期跟 token bucket 模型不匹配）。
// /healthz / /api/analysis / /api/dev/* 不限流：监控端点、单 slot 内存读、
// dev gate 端点频次都低 + 影响面有限。
func (s *Server) Routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", s.handleHealth)
	mux.Handle("/api/push",
		rateLimitMiddleware(s.pushLimiter, 60)(http.HandlerFunc(s.handleListPush)))
	mux.HandleFunc("/api/push/stream", s.handleStream)
	mux.Handle("/api/chat",
		rateLimitMiddleware(s.chatLimiter, 60)(http.HandlerFunc(s.handleChat)))
	mux.HandleFunc("/api/analysis", s.handleAnalysis)
	if s.devAPI {
		mux.HandleFunc("/api/dev/inject", s.handleInjectCard)
		mux.HandleFunc("/api/dev/inject-tweet", s.handleInjectTweet)
		mux.HandleFunc("/api/dev/analysis/regen", s.handleAnalysisRegen)
	}
	return s.withCORS(mux)
}

// withCORS 处理 preflight + 简单跨域响应头。
// origin 白名单由 originAllowed 统一裁决（cors.go），sse.go 复用同一函数。
// SSE 走单独 Origin 白名单（EventSource 不发 preflight），见 handleStream。
func (s *Server) withCORS(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if s.origins["*"] {
			w.Header().Set("Access-Control-Allow-Origin", "*")
		} else if s.originAllowed(origin) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
		}
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Last-Event-ID")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		h.ServeHTTP(w, r)
	})
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	count := 0
	if s.store != nil {
		count = s.store.Count()
	}
	analysisStatus := "none"
	if s.analysis != nil {
		if a := s.analysis.Get(); a != nil {
			analysisStatus = a.Match
		}
	}
	fmt.Fprintf(w, "ok · cards=%d · sse=%d/%d · analysis=%s",
		count, s.activeSSE.Load(), s.maxSSE, analysisStatus)
}

// GET /api/push?limit=20&before=<ingestedAt>
//
// 冷热路径（DD-001 §5.1）：
//   - before > 内存最旧 → store.ListBefore（热）
//   - 否则 → repo.QueryCardsBefore（冷）
func (s *Server) handleListPush(w http.ResponseWriter, r *http.Request) {
	limit := DefaultRESTPageLimit
	if l := r.URL.Query().Get("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil && v > 0 {
			limit = v
		}
	}
	if limit > MaxRESTPageLimit {
		limit = MaxRESTPageLimit
	}

	now := time.Now().UnixMilli()
	var before int64 = now + 1 // 默认取最新（before=now+1 把当前时刻的卡也包含）
	truncated := false
	if b := r.URL.Query().Get("before"); b != "" {
		if v, err := strconv.ParseInt(b, 10, 64); err == nil && v > 0 {
			before = v
		}
	}
	// clamp 72h（R-C3）
	if floor := now - MaxLookbackMs; before < floor {
		before = floor
		truncated = true
	}

	cards := s.fetchBefore(r.Context(), before, limit)

	var next, latest int64
	if len(cards) > 0 {
		// cards 已按 DESC 排：首条最新（latest），末条最老（next 用作下页 before）。
		latest = cards[0].IngestedAt
		next = cards[len(cards)-1].IngestedAt
	}
	hasMore := len(cards) == limit // 简化判定：满页就当还有

	resp := map[string]any{
		"items":     cards,
		"count":     len(cards),
		"hasMore":   hasMore,
		"truncated": truncated,
		"cursor": map[string]int64{
			"next":   next,
			"latest": latest,
		},
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp)
}

// fetchBefore 决定走热/冷路径取卡，热路径不足时与 DB 合并补齐。
//
// 旧实现 bug：热路径返回 1 条但 limit=20 时直接返回 1 条，前端会判 hasMore=false 误以为到底。
// 修正：热路径不足且 repo 在场时，用 DB 补齐剩余条数（按 IngestedAt 严格小于热路径最末一条以去重）。
func (s *Server) fetchBefore(ctx context.Context, before int64, limit int) []*pushtypes.PushCard {
	if s.store == nil {
		return s.repoQueryBefore(ctx, before, limit)
	}
	oldest, ok := s.store.OldestIngestedAt()
	// 热路径条件：内存能完整覆盖区间（before 比内存最旧还新，或池未满）
	hotPathCovers := !ok || before > oldest || s.store.Count() < store.MaxCards
	if !hotPathCovers {
		return s.repoQueryBefore(ctx, before, limit)
	}
	hot := s.store.ListBefore(before, limit)
	if len(hot) >= limit || s.repo == nil {
		return hot
	}
	// 热路径未满 limit：用 DB 补齐。boundary 取热路径最末（最老）条的 IngestedAt 严格更老。
	// hot 为空时降级到原始 before（这也是 ok==false 但池子里没东西的情况）。
	boundary := before
	if len(hot) > 0 {
		boundary = hot[len(hot)-1].IngestedAt
	}
	more := s.repoQueryBefore(ctx, boundary, limit-len(hot))
	return append(hot, more...)
}

func (s *Server) repoQueryBefore(ctx context.Context, before int64, limit int) []*pushtypes.PushCard {
	if s.repo == nil {
		return nil
	}
	cards, err := s.repo.QueryCardsBefore(ctx, before, limit)
	if err != nil {
		log.Printf("[Server] repo.QueryCardsBefore err=%v", err)
		return nil
	}
	return cards
}

type chatReq struct {
	Messages []struct {
		Role    string `json:"role"`
		Content string `json:"content"`
	} `json:"messages"`
}

func (s *Server) handleChat(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "POST only", http.StatusMethodNotAllowed)
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, MaxRequestBytes) // 防 OOM / DoS
	var req chatReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if len(req.Messages) == 0 {
		http.Error(w, "messages required", http.StatusBadRequest)
		return
	}
	if s.kimi == nil {
		http.Error(w, "chat service unavailable", http.StatusServiceUnavailable)
		return
	}
	history := make([]kimi.ChatMessage, 0, len(req.Messages))
	for _, m := range req.Messages {
		history = append(history, kimi.ChatMessage{Role: m.Role, Content: m.Content})
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()
	reply, err := s.kimi.ChatComplete(ctx, history)
	if err != nil {
		// R1.C1：不透传 LLM 错误内容到客户端
		log.Printf("[Server] chat error: %v", err)
		http.Error(w, "chat service unavailable", http.StatusServiceUnavailable)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"reply":     reply,
		"timestamp": time.Now().UnixMilli(),
	})
}

// POST /api/dev/inject — 直接注入一张成型 PushCard（跳过 Kimi）
//
// 仅在 DEV_API_ENABLED=true 时挂载（R1.C3）。
func (s *Server) handleInjectCard(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "POST only", http.StatusMethodNotAllowed)
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, MaxRequestBytes) // 防 OOM / DoS：限 body 大小防 DoS
	var c pushtypes.PushCard
	if err := json.NewDecoder(r.Body).Decode(&c); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	// dev inject 绕过 LLM，攻击者可直接灌入 HTML 字段；与 persist 层入库前的清洗形成双层防御。
	persist.SanitizeAiAnalysis(c.AiAnalysis)
	now := time.Now().UnixMilli()
	if c.ID == "" {
		c.ID = fmt.Sprintf("dev_%d", now)
	}
	if c.CreatedAt == 0 {
		c.CreatedAt = now
	}
	if c.IngestedAt == 0 {
		c.IngestedAt = now
	}
	if c.UpdatedAt == 0 {
		c.UpdatedAt = now
	}
	if c.EnrichStatus == "" {
		c.EnrichStatus = pushtypes.EnrichStatusOK // dev 注入默认已增强
		c.AiEnriched = true                       // 兼容期
	}
	if c.Time == "" {
		c.Time = pushtypes.FormatRelativeTime(c.CreatedAt) // 兼容期
	}
	added := false
	if s.store != nil {
		added = s.store.Add(&c)
	}
	if added {
		if s.persist != nil {
			s.persist.Enqueue(persist.WriteOp{Kind: "insert", Card: &c})
		}
		if s.bus != nil {
			s.bus.Publish(events.CardNew{Card: &c})
		}
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"added": added, "id": c.ID})
}

type injectTweetReq struct {
	Handle string                `json:"handle"`
	Post   tweetcatcher.PostData `json:"post"`
}

func (s *Server) handleInjectTweet(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "POST only", http.StatusMethodNotAllowed)
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, MaxRequestBytes) // 防 OOM / DoS
	var req injectTweetReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	now := time.Now().UnixMilli()
	if req.Post.ID == "" {
		req.Post.ID = fmt.Sprintf("dev_tweet_%d", now)
	}
	if req.Post.CreatedAt == 0 {
		req.Post.CreatedAt = now
	}

	base := pushtypes.BuildBaseCard(
		req.Post.ID,
		req.Handle,
		req.Post.Author.Handle,
		req.Post.Author.Name,
		req.Post.Text,
		req.Post.CreatedAt,
	)
	added := false
	if s.store != nil {
		added = s.store.Add(base)
	}
	if added {
		if s.persist != nil {
			s.persist.Enqueue(persist.WriteOp{Kind: "insert", Card: base})
		}
		if s.bus != nil {
			s.bus.Publish(events.CardNew{Card: base})
		}
	}

	// 同步 enrich（inject 用于本地调试，等结果方便看输出）。
	// 复用 enrich.Apply：与 pool worker 走同一三态状态机，避免 dev 路径与生产路径行为漂移。
	enrichStatus := pushtypes.EnrichStatusPending
	enrichErr := ""
	if s.kimi != nil && s.store != nil {
		ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
		defer cancel()
		enr, err := kimi.EnrichTweet(ctx, s.kimi, &req.Post, req.Handle)
		enrichStatus, enrichErr = enrich.Apply(s.store, s.persist, s.bus, base.ID, enr, err)
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"added":        added,
		"id":           base.ID,
		"enrichStatus": enrichStatus,
		"skipped":      enrichStatus == pushtypes.EnrichStatusSkipped,
		"enrichErr":    enrichErr,
	})
}

// GET /api/analysis — 返回当前的赛前分析（远程整合）。
func (s *Server) handleAnalysis(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if s.analysis == nil {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ready": false, "reason": "analysis store not configured",
		})
		return
	}
	a := s.analysis.Get()
	if a == nil {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ready":  false,
			"reason": "等待首次生成（启动后约 30 秒）",
		})
		return
	}
	_ = json.NewEncoder(w).Encode(map[string]any{"ready": true, "analysis": a})
}

// POST /api/dev/analysis/regen — 同步触发一次分析生成（仅 dev gate 开启时挂载）。
func (s *Server) handleAnalysisRegen(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "POST only", http.StatusMethodNotAllowed)
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, MaxRequestBytes)
	if s.kimi == nil || s.analysis == nil || s.store == nil {
		http.Error(w, "analysis unavailable", http.StatusServiceUnavailable)
		return
	}
	log.Printf("[Server] analysis manual regen requested")
	ctx, cancel := context.WithTimeout(r.Context(), 60*time.Second)
	defer cancel()
	pushes := s.store.ListRecent(20)
	a, err := analysis.Generate(ctx, s.kimi, pushes)
	if err != nil {
		// R1.C1：不透传 LLM 错误细节
		log.Printf("[Server] analysis regen error: %v", err)
		http.Error(w, "analysis unavailable", http.StatusServiceUnavailable)
		return
	}
	s.analysis.Set(a)
	log.Printf("[Server] analysis regenerated match=%s", a.Match)
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"ok": true, "analysis": a})
}
