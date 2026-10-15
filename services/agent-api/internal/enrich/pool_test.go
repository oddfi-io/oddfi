package enrich

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"
	"time"

	"github.com/Crypto-Barrett/oddfi-agent-backend/internal/events"
	"github.com/Crypto-Barrett/oddfi-agent-backend/internal/kimi"
	"github.com/Crypto-Barrett/oddfi-agent-backend/internal/pushtypes"
	"github.com/Crypto-Barrett/oddfi-agent-backend/internal/store"
	"github.com/Crypto-Barrett/oddfi-agent-backend/internal/tweetcatcher"
)

func mkPost(id string) *tweetcatcher.PostData {
	return &tweetcatcher.PostData{ID: id, Text: "post " + id}
}

func setupPool(t *testing.T, enrich EnrichFunc) (*Pool, *store.MemoryStore, *events.Bus, func()) {
	t.Helper()
	mem := store.NewMemoryStore()
	bus := events.NewBus()
	pool := NewPool(enrich, mem, nil, bus, 2, 16)
	ctx, cancel := context.WithCancel(context.Background())
	pool.Run(ctx)
	cleanup := func() {
		cancel()
		pool.Shutdown()
	}
	return pool, mem, bus, cleanup
}

func TestPool_OK_PublishesCardUpdate(t *testing.T) {
	enrich := func(ctx context.Context, post *tweetcatcher.PostData, src string) (*kimi.EnrichmentResult, error) {
		return &kimi.EnrichmentResult{
			Tag: "odds", TagLabel: "赔率剧变", Title: "上升",
			AiAnalysis: &pushtypes.AiAnalysis{Change: "up"},
		}, nil
	}
	pool, mem, bus, cleanup := setupPool(t, enrich)
	defer cleanup()

	sub := bus.Subscribe(4)
	defer bus.Unsubscribe(sub)

	mem.Add(pushtypes.BuildBaseCard("tw1", "@s", "@a", "", "txt", 0))
	if !pool.Submit("tw1", mkPost("tw1"), "@s") {
		t.Fatal("submit failed")
	}

	select {
	case ev := <-sub.Ch:
		cu, ok := ev.(events.CardUpdate)
		if !ok {
			t.Fatalf("type=%T", ev)
		}
		if cu.Card.EnrichStatus != "ok" || cu.Card.Tag != "odds" {
			t.Errorf("card=%+v", cu.Card)
		}
	case <-time.After(1 * time.Second):
		t.Fatal("超时未收到 CardUpdate")
	}

	if pool.Stats().Enriched < 1 {
		t.Errorf("Enriched=%d", pool.Stats().Enriched)
	}
}

func TestPool_Skip_MarksStatusSkipped(t *testing.T) {
	enrich := func(ctx context.Context, post *tweetcatcher.PostData, src string) (*kimi.EnrichmentResult, error) {
		return nil, nil // skip
	}
	pool, mem, bus, cleanup := setupPool(t, enrich)
	defer cleanup()

	sub := bus.Subscribe(4)
	defer bus.Unsubscribe(sub)

	mem.Add(pushtypes.BuildBaseCard("tw_skip", "@s", "@a", "", "off topic", 0))
	pool.Submit("tw_skip", mkPost("tw_skip"), "@s")

	select {
	case ev := <-sub.Ch:
		cu := ev.(events.CardUpdate)
		if cu.Card.EnrichStatus != "skipped" {
			t.Errorf("EnrichStatus=%q want skipped", cu.Card.EnrichStatus)
		}
	case <-time.After(1 * time.Second):
		t.Fatal("超时")
	}
	if pool.Stats().Skipped < 1 {
		t.Errorf("Skipped=%d", pool.Stats().Skipped)
	}
}

func TestPool_Failed_MarksStatusFailedAndSanitizesError(t *testing.T) {
	enrich := func(ctx context.Context, post *tweetcatcher.PostData, src string) (*kimi.EnrichmentResult, error) {
		return nil, errors.New("POST https://api.moonshot.cn/v1/chat 401 unauthorized sk-abc123")
	}
	pool, mem, bus, cleanup := setupPool(t, enrich)
	defer cleanup()

	sub := bus.Subscribe(4)
	defer bus.Unsubscribe(sub)

	mem.Add(pushtypes.BuildBaseCard("tw_fail", "@s", "@a", "", "x", 0))
	pool.Submit("tw_fail", mkPost("tw_fail"), "@s")

	select {
	case ev := <-sub.Ch:
		cu := ev.(events.CardUpdate)
		if cu.Card.EnrichStatus != "failed" {
			t.Errorf("EnrichStatus=%q", cu.Card.EnrichStatus)
		}
		if cu.Card.EnrichError == "" {
			t.Errorf("EnrichError 应有脱敏信息")
		}
		// 不应含原始 URL / API key
		if want := "moonshot.cn"; containsStr(cu.Card.EnrichError, want) {
			t.Errorf("EnrichError 未脱敏 URL: %q", cu.Card.EnrichError)
		}
		if want := "sk-abc"; containsStr(cu.Card.EnrichError, want) {
			t.Errorf("EnrichError 未脱敏 key: %q", cu.Card.EnrichError)
		}
	case <-time.After(1 * time.Second):
		t.Fatal("超时")
	}
}

func TestPool_QueueFullDrops(t *testing.T) {
	// 阻塞 enrich 让 queue 堆积
	hold := make(chan struct{})
	enrich := func(ctx context.Context, post *tweetcatcher.PostData, src string) (*kimi.EnrichmentResult, error) {
		<-hold
		return nil, nil
	}
	mem := store.NewMemoryStore()
	bus := events.NewBus()
	// 极小 queue：1 worker + 2 slot；提交 5 条必有 drop
	pool := NewPool(enrich, mem, nil, bus, 1, 2)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	pool.Run(ctx)
	defer func() {
		close(hold)
		pool.Shutdown()
	}()

	results := make([]bool, 5)
	for i := 0; i < 5; i++ {
		mem.Add(pushtypes.BuildBaseCard("q"+string(rune('a'+i)), "@s", "@a", "", "t", 0))
		results[i] = pool.Submit("q"+string(rune('a'+i)), mkPost("q"+string(rune('a'+i))), "@s")
		time.Sleep(5 * time.Millisecond) // 让 worker 拿到第一个
	}
	gotDropped := 0
	for _, ok := range results {
		if !ok {
			gotDropped++
		}
	}
	if gotDropped == 0 {
		t.Errorf("队列饱和应至少 drop 1 条")
	}
}

func TestPool_TargetGoneAfterEviction(t *testing.T) {
	called := atomic.Int64{}
	enrich := func(ctx context.Context, post *tweetcatcher.PostData, src string) (*kimi.EnrichmentResult, error) {
		called.Add(1)
		return &kimi.EnrichmentResult{Tag: "odds"}, nil
	}
	mem := store.NewMemoryStore()
	bus := events.NewBus()
	pool := NewPool(enrich, mem, nil, bus, 2, 16)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	pool.Run(ctx)
	defer pool.Shutdown()

	// 不 add 基础卡 → mem.Update 返回 false → 走 "target gone" 分支
	pool.Submit("ghost", mkPost("ghost"), "@s")

	deadline := time.Now().Add(500 * time.Millisecond)
	for time.Now().Before(deadline) && called.Load() == 0 {
		time.Sleep(10 * time.Millisecond)
	}
	if called.Load() != 1 {
		t.Errorf("enrich 应被调用 1 次, called=%d", called.Load())
	}
}

func TestPool_PanicRecovery_WorkerSurvives(t *testing.T) {
	// R2 评审 Major-3：panic 之后 worker 应继续处理下一个 job，不能让 pool 缩容。
	count := atomic.Int64{}
	enrich := func(ctx context.Context, post *tweetcatcher.PostData, src string) (*kimi.EnrichmentResult, error) {
		n := count.Add(1)
		if n == 1 {
			panic("first call panics")
		}
		return &kimi.EnrichmentResult{Tag: "odds", Title: "ok"}, nil
	}
	// 1 worker 强制串行 —— 验证同一个 worker panic 后能继续消费
	mem := store.NewMemoryStore()
	bus := events.NewBus()
	pool := NewPool(enrich, mem, nil, bus, 1, 8)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	pool.Run(ctx)
	defer pool.Shutdown()

	sub := bus.Subscribe(8)
	defer bus.Unsubscribe(sub)

	mem.Add(pushtypes.BuildBaseCard("panic1", "@s", "@a", "", "t", 0))
	mem.Add(pushtypes.BuildBaseCard("ok1", "@s", "@a", "", "t", 0))
	pool.Submit("panic1", mkPost("panic1"), "@s")
	pool.Submit("ok1", mkPost("ok1"), "@s")

	// 等 ok1 经过 worker（如果 worker panic 后退出，count 永远停在 1）
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) && count.Load() < 2 {
		time.Sleep(20 * time.Millisecond)
	}
	if count.Load() < 2 {
		t.Errorf("worker panic 后应继续消费, count=%d 期望 ≥ 2 (pool 永久缩容)", count.Load())
	}
}

func TestPool_SubmitNilSafe(t *testing.T) {
	pool, _, _, cleanup := setupPool(t, nil)
	defer cleanup()
	if pool.Submit("", nil, "") {
		t.Errorf("空参数应被拒绝")
	}
}

func containsStr(haystack, needle string) bool {
	if needle == "" {
		return true
	}
	return len(haystack) >= len(needle) && indexOf(haystack, needle) >= 0
}

func indexOf(s, sub string) int {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}
