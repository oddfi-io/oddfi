// Package enrich worker pool —— 把 enrich 的并发度从"每条 tweet 起一个 goroutine"
// 收敛到固定 worker 数 + 队列 + 反压（落地 R1.M1）。
//
// 流程（DD-001 §6.2）：
//
//	Submit(cardID, post, sourceHandle)
//	  ↓ 入队（满则 drop + log）
//	worker:
//	  1. enrich(ctx, post, sourceHandle)   // 30s timeout
//	  2. 三态翻转：ok → ApplyEnrichment；skipped → MarkEnrichSkipped；failed → MarkEnrichFailed
//	  3. mem.Update(id, mutator)
//	  4. persist.Enqueue(UpdateOp)
//	  5. bus.Publish(CardUpdate)
package enrich

import (
	"context"
	"log"
	"sync"
	"time"

	"github.com/Crypto-Barrett/oddfi-agent-backend/internal/events"
	"github.com/Crypto-Barrett/oddfi-agent-backend/internal/kimi"
	"github.com/Crypto-Barrett/oddfi-agent-backend/internal/persist"
	"github.com/Crypto-Barrett/oddfi-agent-backend/internal/pushtypes"
	"github.com/Crypto-Barrett/oddfi-agent-backend/internal/store"
	"github.com/Crypto-Barrett/oddfi-agent-backend/internal/tweetcatcher"
)

// EnrichFunc 抽象 kimi.EnrichTweet，便于注入 fake 做单测（testing.md 规范）。
//   - (result, nil)  → ok
//   - (nil, nil)     → skip（保留基础卡）
//   - (nil, error)   → failed
type EnrichFunc func(ctx context.Context, post *tweetcatcher.PostData, sourceHandle string) (*kimi.EnrichmentResult, error)

// EnrichTimeout LLM 调用单次最长时长。超时强制失败，不阻塞 worker。
var EnrichTimeout = 30 * time.Second

// Pool 固定大小 worker 池。
type Pool struct {
	enrich  EnrichFunc
	mem     *store.MemoryStore
	persist *persist.Persister
	bus     *events.Bus

	queue   chan job
	workers int

	wg   sync.WaitGroup
	stop chan struct{}

	mu       sync.Mutex
	dropped  uint64
	enriched uint64
	skipped  uint64
	failed   uint64
}

type job struct {
	cardID       string
	post         *tweetcatcher.PostData
	sourceHandle string
}

// NewPool 构造（不启动 worker，由 Run 启动）。
//
// workers 推荐 4；queueCap 推荐 100。queue 满时 Submit 返回 false（drop + log）。
//
// mem / persist / bus 之一为 nil 时对应步骤跳过 —— 便于单测注入。
func NewPool(enrich EnrichFunc, mem *store.MemoryStore, p *persist.Persister, bus *events.Bus, workers, queueCap int) *Pool {
	if workers <= 0 {
		workers = 4
	}
	if queueCap <= 0 {
		queueCap = 100
	}
	return &Pool{
		enrich:  enrich,
		mem:     mem,
		persist: p,
		bus:     bus,
		queue:   make(chan job, queueCap),
		workers: workers,
		stop:    make(chan struct{}),
	}
}

// Submit 非阻塞入队。返回 false 表示 queue 满 → 当前 tweet 跳过 enrich（基础卡仍可见）。
func (p *Pool) Submit(cardID string, post *tweetcatcher.PostData, sourceHandle string) bool {
	if cardID == "" || post == nil {
		return false
	}
	select {
	case p.queue <- job{cardID: cardID, post: post, sourceHandle: sourceHandle}:
		return true
	default:
		p.mu.Lock()
		p.dropped++
		p.mu.Unlock()
		log.Printf("[Enrich] queue full id=%s — drop", cardID)
		return false
	}
}

// Run 启动 workers 个 goroutine。阻塞直到 ctx.Done 或 Shutdown。
func (p *Pool) Run(ctx context.Context) {
	for i := 0; i < p.workers; i++ {
		p.wg.Add(1)
		go p.worker(ctx, i)
	}
}

func (p *Pool) worker(ctx context.Context, idx int) {
	defer p.wg.Done()
	// R2 评审 Major-3：panic recover 必须放在 handle() 调用现场（不是 worker 顶层），
	// 否则一次 panic 后 worker goroutine 直接退出，pool 永久缩容。
	for {
		select {
		case <-ctx.Done():
			return
		case <-p.stop:
			return
		case j, ok := <-p.queue:
			if !ok {
				return
			}
			p.safeHandle(ctx, idx, j)
		}
	}
}

// safeHandle 在每次处理一个 job 时 defer/recover，panic 被吸收后 worker 继续消费下一条。
func (p *Pool) safeHandle(ctx context.Context, idx int, j job) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("[Enrich] worker[%d] PANIC recovered id=%s: %v", idx, j.cardID, r)
		}
	}()
	p.handle(ctx, j)
}

func (p *Pool) handle(parentCtx context.Context, j job) {
	ctx, cancel := context.WithTimeout(parentCtx, EnrichTimeout)
	defer cancel()
	enr, err := p.enrich(ctx, j.post, j.sourceHandle)
	status, errMsg := Apply(p.mem, p.persist, p.bus, j.cardID, enr, err)
	switch status {
	case pushtypes.EnrichStatusOK:
		p.bump(&p.enriched)
		log.Printf("[Enrich] ok id=%s tag=%s title=%s", j.cardID, enr.Tag, truncate(enr.Title, 40))
	case pushtypes.EnrichStatusSkipped:
		p.bump(&p.skipped)
		log.Printf("[Enrich] skipped id=%s (off-topic)", j.cardID)
	case pushtypes.EnrichStatusFailed:
		p.bump(&p.failed)
		log.Printf("[Enrich] failed id=%s err=%s", j.cardID, errMsg)
	}
}

// Apply 把一次 enrich 结果应用到「mem + persist + bus」三个出口，并返回最终 EnrichStatus 与脱敏后的错误。
// 由 pool worker（异步）和 server.handleInjectTweet（dev 同步）共享，确保两条路径走完全一样的状态机。
// 任意依赖可为 nil（单测局部隔离）。
//
// 软依赖原则：mem 中目标卡已被 FIFO 淘汰时直接返回，不阻断上游流水线。
func Apply(mem *store.MemoryStore, persister *persist.Persister, bus *events.Bus,
	cardID string, enr *kimi.EnrichmentResult, callErr error) (status, errMsg string) {

	var mutator func(*pushtypes.PushCard)
	switch {
	case callErr != nil:
		errMsg = persist.SanitizeEnrichError(callErr)
		status = pushtypes.EnrichStatusFailed
		mutator = func(c *pushtypes.PushCard) {
			pushtypes.MarkEnrichFailed(c)
			c.EnrichError = errMsg
		}
	case enr == nil:
		status = pushtypes.EnrichStatusSkipped
		mutator = func(c *pushtypes.PushCard) {
			pushtypes.MarkEnrichSkipped(c)
		}
	default:
		status = pushtypes.EnrichStatusOK
		mutator = func(c *pushtypes.PushCard) {
			pushtypes.ApplyEnrichment(c, enr.Tag, enr.TagLabel, enr.Title, enr.Match, enr.AiAnalysis, enr.Suggest)
			// bus.Publish 推送的是内存指针；如果只在落库前清洗，SSE 客户端会先收到未清洗数据。
			// 在 mem 里清洗一次，三条出口（SSE / REST / persist）就都看到干净数据。
			persist.SanitizeAiAnalysis(c.AiAnalysis)
		}
	}

	if mem == nil {
		return
	}
	if !mem.Update(cardID, mutator) {
		log.Printf("[Enrich] target gone id=%s (card evicted before enrich completed)", cardID)
		return
	}
	snapshot := mem.Get(cardID)
	if snapshot == nil {
		return
	}
	if persister != nil {
		if !persister.Enqueue(persist.WriteOp{Kind: "update", Card: snapshot}) {
			log.Printf("[Persist] write queue full id=%s — dropped (update)", cardID)
		}
	}
	if bus != nil {
		bus.Publish(events.CardUpdate{Card: snapshot})
	}
	return
}

func (p *Pool) bump(counter *uint64) {
	p.mu.Lock()
	*counter++
	p.mu.Unlock()
}

// Shutdown 关闭 stop channel；workers 处理完当前 job 后退出。
// 调用后等待所有 worker 收尾。
func (p *Pool) Shutdown() {
	select {
	case <-p.stop:
	default:
		close(p.stop)
	}
	p.wg.Wait()
}

// Stats 返回累计指标快照。
type Stats struct {
	Dropped  uint64
	Enriched uint64
	Skipped  uint64
	Failed   uint64
}

func (p *Pool) Stats() Stats {
	p.mu.Lock()
	defer p.mu.Unlock()
	return Stats{Dropped: p.dropped, Enriched: p.enriched, Skipped: p.skipped, Failed: p.failed}
}

// QueueLen 当前队列堆积量。
func (p *Pool) QueueLen() int { return len(p.queue) }

func truncate(s string, n int) string {
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	return string(r[:n]) + "…"
}
