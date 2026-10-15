// runner/runner.go
package runner

import (
	"context"
	"log"
	"sync"
	"time"

	"oddfi-web-spider/config"
	"oddfi-web-spider/service"
)

type APIRunner struct {
	svc *service.SpiderService
	wg  sync.WaitGroup
}

func NewAPIRunner(svc *service.SpiderService) *APIRunner {
	return &APIRunner{svc: svc}
}

// // Start 启动所有调度任务（支持 Context 优雅关闭）
// func (r *APIRunner) StartOld(ctx context.Context) {
// 	log.Println("🚀 [Start] OddFi API Spider 调度器已启动...")

// 	// 任务注册表（后续新增任务只需在这里加一行即可）
// 	tasks := []struct {
// 		name     string
// 		interval time.Duration
// 		fn       func()
// 	}{
// 		// 任务 1: 首页 7 天赛程同步 (每 1 小时全量刷新一次未来一周)
// 		{
// 			name:     "Future_7_Days",
// 			interval: 1 * time.Hour,
// 			fn: func() {
// 				start := time.Now().Format("2006-01-02")
// 				end := time.Now().Add(time.Hour * 24 * 7).Format("2006-01-02")
// 				r.svc.SyncFixturesRange(ctx, start, end)
// 			},
// 		},
// 		// 任务 2: 核心优化 - 三日滑动窗口实时同步 (每 10 秒)
// 		// 覆盖 [昨天, 今天, 明天]，确保跨天比赛的比分、状态、赔率无缝更新
// 		{
// 			name:     "Live_Window_3_Days",
// 			interval: 10 * time.Second,
// 			fn: func() {
// 				// 定义需要同步的日期窗口
// 				dates := []string{
// 					time.Now().AddDate(0, 0, -1).Format("2006-01-02"), // 昨天
// 					time.Now().Format("2006-01-02"),                   // 今天
// 					time.Now().AddDate(0, 0, 1).Format("2006-01-02"),  // 明天
// 				}

// 				// 使用 WaitGroup 实现任务内部的并行，加快单次轮询效率
// 				var wg sync.WaitGroup
// 				for _, date := range dates {
// 					wg.Add(1)
// 					go func(d string) {
// 						defer wg.Done()
// 						// 这里的 SyncFixturesByDate 内部应该包含 include=odds,participants 逻辑
// 						r.svc.SyncFixturesByDate(ctx, d)
// 					}(date)
// 				}
// 				wg.Wait()
// 			},
// 		},
// 		// 任务 3: 联赛/元数据同步 (每 2 小时执行一次)
// 		{
// 			name:     "Leagues_Metadata",
// 			interval: 2 * time.Hour,
// 			fn:       func() { r.svc.SyncLeagues(ctx) },
// 		},
// 	}

// 	// 启动所有任务
// 	for _, t := range tasks {
// 		r.wg.Add(1)
// 		go r.scheduleTaskWithCtx(ctx, t.name, t.interval, t.fn)
// 	}

// 	// 等待 Context 被取消
// 	<-ctx.Done()
// 	log.Println("🛑 [Start] [stop]  收到停止信号，正在优雅关闭所有任务...")
// 	r.wg.Wait()
// 	log.Println("✅ [Start] [stop]  所有任务已停止，调度器退出")
// }

// Start 启动所有调度任务（支持 Context 优雅关闭）
func (r *APIRunner) StartForAllSport(ctx context.Context) {
	log.Println("🚀 [Start] OddFi API Spider 调度器已启动...")

	// 任务注册表（后续新增任务只需在这里加一行即可）
	tasks := []struct {
		name     string
		interval time.Duration
		fn       func()
	}{
		// 任务 1: 直接全量所有世界杯 / 欧冠数据 比赛 定时刷新
		{
			name:     "all_sport_fixtures",
			interval: 1 * time.Hour,
			fn: func() {
				if config.GetConfig().App.Env == "local" {
					r.svc.SyncFixturesAllLocal(ctx)
				} else {
					r.svc.SyncFixturesAll(ctx)
				}
			},
		},
	}

	// 启动所有任务
	for _, t := range tasks {
		r.wg.Add(1)
		go r.scheduleTaskWithCtx(ctx, t.name, t.interval, t.fn)
	}

	// 等待 Context 被取消
	<-ctx.Done()
	log.Println("🛑 [Start] [stop]  收到停止信号，正在优雅关闭所有任务...")
	r.wg.Wait()
	log.Println("✅ [Start] [stop]  所有任务已停止，调度器退出")
}

// scheduleTaskWithCtx 带 Context 的定时任务（防止 goroutine 泄漏）
func (r *APIRunner) scheduleTaskWithCtx(ctx context.Context, name string, interval time.Duration, task func()) {
	defer r.wg.Done()

	log.Printf("[%s] [scheduleTaskWithCtx] [register]  任务已注册，周期: %v", name, interval)

	// 首次立即执行一次（保持原有行为）
	r.runTaskSafely(name, task)

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			log.Printf("[%s] [scheduleTaskWithCtx] [stop]  任务已停止（Context 取消）", name)
			return
		case <-ticker.C:
			r.runTaskSafely(name, task)
		}
	}
}

// runTaskSafely 安全执行任务（panic 恢复 + 执行耗时日志）
func (r *APIRunner) runTaskSafely(name string, task func()) {
	start := time.Now()

	log.Printf("[%s] [runTaskSafely] 开始执行...", name)

	defer func() {
		if rec := recover(); rec != nil {
			log.Printf("[%s] [runTaskSafely] [panic] 任务 panic: %v", name, rec)
		}
		log.Printf("[%s] [runTaskSafely] [complete] 执行完成，耗时: %v", name, time.Since(start))
	}()

	task()
}
