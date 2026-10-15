package withdrawal

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

func TestWithdrawalTaskExecute(t *testing.T) {
	task := NewWithdrawalTask()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	start := time.Now()
	err := task.Execute(ctx)
	duration := time.Since(start)

	if err != nil {
		t.Errorf("Execute failed: %v", err)
		return
	}

	t.Logf("Execute completed in %v", duration)
	t.Log("Test passed! Withdrawal task executed successfully")
}
