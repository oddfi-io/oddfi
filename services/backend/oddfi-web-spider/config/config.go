package config

import (
	"log"
	"sync"

	"github.com/spf13/viper"
)

type Config struct {
	App        AppConfig
	MySQL      MySQLConfig
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
type TableConfig struct {
	Leagues                   string `mapstructure:"leagues"`
	Fixtures                  string `mapstructure:"fixtures"`
	Odds                      string `mapstructure:"odds"`
	Statistics                string `mapstructure:"statistics"`
	States                    string `mapstructure:"states"`
	FixtureResults            string `mapstructure:"fixture_results"`
	MoneylineSnapshots        string `mapstructure:"moneyline_snapshots"`
	MoneylineCollectionStatus string `mapstructure:"moneyline_collection_status"`
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
