package global

import (
	"fmt"
	"os"
	"sync/atomic"

	yaml "gopkg.in/yaml.v3"
)

const (
	LocalMode = "local"
	ProdMode  = "prod"
)

var backupCfg atomic.Pointer[Config]

func GetBackupConfig() *Config {
	cfg := backupCfg.Load()
	if cfg == nil {
		return &Config{}
	}
	return cfg
}

func LoadConfigByEnv() error {
	var cfg Config
	envStr := os.Getenv("ENV")
	if envStr != ProdMode {
		envStr = LocalMode
	}

	confStr, err := os.ReadFile(getConfigFile(envStr))
	if err != nil {
		return err
	}

	if err := yaml.Unmarshal(confStr, &cfg); err != nil {
		return err
	}

	backupCfg.Store(&cfg)

	return nil
}

func getConfigFile(mode string) string {
	return fmt.Sprintf("./configs/config-%s.yaml", mode)
}
