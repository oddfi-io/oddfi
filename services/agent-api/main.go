package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/Crypto-Barrett/oddfi-agent-backend/internal/analysis"
	"github.com/Crypto-Barrett/oddfi-agent-backend/internal/config"
	"github.com/Crypto-Barrett/oddfi-agent-backend/internal/enrich"
	"github.com/Crypto-Barrett/oddfi-agent-backend/internal/events"
	"github.com/Crypto-Barrett/oddfi-agent-backend/internal/kimi"
	"github.com/Crypto-Barrett/oddfi-agent-backend/internal/persist"
	"github.com/Crypto-Barrett/oddfi-agent-backend/internal/pushtypes"
	"github.com/Crypto-Barrett/oddfi-agent-backend/internal/server"
	"github.com/Crypto-Barrett/oddfi-agent-backend/internal/store"
	"github.com/Crypto-Barrett/oddfi-agent-backend/internal/tweetcatcher"
)

func truncate(s string, n int) string {
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	return string(r[:n]) + "…"
}

func main() {
	log.SetFlags(log.LstdFlags | log.Lshortfile)
	cfg := config.Load()

	// 1. SQLite 持久化（DD-001 §4.1）
	if err := os.MkdirAll(filepath.Dir(cfg.DBPath), 0750); err != nil {
		log.Fatalf("[Main] create db dir %q: %v", filepath.Dir(cfg.DBPath), err)
	}
	repo, err := persist.Open(cfg.DBPath)
	if err != nil {
		log.Fatalf("[Main] persist.Open %q: %v", cfg.DBPath, err)
	}
	defer func() { _ = repo.Close() }()
	log.Printf("[Main] sqlite opened path=%s", cfg.DBPath)

	// 远程整合：欧冠决赛分析单 slot 缓存
	analysisStore := analysis.NewStore()

	// 2. 内存缓存 + 启动恢复
	mem := store.NewMemoryStore()
	bootCtx, bootCancel := context.WithTimeout(context.Background(), 10*time.Second)
	recent, err := repo.LoadRecent(bootCtx, store.MaxCards)
	bootCancel()
	if err != nil {
		log.Printf("[Main] LoadRecent err=%v (空启动)", err)
	} else {
		added := mem.SeedFromDB(recent)
		log.Printf("[Main] seeded %d cards from db", added)
	}

	// 3. 事件总线 + 持久化 worker
	bus := events.NewBus()
	persister := persist.NewPersister(repo, 512)

	// 4. LLM client + enrich pool（provider-agnostic：env 决定 Kimi/Grok/DeepSeek/...）
	kc := kimi.NewClient(cfg.AIAPIKey, cfg.AIBaseURL, cfg.AIModel)
	enrichFn := func(ctx context.Context, post *tweetcatcher.PostData, srcHandle string) (*kimi.EnrichmentResult, error) {
		return kimi.EnrichTweet(ctx, kc, post, srcHandle)
	}
	pool := enrich.NewPool(enrichFn, mem, persister, bus, cfg.EnrichWorkers, cfg.EnrichQueueCap)

	// 5. Tweet 上游 → 基础卡 → 持久化 + bus.Publish → enrich pool
	handleEvent := func(evt *tweetcatcher.DispatchEvent) {
		post, err := evt.UnmarshalPost()
		if err != nil {
			log.Printf("[TweetCatcher] unmarshal post error: %v (event=%s)", err, evt.EventID)
			return
		}
		if post == nil {
			return
		}
		log.Printf("[TweetCatcher] received post id=%s handle=%s text=%q",
			post.ID, evt.TaskInfo.Handle, truncate(post.Text, 120))

		base := pushtypes.BuildBaseCard(
			post.ID,
			evt.TaskInfo.Handle,
			post.Author.Handle,
			post.Author.Name,
			post.Text,
			post.CreatedAt,
		)
		// 不变量（DD-001 §6.2）：mem.Add → persist.Enqueue → bus.Publish → enrich.Submit
		if !mem.Add(base) {
			return // 重复 ID（同一推文重发）—— 内存已有，跳过
		}
		// 幂等防御：mem 没有不代表 DB 没有 —— FIFO 淘汰旧卡后同 ID 重发会重做 LLM、浪费成本。
		// 200ms 超时内查 DB；命中已增强版本则复用，跳过 enrich pool 调用。
		checkCtx, checkCancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
		cached, _ := repo.GetCard(checkCtx, base.ID)
		checkCancel()
		if cached != nil && cached.EnrichStatus == pushtypes.EnrichStatusOK {
			mem.Update(base.ID, func(c *pushtypes.PushCard) { *c = *cached })
			bus.Publish(events.CardNew{Card: cached})
			log.Printf("[Main] reused enriched id=%s from db (FIFO replay — skipped LLM)", base.ID)
			return
		}
		if !persister.Enqueue(persist.WriteOp{Kind: "insert", Card: base}) {
			log.Printf("[Persist] write queue full id=%s — dropped (insert)", base.ID)
		}
		bus.Publish(events.CardNew{Card: base})
		pool.Submit(base.ID, post, evt.TaskInfo.Handle)
	}

	tc := tweetcatcher.NewClient(cfg.TweetCatcherToken, handleEvent)

	// 6. HTTP / SSE server
	srv := server.New(server.Options{
		Store:          mem,
		Repo:           repo,
		Bus:            bus,
		Persister:      persister,
		Kimi:           kc,
		Analysis:       analysisStore,
		AllowedOrigins: cfg.CORSAllowedOrigins,
		MaxSSEConns:    cfg.MaxSSEConns,
		DevAPIEnabled:  cfg.DevAPIEnabled,

		// ENH-002 限流参数
		SSEPerIPLimit:    cfg.SSEPerIPLimit,
		SSESoftLimitPct:  cfg.SSESoftLimitPct,
		SSEMaxTrackedIPs: cfg.SSEMaxTrackedIPs,
		PushRatePerIP:    cfg.PushRatePerIP,
		PushRateBurst:    cfg.PushRateBurst,
		ChatRatePerIP:    cfg.ChatRatePerIP,
		ChatRateBurst:    cfg.ChatRateBurst,
		RateLimitMaxIPs:  cfg.RateLimitMaxIPs,
	})
	httpServer := &http.Server{
		Addr:              cfg.ServerAddr,
		Handler:           srv.Routes(),
		ReadHeaderTimeout: 10 * time.Second,
	}

	// 7. 装配生命周期
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()

	persister.Run(ctx)
	pool.Run(ctx)
	srv.StartRateLimitGC(ctx) // ENH-002: 后台清理过期 IP 桶，ctx cancel 时退出

	go func() {
		log.Printf("[Server] HTTP listening on %s (sse_max=%d, dev_api=%v)",
			cfg.ServerAddr, cfg.MaxSSEConns, cfg.DevAPIEnabled)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[Server] error: %v", err)
		}
	}()

	if cfg.TweetCatcherToken != "" {
		go func() {
			if err := tc.Run(ctx); err != nil && ctx.Err() == nil {
				log.Printf("[TweetCatcher] WS client exited: %v", err)
			}
		}()
		log.Println("[TweetCatcher] WS client started")
	} else {
		log.Println("[Main] TWEET_CATCHER_TOKEN empty — WS skipped (use /api/dev/inject-tweet for mock)")
	}

	// 定时分析 — 每 1 小时生成一份欧冠决赛分析
	go runAnalysisLoop(ctx, kc, mem, analysisStore)

	<-ctx.Done()
	log.Println("[Main] shutdown signal received")

	// 8. 优雅关闭顺序：HTTP（停止新连接）→ pool（停止 enrich 提交）→ persister（drain 落盘）
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()
	if err := httpServer.Shutdown(shutdownCtx); err != nil {
		log.Printf("[Server] shutdown error: %v", err)
	}
	pool.Shutdown()
	persister.Shutdown()
	log.Printf("[Main] persist stats=%+v enrich stats=%+v", persister.Stats(), pool.Stats())
}

func runAnalysisLoop(ctx context.Context, kc *kimi.Client, mem *store.MemoryStore, as *analysis.Store) {
	runOnce := func(reason string) {
		log.Printf("⟳ analysis run (%s)", reason)
		gctx, cancel := context.WithTimeout(ctx, 60*time.Second)
		defer cancel()
		pushes := mem.ListRecent(20)
		a, err := analysis.Generate(gctx, kc, pushes)
		if err != nil {
			log.Printf("⊘ analysis error: %v", err)
			return
		}
		as.Set(a)
		log.Printf("✓ analysis updated · %s · %s", a.Match, a.Summary)
	}

	// 启动延迟 30 秒，让首批推送进入再做第一次分析
	select {
	case <-ctx.Done():
		return
	case <-time.After(30 * time.Second):
	}
	runOnce("startup")

	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			runOnce("hourly")
		}
	}
}
