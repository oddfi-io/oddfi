package config

import (
	"chain_crawler/pkg/consts"
	"chain_crawler/pkg/nacos"
	"chain_crawler/pkg/pubsub"
	"chain_crawler/pkg/tracelog"
	"chain_crawler/pkg/utils"
	"context"
	"fmt"
	"os"
	"sync/atomic"
)

const (
	NacosChainCrawlerDataId = "chain_crawler_config"
)

var defaultNacosChainCrawlerCfg atomic.Pointer[NacosChainCrawlerConfig]

func SetDefaultChainCrawlerConfig(cfg *NacosChainCrawlerConfig) {
	defaultNacosChainCrawlerCfg.Store(cfg)
}

func GetDefaultNacosChainCrawlerConfig() *NacosChainCrawlerConfig {
	return defaultNacosChainCrawlerCfg.Load()
}

type NacosChainCrawlerConfig struct {
	Lark     NacosLarkConfig          `json:"lark"`
	ChainRpc NacosChainRpcConfig      `json:"chain_rpc"`
	Chains   ChainCrawlerChainsConfig `json:"chains"`
}

type NacosChainRpcConfig struct {
	Endpoint string `json:"endpoint"`
	RpcKey   string `json:"rpc_key"`
}

type NacosLarkConfig struct {
	AlertLarkBotId string `json:"alert_lark_bot_id"`
	ServiceBotId   string `json:"service_bot_id"`
}

type ChainCrawlerChainsConfig struct {
	EVM  []*ChainCrawlerChainEVMConfig `json:"evm"`
	Btc  *NacosBtcChainConfig          `json:"btc"`
	Tron *NacosTronChainConfig         `json:"tron"`
	Sui  *NacosSuiChainConfig          `json:"sui"`
}

type ChainCrawlerChainEVMConfig struct {
	Chain        consts.Chain               `json:"chain"` // 链名称
	ForwardTask  NacosEvmForwardTaskConfig  `json:"forward_task"`
	RealtimeTask NacosEvmRealtimeTaskConfig `json:"realtime_task"`
	BackwardTask NacosEvmBackwardTaskConfig `json:"backward_task"`
}

type NacosEvmForwardTaskConfig struct {
	TaskName         string `json:"task_name"`
	Enable           bool   `json:"enable"`             // 是否开启这个task
	DelayBlockNumber uint64 `json:"delay_block_number"` // 区块数确认数
	BlockStep        uint64 `json:"block_step"`         // 步长
	BlockInterval    int64  `json:"block_interval"`     // 轮询区块间隔，单位毫秒
	AlertBlockDelay  uint64 `json:"alert_block_delay"`  // 告警区块延迟数
}

type NacosEvmRealtimeTaskConfig struct {
	TaskName      string `json:"task_name"`
	Enable        bool   `json:"enable"`          // 是否开启这个task
	BlockStep     uint64 `json:"block_step"`      // 步长
	BlockInterval int64  `json:"block_interval"`  // 轮询区块间隔，单位毫秒
	MaxBlockDelay uint64 `json:"max_block_delay"` // 延时队列最大延时区块数
}

type NacosEvmBackwardTaskConfig struct {
	TaskName    string `json:"task_name"`
	Enable      bool   `json:"enable"`       // 是否开启这个task
	BlockStep   uint64 `json:"block_step"`   // 步长
	BackwardRpc string `json:"backward_rpc"` // 回溯节点
}

type NacosBtcChainConfig struct {
	ForwardTask  NacosBtcForwardTaskConfig  `json:"forward_task"`
	BackwardTask NacosBtcBackwardTaskConfig `json:"backward_task"`
	PendingTask  NacosBtcPendingTaskConfig  `json:"pending_task"`
}

type NacosBtcForwardTaskConfig struct {
	Enable        bool  `json:"enable"`         // 是否开启这个task
	BlockInterval int64 `json:"block_interval"` // 轮询区块间隔，单位毫秒
}

type NacosBtcBackwardTaskConfig struct {
	Enable bool `json:"enable"` // 是否开启这个task
}

type NacosBtcPendingTaskConfig struct {
	Enable bool `json:"enable"` // 是否开启pending交易采集

	// Redis配置
	RedisAddresses []string `json:"redis_addresses"` // Redis集群地址
	RedisPassword  string   `json:"redis_password"`  // Redis密码
	RedisDB        int      `json:"redis_db"`        // 数据库索引

	// MongoDB配置（用于UTXO查询）
	MongoURI             string `json:"mongo_uri"`                // MongoDB连接URI
	MongoDatabase        string `json:"mongo_database"`           // MongoDB数据库名
	MongoCollection      string `json:"mongo_collection"`         // MongoDB集合名，默认btc_utxo
	MongoConnectTimeout  int    `json:"mongo_connect_timeout"`    // 连接超时（秒），默认10
	MongoMaxPoolSize     uint64 `json:"mongo_max_pool_size"`      // 最大连接池大小，默认50
	MongoMinPoolSize     uint64 `json:"mongo_min_pool_size"`      // 最小连接池大小，默认5
	MongoMaxConnIdleTime int    `json:"mongo_max_conn_idle_time"` // 连接最大空闲时间（秒），默认300

	// 本地缓存配置
	LocalCacheEnabled      bool `json:"local_cache_enabled"`       // 是否启用本地缓存
	LocalCacheMaxSize      int  `json:"local_cache_max_size"`      // 最大缓存条目数
	LocalCacheTTL          int  `json:"local_cache_ttl"`           // 缓存TTL（秒）
	LocalCacheSyncInterval int  `json:"local_cache_sync_interval"` // 与Redis同步间隔（秒）

	// 轮询配置
	PollerInterval       int `json:"poller_interval"`        // 轮询间隔（秒）
	PollerBatchSize      int `json:"poller_batch_size"`      // 批量查询大小
	PollerMaxConcurrency int `json:"poller_max_concurrency"` // 最大并发数

	// RPC配置
	RpcUtxoBatchSize int `json:"rpc_utxo_batch_size"` // UTXO查询RPC批次大小，默认20

	// 清理配置
	CleanerDefaultTTL                int  `json:"cleaner_default_ttl"`                 // 默认TTL（秒）
	CleanerBatchSize                 int  `json:"cleaner_batch_size"`                  // 批量处理大小
	CleanerStartupScanEnabled        bool `json:"cleaner_startup_scan_enabled"`        // 启动扫描开关
	CleanerStartupScanMaxAge         int  `json:"cleaner_startup_scan_max_age"`        // 启动扫描最大年龄（秒）
	CleanerConfirmationCheckEnabled  bool `json:"cleaner_confirmation_check_enabled"`  // 确认检查开关
	CleanerConfirmationCheckInterval int  `json:"cleaner_confirmation_check_interval"` // 确认检查间隔（秒）
	CleanerOrphanScanEnabled         bool `json:"cleaner_orphan_scan_enabled"`         // 孤儿索引扫描开关
	CleanerOrphanScanInterval        int  `json:"cleaner_orphan_scan_interval"`        // 孤儿索引扫描间隔（秒）
}

type NacosTronChainConfig struct {
	ForwardTask  NacosTronForwardTaskConfig  `json:"forward_task"`
	BackwardTask NacosTronBackwardTaskConfig `json:"backward_task"`
	RealtimeTask NacosTronRealtimeTaskConfig `json:"realtime_task"`
}

type NacosSuiChainConfig struct {
	ForwardTask  NacosSuiForwardTaskConfig  `json:"forward_task"`
	BackwardTask NacosSuiBackwardTaskConfig `json:"backward_task"`
}

type NacosTronForwardTaskConfig struct {
	Enable                   bool   `json:"enable"`                       // 是否开启这个task
	DelayBlockNumber         uint64 `json:"delay_block_number"`           // 区块数确认数
	BlockStep                uint64 `json:"block_step"`                   // 步长
	BlockInterval            int64  `json:"block_interval"`               // 轮询区块间隔，单位毫秒
	AlertBlockDelay          uint64 `json:"alert_block_delay"`            // 告警区块延迟数
	HasGetBlockReceiptMethod bool   `json:"has_get_block_receipt_method"` // 是否有获取区块收据方法
}

type NacosSuiForwardTaskConfig struct {
	Enable           bool   `json:"enable"`             // 是否开启这个task
	DelayBlockNumber uint64 `json:"delay_block_number"` // 区块数确认数
	BlockStep        uint64 `json:"block_step"`         // 步长
	BlockInterval    int64  `json:"block_interval"`     // 轮询区块间隔，单位毫秒
	AlertBlockDelay  uint64 `json:"alert_block_delay"`  // 告警区块延迟数
}

type NacosSuiBackwardTaskConfig struct {
	Enable           bool   `json:"enable"`             // 是否开启这个task
	DelayBlockNumber uint64 `json:"delay_block_number"` // 区块数确认数
	BlockStep        uint64 `json:"block_step"`         // 步长
	BlockInterval    int64  `json:"block_interval"`     // 轮询区块间隔，单位毫秒
	AlertBlockDelay  uint64 `json:"alert_block_delay"`  // 告警区块延迟数
}

type NacosTronRealtimeTaskConfig struct {
	TaskName                 string `json:"task_name"`
	Enable                   bool   `json:"enable"`                       // 是否开启这个task
	BlockStep                uint64 `json:"block_step"`                   // 步长
	BlockInterval            int64  `json:"block_interval"`               // 轮询区块间隔，单位毫秒
	MaxBlockDelay            uint64 `json:"max_block_delay"`              // 延时队列最大延时区块数
	HasGetBlockReceiptMethod bool   `json:"has_get_block_receipt_method"` // 是否有获取区块收据方法
}

type NacosTronBackwardTaskConfig struct {
	Enable                   bool   `json:"enable"`                       // 是否开启这个task
	BlockStep                uint64 `json:"block_step"`                   // 步长
	BackwardJsonRpc          string `json:"backward_jsonrpc"`             // 回溯节点
	BackwardRestRpc          string `json:"backward_restrpc"`             // 回溯节点
	HasGetBlockReceiptMethod bool   `json:"has_get_block_receipt_method"` // 是否有获取区块收据方法
}

func (cfg *NacosChainCrawlerConfig) GetEVMChainConfig(chain consts.Chain) *ChainCrawlerChainEVMConfig {
	if cfg == nil || len(cfg.Chains.EVM) == 0 {
		return &ChainCrawlerChainEVMConfig{
			Chain: chain,
		}
	}
	for _, c := range cfg.Chains.EVM {
		if c.Chain == chain {
			return c
		}
	}
	return &ChainCrawlerChainEVMConfig{
		Chain: chain,
	}
}

func (cfg *NacosChainCrawlerConfig) GetBtcChainConfig() *NacosBtcChainConfig {
	if cfg == nil || cfg.Chains.Btc == nil {
		return &NacosBtcChainConfig{}
	}
	return cfg.Chains.Btc
}

func (cfg *NacosChainCrawlerConfig) GetTronChainConfig() *NacosTronChainConfig {
	if cfg == nil || cfg.Chains.Tron == nil {
		return &NacosTronChainConfig{}
	}
	return cfg.Chains.Tron
}

// InitLocalDebugChainCrawlerConfig 初始化本地调试模式的配置（从本地文件读取）
func InitLocalDebugChainCrawlerConfig(ctx context.Context, localNacosConfigPath string) error {
	tl := tracelog.NewWithContext(ctx)

	// 如果没有指定配置文件路径，使用默认路径
	if localNacosConfigPath == "" {
		localNacosConfigPath = "./configs/nacos_local.json"
	}

	// 读取本地Nacos配置文件
	data, err := os.ReadFile(localNacosConfigPath)
	if err != nil {
		tl.Errorw("读取本地Nacos配置文件失败", "path", localNacosConfigPath, "error", err)
		return fmt.Errorf("读取本地Nacos配置文件失败: %w", err)
	}

	cfg := &NacosChainCrawlerConfig{}
	if err := utils.JsonDecode(data, cfg); err != nil {
		tl.Errorw("解析本地Nacos配置文件失败", "path", localNacosConfigPath, "error", err)
		return fmt.Errorf("解析本地Nacos配置文件失败: %w", err)
	}

	SetDefaultChainCrawlerConfig(cfg)
	tl.Infow("本地调试模式：从本地文件加载Nacos配置成功", "path", localNacosConfigPath, "config", cfg)
	return nil
}

func InitNacosChainCrawlerConfig(ctx context.Context, client *nacos.Client) error {
	tl := tracelog.NewWithContext(ctx)
	cfgStr, err := client.GetConfig(NacosChainCrawlerDataId)
	if err != nil {
		tl.Errorw("InitNacosChainCrawlerConfig GetConfig failed", "dataId", NacosChainCrawlerDataId, "err", err)
		return fmt.Errorf("getConfig error:%w", err)
	}
	cfg := &NacosChainCrawlerConfig{}
	if err = utils.JsonDecode([]byte(cfgStr), cfg); err != nil {
		tl.Errorw("InitNacosChainCrawlerConfig JsonDecode failed", "dataId", NacosChainCrawlerDataId, "cfg", cfgStr, "err", err)
		return fmt.Errorf("jsonDecode config:%s error:%w", cfgStr, err)
	}
	SetDefaultChainCrawlerConfig(cfg)
	tl.Infow("InitNacosChainCrawlerConfig success", "dataId", NacosChainCrawlerDataId, "cfg", cfgStr)

	err = client.ListenConfig(NacosChainCrawlerDataId, func(namespace, changedGroup, changedDataId, newData string) {
		tl.Infow("NacosChainCrawlerConfig OnChange", "namespace", namespace, "changedGroup", changedGroup, "changedDataId", changedDataId, "newData", newData)
		newCfg := &NacosChainCrawlerConfig{}
		if err = utils.JsonDecode([]byte(newData), newCfg); err != nil {
			tl.Errorw("NacosChainCrawlerConfig OnChange JsonDecode failed", "dataId", NacosChainCrawlerDataId, "newData", newData, "err", err)
			return
		}
		pubsub.Publish(pubsub.ChainCrawlerConfigUpdatedTopic, newCfg)

		SetDefaultChainCrawlerConfig(newCfg)
		tl.Infow("NacosChainCrawlerConfig OnChange success", "newCfg", newCfg)
	})
	return nil
}
