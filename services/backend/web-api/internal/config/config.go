package config

import (
	"fmt"
	"os"
	"sync"
	"time"

	"gopkg.in/yaml.v3"
)

var (
	globalConfig *Config
	once         sync.Once
)

type Config struct {
	Server    ServerConfig    `yaml:"server"`
	Database  DatabaseConfig  `yaml:"database"`
	Redis     RedisConfig     `yaml:"redis"`
	JWT       JWTConfig       `yaml:"jwt"`
	RateLimit RateLimitConfig `yaml:"rate_limit"`
	// Presale 预售模块配置，独立节点便于 presale-worker 单独读取
	Presale PresaleConfig `yaml:"presale"`
	// AdminAPI 内部 admin endpoint 配置（DD-003 v3.1）
	// 配齐 InternalPort + ServiceTokens + JWTSecret 才会启动 :8081 loopback listener
	AdminAPI AdminAPIConfig `yaml:"admin_api"`
}

type ServerConfig struct {
	Host string `yaml:"host"`
	Port int    `yaml:"port"`
	Mode string `yaml:"mode"`
	Env  string `yaml:"env"`
}

// AdminAPIConfig 控制 /internal/admin/* 路由组（DD-003 v3.1 §3.1 §4.2）。
//
// 部署模型：
//   - 内部 listener 绑 127.0.0.1:InternalPort（默认 8081）
//   - Nginx admin-api.oddfi.io vhost allow admin EC2 IP + proxy_pass 到 :8081
//   - 公网 :8080 listener 完全不挂 internal handler，物理隔离
//
// 启用门控：InternalPort > 0 && len(ServiceTokens) > 0 && len(JWTSecret) ≥ 32。
// 任一不满足 → 不启动内部 listener（dev 友好），并打 WARN 日志。
type AdminAPIConfig struct {
	// InternalPort 内部 listener 端口，仅绑 127.0.0.1。默认 8081。
	InternalPort int `yaml:"internal_port"`
	// ServiceTokens HMAC 鉴权 secret 列表，支持多 secret 重叠期轮换。
	// 通过 env ADMIN_API_SERVICE_TOKENS=token1,token2 注入。
	ServiceTokens []string `yaml:"service_tokens"`
	// JWTSecret 与 admin-backend 共享的 HS256 secret，必须 ≥ 32 字节。
	// 通过 env ADMIN_API_JWT_SECRET 注入。
	JWTSecret string `yaml:"jwt_secret"`
	// HMACWindowMs HMAC timestamp 容忍窗口，毫秒。默认 60_000（60s）。
	HMACWindowMs int64 `yaml:"hmac_window_ms"`
	// IdempotencyTTLDays 幂等表 TTL，天。默认 90。
	IdempotencyTTLDays int `yaml:"idempotency_ttl_days"`
}

// Enabled 返回 admin internal endpoint 是否启用。
// dev/test 环境通常不配 → 自动禁用，main.go 不启动内部 listener
func (a *AdminAPIConfig) Enabled() bool {
	if a.InternalPort <= 0 {
		return false
	}
	if len(a.ServiceTokens) == 0 {
		return false
	}
	if len(a.JWTSecret) < 32 {
		return false
	}
	return true
}

type DatabaseConfig struct {
	Host            string `yaml:"host"`
	Port            int    `yaml:"port"`
	Username        string `yaml:"username"`
	Password        string `yaml:"password"`
	DBName          string `yaml:"dbname"`
	MaxOpenConns    int    `yaml:"max_open_conns"`
	MaxIdleConns    int    `yaml:"max_idle_conns"`
	ConnMaxLifetime int    `yaml:"conn_max_lifetime"`
}

type RedisConfig struct {
	Host     string `yaml:"host"`
	Port     int    `yaml:"port"`
	Password string `yaml:"password"`
	DB       int    `yaml:"db"`
	PoolSize int    `yaml:"pool_size"`
}

type JWTConfig struct {
	Secret        string `yaml:"secret"`
	AccessExpiry  int    `yaml:"access_expiry"`
	RefreshExpiry int    `yaml:"refresh_expiry"`
}

type RateLimitConfig struct {
	Enabled           bool `yaml:"enabled"`
	RequestsPerSecond int  `yaml:"requests_per_second"`
	BurstSize         int  `yaml:"burst_size"`
}

func (s *ServerConfig) Addr() string {
	return fmt.Sprintf("%s:%d", s.Host, s.Port)
}

func (d *DatabaseConfig) DSN() string {
	return fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		d.Username, d.Password, d.Host, d.Port, d.DBName)
}

func (r *RedisConfig) Addr() string {
	return fmt.Sprintf("%s:%d", r.Host, r.Port)
}

func (j *JWTConfig) AccessDuration() time.Duration {
	return time.Duration(j.AccessExpiry) * time.Second
}

func (j *JWTConfig) RefreshDuration() time.Duration {
	return time.Duration(j.RefreshExpiry) * time.Second
}

func LoadDefault() *Config {
	return Init("./config.yaml")
}

// Init 加载配置文件并初始化全局配置实例
func Init(path string) *Config {
	once.Do(func() {
		data, err := os.ReadFile(path)
		if err != nil {
			panic(fmt.Sprintf("failed to read config file: %v", err))
		}

		var cfg Config
		if err := yaml.Unmarshal(data, &cfg); err != nil {
			panic(fmt.Sprintf("failed to parse config file: %v", err))
		}

		// 合并预售模块环境变量（env 优先级高于 yaml，yaml 中未配的字段从 env fallback）
		envPresale := defaultPresaleConfig()
		if len(cfg.Presale.VaultPool) == 0 {
			cfg.Presale.VaultPool = envPresale.VaultPool
		}
		if cfg.Presale.UsdtAddress == "" {
			cfg.Presale.UsdtAddress = envPresale.UsdtAddress
		}
		if cfg.Presale.BscRpcUrl == "" {
			cfg.Presale.BscRpcUrl = envPresale.BscRpcUrl
		}
		if cfg.Presale.ConfirmBlocks == 0 {
			cfg.Presale.ConfirmBlocks = envPresale.ConfirmBlocks
		}
		if cfg.Presale.PollIntervalSec == 0 {
			cfg.Presale.PollIntervalSec = envPresale.PollIntervalSec
		}
		if cfg.Presale.BoundaryToleranceMin == 0 {
			cfg.Presale.BoundaryToleranceMin = envPresale.BoundaryToleranceMin
		}
		if cfg.Presale.LarkWebhookUrl == "" {
			cfg.Presale.LarkWebhookUrl = envPresale.LarkWebhookUrl
		}
		if cfg.Presale.RedisLeaderKey == "" {
			cfg.Presale.RedisLeaderKey = envPresale.RedisLeaderKey
		}
		if cfg.Presale.RedisLeaderTTLSec == 0 {
			cfg.Presale.RedisLeaderTTLSec = envPresale.RedisLeaderTTLSec
		}

		globalConfig = &cfg
	})

	return globalConfig
}

func Get() *Config {
	if globalConfig == nil {
		panic("Config not initialized! Call config.Init() in main first.")
	}
	return globalConfig
}

// InitForTest sets a minimal in-memory config for unit tests that trigger config.Get()
// (e.g. model.TableName() methods that route to dev/prod table names).
// Must be called in TestMain or init() before any GORM model parsing.
func InitForTest() {
	globalConfig = &Config{
		Server: ServerConfig{Env: "test"},
	}
}

// // InitDefault 加载默认配置
// func InitDefault() *Config {
// 	return Init("./config.yaml")
// // }
// func Load(path string) *Config {
// 	data, err := os.ReadFile(path)
// 	if err != nil {
// 		panic(fmt.Sprintf("failed to read config file: %v", err))
// 	}

// 	var cfg Config
// 	if err := yaml.Unmarshal(data, &cfg); err != nil {
// 		panic(fmt.Sprintf("failed to parse config file: %v", err))
// 	}

// 	return &cfg
// }

// Get 获取全局配置实例
