package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"

	"chain-consumer/global"
	"chain-consumer/internal/logc"
	"chain-consumer/internal/mysql"
	"chain-consumer/internal/redis"
	"chain-consumer/internal/tracelog"
	"chain-consumer/service/bsc"

	"golang.org/x/sync/errgroup"
)

const BlockdataBackupServiceName = "blockdata_backup"

var (
	configPath = flag.String("config", "/app/config/config.yaml", "The path to the config file")
)

func main() {
	flag.Parse()

	if err := global.LoadConfigByEnv(); err != nil {
		log.Fatalf("Failed to init config error:%v", err)
		panic(err)
	}

	// 初始化 MySQL
	config := global.GetBackupConfig()
	if config.MySQL.DSN != "" {
		if err := mysql.InitMysql(config.MySQL.DSN); err != nil {
			log.Fatalf("Failed to init mysql error:%v", err)
			panic(err)
		}
	}

	// 初始化 Redis
	if config.Redis.Addr != "" {
		if err := redis.InitRedis(config.Redis); err != nil {
			log.Fatalf("Failed to init redis error:%v", err)
			panic(err)
		}
	}

	// 创建带取消功能的context
	newCtx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// 处理系统信号
	go func() {
		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
		<-sigChan
		logc.Info(newCtx, "Received shutdown signal, canceling context...", nil)
		cancel()
	}()

	// 初始化日志
	tracelog.InitLogger(config.Global.Env)

	ctx, span := tracelog.StartSpan(newCtx, "chain_consumer", "main")
	defer span.End()
	tl := tracelog.NewWithContext(ctx)

	// 使用errgroup管理多个服务
	g, gCtx := errgroup.WithContext(newCtx)

	// 启动Solana服务
	// g.Go(func() error {
	// 	tl.Infow("Starting Solana Service...")
	// 	solanaService, err := solana.NewSolanaService(gCtx, *config)
	// 	if err != nil {
	// 		return fmt.Errorf("failed to create Solana service: %w", err)
	// 	}
	// 	solanaService.Start()
	// 	<-gCtx.Done()
	// 	solanaService.Stop()
	// 	return nilW
	// })

	// 启动 ETH 服务
	// g.Go(func() error {
	// 	tl.Infow("Starting ETH Service...")
	// 	ethService, err := ethereum.NewEthService(gCtx, *config)
	// 	if err != nil {
	// 		return fmt.Errorf("failed to create ETH service: %w", err)
	// 	}
	// 	ethService.Start()
	// 	<-gCtx.Done()
	// 	ethService.Stop()
	// 	return nil
	// })

	// 启动 BSC 服务
	g.Go(func() error {
		tl.Infow("Starting BSC Service...")
		bscService, err := bsc.NewBscService(gCtx, *config, redis.GetClient())
		if err != nil {
			panic(fmt.Sprintf("failed to create BSC service: %v", err))
			// return fmt.Errorf("failed to create BSC service: %w", err)
		}
		bscService.Start()
		<-gCtx.Done()
		bscService.Stop()
		return nil
	})

	// // 启动 TRON 服务
	// g.Go(func() error {
	// 	tl.Infow("Starting Tron Service...")
	// 	tronService, err := tron.NewTronService(gCtx, *config, redis.GetClient())
	// 	if err != nil {
	// 		panic(fmt.Sprintf("failed to create TRON service: %v", err))
	// 		// return fmt.Errorf("failed to create Tron service: %w", err)
	// 	}
	// 	tronService.Start()
	// 	return nil
	// })

	// 等待所有协程完成或任意一个失败
	if err := g.Wait(); err != nil {
		tl.Errorw("Service group error", err, nil)
	}

	tl.Infow("All services completed successfully")
}
