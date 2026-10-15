package model

import (
	"everything_finance/org/web-api/internal/config"

	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// PresaleConfig 预售全局配置（单行表，PK=1）
// vault_address 字段是运营友好可见字段；实际监听器源是 env PRESALE_VAULT_POOL（数组）
// 运营改 vault_address：admin 接口写表 + Lark 提示"请更新 env + 重启服务"
// CHECK (id=1) 约束在 MySQL 5.7 不支持，升级时去掉该约束，改用 GORM BeforeCreate 硬编码 id=1
type PresaleConfig struct {
	ID                   uint8           `gorm:"column:id;primaryKey"`
	TgeTs                int64           `gorm:"column:tge_ts;not null"`
	TgeOpenPriceUsd      decimal.Decimal `gorm:"column:tge_open_price_usd;not null;type:decimal(38,18)"`
	VaultAddress         string          `gorm:"column:vault_address;not null;type:varchar(42)"`
	MinSubscribeUsd      decimal.Decimal `gorm:"column:min_subscribe_usd;not null;type:decimal(20,6)"`
	BoundaryToleranceMin int             `gorm:"column:boundary_tolerance_min;not null;default:5"`
	TotalTargetUsd       decimal.Decimal `gorm:"column:total_target_usd;not null;type:decimal(38,18)"`
	AuditLabel           *string         `gorm:"column:audit_label;type:varchar(64)"`
	LarkWebhookUrl       *string         `gorm:"column:lark_webhook_url;type:varchar(255)"`
	UpdatedAt            int64           `gorm:"column:updated_at;not null;autoUpdateTime:milli"`
}

func (PresaleConfig) TableName() string {
	if config.Get().Server.Env == "dev" {
		return "presale_config_dev"
	}
	return "presale_config"
}

// BeforeCreate 硬编码 id=1：单行表约束从 SQL CHECK 下沉到 model 层
// 兼容 MySQL 5.7（无 CHECK 支持）+ 防止 GORM Create 误写 id≠1
func (c *PresaleConfig) BeforeCreate(_ *gorm.DB) error {
	c.ID = 1
	return nil
}
