package config

import (
	"log"
	"sync"

	"github.com/spf13/viper"
)

type Config struct {
	App        AppConfig
	MySQL      MySQLConfig
	Settlement SettlementConfig
	SportMonks SportMonksConfig
	Kafka      KafkaConfig
}

type AppConfig struct {
	Env string
}

type MySQLConfig struct {
	DSN    string
	Tables TableConfig
}

type SettlementConfig struct {
	UserID  uint64        `mapstructure:"user_id"`
	MockUCL MockUCLConfig `mapstructure:"mock_ucl"`
}

type MockUCLConfig struct {
	Enabled    bool   `mapstructure:"enabled"`
	FixtureID  int64  `mapstructure:"fixture_id"`
	PeriodSec  int    `mapstructure:"period_sec"`
	BetOpenSec int    `mapstructure:"bet_open_sec"`
	LockName   string `mapstructure:"lock_name"`
}

type TableConfig struct {
	Leagues        string
	Fixtures       string
	FixtureResults string `mapstructure:"fixture_results"`
	Odds           string
	Statistics     string
}
type SportMonksConfig struct {
	ApiToken string `mapstructure:"api_token"`
	BaseURL  string `mapstructure:"base_url"`
}

type KafkaConfig struct {
	Brokers []string
	Topic   string
}

var (
	AppConfigData *Config
	once          sync.Once
)

// GetConfig 确保配置只加载一次，且在被引用时自动初始化
func GetConfig() *Config {
	once.Do(func() {
		if AppConfigData == nil {
			// 这里可以设置一个默认路径，或者从环境变量读取
			LoadConfig("config/config.yaml")
		}
	})
	return AppConfigData
}

func LoadConfig(path string) {
	viper.SetConfigFile(path)
	viper.SetConfigType("yaml")

	if err := viper.ReadInConfig(); err != nil {
		log.Fatalf("读取配置文件失败: %v", err)
	}

	// 注意：这里要直接给全局变量赋值
	AppConfigData = &Config{}
	if err := viper.Unmarshal(AppConfigData); err != nil {
		log.Fatalf("解析配置失败: %v", err)
	}
	log.Println("✅ 配置文件加载成功")
}
