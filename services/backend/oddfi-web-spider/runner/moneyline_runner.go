package runner

import (
	"context"
	"log"
	"sync"
	"time"

	"oddfi-web-spider/service"
	"oddfi-web-spider/storage"
)

type MoneylineRunner struct {
	svc             *service.MoneylineService
	repo            *storage.MoneylineRepo
	workerCount     int
	batchLimit      int
	tickInterval    time.Duration
	refreshInterval time.Duration
	jobs            chan int64
	inflight        map[int64]struct{}
	inflightMu      sync.Mutex
	workerWG        sync.WaitGroup
}

func NewMoneylineRunner(svc *service.MoneylineService, repo *storage.MoneylineRepo) *MoneylineRunner {
	return &MoneylineRunner{
		svc:             svc,
		repo:            repo,
		workerCount:     5,
		batchLimit:      30,
		tickInterval:    30 * time.Second,
		refreshInterval: 10 * time.Minute,
		jobs:            make(chan int64, 60),
		inflight:        make(map[int64]struct{}),
	}
}

// Start 启动 Moneyline 精细调度循环。
// runner 独立于原 APIRunner，是因为 Moneyline 采集频率随比赛生命周期变化，不能用“每小时全量”表达。
func (r *MoneylineRunner) Start(ctx context.Context) {
	log.Printf("🚀 [MoneylineRunner] 启动，workers=%d batch=%d tick=%v", r.workerCount, r.batchLimit, r.tickInterval)
	for i := 0; i < r.workerCount; i++ {
		r.workerWG.Add(1)
		go r.worker(ctx, i+1)
	}

	r.runRefreshSafely(ctx)
	r.dispatchDueSafely(ctx)

	tick := time.NewTicker(r.tickInterval)
	defer tick.Stop()
	refresh := time.NewTicker(r.refreshInterval)
	defer refresh.Stop()

	for {
		select {
		case <-ctx.Done():
			log.Println("🛑 [MoneylineRunner] 收到停止信号，等待 worker 退出")
			r.workerWG.Wait()
			log.Println("✅ [MoneylineRunner] 已停止")
			return
		case <-refresh.C:
			r.runRefreshSafely(ctx)
		case <-tick.C:
			r.dispatchDueSafely(ctx)
		}
	}
}

// worker 串接具体采集任务。
// worker 数固定较小，是为了让并发吞吐受控；真正的全局上游配额保护还在 RestClient 的 token 级节拍限流里。
func (r *MoneylineRunner) worker(ctx context.Context, workerID int) {
	defer r.workerWG.Done()
	for {
		select {
		case <-ctx.Done():
			return
		case fixtureID := <-r.jobs:
			err := r.svc.CaptureSnapshot(ctx, fixtureID)
			if err != nil {
				log.Printf("[MoneylineRunner] worker=%d capture fixture=%d failed: %v", workerID, fixtureID, err)
			}
			r.clearInflight(fixtureID)
		}
	}
}

// dispatchDueSafely 从状态表读取到期 fixture 并入队。
// 使用 next_poll_at 驱动可以让赛前远期、临开、赛中、异常态共享同一套调度入口，同时避免 1600+ fixture 每分钟全量扫上游。
func (r *MoneylineRunner) dispatchDueSafely(ctx context.Context) {
	defer func() {
		if rec := recover(); rec != nil {
			log.Printf("[MoneylineRunner] dispatch panic: %v", rec)
		}
	}()

	due, err := r.repo.FindDueFixtures(ctx, time.Now(), r.batchLimit)
	if err != nil {
		log.Printf("[MoneylineRunner] 查询待采集 fixture 失败: %v", err)
		return
	}
	if len(due) == 0 {
		return
	}

	queued := 0
	for _, fixtureID := range due {
		if !r.markInflight(fixtureID) {
			continue
		}
		select {
		case r.jobs <- fixtureID:
			queued++
		default:
			// job 队列满时释放 inflight，让下一轮 tick 继续调度，避免因本轮雪崩造成 fixture 永久卡住。
			r.clearInflight(fixtureID)
			log.Printf("[MoneylineRunner] job 队列已满，延后 fixture=%d", fixtureID)
		}
	}
	log.Printf("[MoneylineRunner] due=%d queued=%d", len(due), queued)
}

// runRefreshSafely 定期刷新可启动集合。
// 单独加 panic 防护，是为了保证一次异常 fixture 数据不会退出整个后台采集进程。
func (r *MoneylineRunner) runRefreshSafely(ctx context.Context) {
	defer func() {
		if rec := recover(); rec != nil {
			log.Printf("[MoneylineRunner] refresh panic: %v", rec)
		}
	}()
	if err := r.svc.RefreshActiveSet(ctx); err != nil {
		log.Printf("[MoneylineRunner] 刷新活跃集合失败: %v", err)
	}
}

func (r *MoneylineRunner) markInflight(fixtureID int64) bool {
	r.inflightMu.Lock()
	defer r.inflightMu.Unlock()
	if _, ok := r.inflight[fixtureID]; ok {
		return false
	}
	// inflight 是 runner 内部的并发闸门，防止同一 fixture 在上一次请求未完成时又被下一轮 tick 重复提交。
	r.inflight[fixtureID] = struct{}{}
	return true
}

func (r *MoneylineRunner) clearInflight(fixtureID int64) {
	r.inflightMu.Lock()
	delete(r.inflight, fixtureID)
	r.inflightMu.Unlock()
}
