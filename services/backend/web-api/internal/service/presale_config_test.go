package service_test

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
	"time"

	"everything_finance/org/web-api/internal/model"
	"everything_finance/org/web-api/internal/service"

	"github.com/redis/go-redis/v9"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// ===========================
// Mock PresaleConfigRepository
// ===========================

type mockPresaleConfigRepo struct {
	cfg *model.PresaleConfig
	err error
}

func (m *mockPresaleConfigRepo) Get(_ context.Context) (*model.PresaleConfig, error) {
	return m.cfg, m.err
}

func (m *mockPresaleConfigRepo) Update(_ context.Context, _ *gorm.DB, _ *model.PresaleConfig) error {
	return nil
}

// ===========================
// Mock PresaleRoundRepository（只用到 List 和 TotalRaisedUsd）
// ===========================

type mockPresaleRoundRepo struct {
	rounds      []*model.PresaleRound
	listErr     error
	totalRaised decimal.Decimal
	totalErr    error
}

func (m *mockPresaleRoundRepo) GetByID(_ context.Context, _ string) (*model.PresaleRound, error) {
	return nil, nil
}
func (m *mockPresaleRoundRepo) List(_ context.Context) ([]*model.PresaleRound, error) {
	return m.rounds, m.listErr
}
func (m *mockPresaleRoundRepo) ListActive(_ context.Context) ([]*model.PresaleRound, error) {
	return nil, nil
}
func (m *mockPresaleRoundRepo) ListAutoAdvanceable(_ context.Context, _ int64) ([]*model.PresaleRound, error) {
	return nil, nil
}
func (m *mockPresaleRoundRepo) AdvanceStatus(_ context.Context, _, _, _ string) error {
	return nil
}
func (m *mockPresaleRoundRepo) IncrSoldAndRaised(_ context.Context, _ *gorm.DB, _ string, _, _ decimal.Decimal) error {
	return nil
}
func (m *mockPresaleRoundRepo) FindUpcomingNearest(_ context.Context) (*model.PresaleRound, error) {
	return nil, nil
}
func (m *mockPresaleRoundRepo) TotalRaisedUsd(_ context.Context) (decimal.Decimal, error) {
	return m.totalRaised, m.totalErr
}

// ===========================
// Redis 测试客户端（使用 NewFailoverClient 打桩无法 mock，改用 miniredis 或直接测 DB 路径）
// ===========================

// newNoRedis 返回指向不存在地址的 redis.Client，确保 Get 必然返回 redis.Nil（缓存 miss）
func newNoRedis() *redis.Client {
	return redis.NewClient(&redis.Options{
		Addr: "localhost:0", // 端口 0 不可连，Get 返回错误，触发 DB fallback
	})
}

// ===========================
// 辅助构造
// ===========================

func newTestConfig() *model.PresaleConfig {
	tgePrice := decimal.NewFromFloat(0.1)
	auditLabel := "CertiK"
	return &model.PresaleConfig{
		ID:                   1,
		TgeTs:                1749571200000,
		TgeOpenPriceUsd:      tgePrice,
		VaultAddress:         "0xinv000000000000000000000000000000000a2f1",
		MinSubscribeUsd:      decimal.NewFromFloat(1000),
		BoundaryToleranceMin: 5,
		TotalTargetUsd:       decimal.NewFromFloat(20000000),
		AuditLabel:           &auditLabel,
	}
}

func newTestRound(id string, price float64, status string) *model.PresaleRound {
	badge := "hot"
	return &model.PresaleRound{
		ID:                id,
		Name:              "种子轮",
		RoundType:         model.RoundTypePrivate,
		PriceUsd:          decimal.NewFromFloat(price),
		SupplyOdd:         decimal.NewFromFloat(10000000),
		SoldOdd:           decimal.NewFromFloat(3450000),
		RaisedUsd:         decimal.NewFromFloat(103500),
		TargetRaiseUsd:    decimal.NewFromFloat(300000),
		TgeReleasePct:     decimal.NewFromFloat(10),
		LinearReleaseDays: 90,
		ReferralRewardPct: decimal.NewFromFloat(10),
		StartTs:           1747843200000,
		EndTs:             1749571200000,
		Status:            status,
		Badge:             &badge,
	}
}

// ===========================
// TestPresaleConfig_DBPath 缓存 miss 走 DB，返回正确字段
// ===========================

func TestPresaleConfig_DBPath(t *testing.T) {
	configRepo := &mockPresaleConfigRepo{cfg: newTestConfig()}
	roundRepo := &mockPresaleRoundRepo{
		rounds:      []*model.PresaleRound{newTestRound("seed", 0.03, model.RoundStatusActive)},
		totalRaised: decimal.NewFromFloat(8420000),
	}
	rdb := newNoRedis()
	svc := service.NewPresaleConfigService(configRepo, roundRepo, rdb, "0x55d398326f99059fF775485246999027B3197955")

	resp, err := svc.GetConfig(context.Background())
	if err != nil {
		t.Fatalf("GetConfig() error = %v", err)
	}

	// 验证 vault 字段
	if resp.Vault.DepositAddress != "0xinv000000000000000000000000000000000a2f1" {
		t.Errorf("vault.depositAddress = %q, want 0xinv...", resp.Vault.DepositAddress)
	}
	if resp.Vault.TotalRaisedUsd != "8420000" {
		t.Errorf("vault.totalRaisedUsd = %q, want 8420000", resp.Vault.TotalRaisedUsd)
	}
	if resp.Vault.BoundaryToleranceMin != 5 {
		t.Errorf("vault.boundaryToleranceMin = %d, want 5", resp.Vault.BoundaryToleranceMin)
	}
	if resp.Vault.Audit != "CertiK" {
		t.Errorf("vault.audit = %q, want CertiK", resp.Vault.Audit)
	}

	// 验证轮次
	if len(resp.Rounds) != 1 {
		t.Fatalf("len(rounds) = %d, want 1", len(resp.Rounds))
	}
	r := resp.Rounds[0]
	if r.ID != "seed" {
		t.Errorf("round.id = %q, want seed", r.ID)
	}
	if r.Status != model.RoundStatusActive {
		t.Errorf("round.status = %q, want active", r.Status)
	}

	// serverTs 应近似当前时间（允许 5s 误差）
	nowMs := time.Now().UnixMilli()
	if resp.ServerTs < nowMs-5000 || resp.ServerTs > nowMs+5000 {
		t.Errorf("serverTs = %d out of expected range near %d", resp.ServerTs, nowMs)
	}
}

// ===========================
// TestPresaleConfig_TgeDiscountPct 精度测试（decimal 18 位）
// ===========================

func TestPresaleConfig_TgeDiscountPct(t *testing.T) {
	cases := []struct {
		name         string
		tgePrice     string
		roundPrice   string
		expectPct    string // 精确字符串比较前两位确认计算正确
		expectPrefix string // 期望前缀（前端截断展示用）
	}{
		{
			name:       "seed round 0.03 vs tge 0.1",
			tgePrice:   "0.1",
			roundPrice: "0.03",
			// (0.1 - 0.03) / 0.1 * 100 = 70
			expectPrefix: "70",
		},
		{
			name:       "public round 0.07 vs tge 0.1",
			tgePrice:   "0.1",
			roundPrice: "0.07",
			// (0.1 - 0.07) / 0.1 * 100 = 30
			expectPrefix: "30",
		},
		{
			name:       "zero price returns 0",
			tgePrice:   "0",
			roundPrice: "0.03",
			// tge_open_price = 0，防止除零，返回 "0"
			expectPrefix: "0",
		},
		{
			name:       "round price equals tge price → 0% discount",
			tgePrice:   "0.1",
			roundPrice: "0.1",
			// (0.1 - 0.1) / 0.1 * 100 = 0
			expectPrefix: "0",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			tgePriceD, _ := decimal.NewFromString(tc.tgePrice)
			roundPriceD, _ := decimal.NewFromString(tc.roundPrice)

			cfg := newTestConfig()
			cfg.TgeOpenPriceUsd = tgePriceD

			round := newTestRound("seed", 0.03, model.RoundStatusActive)
			round.PriceUsd = roundPriceD

			configRepo := &mockPresaleConfigRepo{cfg: cfg}
			roundRepo := &mockPresaleRoundRepo{
				rounds:      []*model.PresaleRound{round},
				totalRaised: decimal.Zero,
			}
			rdb := newNoRedis()
			svc := service.NewPresaleConfigService(configRepo, roundRepo, rdb, "0xusdtaddr")

			resp, err := svc.GetConfig(context.Background())
			if err != nil {
				t.Fatalf("GetConfig() error = %v", err)
			}
			if len(resp.Rounds) == 0 {
				t.Fatal("no rounds in response")
			}

			pct := resp.Rounds[0].TgeDiscountPct
			// 检查字符串以 expectPrefix 开头（精确前缀匹配）
			if len(pct) < len(tc.expectPrefix) || pct[:len(tc.expectPrefix)] != tc.expectPrefix {
				t.Errorf("tgeDiscountPct = %q, want prefix %q", pct, tc.expectPrefix)
			}
		})
	}
}

// ===========================
// TestPresaleConfig_CacheHit 缓存命中路径：不调 DB
// ===========================

func TestPresaleConfig_CacheHit(t *testing.T) {
	// 准备一个预缓存响应
	cachedResp := &service.ConfigResponse{
		Vault: service.VaultInfo{
			DepositAddress: "0xcached",
			Chain:          "BSC",
			ChainID:        56,
		},
		Rounds:   []service.RoundInfo{},
		ServerTs: 1234567890000,
	}

	b, err := json.Marshal(cachedResp)
	if err != nil {
		t.Fatalf("marshal cached resp: %v", err)
	}

	// DB repo 返回错误，如果走了 DB 路径测试会失败
	configRepo := &mockPresaleConfigRepo{
		err: errors.New("should not be called"),
	}
	roundRepo := &mockPresaleRoundRepo{
		listErr: errors.New("should not be called"),
	}

	// 使用真实 Redis（如果 Redis 不可用则跳过此测试）
	rdb := redis.NewClient(&redis.Options{Addr: "127.0.0.1:6379"})
	ctx := context.Background()
	if _, pingErr := rdb.Ping(ctx).Result(); pingErr != nil {
		t.Skipf("Redis not available, skipping cache hit test: %v", pingErr)
	}
	defer func() {
		_ = rdb.Del(ctx, "presale:config:v1").Err()
		_ = rdb.Close()
	}()

	// 写入缓存
	if setErr := rdb.Set(ctx, "presale:config:v1", b, 30*time.Second).Err(); setErr != nil {
		t.Fatalf("set cache: %v", setErr)
	}

	svc := service.NewPresaleConfigService(configRepo, roundRepo, rdb, "0xusdtaddr")
	resp, err := svc.GetConfig(ctx)
	if err != nil {
		t.Fatalf("GetConfig() error = %v", err)
	}

	// 验证命中缓存（depositAddress 与缓存内容一致）
	if resp.Vault.DepositAddress != "0xcached" {
		t.Errorf("depositAddress = %q, want 0xcached (from cache)", resp.Vault.DepositAddress)
	}
}

// ===========================
// TestPresaleConfig_ConfigRepoError DB 错误向上传递
// ===========================

func TestPresaleConfig_ConfigRepoError(t *testing.T) {
	configRepo := &mockPresaleConfigRepo{
		err: errors.New("db connection failed"),
	}
	roundRepo := &mockPresaleRoundRepo{}
	rdb := newNoRedis()
	svc := service.NewPresaleConfigService(configRepo, roundRepo, rdb, "0xusdtaddr")

	_, err := svc.GetConfig(context.Background())
	if err == nil {
		t.Error("expected error from config repo, got nil")
	}
}
