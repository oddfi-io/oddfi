package model

import (
	"everything_finance/org/web-api/internal/config"

	"github.com/shopspring/decimal"
)

// HoldingSource 区分持仓来源：认购投入 vs 邀请奖励
// referral 行的 invested_usd / locked_price_avg 恒为 0（奖励是凭空发的，无成本价语义）
const (
	HoldingSourceInvest   = 1 // 认购投入（source=invest）
	HoldingSourceReferral = 2 // 邀请奖励（source=referral）
)

// PresaleHolding 预售持仓聚合
// 本期只维护 total_odd / invested_usd / locked_price_avg 三个核心字段
// released_odd / claimed_odd / vesting_start_ts / vesting_end_ts 字段保留，合约就绪后再填充
//
// 加权平均成本价公式（upsert 时原子计算）：
//
//	new_avg = (old_total × old_avg + delta × price) / (old_total + delta)
//
// 此公式在 MySQL ON DUPLICATE KEY UPDATE 单语句中实现，避免 SELECT-then-UPDATE 竞态
type PresaleHolding struct {
	ID             uint64          `gorm:"column:id;primaryKey;autoIncrement"`
	UserID         uint64          `gorm:"column:user_id;not null;uniqueIndex:uk_user_round_source"`
	RoundID        string          `gorm:"column:round_id;not null;uniqueIndex:uk_user_round_source;type:varchar(32)"`
	Source         int8            `gorm:"column:source;not null;uniqueIndex:uk_user_round_source"`
	TotalOdd       decimal.Decimal `gorm:"column:total_odd;not null;default:0;type:decimal(38,18)"`
	InvestedUsd    decimal.Decimal `gorm:"column:invested_usd;not null;default:0;type:decimal(38,18)"`
	LockedPriceAvg decimal.Decimal `gorm:"column:locked_price_avg;not null;default:0;type:decimal(38,18)"`
	// 以下字段本期不维护，schema 保留供 vesting/claim 接入时使用
	ReleasedOdd   decimal.Decimal `gorm:"column:released_odd;not null;default:0;type:decimal(38,18)"`
	ClaimedOdd    decimal.Decimal `gorm:"column:claimed_odd;not null;default:0;type:decimal(38,18)"`
	VestingStartTs *int64         `gorm:"column:vesting_start_ts"`
	VestingEndTs   *int64         `gorm:"column:vesting_end_ts"`
	CreatedAt      int64          `gorm:"column:created_at;not null;autoCreateTime:milli"`
	UpdatedAt      int64          `gorm:"column:updated_at;not null;autoUpdateTime:milli"`
}

func (PresaleHolding) TableName() string {
	if config.Get().Server.Env == "dev" {
		return "presale_holding_dev"
	}
	return "presale_holding"
}
