package worker

import (
	"chain_crawler/internal/config"
	"chain_crawler/internal/repository"
	"chain_crawler/internal/worker/chain/evm"
	"chain_crawler/internal/worker/chain/tron"
	"chain_crawler/internal/worker/interfaces"
	"chain_crawler/pkg/consts"
	"chain_crawler/pkg/tracelog"
	"chain_crawler/pkg/web3chain"
	"context"
	"encoding/json"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/samber/lo"
)

type Worker struct {
	cfg             config.Config
	repository      repository.Repository
	tasks           []interfaces.ScheduleTask
	web3ChainClient web3chain.Client
	chains          []web3chain.Chain
	hotFlag         int
	ctx             context.Context
	cancel          context.CancelFunc
	wg              sync.WaitGroup
}

func NewWorker(ctx context.Context, hotFlag int, cfg config.Config) *Worker {
	workerCtx, cancel := context.WithCancel(ctx)
	impl := &Worker{
		cfg:        cfg,
		hotFlag:    hotFlag,
		repository: repository.NewRepository(ctx, cfg),
		ctx:        workerCtx,
		cancel:     cancel,
	}
	impl.init(ctx)
	return impl
}

func (w *Worker) init(ctx context.Context) {
	initSpanCtx, initSpan := tracelog.StartSpan(ctx, "blockchain", "init")
	defer initSpan.End()
	tl := tracelog.NewWithContext(initSpanCtx)
	// rpcdelegator.RegisterProm(monitor.Registry)
	// 获取链数据
	if err := w.getChainInfos(ctx); err != nil {
		tl.Errorw("Worker getChainInfos failed", "error", err)
		panic(err)
	}
}

func (w *Worker) getChainInfos(ctx context.Context) error {
	getChainInfosSpanCtx, getChainInfosSpan := tracelog.StartSpan(ctx, "blockchain", "getChainInfos")
	defer getChainInfosSpan.End()
	tl := tracelog.NewWithContext(getChainInfosSpanCtx)

	// // 检查是否启用本地调试模式
	// if w.cfg.LocalDebug.Enabled {
	// 	tl.Infow("本地调试模式已启用，从本地配置文件加载链信息", "config_path", w.cfg.LocalDebug.LocalChainsConfig)
	// 	return w.loadLocalChainInfos(ctx)
	// }

	// // 正常模式：从web3chain服务获取链信息
	// nacosCfg := config.GetDefaultNacosChainCrawlerConfig().ChainRpc
	// if nacosCfg.Endpoint == "" {
	// 	return errors.New("empty nacosCfg.Endpoint")
	// }
	// w.web3ChainClient = web3chain.NewClient(nacosCfg.Endpoint, nacosCfg.RpcKey, httpclient.NewHttpClient())

	// chainData, err := w.web3ChainClient.GetChains(ctx, web3chain.QueryChainParams{})
	// if err != nil {
	// 	return err
	// }
	// for _, chain := range chainData.Chains {
	// 	chain = w.updateChainInfo(ctx, chain)
	// 	if consts.IsTargetChain(w.hotFlag, chain.Chain) {
	// 		w.chains = append(w.chains, chain)
	// 	}
	// }
	// chains := lo.Map(w.chains, func(c web3chain.Chain, _ int) string {
	// 	return string(c.Chain)
	// })

	tl.Infow("从本地配置文件加载链信息", "config_path", w.cfg.LocalDebug.LocalChainsConfig)
	return w.loadLocalChainInfos(ctx)

}

// loadLocalChainInfos 从本地配置文件加载链信息（本地调试模式）
func (w *Worker) loadLocalChainInfos(ctx context.Context) error {
	loadLocalChainInfosSpanCtx, loadLocalChainInfosSpan := tracelog.StartSpan(ctx, "blockchain", "loadLocalChainInfos")
	defer loadLocalChainInfosSpan.End()
	tl := tracelog.NewWithContext(loadLocalChainInfosSpanCtx)

	configPath := w.cfg.LocalDebug.LocalChainsConfig
	if configPath == "" {
		configPath = "./configs/local_chains.json"
	}

	data, err := os.ReadFile(configPath)
	if err != nil {
		tl.Errorw("读取本地链配置文件失败", "path", configPath, "error", err)
		return err
	}

	var localChainData struct {
		Chains []web3chain.Chain `json:"chains"`
	}
	if err := json.Unmarshal(data, &localChainData); err != nil {
		tl.Errorw("解析本地链配置文件失败", "path", configPath, "error", err)
		return err
	}

	for _, chain := range localChainData.Chains {
		chain = w.updateChainInfo(ctx, chain)
		if consts.IsTargetChain(w.hotFlag, chain.Chain) {
			w.chains = append(w.chains, chain)
		}
	}

	chains := lo.Map(w.chains, func(c web3chain.Chain, _ int) string {
		return string(c.Chain)
	})

	tl.Infow("从本地配置加载链信息成功", "chains", chains, "total", len(w.chains))
	return nil
}

func (w *Worker) updateChainInfo(ctx context.Context, chain web3chain.Chain) web3chain.Chain {
	updateChainInfoSpanCtx, updateChainInfoSpan := tracelog.StartSpan(ctx, "blockchain", "updateChainInfo")
	defer updateChainInfoSpan.End()
	tl := tracelog.NewWithContext(updateChainInfoSpanCtx)
	tl.Infow("updateChainInfo", "chain", chain.Chain)
	if chain.Chain != consts.CHAIN_LINEA {
		return chain
	}
	// 修改linea的rpc url，添加routeKey参数
	newChain := chain
	for i, endpoint := range newChain.Endpoints {
		if strings.Contains(endpoint, "routeKey=allblockLinea") {
			continue
		}
		if strings.ContainsAny(endpoint, "?") {
			newChain.Endpoints[i] = endpoint + "&routeKey=allblockLinea"
		} else {
			newChain.Endpoints[i] = endpoint + "?routeKey=allblockLinea"
		}
	}
	return newChain
}

func (w *Worker) GetChainInfo(targetChain consts.Chain) *web3chain.Chain {
	for _, chain := range w.chains {
		if chain.Chain == targetChain {
			newChain := chain // copy 一下，避免被修改了
			return &newChain
		}
	}
	return nil
}

// Run 运行工作者
func (w *Worker) Run() {
	runSpanCtx, runSpan := tracelog.StartSpan(w.ctx, "blockchain", "Run")
	defer runSpan.End()
	tl := tracelog.NewWithContext(runSpanCtx)
	nacosCfg := config.GetDefaultNacosChainCrawlerConfig()
	tl.Infow("Worker starting", "hotFlag", w.hotFlag)

	// 启动EVM链任务
	w.startEVMChainTasks(runSpanCtx, w.cfg, nacosCfg)
	// 启动Tron链任务
	w.startTronChainTasks(runSpanCtx, w.cfg, nacosCfg)

	tl.Infow("Worker started successful")
}

func (w *Worker) startEVMChainTasks(ctx context.Context, cfg config.Config, nacosCfg *config.NacosChainCrawlerConfig) {
	startEVMChainTasksSpanCtx, startEVMChainTasksSpan := tracelog.StartSpan(ctx, "blockchain", "startEVMChainTasks")
	defer startEVMChainTasksSpan.End()
	tl := tracelog.NewWithContext(startEVMChainTasksSpanCtx)
	tl.Infow("startEVMChainTasks", "nacosCfg", nacosCfg)

	for _, evmChainCfg := range nacosCfg.Chains.EVM {
		chainInfo := w.GetChainInfo(evmChainCfg.Chain)
		if chainInfo == nil {
			tl.Errorw("startEVMChainTask failed", "chain", evmChainCfg.Chain, "error", "chain info not found")
			continue
		}

		forwardTask, err := evm.NewForwardTask(startEVMChainTasksSpanCtx, cfg, evmChainCfg, chainInfo, w.repository)
		if err != nil {
			tl.Errorw("startEVMChainTask NewForwardTask failed", "chain", evmChainCfg.Chain, "error", err)
		}
		w.addScheduleTask(forwardTask)

		// realtimeTask, err := evm.NewRealTimeTask(startEVMChainTasksSpanCtx, cfg, evmChainCfg, chainInfo, w.repository)
		// if err != nil {
		// 	tl.Errorw("startEVMChainTask NewRealTimeTask failed", "chain", evmChainCfg.Chain, "error", err)
		// }
		// w.addScheduleTask(realtimeTask)

		// backwardTask, err := evm.NewBackwardTask(startEVMChainTasksSpanCtx, cfg, evmChainCfg, chainInfo, w.repository)
		// if err != nil {
		// 	tl.Errorw("startEVMChainTask NewBackwardTask failed", "chain", evmChainCfg.Chain, "error", err)
		// }
		// w.addScheduleTask(backwardTask)
	}
}

func (w *Worker) startTronChainTasks(ctx context.Context, cfg config.Config, nacosCfg *config.NacosChainCrawlerConfig) {
	startTronChainTasksSpanCtx, startTronChainTasksSpan := tracelog.StartSpan(ctx, "blockchain", "startTronChainTasks")
	defer startTronChainTasksSpan.End()
	tl := tracelog.NewWithContext(startTronChainTasksSpanCtx)
	tl.Infow("startTronChainTasks", "nacosCfg", nacosCfg)
	if nacosCfg.Chains.Tron == nil {
		return
	}
	chainCfg := nacosCfg.Chains.Tron
	chainInfo := w.GetChainInfo(consts.CHAIN_TRON)
	if chainInfo == nil {
		tl.Errorw("startTronChainTasks failed", "error", "chain info not found")
		return
	}

	// 向前获取注册
	forwardTask, err := tron.NewForwardTask(startTronChainTasksSpanCtx, cfg, chainCfg, chainInfo, w.repository)
	if err != nil {
		tl.Errorw("startTronChainTasks NewForwardTask failed", "error", err)
	}
	w.addScheduleTask(forwardTask)

	// tl.Infow("startTronChainTasks", "chain", chainInfo.Chain, "rpc endpoints", chainInfo.Endpoints)
	// realtimeTask, err := tron.NewRealTimeTask(startTronChainTasksSpanCtx, cfg, chainCfg, chainInfo, w.repository)
	// if err != nil {
	// 	tl.Errorw("startTronChainTasks NewRealTimeTask failed", "error", err)
	// }
	// w.addScheduleTask(realtimeTask)

	// backwardTask, err := tron.NewBackwardTask(startTronChainTasksSpanCtx, cfg, chainCfg, chainInfo, w.repository)
	// if err != nil {
	// 	tl.Errorw("startTronChainTasks NewBackwardTask failed", "error", err)
	// }
	// w.addScheduleTask(backwardTask)
}

func (w *Worker) addScheduleTask(task interfaces.ScheduleTask) {
	if task == nil {
		return
	}
	taskName := task.GetTaskName()
	// 为每个任务创建带 trace 的 context
	addScheduleTaskSpanCtx, addScheduleTaskSpan := tracelog.StartSpan(w.ctx, "worker", "addScheduleTask")
	defer addScheduleTaskSpan.End()
	tl := tracelog.NewWithContext(addScheduleTaskSpanCtx)
	tl.Infow("addScheduleTask", "taskName", taskName)

	w.tasks = append(w.tasks, task)
	w.wg.Add(1)
	go func() {
		defer w.wg.Done()
		// 为任务执行创建新的 span，追踪任务运行时间
		// taskRunSpanCtx, taskRunSpan := tracelog.StartSpan(addScheduleTaskSpanCtx, "worker", "taskRun")
		// defer taskRunSpan.End()
		// taskRunTl := tracelog.NewWithContext(taskRunSpanCtx)
		// defer func() {
		// 	if r := recover(); r != nil {
		// 		taskRunTl.Errorw("Worker task panic recovered", "taskName", taskName, "error", r, "stack", string(debug.Stack()))
		// 	}
		// }()
		task.Run()
	}()
	tl.Infow("Worker task started success", "taskName", taskName)
}

// Shutdown 关闭工作者
func (w *Worker) Shutdown() {
	shutdownSpanCtx, shutdownSpan := tracelog.StartSpan(w.ctx, "blockchain", "Shutdown")
	defer shutdownSpan.End()
	tl := tracelog.NewWithContext(shutdownSpanCtx)
	tl.Infow("shutting down worker", "taskCount", len(w.tasks))

	// 取消上下文
	w.cancel()

	// 关闭所有任务
	for _, task := range w.tasks {
		task.Shutdown()
	}

	// 等待所有goroutine完成
	done := make(chan struct{})
	go func() {
		w.wg.Wait()
		close(done)
	}()

	// 设置超时时间
	select {
	case <-done:
		tl.Errorw("worker shutdown completed successfully", "taskCount", len(w.tasks))
	case <-time.After(30 * time.Second):
		tl.Errorw("worker shutdown timeout after 30s, some tasks may not have completed gracefully", "taskCount", len(w.tasks))
	}
}
