// Package config 负责加载 YAML 配置并允许敏感字段被环境变量覆盖。
//
// 设计取舍：
//   - 主路径走 YAML（人类可读、便于本地多份切换）
//   - 敏感字段（DB DSN / Redis 密码 / JWT secret / Lark App secret）允许 env 覆盖，
//     生产环境 systemd unit 注入这些 env，避免明文写盘
//   - 不引入 viper（依赖太大、对 YAML 之外的格式收益低），手写薄封装即可
package config

import (
	"fmt"
	"os"
	"time"

	"gopkg.in/yaml.v3"
)

// Config 是整个服务的配置根结构。
type Config struct {
	Server    ServerConfig    `yaml:"server"`
	Logger    LoggerConfig    `yaml:"logger"`
	MySQL     MySQLConfig     `yaml:"mysql"`
	Redis     RedisConfig     `yaml:"redis"`
	JWT       JWTConfig       `yaml:"jwt"`
	Lark      LarkConfig      `yaml:"lark"`
	Frontend  FrontendConfig  `yaml:"frontend"`
	CORS      CORSConfig      `yaml:"cors"`
	RateLimit RateLimitConfig `yaml:"rate_limit"`
	// Webapi 是 admin-backend 调用 web-api internal endpoint 的配置（DD-003 v3.1 B6）。
	Webapi WebapiConfig `yaml:"webapi"`
}

// WebapiConfig 配置 admin-backend → web-api internal endpoint 的 HTTP client。
type WebapiConfig struct {
	// InternalURL 是 web-api 内部监听地址，例如 http://127.0.0.1:8081。
	// 生产环境通过 WEBAPI_INTERNAL_URL 注入，避免明文写盘。
	InternalURL string `yaml:"internal_url"`
	// ServiceToken 是 HMAC-SHA256 签名 secret（与 web-api 共享）。
	// 生产环境通过 WEBAPI_SERVICE_TOKEN 注入。
	ServiceToken string `yaml:"service_token"`
	// TimeoutSec 是单次请求超时（秒），默认 5。
	TimeoutSec int `yaml:"timeout_sec"`
	// MaxRetries 是最大重试次数，默认 3（仅 5xx + 网络错误）。
	MaxRetries int `yaml:"max_retries"`

	// EventsInternalURL / EventsServiceToken 是 events 模块（赛事风险信号灯 + approval/counts）
	// 的专用上游覆盖（DD002 联调期机制）。
	//
	// 为什么需要：DD002 信号灯先发布在 C 端 dev（<SERVER_IP>:8082），而 presale 模块的
	// 主上游是 C 端生产（admin-api.oddfi.io）——同一进程内两个模块需要指向不同上游。
	//
	// 回落语义：两个字段任一为空 → events 跟随主上游（InternalURL/ServiceToken）。
	// 切换到生产 = C 端把 DD002 发版生产后，删掉 WEBAPI_EVENTS_* 两行 env + systemctl restart 即合流，
	// 无需改代码。生产通过 WEBAPI_EVENTS_INTERNAL_URL / WEBAPI_EVENTS_SERVICE_TOKEN 注入。
	EventsInternalURL  string `yaml:"events_internal_url"`
	EventsServiceToken string `yaml:"events_service_token"`
}

// EventsUpstream 返回 events 模块实际生效的上游地址与 token。
// 覆盖未配置（任一为空）时回落主上游——这是"快速切换"的关键：删 env 即合流。
func (w WebapiConfig) EventsUpstream() (url, token string) {
	if w.EventsInternalURL != "" && w.EventsServiceToken != "" {
		return w.EventsInternalURL, w.EventsServiceToken
	}
	return w.InternalURL, w.ServiceToken
}

type ServerConfig struct {
	// Host 控制监听地址。空 → 监听 0.0.0.0（所有接口，仅用于 dev）。
	// 生产应设 127.0.0.1，靠 Nginx 反代访问，应用层兜底防止 ufw 失效
	Host            string        `yaml:"host"`
	Port            string        `yaml:"port"`
	ReadTimeout     time.Duration `yaml:"read_timeout"`
	WriteTimeout    time.Duration `yaml:"write_timeout"`
	ShutdownTimeout time.Duration `yaml:"shutdown_timeout"`
	Env             string        `yaml:"env"` // dev | prod
}

type LoggerConfig struct {
	Level  string `yaml:"level"`
	Pretty bool   `yaml:"pretty"`
}

type MySQLConfig struct {
	DSN             string        `yaml:"dsn"`
	MaxOpen         int           `yaml:"max_open"`
	MaxIdle         int           `yaml:"max_idle"`
	ConnMaxLifetime time.Duration `yaml:"conn_max_lifetime"`
}

type RedisConfig struct {
	Addr     string `yaml:"addr"`
	Password string `yaml:"password"`
	DB       int    `yaml:"db"`
}

type JWTConfig struct {
	Secret string        `yaml:"secret"`
	TTL    time.Duration `yaml:"ttl"`
	Issuer string        `yaml:"issuer"`
}

type LarkConfig struct {
	AppID        string `yaml:"app_id"`
	AppSecret    string `yaml:"app_secret"`
	AuthorizeURL string `yaml:"authorize_url"`
	TokenURL     string `yaml:"token_url"`
	UserInfoURL  string `yaml:"user_info_url"`
	Scope        string `yaml:"scope"`
	RedirectURI  string `yaml:"redirect_uri"`
}

type FrontendConfig struct {
	CallbackURL string `yaml:"callback_url"`
}

type CORSConfig struct {
	AllowedOrigins   []string `yaml:"allowed_origins"`
	AllowCredentials bool     `yaml:"allow_credentials"`
}

type RateLimitConfig struct {
	PerIPPerMin int `yaml:"per_ip_per_min"`
}

// Load 读取指定路径的 YAML，并应用环境变量覆盖。
func Load(path string) (*Config, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read %s: %w", path, err)
	}
	var cfg Config
	if err := yaml.Unmarshal(raw, &cfg); err != nil {
		return nil, fmt.Errorf("parse yaml: %w", err)
	}
	applyEnvOverride(&cfg)
	if err := cfg.validate(); err != nil {
		return nil, err
	}
	return &cfg, nil
}

// applyEnvOverride 用环境变量覆盖敏感字段。
// 生产环境通过 systemd unit 注入这些 env，避免在 yaml 里写明文凭据。
func applyEnvOverride(cfg *Config) {
	if v := os.Getenv("ADMIN_DB_DSN"); v != "" {
		cfg.MySQL.DSN = v
	}
	if v := os.Getenv("ADMIN_REDIS_ADDR"); v != "" {
		cfg.Redis.Addr = v
	}
	if v := os.Getenv("ADMIN_REDIS_PASSWORD"); v != "" {
		cfg.Redis.Password = v
	}
	if v := os.Getenv("ADMIN_JWT_SECRET"); v != "" {
		cfg.JWT.Secret = v
	}
	if v := os.Getenv("ADMIN_LARK_APP_ID"); v != "" {
		cfg.Lark.AppID = v
	}
	if v := os.Getenv("ADMIN_LARK_APP_SECRET"); v != "" {
		cfg.Lark.AppSecret = v
	}
	if v := os.Getenv("ADMIN_FRONTEND_URL"); v != "" {
		cfg.Frontend.CallbackURL = v
	}
	// web-api internal endpoint 凭据（DD-003 v3.1 B6）
	if v := os.Getenv("WEBAPI_INTERNAL_URL"); v != "" {
		cfg.Webapi.InternalURL = v
	}
	if v := os.Getenv("WEBAPI_SERVICE_TOKEN"); v != "" {
		cfg.Webapi.ServiceToken = v
	}
	// events 模块专用上游覆盖（DD002 联调期：events 指 C 端 dev，presale 仍指生产）。
	// 两个变量删除后 events 自动回落主上游——切生产无需改代码。
	if v := os.Getenv("WEBAPI_EVENTS_INTERNAL_URL"); v != "" {
		cfg.Webapi.EventsInternalURL = v
	}
	if v := os.Getenv("WEBAPI_EVENTS_SERVICE_TOKEN"); v != "" {
		cfg.Webapi.EventsServiceToken = v
	}
}

// validate 在启动期发现明显配置错误，比早上线后 panic 强。
func (c *Config) validate() error {
	if c.Server.Port == "" {
		return fmt.Errorf("server.port is required")
	}
	if c.MySQL.DSN == "" {
		return fmt.Errorf("mysql.dsn is required (or set ADMIN_DB_DSN)")
	}
	if c.JWT.Secret == "" || c.JWT.Secret == "CHANGE_ME_TO_RANDOM_32_BYTES" {
		return fmt.Errorf("jwt.secret must be set to a strong random value (or set ADMIN_JWT_SECRET)")
	}
	// 长度强校验：HS256 推荐 ≥ 32 字节（256 bit），低于会被 jwt.Sign 兜底拒签
	if len(c.JWT.Secret) < 32 {
		return fmt.Errorf("jwt.secret must be ≥ 32 bytes")
	}
	// TTL 上限 24h：超过即视为配置错误（避免 yaml 写错出长效 token）
	if c.JWT.TTL <= 0 || c.JWT.TTL > 24*time.Hour {
		return fmt.Errorf("jwt.ttl must be in (0, 24h]")
	}
	if c.Lark.AppID == "" || c.Lark.AppSecret == "" {
		return fmt.Errorf("lark.app_id / app_secret required (or set ADMIN_LARK_APP_ID / ADMIN_LARK_APP_SECRET)")
	}
	if c.Lark.RedirectURI == "" {
		return fmt.Errorf("lark.redirect_uri required (must match Lark app whitelist exactly)")
	}
	// prod 环境强校 web-api 配置（DD-003 v3.1 B6）
	if c.Server.Env == "prod" {
		if c.Webapi.InternalURL == "" {
			return fmt.Errorf("webapi.internal_url required in prod (set WEBAPI_INTERNAL_URL)")
		}
		if c.Webapi.ServiceToken == "" {
			return fmt.Errorf("webapi.service_token required in prod (set WEBAPI_SERVICE_TOKEN)")
		}
	}
	return nil
}
