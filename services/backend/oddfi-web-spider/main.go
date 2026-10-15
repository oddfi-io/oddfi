package main

import (
	"context"
	"flag"
	"log"
	"os"
	"os/signal"
	"sync"
	"syscall"

	"oddfi-web-spider/client"
	"oddfi-web-spider/config"
	"oddfi-web-spider/runner"
	"oddfi-web-spider/service"
	"oddfi-web-spider/storage"
)

func main() {
	// 1. 参数解析
	mode := flag.String("mode", "api", "运行模式")

	// 本地开发环境默认使用 config.yaml 配置文件
	// 线上测试和正式环境使用 config_xxx.yaml 配置文件
	configPath := flag.String("config", "config/config_prod.yaml", "配置文件路径")
	flag.Parse()

	// 2. 加载配置
	config.LoadConfig(*configPath)
	cfg := config.GetConfig()

	log.Printf("🛠️  初始化 oddfi-web-spider, 模式: [%s], 环境: [%s]", *mode, cfg.App.Env)

	// 3. 监听系统信号 (创建可取消的 Context)
	// 当接收到中断信号时，ctx.Done() 会收到信号，触发一路向下的“优雅关闭”
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	// 4. 依赖注入 (IoC)
	dbStorage := storage.NewDBStorage(cfg.MySQL.DSN)
	// 强烈建议：给 DB 加一个 Close 延迟调用，防止 main 退出太快
	rawDB, err := dbStorage.GetDB().DB()
	if err != nil {
		log.Fatalf("❌ 无法获取原生数据库连接: %v", err)
	}

	// 这里的 rawDB 才是 *sql.DB 类型，拥有 Close 方法
	defer func() {
		log.Println("🔌 [Cleanup] 正在关闭数据库连接池...")
		if err := rawDB.Close(); err != nil {
			log.Printf("⚠️ 关闭数据库连接失败: %v", err)
		}
	}()

	restClient := client.NewRestClient(cfg.SportMonks.ApiToken)
	moneylineRepo := storage.NewMoneylineRepo(dbStorage)
	moneylineSvc := service.NewMoneylineService(restClient, moneylineRepo)
	spiderSvc := service.NewSpiderService(restClient, dbStorage)
	spiderSvc.AttachMoneylineService(moneylineSvc)

	// 5. 运行分发
	log.Println("🚀 oddfi-web-spider 引擎准备就绪...")

	switch *mode {
	case "api":
		apiRunner := runner.NewAPIRunner(spiderSvc)
		moneylineRunner := runner.NewMoneylineRunner(moneylineSvc, moneylineRepo)
		var wg sync.WaitGroup
		wg.Add(2)
		go func() {
			defer wg.Done()
			apiRunner.StartForAllSport(ctx)
		}()
		go func() {
			defer wg.Done()
			moneylineRunner.Start(ctx)
		}()
		wg.Wait()
	case "ws":
		log.Println("WS 模式待实现...")
	default:
		log.Fatalf("❌ 未知的模式: %s", *mode)
	}

	log.Println("👋 oddfi-web-spider 已安全退出")
}
