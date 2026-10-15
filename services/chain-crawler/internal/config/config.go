package config

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"

	"chain_crawler/pkg/redis"

	"github.com/mitchellh/mapstructure"
	"github.com/nacos-group/nacos-sdk-go/clients"
	"github.com/nacos-group/nacos-sdk-go/common/constant"
	"github.com/nacos-group/nacos-sdk-go/vo"
	"github.com/pelletier/go-toml/v2"
	"github.com/spf13/viper"
)

type MySQLConfig struct {
	DSN  string `mapstructure:"dsn"`
	Mock bool   `mapstructure:"mock"`
}

type KafkaConfig struct {
	Group                      string `mapstructure:"group" toml:"group"`
	Host                       string `mapstructure:"host" toml:"host"`
	UserName                   string `mapstructure:"username" toml:"username"`
	Password                   string `mapstructure:"password" toml:"password"`
	TopicWeb3ChainEvmReal      string `mapstructure:"topic_web3chain_evm_real" toml:"topic_web3chain_evm_real"`
	TopicWeb3ChainEvmIncr      string `mapstructure:"topic_web3chain_evm_incr" toml:"topic_web3chain_evm_incr"`
	TopicWeb3ChainEvmBackward  string `mapstructure:"topic_web3chain_evm_backward" toml:"topic_web3chain_evm_backward"`
	TopicWeb3Chain             string `mapstructure:"topic_web3chain" toml:"topic_web3chain"`
	TopicWeb3ChainBtcBackward  string `mapstructure:"topic_web3chain_btc_backward" toml:"topic_web3chain_btc_backward"`
	TopicWeb3ChainTronIncr     string `mapstructure:"topic_web3chain_tron_incr" toml:"topic_web3chain_tron_incr"` // tron forward topic
	TopicWeb3ChainTronReal     string `mapstructure:"topic_web3chain_tron_real" toml:"topic_web3chain_tron_real"`
	TopicWeb3ChainTronBackward string `mapstructure:"topic_web3chain_tron_backward" toml:"topic_web3chain_tron_backward"`
	TopicWeb3ChainTonBackward  string `mapstructure:"topic_web3chain_ton_backward" toml:"topic_web3chain_ton_backward"`
	TopicWeb3ChainTonForward   string `mapstructure:"topic_web3chain_ton_forward" toml:"topic_web3chain_ton_forward"`
	TopicWeb3ChainSuiForward   string `mapstructure:"topic_web3chain_sui_forward" toml:"topic_web3chain_sui_forward"`
	TopicWeb3ChainSuiBackward  string `mapstructure:"topic_web3chain_sui_backward" toml:"topic_web3chain_sui_backward"`
}

type ChainConfig struct {
	Endpoint string `mapstructure:"endpoint" toml:"endpoint"`
	RPCKey   string `mapstructure:"rpc_key" toml:"rpc_key"`
}

type FullChainConfig struct {
	FullEndpoint string `mapstructure:"full_endpoint" toml:"full_endpoint"`
	FullRpcKey   string `mapstructure:"full_rpc_key" toml:"full_rpc_key"`
}

type TonChainConfig struct {
	ApiKey    string `mapstructure:"apikey"`
	QuickNode string `mapstructure:"quick_node"`
	NodeId    int    `mapstructure:"node_id"`
}

type SolanaConfig struct {
	RpcEndpoint string `mapstructure:"rpc_endpoint"`
}

type SubstrateChain struct {
	NodeEndpoint string `mapstructure:"node_endpoint"`
}

type LarkConfig struct {
	HookURL   string `mapstructure:"hook_url"`
	BotID     string `mapstructure:"bot_id"`
	BotSecret string `mapstructure:"bot_secret"`
	TestBotID string `mapstructure:"test_bot_id"`
}

// type NacosConfig struct {
// 	Ip          string `yaml:"ip" json:"ip"`
// 	Port        uint64 `yaml:"port" json:"port"`
// 	NamespaceId string `yaml:"namespaceId" json:"namespaceId"`
// 	Username    string `yaml:"username" json:"username"`
// 	Password    string `yaml:"password" json:"password"`
// }

type SUICustomConfig struct {
	Token     string   `mapstructure:"token"`
	Endpoints []string `mapstructure:"endpoints"`

	QPS   int `mapstructure:"qps"`   // 每秒请求数限制
	Burst int `mapstructure:"burst"` // 突发请求数限制

	WorkerCount int    `mapstructure:"worker_count"` // 线程数量
	ChunkSize   uint64 `mapstructure:"chunk_size"`   // 每个线程处理的区块数
	BlockStep   uint64 `mapstructure:"block_step"`   // 总的区块步长
}

// GetEffectiveMultiWorkerConfig 获取有效的多worker配置，仅从配置文件读取
func (cfg *Config) GetEffectiveMultiWorkerConfig() SUICustomConfig {
	return cfg.SuiCustomConfig
}

type LocalDebugConfig struct {
	Enabled           bool   `mapstructure:"enabled"`
	LocalChainsConfig string `mapstructure:"local_chains_config"`
	LocalNacosConfig  string `mapstructure:"local_nacos_config"`
}

// TraceConfig Trace配置结构
// 用于配置OpenTelemetry trace上报
type TraceConfig struct {
	ServiceName string `mapstructure:"service_name"` // 服务名称，用于在trace平台标识服务
	Endpoint    string `mapstructure:"endpoint"`     // trace上报地址，如：trace-dev-http.fulltrust.link:80
}

type Config struct {
	Env             string            `mapstructure:"env" toml:"env"`
	ListenAddr      string            `mapstructure:"listen_addr" toml:"listen_addr"`
	MySQL           MySQLConfig       `mapstructure:"mysql" toml:"mysql"` // msq 配置
	Kafka           KafkaConfig       `mapstructure:"kafka" toml:"kafka"`
	FullChain       FullChainConfig   `mapstructure:"full_chain" toml:"full_chain"`
	Redis           redis.RedisConfig `mapstructure:"redis" toml:"redis"`
	Solana          SolanaConfig      `mapstructure:"solana" toml:"solana"`
	SubstrateChain  SubstrateChain    `mapstructure:"substrate_chain" toml:"substrate_chain"`
	Lark            LarkConfig        `mapstructure:"lark" toml:"lark"`
	SuiCustomConfig SUICustomConfig   `mapstructure:"sui_custom_config" toml:"sui_custom_config"`
	LocalDebug      LocalDebugConfig  `mapstructure:"local_debug" toml:"local_debug"`
	// UserName        string            `mapstructure:"username" toml:"username"`
	// Password        string            `mapstructure:"password" toml:"password"`
	// Chain           ChainConfig       `mapstructure:"chain" toml:"chain"`
	// MetricsListenAddr string            `mapstructure:"metrics_listen_addr"`
	// TonChain TonChainConfig `mapstructure:"tonchain" toml:"tonchain"`
}

func InitConfig(configFileName ...string) Config {
	var config Config

	fileName := "chaincrawler"
	if len(configFileName) > 0 {
		fileName = configFileName[0]
	}
	viper.SetConfigName(fileName)     // name of config file (without extension)
	viper.SetConfigType("toml")       // REQUIRED if the config file does not have the extension in the name
	viper.AddConfigPath("./configs/") // path to look for the config file in
	err := viper.ReadInConfig()       // Find and read the config file
	if err != nil {                   // Handle errors reading the config file
		panic(fmt.Errorf("fatal error config file: %w", err))
	}

	if err := mapstructure.Decode(viper.AllSettings(), &config); err != nil {
		panic(fmt.Errorf("fatal error config file: %w", err))
	}
	return config
}

func (cfg *Config) IsTestEnv() bool {
	return cfg.Env == "test_tc" || cfg.Env == "dev_tc"
}

func (cfg *Config) IsProdEnv() bool {
	return cfg.Env == "prod_tc"
}

func (cfg *Config) IsDevEnv() bool {
	return cfg.Env == "dev"
}

// NacosConfig Nacos配置结构
type NacosConfig struct {
	Ip                  string
	Port                uint64
	Username            string
	Password            string
	NamespaceId         string
	DataId              string
	Group               string
	TimeoutMs           uint64
	NotLoadCacheAtStart bool
	LogDir              string
	CacheDir            string
	LogLevel            string
}

func InitNacosConfig() *Config {
	var config Config

	// 尝试从Nacos加载配置
	nacosConfig, err := InitNacosEnv()
	if err != nil {
		panic(fmt.Errorf("Failed to sync Nacos config: %w", err))
	}
	if err := syncNacosConf(&config, nacosConfig); err != nil {
		panic(fmt.Errorf("Failed to sync Nacos config: %w", err))
	}
	return &config
}

// InitNacosEnv 从环境变量初始化Nacos配置
func InitNacosEnv() (*NacosConfig, error) {
	if len(os.Getenv("NACOS_HOST")) > 0 {
		portUint64, err := strconv.ParseUint(os.Getenv("NACOS_PORT"), 10, 64)
		if err != nil {
			return nil, err
		}

		group := os.Getenv("NACOS_GROUP")
		if group == "" {
			group = "DEFAULT_GROUP"
		}

		return &NacosConfig{
			Ip:                  os.Getenv("NACOS_HOST"),
			Port:                portUint64,
			Username:            os.Getenv("NACOS_USERNAME"),
			Password:            os.Getenv("NACOS_PASSWORD"),
			NamespaceId:         os.Getenv("NACOS_NAMESPACE"),
			DataId:              os.Getenv("NACOS_DATA_ID"),
			Group:               group,
			TimeoutMs:           5000,
			NotLoadCacheAtStart: true,
			LogDir:              "./log/nacos",
			CacheDir:            "./cache/nacos",
			LogLevel:            "info",
		}, nil
	}
	return nil, errors.New("nacos env doesn't exist")
}

// syncNacosConf 同步Nacos配置
func syncNacosConf(config *Config, nacosConfig *NacosConfig) error {
	fmt.Printf("Syncing Nacos config from %s:%d\n", nacosConfig.Ip, nacosConfig.Port)

	// server conf
	sc := []constant.ServerConfig{
		{
			IpAddr: nacosConfig.Ip,
			Port:   nacosConfig.Port,
		},
	}
	// client conf
	cc := constant.ClientConfig{
		NamespaceId:         nacosConfig.NamespaceId,
		Username:            nacosConfig.Username,
		Password:            nacosConfig.Password,
		TimeoutMs:           nacosConfig.TimeoutMs,
		NotLoadCacheAtStart: nacosConfig.NotLoadCacheAtStart,
		LogDir:              nacosConfig.LogDir,
		CacheDir:            nacosConfig.CacheDir,
		LogLevel:            nacosConfig.LogLevel,
	}
	// init client
	client, err := clients.NewConfigClient(
		vo.NacosClientParam{
			ClientConfig:  &cc,
			ServerConfigs: sc,
		},
	)
	if err != nil {
		fmt.Printf("init nacos client err:%s\n", err.Error())
		return err
	}
	// get config
	content, err := client.GetConfig(vo.ConfigParam{
		DataId: nacosConfig.DataId,
		Group:  nacosConfig.Group,
	})
	if err != nil {
		fmt.Printf("get nacos config err:%v\n", err)
		return err
	}
	// 解析所有配置（第一次加载）
	if err := parseConfig(config, content); err != nil {
		fmt.Printf("load nacos config err:%s\n", err.Error())
		return err
	}
	// 监听配置变化
	err = client.ListenConfig(vo.ConfigParam{
		DataId: nacosConfig.DataId,
		Group:  nacosConfig.Group,
		OnChange: func(_, _, _, data string) {
			var tempConfig Config
			if err := parseConfig(&tempConfig, data); err != nil {
				fmt.Printf("update dynamic conf err:%s\n", err.Error())
				return
			}
			// 更新配置
			*config = tempConfig
			fmt.Printf("update dynamic conf success: %+v\n", config)
		},
	})

	return err
}

// parseConfig 解析配置
func parseConfig(config *Config, content string) error {
	// 创建临时viper实例解析配置
	tempViper := viper.New()
	tempViper.SetConfigType("toml")
	tempViper.ReadConfig(strings.NewReader(content))

	// 解析所有配置
	if err := mapstructure.Decode(tempViper.AllSettings(), config); err != nil {
		return fmt.Errorf("failed to decode config: %w", err)
	}

	return nil
}

func InitConfigByMode(ctx context.Context, mode string) *Config {
	var cfg Config

	file := InitReadFile(mode)
	data, err := os.ReadFile(file)
	if err != nil {
		panic(err)
	}

	err = toml.Unmarshal(data, &cfg)
	if err != nil {
		panic(err)
	}

	err = InitLocalDebugChainCrawlerConfig(ctx, "")
	if err != nil {
		panic(err)
	}

	return &cfg
}

func InitReadFile(mode string) string {
	return fmt.Sprintf("./configs/%s_config.toml", mode)
}
