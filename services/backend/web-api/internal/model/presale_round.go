package model

import (
	"everything_finance/org/web-api/internal/config"

	"github.com/shopspring/decimal"
)

// 轮次状态常量：cron 只推进 manual_override=0 的行
// 运营 pause/resume/reopen/close 都会设 manual_override=1，
// 这样避免 cron 把运营干预后的轮次状态自动回退
const (
	RoundStatusUpcoming = "upcoming"
	RoundStatusActive   = "active"
	RoundStatusPaused   = "paused"
	RoundStatusEnded    = "ended"
)

// 轮次类型常量
const (
	RoundTypePrivate = "private"
	RoundTypePublic  = "public"
)

// PresaleRound 预售轮次配置
// 状态机：upcoming → active → ended（cron 自动，manual_override=0 时有效）
//
//	active ↔ paused（运营手动，设 manual_override=1）
//	ended  → active（运营 reopen，设 manual_override=1）
//
// sold_odd ≤ supply_odd 不变量由 IncrSoldAndRaised 乐观条件保证
type PresaleRound struct {
	ID                 string           `gorm:"column:id;primaryKey;type:varchar(32)"`
	Name               string           `gorm:"column:name;not null;type:varchar(64)"`
	RoundType          string           `gorm:"column:round_type;not null;default:public;type:varchar(16)"`
	PriceUsd           decimal.Decimal  `gorm:"column:price_usd;not null;type:decimal(38,18)"`
	SupplyOdd          decimal.Decimal  `gorm:"column:supply_odd;not null;type:decimal(38,18)"`
	SoldOdd            decimal.Decimal  `gorm:"column:sold_odd;not null;default:0;type:decimal(38,18)"`
	RaisedUsd          decimal.Decimal  `gorm:"column:raised_usd;not null;default:0;type:decimal(38,18)"`
	TargetRaiseUsd     decimal.Decimal  `gorm:"column:target_raise_usd;not null;type:decimal(38,18)"`
	MinPerOrderUsd     *decimal.Decimal `gorm:"column:min_per_order_usd;type:decimal(20,6)"`
	MaxPerWalletUsd    *decimal.Decimal `gorm:"column:max_per_wallet_usd;type:decimal(20,6)"`
	TgeReleasePct      decimal.Decimal  `gorm:"column:tge_release_pct;not null;type:decimal(5,2)"`
	LinearReleaseDays  uint             `gorm:"column:linear_release_days;not null"`
	ReferralRewardPct  decimal.Decimal  `gorm:"column:referral_reward_pct;not null;default:10.0000;type:decimal(10,4)"`
	ReferralReleasePct decimal.Decimal  `gorm:"column:referral_release_pct;not null;default:100.00;type:decimal(5,2)"`
	ReferralLinearDays uint             `gorm:"column:referral_linear_days;not null;default:0"`
	StartTs            int64            `gorm:"column:start_ts;not null"`
	EndTs              int64            `gorm:"column:end_ts;not null"`
	Status             string           `gorm:"column:status;not null;default:upcoming;type:varchar(16)"`
	// ManualOverride=true 时 cron 不推进状态；所有运营写操作（pause/resume/reopen/close）必须同步置 true
	ManualOverride bool    `gorm:"column:manual_override;not null;default:0"`
	Badge          *string `gorm:"column:badge;type:varchar(16)"`
	SortOrder      int     `gorm:"column:sort_order;not null;default:0"`
	CreatedAt      int64   `gorm:"column:created_at;not null;autoCreateTime:milli"`
	UpdatedAt      int64   `gorm:"column:updated_at;not null;autoUpdateTime:milli"`
}

func (PresaleRound) TableName() string {
	if config.Get().Server.Env == "dev" {
		return "presale_round_dev"
	}
	return "presale_round"
}
