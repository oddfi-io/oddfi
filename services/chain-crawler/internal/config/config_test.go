package config

import (
	"testing"
)

func TestMultiWorkerConfigFromFile(t *testing.T) {
	// 使用测试配置文件
	cfg := InitConfig("../../../configs/chaincrawler.dev.toml")

	// 获取有效配置
	multiWorkerConfig := cfg.GetEffectiveMultiWorkerConfig()

	if multiWorkerConfig.WorkerCount != 4 {
		t.Errorf("Expected WorkerCount to be 4, got %d", multiWorkerConfig.WorkerCount)
	}

	if multiWorkerConfig.ChunkSize != 5 {
		t.Errorf("Expected ChunkSize to be 5, got %d", multiWorkerConfig.ChunkSize)
	}

	if multiWorkerConfig.BlockStep != 20 {
		t.Errorf("Expected BlockStep to be 20, got %d", multiWorkerConfig.BlockStep)
	}
}
