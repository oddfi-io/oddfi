package global

import (
	"fmt"
	"os"
	"path/filepath"
	"time"

	yaml "gopkg.in/yaml.v3"
)

type Config struct {
	Global       GlobalSettings     `yaml:"global" json:"global"`
	Solana       ChainConfig        `yaml:"solana" json:"solana"`
	Bsc          ChainConfig        `yaml:"bsc" json:"bsc"`
	Eth          ChainConfig        `yaml:"eth" json:"eth"`
	Tron         ChainConfig        `yaml:"tron" json:"tron"`
	ChainCrawler ChainCrawlerConfig `yaml:"chain_crawler" json:"chain_crawler"`
	MySQL        MySQLConfig        `yaml:"mysql" json:"mysql"`
	Redis        RedisConfig        `yaml:"redis" json:"redis"`
}

type GlobalSettings struct {
	Env           string `yaml:"env" json:"env"`
	LogLevel      string `yaml:"log_level" json:"log_level"`
	ConsumerGroup string `yaml:"consumer_group" json:"consumer_group"`
}

// LogConf 日志配置 (占位结构，保持配置兼容性)
type LogConf struct {
	ServiceName string `yaml:"service_name" json:"service_name"`
}

type NacosConfig struct {
	Ip          string `yaml:"ip" json:"ip"`
	Port        uint64 `yaml:"port" json:"port"`
	NamespaceId string `yaml:"namespace_id" json:"namespace_id"`
	Username    string `yaml:"username" json:"username"`
	Password    string `yaml:"password" json:"password"`
}

type ProcessorConfig struct {
	MaxRetries int    `yaml:"max_retries" json:"max_retries"`
	RetryDelay string `yaml:"retry_delay" json:"retry_delay"`
}

type CosConfig struct {
	Solana  CosConfigDetail `yaml:"solana" json:"solana"`
	Evm     CosConfigDetail `yaml:"evm" json:"evm"`
	Bitcoin CosConfigDetail `yaml:"bitcoin" json:"bitcoin"`
	Ltc     CosConfigDetail `yaml:"ltc" json:"ltc"`
	Sui     CosConfigDetail `yaml:"sui" json:"sui"`
	Tron    CosConfigDetail `yaml:"tron" json:"tron"`
}

type CosConfigDetail struct {
	Endpoint  string `yaml:"endpoint" json:"endpoint"`
	SecretID  string `yaml:"secret_id" json:"secret_id"`
	SecretKey string `yaml:"secret_key" json:"secret_key"`
}

type ChainConfig struct {
	Kafka        KafkaConfig `yaml:"kafka" json:"kafka"`
	IsDebugTrace bool        `yaml:"is_debug_trace" json:"is_debug_trace"`
	OddFi        OddFiConfig `yaml:"oddfi" json:"oddfi"`
}

// OddFiConfig OddFi 合约监听配置（链上行为/管理员审计索引）。
// chain_id 与 4 个合约代理地址均走配置，主网上线只改 YAML，代码不动。
type OddFiConfig struct {
	ChainID       int64  `yaml:"chain_id" json:"chain_id"`             // BSC 测试网 97 / 主网 56
	BettingPool   string `yaml:"betting_pool" json:"betting_pool"`     // BettingPool 代理地址
	StakingPool   string `yaml:"staking_pool" json:"staking_pool"`     // StakingPool 代理地址
	LiquidityPool string `yaml:"liquidity_pool" json:"liquidity_pool"` // LiquidityPool 代理地址
	ODDToken      string `yaml:"odd_token" json:"odd_token"`           // ODDToken 代理地址
	// BetTaxBps 下注税率(基点)。BET_PLACED 含税总额优先取同 tx 的链上 Transfer 金额；
	// 取不到时回退用本配置按 acceptedAmount*(1+bps/1e4) 估算。链上默认 100(=1%)，改了 setTaxConfig 需同步此值。
	BetTaxBps uint16 `yaml:"bet_tax_bps" json:"bet_tax_bps"`
}

type CheckpointConfig struct {
	Enable        bool          `yaml:"enable" json:"enable"`                 // 是否启动checkpoint功能
	Checkpoint    int64         `yaml:"checkpoint" json:"checkpoint"`         // 初始checkpoint
	CheckInterval time.Duration `yaml:"check_interval" json:"check_interval"` // checkpoint定时器检查间隔
	CheckTimeout  time.Duration `yaml:"check_timeout" json:"check_timeout"`   // 超过这个时间还没有消费到的区块，重发缺块请求
	AlertInterval time.Duration `yaml:"alert_interval" json:"alert_interval"` // 如果超过这个时间区块还没有消费到，发送告警
}

type ChainCrawlerConfig struct {
	RpcUrl string `yaml:"rpc_url" json:"rpc_url"`
}

type MySQLConfig struct {
	DSN string `yaml:"dsn" json:"dsn"`
}

type RedisConfig struct {
	Addr     string `yaml:"addr" json:"addr"`
	Password string `yaml:"password" json:"password"`
	DB       int    `yaml:"db" json:"db"`
	PoolSize int    `yaml:"pool_size" json:"pool_size"`
}

type InitialOffset string

const (
	InitialOffsetOldest InitialOffset = "oldest"
	InitialOffsetNewest InitialOffset = "newest"
)

type KafkaConfig struct {
	Brokers       string        `yaml:"brokers" json:"brokers"`
	Topic         string        `yaml:"topic" json:"topic"`
	BackwardTopic string        `yaml:"backward_topic" json:"backward_topic"`
	InitialOffset InitialOffset `yaml:"initial_offset" json:"initial_offset"`
}

// LoadConfig loads configuration from a YAML file
func LoadConfig(configPath string) (*Config, error) {
	// Get absolute path
	absPath, err := filepath.Abs(configPath)
	if err != nil {
		return nil, fmt.Errorf("failed to get absolute path: %w", err)
	}

	// Check if file exists
	if _, err := os.Stat(absPath); os.IsNotExist(err) {
		return nil, fmt.Errorf("config file does not exist: %s", absPath)
	}

	// Read file
	data, err := os.ReadFile(absPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}

	// Create config with defaults
	config := &Config{}
	config.SetDefaults()

	// Parse YAML
	if err := yaml.Unmarshal(data, config); err != nil {
		return nil, fmt.Errorf("failed to parse YAML: %w", err)
	}

	return config, nil
}

// SetDefaults sets default values for configuration
func (c *Config) SetDefaults() {
	// Set global defaults
	if c.Global.LogLevel == "" {
		c.Global.LogLevel = "info"
	}
}

// LoadConfigFromPaths tries to load configuration from multiple paths
func LoadConfigFromPaths(paths []string) (*Config, error) {
	var lastErr error

	for _, path := range paths {
		config, err := LoadConfig(path)
		if err == nil {
			return config, nil
		}
		lastErr = err
	}

	return nil, fmt.Errorf("failed to load config from any path, last error: %w", lastErr)
}
