package mysql

import (
	"time"

	"github.com/shopspring/decimal"
)

// UserBalance 用户资产核心表
type UserBalance struct {
	ID               uint64          `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	UserID           uint64          `gorm:"column:user_id;not null;uniqueIndex:uk_user_coin" json:"user_id"`
	CoinSymbol       string          `gorm:"column:coin_symbol;type:varchar(20);not null;default:'';uniqueIndex:uk_user_coin" json:"coin_symbol"` // 币种标识, 如 BTC, USDT
	AvailableBalance decimal.Decimal `gorm:"column:available_balance;type:decimal(40,18);not null;default:0" json:"available_balance"`            // 可用余额
	FrozenBalance    decimal.Decimal `gorm:"column:frozen_balance;type:decimal(40,18);not null;default:0" json:"frozen_balance"`                  // 提现或业务冻结
	StakeLockBalance decimal.Decimal `gorm:"column:stake_lock_balance;type:decimal(40,18);not null;default:0" json:"stake_lock_balance"`          // 质押锁定
	LiqLockBalance   decimal.Decimal `gorm:"column:liq_lock_balance;type:decimal(40,18);not null;default:0" json:"liq_lock_balance"`              // 流动性锁定
	UpdateTime       time.Time       `gorm:"column:update_time;default:CURRENT_TIMESTAMP" json:"update_time"`
}

func (UserBalance) TableName() string {
	return "user_balance"
}
