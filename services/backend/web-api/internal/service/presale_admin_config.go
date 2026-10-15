// Package service — 预售全局配置 admin 业务层（DD-003 v3.1 B5）。
package service

import (
	"context"
	"fmt"
	"regexp"
	"strings"
	"time"

	"gorm.io/gorm"

	"everything_finance/org/web-api/internal/model"
	"everything_finance/org/web-api/internal/repository"

	"github.com/shopspring/decimal"
)

// ethAddressRegexp 校验以太坊地址格式（0x + 40 位十六进制）。
var ethAddressRegexp = regexp.MustCompile(`^0x[0-9a-fA-F]{40}$`)

// UpdateConfigRequest 是 PATCH /internal/admin/presale/config 的 DTO（全字段可选）。
type UpdateConfigRequest struct {
	TgeTs                *int64
	TgeOpenPriceUsd      *decimal.Decimal
	VaultAddress         *string
	MinSubscribeUsd      *decimal.Decimal
	BoundaryToleranceMin *int
	TotalTargetUsd       *decimal.Decimal
	AuditLabel           *string
	LarkWebhookUrl       *string
}

// UpdateConfigResult 是 UpdateConfig 的输出。
// Warning 非空时前端应展示（改 vault_address 需提示重启 presale-worker）。
type UpdateConfigResult struct {
	Config  *model.PresaleConfig
	Warning string
}

// PresaleAdminConfigService 封装全局配置读写。
type PresaleAdminConfigService interface {
	// GetConfig 读取全局配置（只读接口用）
	GetConfig(ctx context.Context) (*model.PresaleConfig, error)

	// GetConfigTx 在共享事务内读取配置（PATCH before 快照用）
	GetConfigTx(tx *gorm.DB) (*model.PresaleConfig, error)

	// UpdateConfig 更新配置字段，vault_address 变更时附带重启提示
	UpdateConfig(tx *gorm.DB, req *UpdateConfigRequest) (*UpdateConfigResult, error)
}

type presaleAdminConfigService struct {
	readRepo  repository.PresaleConfigRepository
	adminRepo repository.AdminPresaleConfigRepository
}

// NewPresaleAdminConfigService 构造默认实现。
func NewPresaleAdminConfigService(
	readRepo repository.PresaleConfigRepository,
	adminRepo repository.AdminPresaleConfigRepository,
) PresaleAdminConfigService {
	return &presaleAdminConfigService{readRepo: readRepo, adminRepo: adminRepo}
}

func (s *presaleAdminConfigService) GetConfig(ctx context.Context) (*model.PresaleConfig, error) {
	cfg, err := s.readRepo.Get(ctx)
	if err != nil {
		return nil, fmt.Errorf("[PresaleAdminConfigService] get config: %w", err)
	}
	// 出参 mask larkWebhookUrl，避免凭据通过响应外泄到任意 customer_service+ 角色浏览器
	// 注意：GetConfigTx（before 快照 / audit 用途）不 mask，保留真值用于审计对比
	out := *cfg
	out.LarkWebhookUrl = maskLarkWebhookURL(cfg.LarkWebhookUrl)
	return &out, nil
}

// maskLarkWebhookURL 将 Lark 自定义机器人 webhook 的 secret-uuid 段打码。
// 输入形如 https://open.larksuite.com/open-apis/bot/v2/hook/<uuid>，
// 输出形如 https://open.larksuite.com/open-apis/bot/v2/hook/****，保留前缀便于运营识别。
// nil / 空字符串 / 不含 /hook/ 的输入：原样返回（fallback 不破坏）。
func maskLarkWebhookURL(u *string) *string {
	if u == nil || *u == "" {
		return u
	}
	idx := strings.LastIndex(*u, "/hook/")
	if idx < 0 {
		return u
	}
	masked := (*u)[:idx+len("/hook/")] + "****"
	return &masked
}

func (s *presaleAdminConfigService) GetConfigTx(tx *gorm.DB) (*model.PresaleConfig, error) {
	cfg, err := s.adminRepo.GetForUpdate(tx)
	if err != nil {
		return nil, fmt.Errorf("[PresaleAdminConfigService] get config tx: %w", err)
	}
	return cfg, nil
}

// UpdateConfig 更新配置字段。
// vault_address 变更时附带 warning 提示运营同步 env + 重启 presale-worker。
func (s *presaleAdminConfigService) UpdateConfig(tx *gorm.DB, req *UpdateConfigRequest) (*UpdateConfigResult, error) {
	cfg, err := s.adminRepo.GetForUpdate(tx)
	if err != nil {
		return nil, fmt.Errorf("[PresaleAdminConfigService] get config for update: %w", err)
	}

	fields := map[string]any{
		"updated_at": time.Now().UnixMilli(),
	}
	var warning string

	if req.TgeTs != nil {
		fields["tge_ts"] = *req.TgeTs
		cfg.TgeTs = *req.TgeTs
	}
	if req.TgeOpenPriceUsd != nil {
		if req.TgeOpenPriceUsd.IsNegative() || req.TgeOpenPriceUsd.IsZero() {
			return nil, fmt.Errorf("[PresaleAdminConfigService] tge_open_price_usd must be > 0")
		}
		fields["tge_open_price_usd"] = *req.TgeOpenPriceUsd
		cfg.TgeOpenPriceUsd = *req.TgeOpenPriceUsd
	}
	if req.VaultAddress != nil {
		if !ethAddressRegexp.MatchString(*req.VaultAddress) {
			return nil, fmt.Errorf("[PresaleAdminConfigService] vault_address invalid: must be 0x + 40 hex chars")
		}
		lower := strings.ToLower(*req.VaultAddress)
		fields["vault_address"] = lower
		cfg.VaultAddress = lower
		// vault_address 变更必须提示运营同步 env PRESALE_VAULT_POOL + 重启 presale-worker
		warning = fmt.Sprintf(
			"vault_address updated to %s, but env PRESALE_VAULT_POOL must be synced and presale-worker restarted to take effect. "+
				"Old-address deposits remain valid (multi-address pool).",
			lower,
		)
	}
	if req.MinSubscribeUsd != nil {
		if req.MinSubscribeUsd.IsNegative() {
			return nil, fmt.Errorf("[PresaleAdminConfigService] min_subscribe_usd must be >= 0")
		}
		fields["min_subscribe_usd"] = *req.MinSubscribeUsd
		cfg.MinSubscribeUsd = *req.MinSubscribeUsd
	}
	if req.BoundaryToleranceMin != nil {
		if *req.BoundaryToleranceMin < 0 {
			return nil, fmt.Errorf("[PresaleAdminConfigService] boundary_tolerance_min must be >= 0")
		}
		fields["boundary_tolerance_min"] = *req.BoundaryToleranceMin
		cfg.BoundaryToleranceMin = *req.BoundaryToleranceMin
	}
	if req.TotalTargetUsd != nil {
		if req.TotalTargetUsd.IsNegative() || req.TotalTargetUsd.IsZero() {
			return nil, fmt.Errorf("[PresaleAdminConfigService] total_target_usd must be > 0")
		}
		fields["total_target_usd"] = *req.TotalTargetUsd
		cfg.TotalTargetUsd = *req.TotalTargetUsd
	}
	if req.AuditLabel != nil {
		fields["audit_label"] = *req.AuditLabel
		cfg.AuditLabel = req.AuditLabel
	}
	if req.LarkWebhookUrl != nil {
		fields["lark_webhook_url"] = *req.LarkWebhookUrl
		cfg.LarkWebhookUrl = req.LarkWebhookUrl
	}

	// 只有 updated_at，无实质字段改动，noop
	if len(fields) <= 1 {
		return &UpdateConfigResult{Config: cfg}, nil
	}

	if err := s.adminRepo.UpdateFields(tx, fields); err != nil {
		return nil, fmt.Errorf("[PresaleAdminConfigService] update config: %w", err)
	}
	cfg.UpdatedAt = time.Now().UnixMilli()

	return &UpdateConfigResult{Config: cfg, Warning: warning}, nil
}
