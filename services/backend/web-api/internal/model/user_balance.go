package model

import (
	"everything_finance/org/web-api/internal/config"
	"time"

	"github.com/shopspring/decimal"
)

// 用户 余额 记录表
type UserBalance struct {
	ID               uint64          `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	UserID           uint64          `gorm:"column:user_id;index" json:"user_id"`
	CoinSymbol       string          `gorm:"column:coin_symbol;size:20" json:"coin_symbol"`
	AvailableBalance decimal.Decimal `gorm:"column:available_balance;type:decimal(40,18);default:0" json:"available_balance"`
	ClaimableBalance decimal.Decimal `gorm:"column:claimable_balance;type:decimal(40,18);default:0" json:"claimable_balance"`
	FrozenBalance    decimal.Decimal `gorm:"column:frozen_balance;type:decimal(40,18);default:0" json:"frozen_balance"`
	BetLockBalance   decimal.Decimal `gorm:"column:bet_lock_balance;type:decimal(40,18);default:0" json:"bet_lock_balance"`
	StakeLockBalance decimal.Decimal `gorm:"column:stake_lock_balance;type:decimal(40,18);default:0" json:"stake_lock_balance"`
	LiqLockBalance   decimal.Decimal `gorm:"column:liq_lock_balance;type:decimal(40,18);default:0" json:"liq_lock_balance"`
	UpdateTime       time.Time       `gorm:"column:update_time;autoUpdateTime" json:"update_time"`
}

func (UserBalance) TableName() string {
	if config.Get().Server.Env == "dev" {
		return "user_balance_dev"
	}
	return "user_balance"
}
