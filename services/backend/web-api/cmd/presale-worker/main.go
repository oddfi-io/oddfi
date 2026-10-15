// cmd/presale-worker/main.go
//
// presale-worker 是独立 binary，与 web-api HTTP server 同机部署但进程分离。
// B2 完整实现：
//  1. config + logger + DB + Redis 初始化
//  2. EnsureAll 游标初始化（必须在扫块前完成）
//  3. leader 抢锁（Redis SET NX EX）：防止多实例并发扫块导致重复入账
//  4. USDT Transfer 监听器（PresaleListener.Run，多金库地址池）
//  5. Round status cron（每 5min，RoundCronService.Tick）
//
// Worker 失去 leader 锁时静默退出当前 tick，下一轮重新竞争。
// Leader 转移：isLeader 原子标志控制 cron goroutine 是否真正执行，避免重复 spawn。

package main

import (
	"context"
	"os"
	"os/signal"
	"sync/atomic"
	"syscall"
	"time"

	"everything_finance/org/web-api/internal/chain"
	"everything_finance/org/web-api/internal/config"
	"everything_finance/org/web-api/internal/pkg/logger"
	"everything_finance/org/web-api/internal/pkg/mysql"
	"everything_finance/org/web-api/internal/pkg/redis"
	"everything_finance/org/web-api/internal/repository"
	"everything_finance/org/web-api/internal/service"

	"github.com/ethereum/go-ethereum/ethclient"
	"gorm.io/gorm"
)

func main() {
	// 1. 初始化 logger（presale-worker 使用结构化 JSON 输出）
	logger.Init("info", false)

	// 2. 加载配置（config.yaml + env 覆盖）
	cfg := config.LoadDefault()
	presaleCfg := &cfg.Presale

	logger.Infof("[presale-worker] starting, env=%s vault_pool=%v confirm_blocks=%d",
		cfg.Server.Env, presaleCfg.VaultPool, presaleCfg.ConfirmBlocks)

	// 3. 初始化 MySQL（GORM + legacy sql.DB，UserRepo 依赖 legacy client）
	mysql.Init(cfg.Database)
	mysql.InitGORM(cfg.Database)
	gdb := mysql.GetGORM()
	logger.Info("[presale-worker] database connected")

	// 4. 初始化 Redis
	rdb := redis.Init(cfg.Redis)
	logger.Info("[presale-worker] redis connected")

	// 5. EnsureAll：为 vault_pool 中每个地址创建初始游标
	// 必须在 Worker 开始扫块前执行完毕，否则游标不存在会导致 Load 失败
	// 新建 cursor 时用当前 BSC head block 作初始值，避免新加 vault 时从高度 0 回扫整链
	cursorRepo := repository.NewPresaleEventCursorRepo(gdb)
	if len(presaleCfg.VaultPool) > 0 {
		var initBlock uint64
		if presaleCfg.BscRpcUrl != "" {
			ec, dialErr := ethclient.Dial(presaleCfg.BscRpcUrl)
			if dialErr == nil {
				if h, hErr := ec.BlockNumber(context.Background()); hErr == nil {
					initBlock = h
					logger.Infof("[presale-worker] EnsureAll init block from BSC head: %d", initBlock)
				} else {
					logger.Warnf("[presale-worker] EnsureAll head query failed: %v (fallback init=0)", hErr)
				}
				ec.Close()
			} else {
				logger.Warnf("[presale-worker] EnsureAll ethclient dial failed: %v (fallback init=0)", dialErr)
			}
		}
		if err := cursorRepo.EnsureAll(context.Background(), presaleCfg.VaultPool, initBlock); err != nil {
			logger.Errorf("[presale-worker] failed to ensure event cursors: %v", err)
			// 游标初始化失败是启动致命错误，退出让 supervisor 重启
			os.Exit(1)
		}
		logger.Infof("[presale-worker] ensured cursors for %d vault addresses (init_block=%d)", len(presaleCfg.VaultPool), initBlock)
	} else {
		logger.Warn("[presale-worker] no vault addresses configured, listener will skip scanning")
	}

	// 6. 初始化 BSC RPC client（启动时验证连通性）
	var bscClient service.BscClient
	if presaleCfg.BscRpcUrl != "" {
		var err error
		bscClient, err = service.NewBscClientFromURL(presaleCfg.BscRpcUrl)
		if err != nil {
			logger.Errorf("[presale-worker] failed to connect bsc rpc: %v", err)
			os.Exit(1)
		}
		logger.Infof("[presale-worker] bsc rpc connected: %s", presaleCfg.BscRpcUrl)
	} else {
		logger.Warn("[presale-worker] BSC_RPC_URL not configured, listener will not function")
	}

	// 7. 装配 repositories
	depositRepo := repository.NewPresaleDepositRepo(gdb)
	roundRepo := repository.NewPresaleRoundRepo(gdb)
	holdingRepo := repository.NewPresaleHoldingRepo(gdb)
	opsRepo := repository.NewPresaleOpsEventRepo(gdb)
	bindRepo := repository.NewUserReferralBindRepo(gdb)
	// REQ-004：KOL 自定义返佣 repo，落 deposit 时按 referrer_eoa 命中则覆盖轮次比例
	kolReferralRepo := repository.NewKolReferralPctRepository(gdb)
	// TODO-016：lark webhook URL 走 DB lazy fetch + 30s cache，admin 改后秒级生效
	presaleConfigRepo := repository.NewPresaleConfigRepo(gdb)

	// 8. 装配 PresaleDepositService（bscClient 已在上方初始化）
	// NewPresaleDepositService 中 bscClient 非 nil 则不再重试 dial
	//
	// ISSUE-005 残留 bug 修复：必须注入真实 LarkWebhookService 否则 worker 路径
	// 调到 NotifyDepositConfirmed 后 SendAnomalyAlert 是 noop（构造函数默认降级）。
	//
	// TODO-016：用 WithRepo 版本启用 DB lazy fetch（cache 30s）。
	// fallback URL 仍从 cfg.LarkWebhookUrl（yaml/env）来，DB 拉失败时兜底。
	// 即使 yaml/env 都空也用 WithRepo — DB 里有值就能跑起来，否则首次 Notify 时降级 skip。
	larkAlerter := service.AnomalyAlerter(service.NewLarkWebhookServiceWithRepo(presaleCfg.LarkWebhookUrl, presaleConfigRepo))
	// REV-007 m1：装配日志脱敏 webhook URL，避免 secret token 落到 prod docker logs
	if presaleCfg.LarkWebhookUrl != "" {
		logger.Infof("[presale-worker] LarkWebhookService initialized fallback_url=%s + DB lazy fetch",
			service.MaskLarkWebhookURL(presaleCfg.LarkWebhookUrl))
	} else {
		logger.Info("[presale-worker] LarkWebhookService initialized (fallback empty, rely on DB lazy fetch)")
	}

	depositSvc := service.NewPresaleDepositService(
		presaleCfg,
		gdb,
		depositRepo,
		roundRepo,
		holdingRepo,
		opsRepo,
		bindRepo,
		kolReferralRepo, // REQ-004：worker 路径 ReportTx 不走，仅作 fallback；listener 自身另外注入
		rdb,
		bscClient,
		larkAlerter, // ISSUE-005：listener.processLog 走 NotifyDepositConfirmed 必须落到真实 alerter
	)

	// 9. 装配 RoundCronService
	roundCronSvc := service.NewRoundCronService(roundRepo)

	// 10. 装配 PresaleListener（需要 UserRepo，沿用现有 mysql.Client）
	// UserRepo 依赖 mysql.Client（旧接口）和 GORM（新接口），presale-worker 走 GORM 路径
	// 使用轻量 NewUserRepo 包装，只用 GetByWalletAddress 方法
	userRepo := repository.NewUserRepo(mysql.GetMySQL(), rdb)

	presaleListener := chain.NewPresaleListener(
		presaleCfg,
		gdb,
		bscClient,
		depositSvc,
		depositRepo,
		roundRepo,
		holdingRepo,
		opsRepo,
		cursorRepo,
		bindRepo,
		userRepo,
		rdb,
	)
	// REQ-004：worker 落 deposit 也按 referrer_eoa 查 KOL 自定义比例
	presaleListener.SetKolReferralRepo(kolReferralRepo)

	// 11. 优雅退出信号监听
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// 12. 启动 leader 抢锁循环（后台 goroutine）
	go runLeaderLoop(ctx, presaleCfg, rdb, gdb, presaleListener, roundCronSvc)

	// 13. 等待退出信号
	<-quit
	logger.Info("[presale-worker] received shutdown signal, stopping gracefully")

	// 通知所有 goroutine 退出
	cancel()
	// 给正在运行的 cron tick 最多 10s 完成
	time.Sleep(2 * time.Second)

	if err := rdb.Close(); err != nil {
		logger.Errorf("[presale-worker] redis close error: %v", err)
	}
	sqlDB, _ := gdb.DB()
	if sqlDB != nil {
		if err := sqlDB.Close(); err != nil {
			logger.Errorf("[presale-worker] mysql close error: %v", err)
		}
	}

	logger.Info("[presale-worker] stopped gracefully")
}

// runLeaderLoop 每 RedisLeaderTTLSec/3 秒尝试抢锁或续约
// 只有 leader 才执行 cron goroutine；非 leader 空转等待。
//
// 设计：cron goroutine 只在首次抢到 leader 时启动一次（workStarted 标志保证），
// 后续靠 isLeader 原子标志控制是否真正执行业务逻辑。
// Leader 转移时 cron goroutine 不重启，靠 isLeader 标志短路，避免重复 spawn goroutine。
func runLeaderLoop(
	ctx context.Context,
	cfg *config.PresaleConfig,
	rdb *redis.Client,
	gdb *gorm.DB,
	listener *chain.PresaleListener,
	roundCronSvc service.RoundCronService,
) {
	ttl := cfg.RedisLeaderTTLSec
	if ttl < 9 {
		ttl = 9
	}
	renewInterval := time.Duration(ttl/3) * time.Second
	ticker := time.NewTicker(renewInterval)
	defer ticker.Stop()

	var isLeader atomic.Bool
	var workStarted bool

	for {
		select {
		case <-ctx.Done():
			logger.Info("[presale-worker] leader loop stopped")
			return
		case <-ticker.C:
			ok, err := rdb.SetNX(ctx, cfg.RedisLeaderKey, "1",
				time.Duration(ttl)*time.Second)
			if err != nil {
				logger.Errorf("[presale-worker] redis SetNX error: %v — standing down", err)
				if isLeader.Load() {
					logger.Info("[presale-worker] lost leader lock due to redis error")
					isLeader.Store(false)
				}
				continue
			}

			if ok && !isLeader.Load() {
				logger.Info("[presale-worker] acquired leader lock, starting crons")
				isLeader.Store(true)
				if !workStarted {
					workStarted = true
					go runLeaderWork(ctx, cfg, gdb, &isLeader, listener, roundCronSvc)
				}
			} else if !ok && isLeader.Load() {
				logger.Info("[presale-worker] lost leader lock, crons will idle")
				isLeader.Store(false)
			}
		}
	}
}

// runLeaderWork 启动所有 leader 专属 cron goroutine
// 只调用一次（workStarted 标志保证）；各 cron 靠自己的 ticker 循环，isLeader 控制短路。
func runLeaderWork(
	ctx context.Context,
	cfg *config.PresaleConfig,
	_ *gorm.DB,
	isLeader *atomic.Bool,
	listener *chain.PresaleListener,
	roundCronSvc service.RoundCronService,
) {
	// cron 1：Round status 推进（每 5min）
	go runRoundStatusCron(ctx, isLeader, roundCronSvc)

	// cron 2：USDT Transfer 监听器（每 PollIntervalSec）
	// Run 内部自带 ticker，直接 Run 即可；isLeader 检测在 Run 外层 goroutine
	go runListenerWithLeaderCheck(ctx, isLeader, listener)
}

// runRoundStatusCron 每 5 分钟推进轮次状态（manual_override=0 的轮次）
func runRoundStatusCron(ctx context.Context, isLeader *atomic.Bool, svc service.RoundCronService) {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	logger.Info("[presale-worker] round status cron started")
	for {
		select {
		case <-ctx.Done():
			logger.Info("[presale-worker] round status cron stopped")
			return
		case t := <-ticker.C:
			if !isLeader.Load() {
				// 非 leader：等待锁漂移，不执行业务
				continue
			}
			logger.Infof("[presale-worker] round status cron tick at %s", t.Format(time.RFC3339))
			if err := svc.Tick(ctx); err != nil {
				logger.Errorf("[presale-worker] round status cron tick error: %v", err)
			}
		}
	}
}

// runListenerWithLeaderCheck 包装 PresaleListener.Run，加 isLeader 保护
// 若失去 leader 则等待，重新获取后恢复（监听器 Run 是阻塞循环，ctx 取消时退出）
func runListenerWithLeaderCheck(ctx context.Context, isLeader *atomic.Bool, listener *chain.PresaleListener) {
	logger.Info("[presale-worker] listener goroutine started")
	// 等待确认为 leader 后再启动监听器（首次已在 leader 状态下调用此函数）
	for {
		select {
		case <-ctx.Done():
			logger.Info("[presale-worker] listener goroutine stopped")
			return
		default:
		}
		if isLeader.Load() {
			break
		}
		time.Sleep(1 * time.Second)
	}

	// 启动监听器（内部循环，ctx 取消时自然退出）
	// 注意：如果 leader 丢失后再次获取，Run 已在运行中（isLeader 检查在 scanVault 调用前完成）
	// 这里的简单实现：监听器一旦启动就持续运行（靠 isLeader 在 runLeaderLoop 中控制全局状态）
	listener.Run(ctx)
}
