package service_test

import (
	"context"
	"errors"
	"testing"

	"gorm.io/gorm"

	"everything_finance/org/web-api/internal/model"
	"everything_finance/org/web-api/internal/repository"
	"everything_finance/org/web-api/internal/service"

	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// ─── mock repos ──────────────────────────────────────────────────────────────

type mockPresaleConfigReadRepo struct{ mock.Mock }

func (m *mockPresaleConfigReadRepo) Get(ctx context.Context) (*model.PresaleConfig, error) {
	args := m.Called(ctx)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.PresaleConfig), args.Error(1)
}

func (m *mockPresaleConfigReadRepo) Update(ctx context.Context, tx *gorm.DB, cfg *model.PresaleConfig) error {
	args := m.Called(ctx, tx, cfg)
	return args.Error(0)
}

type mockAdminPresaleConfigRepo struct{ mock.Mock }

func (m *mockAdminPresaleConfigRepo) GetForUpdate(tx *gorm.DB) (*model.PresaleConfig, error) {
	args := m.Called(tx)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.PresaleConfig), args.Error(1)
}

func (m *mockAdminPresaleConfigRepo) UpdateFields(tx *gorm.DB, fields map[string]any) error {
	args := m.Called(tx, fields)
	return args.Error(0)
}

func defaultConfig() *model.PresaleConfig {
	return &model.PresaleConfig{
		ID:                   1,
		TgeTs:                9_000_000,
		TgeOpenPriceUsd:      decimal.NewFromFloat(0.1),
		VaultAddress:         "0xabcdef1234567890abcdef1234567890abcdef12",
		MinSubscribeUsd:      decimal.NewFromInt(10),
		BoundaryToleranceMin: 5,
		TotalTargetUsd:       decimal.NewFromInt(1_000_000),
	}
}

// ─── GetConfig ───────────────────────────────────────────────────────────────

func TestPresaleAdminConfigService_GetConfig(t *testing.T) {
	readRepo := new(mockPresaleConfigReadRepo)
	adminRepo := new(mockAdminPresaleConfigRepo)
	readRepo.On("Get", mock.Anything).Return(defaultConfig(), nil)

	svc := service.NewPresaleAdminConfigService(readRepo, adminRepo)
	cfg, err := svc.GetConfig(context.Background())
	assert.NoError(t, err)
	assert.Equal(t, uint8(1), cfg.ID)
}

// 验证 GetConfig 出参对 larkWebhookUrl 做 mask，避免凭据通过 customer_service+ 角色泄漏。
// 同时检查未变副作用：不破坏 repo 内的原模型指针字段（shallow copy 保护）。
func TestPresaleAdminConfigService_GetConfig_MasksLarkWebhook(t *testing.T) {
	readRepo := new(mockPresaleConfigReadRepo)
	adminRepo := new(mockAdminPresaleConfigRepo)

	rawURL := "https://open.larksuite.com/open-apis/bot/v2/hook/abc123-secret-uuid"
	cfg := defaultConfig()
	cfg.LarkWebhookUrl = &rawURL
	readRepo.On("Get", mock.Anything).Return(cfg, nil)

	svc := service.NewPresaleAdminConfigService(readRepo, adminRepo)
	got, err := svc.GetConfig(context.Background())
	assert.NoError(t, err)
	assert.NotNil(t, got.LarkWebhookUrl)
	assert.Equal(t, "https://open.larksuite.com/open-apis/bot/v2/hook/****", *got.LarkWebhookUrl,
		"GetConfig 必须对 secret-uuid 段打码，仅保留 /hook/ 前缀")
	// 源模型未被污染（GetConfigTx 路径用于 audit before 快照，必须看到真值）
	assert.Equal(t, rawURL, *cfg.LarkWebhookUrl,
		"GetConfig 不得 in-place 修改 repo 返回的模型 — 否则 audit before 快照会丢真值")
}

// nil / 空 / 异常格式输入 mask 兜底
func TestPresaleAdminConfigService_GetConfig_MaskFallback(t *testing.T) {
	readRepo := new(mockPresaleConfigReadRepo)
	adminRepo := new(mockAdminPresaleConfigRepo)
	cfg := defaultConfig()
	cfg.LarkWebhookUrl = nil
	readRepo.On("Get", mock.Anything).Return(cfg, nil).Once()

	svc := service.NewPresaleAdminConfigService(readRepo, adminRepo)
	got, err := svc.GetConfig(context.Background())
	assert.NoError(t, err)
	assert.Nil(t, got.LarkWebhookUrl, "nil 输入应保持 nil")
}

func TestPresaleAdminConfigService_GetConfig_Error(t *testing.T) {
	readRepo := new(mockPresaleConfigReadRepo)
	adminRepo := new(mockAdminPresaleConfigRepo)
	readRepo.On("Get", mock.Anything).Return(nil, errors.New("db error"))

	svc := service.NewPresaleAdminConfigService(readRepo, adminRepo)
	_, err := svc.GetConfig(context.Background())
	assert.Error(t, err)
}

// ─── UpdateConfig ────────────────────────────────────────────────────────────

func TestPresaleAdminConfigService_UpdateConfig(t *testing.T) {
	tx := &gorm.DB{}

	cases := []struct {
		name        string
		req         service.UpdateConfigRequest
		expectErr   bool
		expectWarn  bool
		setupFields func(repo *mockAdminPresaleConfigRepo)
	}{
		{
			name: "success_tge_ts",
			req:  service.UpdateConfigRequest{TgeTs: ptrInt64(10_000_000)},
			setupFields: func(repo *mockAdminPresaleConfigRepo) {
				repo.On("GetForUpdate", tx).Return(defaultConfig(), nil)
				repo.On("UpdateFields", tx, mock.Anything).Return(nil)
			},
		},
		{
			name: "success_vault_address_with_warning",
			req: service.UpdateConfigRequest{
				VaultAddress: func() *string { s := "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"; return &s }(),
			},
			expectWarn: true,
			setupFields: func(repo *mockAdminPresaleConfigRepo) {
				repo.On("GetForUpdate", tx).Return(defaultConfig(), nil)
				repo.On("UpdateFields", tx, mock.Anything).Return(nil)
			},
		},
		{
			name:      "fail_invalid_vault_address",
			req:       service.UpdateConfigRequest{VaultAddress: func() *string { s := "notanaddress"; return &s }()},
			expectErr: true,
			setupFields: func(repo *mockAdminPresaleConfigRepo) {
				repo.On("GetForUpdate", tx).Return(defaultConfig(), nil)
			},
		},
		{
			name:      "fail_zero_tge_price",
			req:       service.UpdateConfigRequest{TgeOpenPriceUsd: ptrDecimal("0")},
			expectErr: true,
			setupFields: func(repo *mockAdminPresaleConfigRepo) {
				repo.On("GetForUpdate", tx).Return(defaultConfig(), nil)
			},
		},
		{
			name:      "fail_negative_min_subscribe",
			req:       service.UpdateConfigRequest{MinSubscribeUsd: ptrDecimal("-1")},
			expectErr: true,
			setupFields: func(repo *mockAdminPresaleConfigRepo) {
				repo.On("GetForUpdate", tx).Return(defaultConfig(), nil)
			},
		},
		{
			name:      "fail_negative_boundary_tolerance",
			req:       service.UpdateConfigRequest{BoundaryToleranceMin: func() *int { v := -1; return &v }()},
			expectErr: true,
			setupFields: func(repo *mockAdminPresaleConfigRepo) {
				repo.On("GetForUpdate", tx).Return(defaultConfig(), nil)
			},
		},
		{
			name:      "fail_get_config_error",
			req:       service.UpdateConfigRequest{TgeTs: ptrInt64(1)},
			expectErr: true,
			setupFields: func(repo *mockAdminPresaleConfigRepo) {
				repo.On("GetForUpdate", tx).Return(nil, errors.New("db error"))
			},
		},
		{
			name: "noop_no_fields",
			req:  service.UpdateConfigRequest{},
			setupFields: func(repo *mockAdminPresaleConfigRepo) {
				repo.On("GetForUpdate", tx).Return(defaultConfig(), nil)
				// UpdateFields should NOT be called for noop
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			readRepo := new(mockPresaleConfigReadRepo)
			adminRepo := new(mockAdminPresaleConfigRepo)
			tc.setupFields(adminRepo)

			svc := service.NewPresaleAdminConfigService(readRepo, adminRepo)
			result, err := svc.UpdateConfig(tx, &tc.req)

			if tc.expectErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, result)
				if tc.expectWarn {
					assert.NotEmpty(t, result.Warning)
				}
			}
			adminRepo.AssertExpectations(t)
		})
	}
}

// ─── Adversarial ─────────────────────────────────────────────────────────────

func TestPresaleAdminConfigService_Adversarial_InvalidAddressFormats(t *testing.T) {
	// 测试各种非法地址格式都被拒绝
	badAddresses := []string{
		"",
		"0x",
		"0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG", // 非十六进制
		"abcdef1234567890abcdef1234567890abcdef12",       // 缺少 0x
		"0xabcdef",                                        // 太短
		"0xabcdef1234567890abcdef1234567890abcdef1234",   // 太长
	}

	for _, addr := range badAddresses {
		t.Run("addr_"+addr, func(t *testing.T) {
			readRepo := new(mockPresaleConfigReadRepo)
			adminRepo := new(mockAdminPresaleConfigRepo)
			tx := &gorm.DB{}
			adminRepo.On("GetForUpdate", tx).Return(defaultConfig(), nil)

			a := addr
			svc := service.NewPresaleAdminConfigService(readRepo, adminRepo)
			_, err := svc.UpdateConfig(tx, &service.UpdateConfigRequest{VaultAddress: &a})
			assert.Error(t, err, "expected error for address: %s", addr)
		})
	}
}

// ─── helpers for config test ──────────────────────────────────────────────────

// ensure repository.PresaleConfigRepository is satisfied by mockPresaleConfigReadRepo
var _ repository.PresaleConfigRepository = (*mockPresaleConfigReadRepo)(nil)
var _ repository.AdminPresaleConfigRepository = (*mockAdminPresaleConfigRepo)(nil)
