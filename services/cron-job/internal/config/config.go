package config

import (
	"os"
	"time"

	"github.com/spf13/viper"
)

var config *Config

// Config 应用配置
type Config struct {
	Env      string
	App      AppConfig
	Log      LogConfig
	Redis    RedisConfig
	MySQL    MySQLConfig
	Lark     LarkConfig
	Bsc      EvmConfig
	Odd      OddConfig
	Timezone string
}

// MySQLConfig MySQL配置
type MySQLConfig struct {
	DSN             string `mapstructure:"dsn"`
	MaxOpenConns    int    `mapstructure:"max_open_conns"`
	MaxIdleConns    int    `mapstructure:"max_idle_conns"`
	ConnMaxLifetime int    `mapstructure:"conn_max_lifetime"`
}

// LarkConfig 飞书通知配置
type LarkConfig struct {
	Withdrawal LarkWebhookConfig `mapstructure:"withdrawal"` // 提现通知正式群
}

// LarkWebhookConfig 飞书群机器人配置
type LarkWebhookConfig struct {
	Webhook string `mapstructure:"webhook"` // 飞书群机器人Webhook地址
}

// EvmConfig 以太坊配置
type EvmConfig struct {
	RPC string `mapstructure:"rpc"` // Ethereum JSON-RPC URL
}

// RedisConfig Redis配置
type RedisConfig struct {
	Addr string `mapstructure:"addr"`
}

// AppConfig 应用配置
type AppConfig struct {
	Port int `mapstructure:"port"`
}

// OddConfig ODD Token 配置
type OddConfig struct {
	TokenAddress              string `mapstructure:"token_address"`
	DistributeContractAddress string `mapstructure:"distribute_contract_address"`
	SenderPrivateKey          string `mapstructure:"sender_private_key"`
	TokenDec                  int    `mapstructure:"token_dec"`
}

// LogConfig 日志配置
type LogConfig struct {
	Level    string `mapstructure:"level"`
	Encoding string `mapstructure:"encoding"`
}

func GetConfig() *Config {
	return config
}

// Load 从文件加载配置
func Load(configPath string) (*Config, error) {
	viper.SetConfigName("config")
	viper.SetConfigType("yaml")
	viper.AddConfigPath(configPath)
	viper.AddConfigPath(".") // 当前目录

	// 设置默认值
	setDefaults()

	// 读取配置文件
	if err := viper.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return nil, err
		}
		// 配置文件不存在时使用默认值
	}

	var cfg Config
	if err := viper.Unmarshal(&cfg); err != nil {
		return nil, err
	}

	cfg.Env = "dev"

	if pk := os.Getenv("ODD_SENDER_PRIVATE_KEY"); pk != "" {
		cfg.Odd.SenderPrivateKey = pk
	}

	return &cfg, nil
}

// LoadByEnv 根据 ENV 环境变量加载配置
// ENV=prod 时加载 config_prod.yaml，否则加载 config.yaml（本地开发默认 dev）
func LoadByEnv() *Config {
	env := os.Getenv("ENV")

	cfg := &Config{}
	setDefaults()
	cfg.Env = env

	if env == "prod" {
		viper.SetConfigName("config_prod")
	} else if env == "dev" {
		viper.SetConfigName("config_dev")
	} else {
		viper.SetConfigName("config")
	}
	viper.SetConfigType("yaml")
	viper.AddConfigPath("internal/config")
	viper.AddConfigPath(".")

	if env == "" {
		env = "dev"
	}

	if err := viper.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			panic("load config failed: " + err.Error())
		}
		panic("config file not found: " + viper.ConfigFileUsed())
	}

	if err := viper.Unmarshal(cfg); err != nil {
		panic("unmarshal config failed: " + err.Error())
	}

	if pk := os.Getenv("ODD_SENDER_PRIVATE_KEY"); pk != "" {
		cfg.Odd.SenderPrivateKey = pk
	}

	config = cfg
	return cfg
}

func setDefaults() {
	viper.SetDefault("app.port", 8080)
	viper.SetDefault("log.level", "info")
	viper.SetDefault("log.encoding", "json")
	viper.SetDefault("timezone", "Asia/Shanghai")
	viper.SetDefault("redis.addr", "localhost:6379")
	viper.SetDefault("mysql.max_open_conns", 25)
	viper.SetDefault("mysql.max_idle_conns", 25)
	viper.SetDefault("mysql.conn_max_lifetime", 300)
	viper.SetDefault("odd.token_dec", 18)
}

// GetCronLocation 获取cron时区
func (c *Config) GetCronLocation() (*time.Location, error) {
	loc, err := time.LoadLocation(c.Timezone)
	if err != nil {
		// 失败时返回UTC
		return time.UTC, nil
	}
	return loc, nil
}
