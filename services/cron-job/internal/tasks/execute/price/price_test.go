package price

import (
	"context"
	"testing"
	"time"

	"oddfi-cron-job/internal/logger"
)

func TestMain(m *testing.M) {
	_ = logger.Init("debug", "console")
	m.Run()
}

func TestGetReserves(t *testing.T) {
	// 使用 BSC 公共节点测试
	// endpoint := "https://bsc-dataseed.binance.org/"

	task := NewPriceTaskWithEndpoint()

	// 测试 Execute 方法
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	start := time.Now()
	err := task.Execute(ctx)
	duration := time.Since(start)

	if err != nil {
		t.Errorf("Execute failed: %v", err)
		return
	}

	t.Logf("Execute completed in %v", duration)
	t.Log("Test passed! Successfully fetched reserves from BSC UniswapV2 pair")
}
