package main

import (
	"fmt"
	"os"
	"os/signal"
	"syscall"
	"time"

	"oddfi-cron-job/internal/bsc"
	"oddfi-cron-job/internal/config"
	"oddfi-cron-job/internal/health"
	"oddfi-cron-job/internal/lark"
	"oddfi-cron-job/internal/logger"
	"oddfi-cron-job/internal/mysql"
	"oddfi-cron-job/internal/redis"
	"oddfi-cron-job/internal/scheduler"
	"oddfi-cron-job/internal/tasks"

	"github.com/davecgh/go-spew/spew"
	"github.com/spf13/viper"
)

func main() {
	// 1. 加载配置
	cfg, err := loadConfig()
	if err != nil {
		panic("Failed to load config: " + err.Error())
	}

	// 2. 初始化日志
	if err := initLogger(cfg); err != nil {
		panic("Failed to init logger: " + err.Error())
	}

	// 3. 初始化Redis
	initRedis(cfg)

	// 4. 初始化MySQL
	initMySQL(cfg)

	// 5. 初始化BSc
	initBsc(cfg)

	// 6. 初始化飞书
	initLark(cfg)

	logger.Infof("Starting Oddfi Cron Job...")
	logger.Infof("Config: port=%d, timezone=%s, log_level=%s",
		cfg.App.Port, cfg.Timezone, cfg.Log.Level)

	// 5. 获取时区
	loc, err := cfg.GetCronLocation()
	if err != nil {
		logger.Warnf("Failed to load timezone %s, using UTC: %v", cfg.Timezone, err)
		loc = time.UTC
	}

	// 6. 创建调度器
	sched := scheduler.NewScheduler(scheduler.WithLocation(loc))

	// 7. 注册所有任务
	if err := tasks.RegisterAll(sched, cfg); err != nil {
		logger.Errorf("Failed to register tasks: %v", err)
	}

	logger.Infof("Registered %d tasks", sched.GetTaskCount())

	// 8. 启动健康检查服务器
	port := fmt.Sprintf("%d", cfg.App.Port)
	if err := health.StartServer(port, sched); err != nil {
		logger.Errorf("Failed to start health server: %v", err)
	}

	// 9. 启动调度器
	if err := sched.Start(); err != nil {
		logger.Errorf("Failed to start scheduler: %v", err)
	}

	logger.Infof("Scheduler started successfully")

	// 10. 等待退出信号
	waitForShutdown(sched)

	logger.Infof("Application stopped")
}

// initRedis 初始化Redis客户端
func initRedis(cfg *config.Config) {
	addr := cfg.Redis.Addr
	if addr == "" {
		addr = viper.GetString("REDIS_ADDR")
	}
	if addr == "" {
		panic("redis address is required")
	}

	redis.Init(addr)
}

// initMySQL 初始化MySQL客户端
func initMySQL(cfg *config.Config) {
	dsn := cfg.MySQL.DSN
	if dsn == "" {
		dsn = viper.GetString("MYSQL_DSN")
	}
	if dsn == "" {
		panic("mysql DSN is required")
	}

	mysql.Init(
		dsn,
		cfg.MySQL.MaxOpenConns,
		cfg.MySQL.MaxIdleConns,
		cfg.MySQL.ConnMaxLifetime,
	)
}

// initEth 初始化Ethereum客户端
func initBsc(cfg *config.Config) {
	rpc := cfg.Bsc.RPC
	if rpc == "" {
		rpc = viper.GetString("BSC_RPC")
	}
	if rpc == "" {
		panic("ethereum RPC URL is required")
	}

	bsc.Init(rpc)
}

// initLark 初始化飞书客户端
func initLark(cfg *config.Config) {
	// 从配置或环境变量获取 webhook
	webhook := cfg.Lark.Withdrawal.Webhook
	if webhook == "" {
		webhook = viper.GetString("LARK_WITHDRAWAL_WEBHOOK")
	}
	if webhook == "" {
		panic("lark webhook is required")
	}

	lark.Init(webhook)
	logger.Infof("Lark client initialized")
}

// loadConfig 加载配置
func loadConfig() (*config.Config, error) {
	cfg := config.LoadByEnv()
	spew.Dump(*cfg)
	return cfg, nil
}

// initLogger 初始化日志系统
func initLogger(cfg *config.Config) error {
	level := cfg.Log.Level
	if level == "" {
		level = viper.GetString("LOG_LEVEL")
	}
	if level == "" {
		level = "info"
	}

	encoding := cfg.Log.Encoding
	if encoding == "" {
		encoding = viper.GetString("LOG_ENCODING")
	}
	if encoding == "" {
		encoding = "json"
	}

	return logger.Init(level, encoding)
}

// waitForShutdown 等待关闭信号
func waitForShutdown(sched *scheduler.Scheduler) {
	// 创建信号通道
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	// 等待信号
	sig := <-sigChan
	logger.Infof("Received signal: %v", sig)

	// 优雅关闭
	sched.Stop()
	redis.Close()
	mysql.Close()
	bsc.Close()
}
