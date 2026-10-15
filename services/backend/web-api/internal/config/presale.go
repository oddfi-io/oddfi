package config

import (
	"os"
	"strconv"
	"strings"
)

// PresaleConfig 集中管理所有预售相关运行时参数
// 独立文件（而非内嵌 AppConfig），便于 presale-worker 单独读取而不污染主配置结构
// 加载顺序：优先读 config.yaml presale 节，缺失字段从环境变量 fallback
type PresaleConfig struct {
	// VaultPool 金库地址池（数组），支持多地址监听
	// 新旧金库并存：老金库退役后仍需监听历史入账，故使用数组而非单地址
	// env: PRESALE_VAULT_POOL = "0xABC...,0xDEF..."（逗号分隔）
	VaultPool []string `yaml:"vault_pool"`

	// UsdtAddress BSC 链上 USDT (BEP20) 合约地址
	// 固定值（mainnet）：0x55d398326f99059fF775485246999027B3197955
	UsdtAddress string `yaml:"usdt_address"`

	// BscRpcUrl 支持 Alchemy / QuickNode / 自建节点，推荐 HTTP（非 WebSocket）做 eth_getLogs 轮询
	BscRpcUrl string `yaml:"bsc_rpc_url"`

	// ConfirmBlocks 等待区块确认数（默认 3），防止链上重组（BSC 出块 ~3s，3 块 ≈ 9s）
	ConfirmBlocks uint64 `yaml:"confirm_blocks"`

	// PollIntervalSec eth_getLogs 轮询间隔秒数（默认 6s ≈ BSC 2 个出块）
	PollIntervalSec int `yaml:"poll_interval_sec"`

	// BoundaryToleranceMin 轮次边界容差分钟数（默认 5），与 presale_config 表同步
	BoundaryToleranceMin int `yaml:"boundary_tolerance_min"`

	// LarkWebhookUrl anomaly 告警推送地址，空字符串表示不推送
	LarkWebhookUrl string `yaml:"lark_webhook_url"`

	// RedisLeaderKey Worker leader 抢锁用的 Redis key
	RedisLeaderKey string `yaml:"redis_leader_key"`

	// RedisLeaderTTLSec leader 锁 TTL（默认 30s），Worker 每 ~10s 续约
	RedisLeaderTTLSec int `yaml:"redis_leader_ttl_sec"`
}

// defaultPresaleConfig 返回带默认值的 PresaleConfig
// 各字段可通过 config.yaml presale 节覆盖，也可通过环境变量覆盖（环境变量优先）
func defaultPresaleConfig() PresaleConfig {
	cfg := PresaleConfig{
		UsdtAddress:          "0x55d398326f99059fF775485246999027B3197955",
		ConfirmBlocks:        3,
		PollIntervalSec:      6,
		BoundaryToleranceMin: 5,
		RedisLeaderKey:       "presale:worker:leader",
		RedisLeaderTTLSec:    30,
	}

	// 从环境变量 fallback（优先级高于 yaml）
	if v := os.Getenv("PRESALE_VAULT_POOL"); v != "" {
		parts := strings.Split(v, ",")
		for i := range parts {
			parts[i] = strings.TrimSpace(parts[i])
		}
		cfg.VaultPool = parts
	}
	if v := os.Getenv("PRESALE_USDT_ADDRESS"); v != "" {
		cfg.UsdtAddress = v
	}
	if v := os.Getenv("PRESALE_BSC_RPC_URL"); v != "" {
		cfg.BscRpcUrl = v
	}
	if v := os.Getenv("PRESALE_CONFIRM_BLOCKS"); v != "" {
		if n, err := strconv.ParseUint(v, 10, 64); err == nil {
			cfg.ConfirmBlocks = n
		}
	}
	if v := os.Getenv("PRESALE_POLL_INTERVAL_SEC"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			cfg.PollIntervalSec = n
		}
	}
	if v := os.Getenv("PRESALE_BOUNDARY_TOLERANCE_MIN"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			cfg.BoundaryToleranceMin = n
		}
	}
	if v := os.Getenv("PRESALE_LARK_WEBHOOK_URL"); v != "" {
		cfg.LarkWebhookUrl = v
	}
	if v := os.Getenv("PRESALE_REDIS_LEADER_KEY"); v != "" {
		cfg.RedisLeaderKey = v
	}
	if v := os.Getenv("PRESALE_REDIS_LEADER_TTL_SEC"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			cfg.RedisLeaderTTLSec = n
		}
	}

	return cfg
}
