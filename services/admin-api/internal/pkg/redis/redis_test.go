package redis_test

import (
	"context"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"

	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/config"
	redispkg "github.com/Crypto-Barrett/oddfi-admin-backend/internal/pkg/redis"
)

// TestNew_Success 用 miniredis 跑成功路径，确保连接、ping、cleanup 都正常。
func TestNew_Success(t *testing.T) {
	mr := miniredis.RunT(t)
	ctx := context.Background()

	cfg := config.RedisConfig{Addr: mr.Addr(), DB: 0}
	client, cleanup, err := redispkg.New(ctx, cfg, nil)
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	t.Cleanup(func() { _ = cleanup() })

	if err := client.Set(ctx, "k", "v", 0).Err(); err != nil {
		t.Fatalf("set: %v", err)
	}
	got, err := client.Get(ctx, "k").Result()
	if err != nil || got != "v" {
		t.Fatalf("get: %v / %q", err, got)
	}
}

// TestNew_PingFail 用不可达地址触发 ping 失败路径。
func TestNew_PingFail(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	cfg := config.RedisConfig{Addr: "127.0.0.1:1", DB: 0}
	_, _, err := redispkg.New(ctx, cfg, nil)
	if err == nil {
		t.Fatal("expected ping error, got nil")
	}
}
