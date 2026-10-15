package persist

import (
	"context"
	"log"
	"sync"
	"time"

	"github.com/Crypto-Barrett/oddfi-agent-backend/internal/pushtypes"
)

// WriteOp 持久化操作单元，串行消费保证 SQLite 写无锁竞争。
//
// 注意：Card 是入队时刻的快照（浅拷贝 + 指针字段深拷贝），
// 入队后 caller 可继续修改原 *PushCard 而不影响本 op。
type WriteOp struct {
	Kind string // "insert" | "update"
	Card *pushtypes.PushCard
}

// Persister 单 goroutine 消费 channel，串行写 SQLite。
// 全程 non-blocking 入队（drop-on-full + log + metric）；不阻断 WS 主流水线。
type Persister struct {
	repo *Repo
	ch   chan WriteOp
	wg   sync.WaitGroup
	stop chan struct{}

	mu      sync.Mutex
	dropped uint64
	wrote   uint64
	failed  uint64
}

// NewPersister 创建 persister（不启动 worker，由 Run 启动）。
// chanBuf 推荐 512（见 DD-001 §8.D5）。
func NewPersister(repo *Repo, chanBuf int) *Persister {
	if chanBuf <= 0 {
		chanBuf = 512
	}
	return &Persister{
		repo: repo,
		ch:   make(chan WriteOp, chanBuf),
		stop: make(chan struct{}),
	}
}

// Enqueue 非阻塞入队。满则返回 false（caller 自行 log + metric）。
//
// 内部对 card 做浅拷贝 + AiAnalysis/Suggest 指针深拷贝，
// 调用方 Enqueue 之后修改原对象不会影响落库结果。
func (p *Persister) Enqueue(op WriteOp) bool {
	if op.Card == nil {
		return false
	}
	op.Card = copyCard(op.Card)
	select {
	case p.ch <- op:
		return true
	default:
		p.mu.Lock()
		p.dropped++
		p.mu.Unlock()
		return false
	}
}

func copyCard(c *pushtypes.PushCard) *pushtypes.PushCard {
	cp := *c // 浅拷
	if c.AiAnalysis != nil {
		ai := *c.AiAnalysis
		cp.AiAnalysis = &ai
	}
	if c.Suggest != nil {
		sg := *c.Suggest
		cp.Suggest = &sg
	}
	if c.Position != nil {
		ps := *c.Position
		cp.Position = &ps
	}
	return &cp
}

// Run 启动后台 worker；阻塞直到 Shutdown 调用或 ctx 取消。
func (p *Persister) Run(ctx context.Context) {
	p.wg.Add(1)
	go func() {
		defer p.wg.Done()
		for {
			select {
			case <-ctx.Done():
				p.drain()
				return
			case <-p.stop:
				p.drain()
				return
			case op := <-p.ch:
				p.handle(op)
			}
		}
	}()
}

func (p *Persister) drain() {
	for {
		select {
		case op := <-p.ch:
			p.handle(op)
		default:
			return
		}
	}
}

func (p *Persister) handle(op WriteOp) {
	if op.Card == nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	var err error
	switch op.Kind {
	case "insert":
		err = p.repo.InsertCard(ctx, op.Card)
	case "update":
		err = p.repo.UpdateEnrich(ctx, op.Card)
	default:
		log.Printf("[Persist] unknown op kind=%q id=%s — dropped", op.Kind, op.Card.ID)
		return
	}

	p.mu.Lock()
	defer p.mu.Unlock()
	if err != nil {
		p.failed++
		log.Printf("[Persist] %s id=%s err=%v", op.Kind, op.Card.ID, err)
		return
	}
	p.wrote++
}

// Shutdown 触发优雅退出（drain 剩余 ops 后退出 worker）。
// 调用方应在退出前调用，并隐式 Wait()。
func (p *Persister) Shutdown() {
	select {
	case <-p.stop:
		// 已关闭，幂等
	default:
		close(p.stop)
	}
	p.wg.Wait()
}

// Stats 返回累计指标快照。
type Stats struct {
	Dropped uint64
	Wrote   uint64
	Failed  uint64
}

func (p *Persister) Stats() Stats {
	p.mu.Lock()
	defer p.mu.Unlock()
	return Stats{Dropped: p.dropped, Wrote: p.wrote, Failed: p.failed}
}

// Capacity 返回 channel 容量；测试场景下用于断言。
func (p *Persister) Capacity() int { return cap(p.ch) }

// QueueLen 返回当前 channel 中待处理 op 数量。
func (p *Persister) QueueLen() int { return len(p.ch) }
