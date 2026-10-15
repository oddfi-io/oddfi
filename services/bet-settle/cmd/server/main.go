package main

import (
	"context"
	"flag"
	"log"
	"os"
	"os/signal"
	"syscall"

	"oddfi-bet-settle/cmd/worker"
	"oddfi-bet-settle/config"
	"oddfi-bet-settle/internal/db"
)

func main() {
	// 结算服务定位为后台计算进程，对外 HTTP API 已收敛到 web-api 服务，这里只保留配置入口。
	configPath := flag.String("config", "config/config_prod.yaml", "配置文件路径")
	flag.Parse()

	// 加载配置并初始化数据库连接。
	config.LoadConfig(*configPath)
	cfg := config.GetConfig()
	log.Println("初始化 oddfi-bet-settle worker")

	dbStorage := db.NewDBStorage(cfg.MySQL.DSN)
	rawDB, err := dbStorage.GetDB().DB()
	if err != nil {
		log.Fatalf("[ERROR] 无法获取原生数据库连接: %v", err)
	}
	defer func() {
		log.Println("正在关闭数据库连接池...")
		if err := rawDB.Close(); err != nil {
			log.Printf("[ERROR] 关闭数据库连接失败: %v", err)
		}
	}()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	startSettleWorker(ctx, dbStorage, cfg)
	startMockUCLWorker(ctx, dbStorage, cfg)
	waitForShutdown(cancel)
	log.Println("Shutting down worker...")
}

// startSettleWorker 启动 30 秒轮询结算任务。
func startSettleWorker(ctx context.Context, dbStorage *db.DBStorage, cfg *config.Config) {
	settleWorker := worker.NewSettleWorker(dbStorage.GetDB(), cfg)
	go func() {
		log.Printf("Settlement Worker started (Polling every %s)...", worker.SettlementPollInterval)
		settleWorker.StartPolling(ctx)
	}()
}

// startMockUCLWorker 启动欧冠 5 分钟 mock 赛事；配置默认关闭，灰度时才会写 fixture/odds/result 并自动结算。
func startMockUCLWorker(ctx context.Context, dbStorage *db.DBStorage, cfg *config.Config) {
	if cfg == nil || !cfg.Settlement.MockUCL.Enabled {
		return
	}
	settleWorker := worker.NewSettleWorker(dbStorage.GetDB(), cfg)
	go func() {
		log.Println("Mock UCL Worker started...")
		settleWorker.StartMockUCLLoop(ctx, cfg.Settlement.MockUCL)
	}()
}

// waitForShutdown 等待系统退出信号，并通知 worker 停止。
func waitForShutdown(cancel context.CancelFunc) {
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	// 收到容器停止信号后先取消 context，让轮询循环有机会退出并释放数据库连接。
	cancel()
}
