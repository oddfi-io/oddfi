package config

import (
	"fmt"
	"log"
	"sync"

	"github.com/spf13/viper"
)

type Config struct {
	App        AppConfig        `yaml:"app"`
	MySQL      MySQLConfig      `yaml:"mysql"`
	SportMonks SportMonksConfig `yaml:"sport_monks"`
	Kafka      KafkaConfig      `yaml:"kafka"`
	Redis      RedisConfig      `yaml:"redis"`
}

type AppConfig struct {
	Env        string `mapstructure:"env"`
	MockEnable bool   `mapstructure:"mock_enable"`
}

type RedisConfig struct {
	Host     string `yaml:"host"`
	Port     int    `yaml:"port"`
	Password string `yaml:"password"`
	DB       int    `yaml:"db"`
	PoolSize int    `yaml:"pool_size"`
}

type MySQLConfig struct {
	DSN    string
	Tables TableConfig
}
type TableConfig struct {
	Leagues                   string
	Fixtures                  string
	Odds                      string
	Statistics                string
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

func (r *RedisConfig) Addr() string {
	return fmt.Sprintf("%s:%d", r.Host, r.Port)
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
