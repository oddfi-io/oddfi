package nacos

import (
	"fmt"
	"github.com/nacos-group/nacos-sdk-go/clients"
	"github.com/nacos-group/nacos-sdk-go/clients/config_client"
	"github.com/nacos-group/nacos-sdk-go/common/constant"
	"github.com/nacos-group/nacos-sdk-go/vo"
)

const NacosDefaultGroup = "DEFAULT_GROUP"

type OnNacosConfigChange func(namespace, changedGroup, changedDataId, newData string)

type NacosConfig struct {
	Ip   string
	Port uint64

	// 此配置仅动态配置会用到，服务注册发现固定public，不用此字段
	NamespaceId string `json:",default=public"`
	// 此配置仅动态配置会用到
	Username            string `json:",default=nacos"`
	Password            string `json:",default=nacos"`
	TimeoutMs           uint64 `json:",default=5000"`
	NotLoadCacheAtStart bool   `json:",default=true"`
	LogDir              string `json:",default=/tmp/nacos/log"`
	CacheDir            string `json:",default=/tmp/nacos/cache"`
	LogLevel            string `json:",default=debug"`
}

type Client struct {
	cfg    *NacosConfig
	client config_client.IConfigClient
	group  string
}

func NewNacosClient(cfg *NacosConfig, group ...string) (*Client, error) {
	cc := constant.ClientConfig{
		NamespaceId:         cfg.NamespaceId, // namespace id
		Username:            cfg.Username,
		Password:            cfg.Password,
		TimeoutMs:           cfg.TimeoutMs,
		NotLoadCacheAtStart: cfg.NotLoadCacheAtStart,
		LogLevel:            cfg.LogLevel,
	}
	// server conf
	sc := []constant.ServerConfig{
		{
			IpAddr: cfg.Ip,
			Port:   cfg.Port,
		},
	}
	client, err := clients.NewConfigClient(
		vo.NacosClientParam{
			ClientConfig:  &cc,
			ServerConfigs: sc,
		},
	)
	if err != nil {
		return nil, fmt.Errorf("nacos.NewConfigClient error:%s", err)
	}
	g := NacosDefaultGroup
	if len(group) > 0 && group[0] != "" {
		g = group[0]
	}
	return &Client{
		cfg:    cfg,
		client: client,
		group:  g,
	}, nil
}

func (client *Client) GetConfig(dataId string) (string, error) {
	if client.client == nil {
		return "", fmt.Errorf("nacos client not initialized")
	}
	cfg, err := client.client.GetConfig(vo.ConfigParam{
		DataId: dataId,
		Group:  client.group,
	})
	if err != nil {
		return "", fmt.Errorf("nacos.GetConfig dataId:%s error:%s", dataId, err)
	}
	return cfg, nil
}

func (client *Client) ListenConfig(dataId string, onChange OnNacosConfigChange) error {
	if err := client.client.ListenConfig(vo.ConfigParam{
		DataId:   dataId,
		Group:    client.group,
		OnChange: onChange,
	}); err != nil {
		return fmt.Errorf("nacos.ListenConfig dataId:%s error:%s", dataId, err)
	}
	return nil
}
