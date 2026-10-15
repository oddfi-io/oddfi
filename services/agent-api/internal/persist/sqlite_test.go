package persist

import (
	"context"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/Crypto-Barrett/oddfi-agent-backend/internal/pushtypes"
)

// 临时文件 SQLite —— `:memory:` 不便于 WAL 验证，且 modernc 驱动对纯 memory 的 PRAGMA 行为差异。
func newTestRepo(t *testing.T) (*Repo, func()) {
	t.Helper()
	dir := t.TempDir()
	path := filepath.Join(dir, "test.db")
	r, err := Open(path)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	return r, func() { _ = r.Close() }
}

func newCard(id string, ingestedMs int64) *pushtypes.PushCard {
	return &pushtypes.PushCard{
		ID:           id,
		CreatedAt:    ingestedMs - 100,
		IngestedAt:   ingestedMs,
		SourceHandle: "@src",
		AuthorHandle: "@a",
		AuthorName:   "Alice",
		OriginalText: "hello " + id,
		SourceURL:    "x.com/a/status/" + id,
		EnrichStatus: "pending",
		UpdatedAt:    ingestedMs,
	}
}

func TestOpen_AppliesPragma(t *testing.T) {
	r, cleanup := newTestRepo(t)
	defer cleanup()

	checks := []struct {
		pragma, want string
	}{
		{"journal_mode", "wal"},
		{"synchronous", "1"}, // NORMAL == 1
		{"temp_store", "2"},  // MEMORY == 2
	}
	for _, c := range checks {
		row := r.db.QueryRow("PRAGMA " + c.pragma)
		var got string
		if err := row.Scan(&got); err != nil {
			t.Errorf("pragma %s scan: %v", c.pragma, err)
			continue
		}
		if got != c.want {
			t.Errorf("pragma %s got %q want %q", c.pragma, got, c.want)
		}
	}
}

func TestInsertAndGetCard(t *testing.T) {
	r, cleanup := newTestRepo(t)
	defer cleanup()
	ctx := context.Background()

	in := newCard("tw1", 1000)
	in.AiAnalysis = &pushtypes.AiAnalysis{Change: "up", PriceImpact: `<b class="delta-up">↑</b>`, ProbImpact: "+5%"}
	in.Suggest = &pushtypes.Suggest{Text: "买", Action: "act", Alt: "or wait"}
	in.Tag = "odds"
	in.TagLabel = "赔率剧变"
	in.EnrichStatus = "ok"

	if err := r.InsertCard(ctx, in); err != nil {
		t.Fatalf("insert: %v", err)
	}

	got, err := r.GetCard(ctx, "tw1")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got == nil {
		t.Fatal("got nil")
	}
	if got.ID != "tw1" || got.OriginalText != "hello tw1" {
		t.Errorf("基础字段错: %+v", got)
	}
	if got.EnrichStatus != "ok" {
		t.Errorf("EnrichStatus got %q", got.EnrichStatus)
	}
	if got.Tag != "odds" || got.TagLabel != "赔率剧变" {
		t.Errorf("enrich 字段未回读: tag=%q label=%q", got.Tag, got.TagLabel)
	}
	if got.AiAnalysis == nil || got.AiAnalysis.PriceImpact != `<b class="delta-up">↑</b>` {
		t.Errorf("AiAnalysis 回读失败: %+v", got.AiAnalysis)
	}
	if got.Suggest == nil || got.Suggest.Text != "买" {
		t.Errorf("Suggest 回读失败: %+v", got.Suggest)
	}
	// 兼容期重建
	if got.AiEnriched != true {
		t.Errorf("AiEnriched 重建错: %v", got.AiEnriched)
	}
	if got.Source != "🐦 @a" {
		t.Errorf("Source 重建错: %q", got.Source)
	}
}

func TestInsertCard_SanitizesAiAnalysis(t *testing.T) {
	r, cleanup := newTestRepo(t)
	defer cleanup()
	ctx := context.Background()

	in := newCard("tw1", 1000)
	in.AiAnalysis = &pushtypes.AiAnalysis{
		Change:      `<script>alert(1)</script>up`,
		PriceImpact: `<b class="delta-up">↑</b><img src=x onerror=alert(1)>`,
		ProbImpact:  `<iframe src=//evil></iframe>+5%`,
	}
	if err := r.InsertCard(ctx, in); err != nil {
		t.Fatalf("insert: %v", err)
	}
	got, _ := r.GetCard(ctx, "tw1")
	if got.AiAnalysis.Change != "up" {
		t.Errorf("script 未剥: %q", got.AiAnalysis.Change)
	}
	if got.AiAnalysis.PriceImpact != `<b class="delta-up">↑</b>` {
		t.Errorf("img 未剥: %q", got.AiAnalysis.PriceImpact)
	}
	if got.AiAnalysis.ProbImpact != "+5%" {
		t.Errorf("iframe 未剥: %q", got.AiAnalysis.ProbImpact)
	}
}

func TestGetCard_NotFound(t *testing.T) {
	r, cleanup := newTestRepo(t)
	defer cleanup()
	got, err := r.GetCard(context.Background(), "ghost")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if got != nil {
		t.Errorf("应返回 nil, 实得 %+v", got)
	}
}

func TestUpdateEnrich(t *testing.T) {
	r, cleanup := newTestRepo(t)
	defer cleanup()
	ctx := context.Background()

	base := newCard("tw1", 1000)
	if err := r.InsertCard(ctx, base); err != nil {
		t.Fatal(err)
	}

	base.Tag = "odds"
	base.Title = "Real 赔率上升"
	base.AiAnalysis = &pushtypes.AiAnalysis{Change: "up"}
	base.EnrichStatus = "ok"
	if err := r.UpdateEnrich(ctx, base); err != nil {
		t.Fatal(err)
	}

	got, _ := r.GetCard(ctx, "tw1")
	if got.Tag != "odds" || got.Title != "Real 赔率上升" || got.EnrichStatus != "ok" {
		t.Errorf("update 未生效: %+v", got)
	}
	if got.UpdatedAt < base.UpdatedAt {
		t.Errorf("UpdatedAt 应更新")
	}
	// 基础字段不动
	if got.IngestedAt != 1000 {
		t.Errorf("IngestedAt 被改了: %d", got.IngestedAt)
	}
}

func TestQueryCardsSince_AscOrder(t *testing.T) {
	r, cleanup := newTestRepo(t)
	defer cleanup()
	ctx := context.Background()

	for _, ms := range []int64{100, 300, 500, 700, 900} {
		_ = r.InsertCard(ctx, newCard("c"+string(rune('a'+ms/100)), ms))
	}

	got, err := r.QueryCardsSince(ctx, 300, 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 4 {
		t.Fatalf("len=%d want 4", len(got))
	}
	for i := 1; i < len(got); i++ {
		if got[i].IngestedAt < got[i-1].IngestedAt {
			t.Errorf("非升序: %d < %d", got[i].IngestedAt, got[i-1].IngestedAt)
		}
	}
}

func TestQueryCardsSince_LimitClampedTo500(t *testing.T) {
	r, cleanup := newTestRepo(t)
	defer cleanup()
	ctx := context.Background()

	// caller 传 9999，硬上限 500
	got, _ := r.QueryCardsSince(ctx, 0, 9999)
	if len(got) > 500 {
		t.Errorf("len=%d, 硬上限应为 500", len(got))
	}
}

func TestQueryCardsBefore_DescOrder(t *testing.T) {
	r, cleanup := newTestRepo(t)
	defer cleanup()
	ctx := context.Background()

	for _, ms := range []int64{100, 300, 500, 700, 900} {
		_ = r.InsertCard(ctx, newCard("c"+string(rune('a'+ms/100)), ms))
	}

	got, _ := r.QueryCardsBefore(ctx, 800, 10)
	if len(got) != 4 {
		t.Fatalf("len=%d want 4 (排除 900)", len(got))
	}
	if got[0].IngestedAt != 700 {
		t.Errorf("first 应为 700 (DESC 最新), 实得 %d", got[0].IngestedAt)
	}
	for i := 1; i < len(got); i++ {
		if got[i].IngestedAt > got[i-1].IngestedAt {
			t.Errorf("非降序: %d > %d", got[i].IngestedAt, got[i-1].IngestedAt)
		}
	}
}

func TestQueryCardsBefore_LimitClampedTo100(t *testing.T) {
	r, cleanup := newTestRepo(t)
	defer cleanup()
	ctx := context.Background()
	got, _ := r.QueryCardsBefore(ctx, 1<<62, 9999)
	if len(got) > 100 {
		t.Errorf("len=%d, 硬上限应为 100", len(got))
	}
}

func TestLoadRecent_DescOrder(t *testing.T) {
	r, cleanup := newTestRepo(t)
	defer cleanup()
	ctx := context.Background()

	for _, ms := range []int64{100, 300, 500} {
		_ = r.InsertCard(ctx, newCard("c"+string(rune('a'+ms/100)), ms))
	}

	got, _ := r.LoadRecent(ctx, 10)
	if len(got) != 3 {
		t.Fatalf("len=%d", len(got))
	}
	if got[0].IngestedAt != 500 || got[2].IngestedAt != 100 {
		t.Errorf("非 DESC: %v", got)
	}
}

func TestPersister_EnqueueDropOnFull(t *testing.T) {
	r, cleanup := newTestRepo(t)
	defer cleanup()

	// 极小 buf 触发 drop（不启动 worker）
	p := NewPersister(r, 2)
	for i := 0; i < 2; i++ {
		if !p.Enqueue(WriteOp{Kind: "insert", Card: newCard("c", int64(i))}) {
			t.Fatalf("should enqueue at i=%d", i)
		}
	}
	if p.Enqueue(WriteOp{Kind: "insert", Card: newCard("over", 9)}) {
		t.Errorf("满 channel 应 drop")
	}
	if p.Stats().Dropped != 1 {
		t.Errorf("Dropped=%d want 1", p.Stats().Dropped)
	}
}

func TestPersister_RoundTrip(t *testing.T) {
	r, cleanup := newTestRepo(t)
	defer cleanup()

	p := NewPersister(r, 16)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	p.Run(ctx)
	defer p.Shutdown()

	c := newCard("tw_async", 12345)
	if !p.Enqueue(WriteOp{Kind: "insert", Card: c}) {
		t.Fatal("enqueue insert failed")
	}

	// 入队后立刻改原卡 —— 不应影响落库（验证浅拷贝）
	c.OriginalText = "MUTATED AFTER ENQUEUE"

	// 轮询等 worker 写完
	waitFor(t, 1*time.Second, func() bool {
		got, _ := r.GetCard(context.Background(), "tw_async")
		return got != nil && got.OriginalText == "hello tw_async"
	})

	// update enrich
	c2 := newCard("tw_async", 12345)
	c2.EnrichStatus = "ok"
	c2.Tag = "odds"
	if !p.Enqueue(WriteOp{Kind: "update", Card: c2}) {
		t.Fatal("enqueue update failed")
	}
	waitFor(t, 1*time.Second, func() bool {
		got, _ := r.GetCard(context.Background(), "tw_async")
		return got != nil && got.Tag == "odds" && got.EnrichStatus == "ok"
	})

	stats := p.Stats()
	if stats.Wrote < 2 {
		t.Errorf("Wrote=%d want ≥ 2", stats.Wrote)
	}
}

func TestPersister_NilCardDropped(t *testing.T) {
	r, cleanup := newTestRepo(t)
	defer cleanup()
	p := NewPersister(r, 4)
	if p.Enqueue(WriteOp{Kind: "insert", Card: nil}) {
		t.Errorf("nil card 应直接返回 false")
	}
}

func TestPersister_ShutdownDrains(t *testing.T) {
	r, cleanup := newTestRepo(t)
	defer cleanup()

	p := NewPersister(r, 16)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	p.Run(ctx)

	for i := 0; i < 10; i++ {
		p.Enqueue(WriteOp{Kind: "insert", Card: newCard("d"+string(rune('a'+i)), int64(i+1))})
	}
	p.Shutdown() // 应 drain 完成所有 ops

	got, _ := r.LoadRecent(context.Background(), 100)
	if len(got) != 10 {
		t.Errorf("drain 后 DB 中 %d 条, 期望 10", len(got))
	}
	if p.Stats().Wrote < 10 {
		t.Errorf("Wrote=%d", p.Stats().Wrote)
	}
}

func TestPersister_ShutdownIdempotent(t *testing.T) {
	r, cleanup := newTestRepo(t)
	defer cleanup()
	p := NewPersister(r, 4)
	p.Run(context.Background())
	p.Shutdown()
	p.Shutdown() // 不应 panic
}

func TestRepo_ConcurrentReadDuringWrite(t *testing.T) {
	r, cleanup := newTestRepo(t)
	defer cleanup()
	ctx := context.Background()

	for i := 0; i < 20; i++ {
		_ = r.InsertCard(ctx, newCard("init"+string(rune('a'+i)), int64(i+1)))
	}

	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		defer wg.Done()
		for i := 0; i < 50; i++ {
			_ = r.InsertCard(ctx, newCard("w"+string(rune('a'+i%26)), int64(100+i)))
		}
	}()
	go func() {
		defer wg.Done()
		for i := 0; i < 50; i++ {
			_, _ = r.LoadRecent(ctx, 20)
		}
	}()
	done := make(chan struct{})
	go func() { wg.Wait(); close(done) }()
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("WAL 并发读写超时 / 死锁")
	}
}

func waitFor(t *testing.T, timeout time.Duration, cond func() bool) {
	t.Helper()
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		if cond() {
			return
		}
		time.Sleep(20 * time.Millisecond)
	}
	t.Fatalf("waitFor timeout after %s", timeout)
}
