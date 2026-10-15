package mysql_test

import (
	"context"
	"testing"
	"time"

	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/config"
	mysqlpkg "github.com/Crypto-Barrett/oddfi-admin-backend/internal/pkg/mysql"
)

// TestNew_PingFail 验证 DSN 不可达时启动失败有清晰错误。
// 成功路径需要真实 MySQL，放在手动联调阶段，不在 CI 单测里依赖外部服务。
func TestNew_PingFail(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	cfg := config.MySQLConfig{
		// 127.0.0.1:1 是几乎肯定不通的端口，触发 ping 失败路径
		DSN:             "admin:wrongpw@tcp(127.0.0.1:1)/oddfi?parseTime=true&timeout=500ms",
		MaxOpen:         5,
		MaxIdle:         1,
		ConnMaxLifetime: time.Hour,
	}

	_, _, err := mysqlpkg.New(ctx, cfg, nil)
	if err == nil {
		t.Fatal("expected ping error, got nil")
	}
}
