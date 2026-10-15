package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"log"
	"net/http"
	"oddfi-web-api/client"
	"oddfi-web-api/config"
	"oddfi-web-api/handler"
	"oddfi-web-api/storage"
	"oddfi-web-api/utils"
	"os"
	"os/signal"
	"runtime"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/opentracing-contrib/go-stdlib/nethttp"
	"github.com/opentracing/opentracing-go"
)

// @title Oddfi Market Web API
// @version 1.0
// @description Oddfi 详情页、赛事、盘口、流动池、Banner 和 token price 相关接口文档。
// @BasePath /
// @schemes http https
func main() {

	log.Println("runtime numCPU: ", runtime.NumCPU(), " , GOMAXPROCS: ", runtime.GOMAXPROCS(0))

	configPath := flag.String("config", "config/config_prod.yaml", "配置文件路径")
	flag.Parse()

	// 2. 加载配置
	config.LoadConfig(*configPath)
	cfg := config.GetConfig()
	log.Println("config 配置文件加载成功环境: ", cfg.App.Env)

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

	// 5. 初始化 Redis (单机版)
	// 假设配置结构体中有 Redis.Addr, Redis.Password, Redis.DB
	redisClient, err := storage.NewRedisStorage(cfg.Redis)
	if err != nil {
		log.Fatalf("❌ Redis 初始化失败: %v", err)
	}
	log.Printf("✅ Redis 初始化成功: %v", cfg.Redis.Addr())

	// 初始化：加载语言映射表（文件路径改为你实际的路径）
	err = storage.LoadFixtureLangMapping("config/fixture_language_mapping.json")
	if err != nil {
		log.Fatalf("[LoadFixtureLangMapping] 加载语言映射文件失败:%v", err)
	}
	log.Printf("✅ 加载语言映射文件成功")

	// 这里的 rawDB 才是 *sql.DB 类型，拥有 Close 方法
	defer func() {
		log.Println("🔌 [Cleanup] 正在关闭数据库连接池...")
		if err := rawDB.Close(); err != nil {
			log.Printf("⚠️ 关闭数据库连接失败: %v", err)
		}

		// 关闭 Redis 连接池
		if err := redisClient.Close(); err != nil {
			log.Printf("⚠️ 关闭 Redis 连接池失败: %v", err)
		}
		log.Println("🔌 [Cleanup] 资源连接池已关闭")
	}()

	rootRouter := gin.New()
	tracer := opentracing.GlobalTracer()

	restClient := client.NewRestClient(cfg.SportMonks.ApiToken)

	handler.RootApis(rootRouter)
	v1Group := rootRouter.Group("api/v1")
	// Moneyline 历史曲线依赖独立仓储，和原有赛事仓储一起注入，避免 handler 直接感知数据库初始化细节。
	handler.BuildMarket(v1Group, restClient, redisClient, storage.NewFixtureRepo(dbStorage), storage.NewMoneylineRepo(dbStorage))
	handler.BuildEarlyAccess(v1Group, storage.NewEarlyAccessRepo(dbStorage))

	// tracing
	tracingMiddleWare := nethttp.Middleware(
		tracer,
		rootRouter,
		nethttp.OperationNameFunc(func(r *http.Request) string {
			return fmt.Sprintf("HTTP %v%v", r.Method, r.URL.Path)
		}),
		nethttp.MWSpanObserver(func(sp opentracing.Span, r *http.Request) {
			sp.SetTag("http.uri", r.URL.EscapedPath())
		}),
	)

	// 1. 启动 WebSocket 引擎
	go handler.WSHub.Run()
	// 2. 启动后台抓取轮询 (加载 30 天数据，并每分钟推一次最新价)
	go handler.StartPriceFetcher()

	srv := &http.Server{
		Addr:    ":8080",
		Handler: tracingMiddleWare,
	}
	go func() {
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("listen: %s\n", err)
		}
		utils.CloseTracer()
		log.Println("Server exited")
	}()

	quit := make(chan os.Signal)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Gracefully shutting down server...")
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatal("Server forced to shutdown:", err)
	}
	log.Println("Server exiting")
}
